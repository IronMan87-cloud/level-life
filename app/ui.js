const paths = {
  logo: 'M2 20l7-9 4 5 3-4 6 8H2zm7-12 3-4 4 6',
  home: 'M3 10l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z',
  calendar: 'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm3 9h2m4 0h2m-8 4h2',
  growth: 'M3 20h18M6 16V9m6 7V4m6 12v-5m-1-4 2 2 3-4',
  target: 'M21 12a9 9 0 1 1-9-9m6 9a6 6 0 1 1-6-6m0 6 8-8m-4 0h4v4',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'm9 18 6-6-6-6',
  check: 'm5 12 4 4L19 6',
  circle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  star: 'm12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2zm7 14v5m-2.5-2.5h5',
  bolt: 'M13 2 3 14h8l-1 8L21 9h-8l1-7z',
  book: 'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v14',
  shield: 'M12 22S4 18 4 10V5l8-3 8 3v5c0 8-8 12-8 12zm-3-10 2 2 4-4',
  close: 'm6 6 12 12M18 6 6 18',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9-5v5l3 2',
  moon: 'M20.9 13.5A9 9 0 0 1 10.5 3.1 9 9 0 1 0 20.9 13.5z',
  sun: 'M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-14v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19',
  flag: 'M5 21V4c4-4 8 4 14 0v10c-6 4-10-4-14 0',
  edit: 'm14 6 4 4M4 20l4-1 12-12-4-4L4 15z',
  journal: 'M5 20h15V4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2zm-2-2a2 2 0 0 1 2-2h15M8 8h8m-8 4h5',
  settings: 'M4 7h16M4 17h16M9 4v6m6 4v6',
  wallet: 'M20 8V5H5a2 2 0 0 0-2 2v12h18V8H5m16 4h-5v4h5',
  heart: 'M12 20 4 12C0 7 6 2 10 6l2 2 2-2c4-4 10 1 6 6l-8 8Z',
  cloud: 'M7 18h11a4 4 0 1 0-1-8 6 6 0 0 0-11-1 4.5 4.5 0 0 0 1 9z',
};

export function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.circle}"/></svg>`;
}

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export const attr = esc;
export const opt = (value, label, selected) =>
  `<option value="${attr(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;
export const button = (action, label, glyph = '', style = 'secondary', id = '') =>
  `<button type="button" class="button ${style}" data-action="${attr(action)}" data-id="${attr(id)}">${glyph ? icon(glyph, 17) : ''}${esc(label)}</button>`;
export const iconButton = (action, label, glyph, id = '') =>
  `<button type="button" class="icon-button" aria-label="${attr(label)}" title="${attr(label)}" data-action="${attr(action)}" data-id="${attr(id)}">${icon(glyph, 18)}</button>`;
export const field = (label, control) => `<label class="field"><span>${esc(label)}</span>${control}</label>`;
export const input = (name, value = '', more = '') => `<input name="${name}" value="${attr(value)}" ${more}>`;
export const area = (name, value = '', more = '') => `<textarea name="${name}" maxlength="12000" ${more}>${esc(value)}</textarea>`;
export const select = (name, choices, value = '') => `<select name="${name}">${choices.map(([id, title]) => opt(id, title, value)).join('')}</select>`;
export const panelHead = (title, action = '') => `<div class="panel-head"><h2>${esc(title)}</h2>${action}</div>`;
export const empty = (glyph, title, detail, action = '') =>
  `<div class="empty"><span class="empty-icon">${icon(glyph, 23)}</span><div><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>${action}</div>`;

export function dateLabel(date, options = { day: 'numeric', month: 'long' }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Без даты';
  const time = new Date(date + 'T12:00:00Z');
  if (!Number.isFinite(+time)) return 'Без даты';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', ...options }).format(time);
}
