import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = read('index.html');
for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  new vm.Script(script[1], { filename: 'index.html' });
}
for (const path of ['level-advanced.js', 'level-autopilot.js', 'sw.js']) {
  new vm.Script(read(path), { filename: path });
}
const ids = [...html.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.scope, './');
for (const path of ['level-mobile.css', 'level-advanced.js', 'level-autopilot.js', 'manifest.webmanifest', ...manifest.icons.map(icon => icon.src.slice(2))]) {
  assert.ok(read(path).length);
  assert.ok(read('sw.js').includes('./' + path), 'Missing shell entry for ' + path);
}
console.log('Static checks passed');
