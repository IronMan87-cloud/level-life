"""Run with Python Playwright and Chromium against a localhost HTTP server."""
from datetime import datetime
import os
from playwright.sync_api import expect, sync_playwright

ORIGIN = os.getenv("LEVEL_TEST_URL", "http://127.0.0.1:8765/")
CHROMIUM = os.getenv("LEVEL_CHROMIUM", "/usr/bin/chromium")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=CHROMIUM, args=["--no-sandbox"])
    context = browser.new_context(
        viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True,
        timezone_id="America/Los_Angeles", reduced_motion="reduce",
    )
    context.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.clock.install(time=datetime.fromisoformat("2026-11-18T13:30:00+00:00"))
    page.add_init_script("""if (!localStorage.getItem('level-life-v1')) {
      localStorage.setItem('level-life-v1', JSON.stringify({
        starterApplied:true, dailyTemplateDate:'2026-11-17', activityXP:90,
        tasks:[
          {id:'priority',title:'Важный тестовый квест',date:'2026-11-18',priority:'Главный результат',done:false},
          {id:'legacy',title:'Старый выполненный квест',date:'2026-11-17',done:true},
          {id:'replaced',title:'Заменённый тестовый квест',date:'2026-11-18',replaced:true}
        ],
        habits:[{id:'habit',title:'Тестовая привычка',logs:[]}],
        futureField:{retained:true}
      }));
    }""")
    page.goto(ORIGIN)
    today = page.locator("#page-home")
    expect(today.get_by_role("heading", name="Сегодня", exact=True)).to_be_visible()
    expect(page.locator("#statTasks")).to_have_text("0/1")
    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
    expect(page.locator("#today")).to_contain_text("18")
    today.get_by_role("button", name="Важный тестовый квест").click()
    expect(page.locator("#dayXP")).to_have_text("10")
    expect(page.locator("#rewardNote")).to_contain_text("Уровень 2")
    today.get_by_role("button", name="Важный тестовый квест").click()
    today.get_by_role("button", name="Важный тестовый квест").click()
    expect(page.locator("#dayXP")).to_have_text("10")
    expect(page.locator("#toast")).to_contain_text("XP уже получен")

    today.get_by_role("button", name="＋ Квест").click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    page.keyboard.press("Escape")
    expect(dialog).to_be_hidden()
    expect(today.get_by_role("button", name="＋ Квест")).to_be_focused()

    page.locator(".nav [data-page=quests]").click()
    expect(page.get_by_role("button", name="Заменённый тестовый квест")).to_be_disabled()
    for _ in range(2):
        page.get_by_role("button", name="Старый выполненный квест").click()
    assert page.evaluate("db.activityXP") == 100

    page.locator(".nav [data-page=home]").click()
    today.get_by_role("button", name="Отметить привычку").click()
    page.evaluate("toggleHabit('habit');toggleHabit('habit');toggleHabit('habit')")
    assert page.evaluate("db.activityXP") == 105
    page.evaluate("addReward()")
    page.locator("#rewardTitle").fill("Тестовая награда")
    page.locator("#rewardCondition").fill("Закончить работу")
    page.get_by_role("button", name="Добавить награду").click()
    assert page.evaluate("db.rewards[0].title") == "Тестовая награда"

    page.clock.fast_forward(31 * 60 * 1000)
    page.evaluate("refreshDay();ensureDailyTasks()")
    assert page.evaluate("db.tasks.filter(task => task.date === '2026-11-18').length") == 10
    page.evaluate("navigator.serviceWorker.ready")
    page.wait_for_function("navigator.serviceWorker.controller")
    context.set_offline(True)
    page.reload()
    expect(page.locator("#page-home h1")).to_have_text("Сегодня")
    expect(page.locator("#dayXP")).to_have_text("15")
    assert page.evaluate("db.futureField.retained")
    assert page.evaluate("db.rewards.length") == 1
    context.set_offline(False)
    # The in-browser stub changes the remote timestamp between SELECT and UPDATE.
    page.evaluate("""async () => {
      syncUser = {id: 'fixture-account'};
      const before = '2026-11-18T12:00:00Z', after = '2026-11-18T12:01:00Z';
      let remote = { payload: { tasks: [], goals: [] }, updated_at: before };
      let attempts = 0;
      supabaseClient = { from() {
        const conditions = {};
        let pending;
        return {
          select() { return this; },
          eq(field, value) { conditions[field] = value; return this; },
          update(value) { pending = value; return this; },
          insert() { throw new Error('INSERT must not run for an existing snapshot'); },
          async maybeSingle() {
            if (conditions.user_id !== 'fixture-account') throw new Error('Missing account filter');
            if (!pending) return {data: remote, error: null};
            if (++attempts === 1) remote = {...remote, updated_at: after};
            if (conditions.updated_at !== remote.updated_at) return {data: null, error: null};
            remote = pending;
            return {data: remote, error: null};
          }
        };
      }};
      writeSyncMeta({userId: syncUser.id, remoteUpdatedAt: before, dirty: true});
      await syncNow();
      if (syncConflictData?.updated_at !== after || !readSyncMeta().dirty || remote.payload.tasks.length)
        throw new Error('Concurrent cloud snapshot was not protected');
      await resolveSyncConflict('local');
      if (syncConflictData || readSyncMeta().dirty || !remote.payload.futureField.retained)
        throw new Error('Explicit local conflict resolution did not preserve the local snapshot');
    }""")
    assert not errors, errors
    browser.close()
print("Mobile, persistence, XP, daily rollover, offline and cloud-conflict smoke passed")
