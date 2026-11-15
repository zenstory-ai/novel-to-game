// 界面图标：一套同线宽的线描 SVG，颜色跟随文字色。
const PATHS = {
  backlog: '<path d="M6 4h10a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2z"/><path d="M6 18a2 2 0 0 1 2-2h10M9.5 8h5M9.5 11.5h5"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M10.2 8.6v6.8l5.4-3.4z"/>',
  skip: '<path d="M5 6.5l6 5.5-6 5.5zM12.5 6.5l6 5.5-6 5.5z"/>',
  rollback: '<path d="M8 5.5L4.5 9 8 12.5"/><path d="M4.5 9H14a5 5 0 0 1 0 10h-3.5"/>',
  save: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1z"/>',
  qsave: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1z"/><path d="M12 7.5v5M9.8 10.5l2.2 2.2 2.2-2.2"/>',
  qload: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1z"/><path d="M12 12.7v-5M9.8 9.7L12 7.5l2.2 2.2"/>',
  load: '<path d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2.2h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  hide: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>',
  tree: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8M8 6h4a4 4 0 0 1 4 4v0M8 18h4a4 4 0 0 0 4-4v0"/>',
  lamp: '<path d="M9 3.5h6M12 3.5V6M8 6h8l1.5 3.5v6L16 19H8l-1.5-3.5v-6z"/><path d="M12 10.5c1.4 1.3 1.8 2.6 1 3.8a1.4 1.4 0 0 1-2 0c-.8-1.2-.4-2.5 1-3.8zM10 19v1.5h4V19"/>',
  gallery: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 15.5l4.5-4.5 4 4 2.5-2.5 6 5"/><circle cx="15.5" cy="9.3" r="1.3"/>',
  settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  home: '<path d="M4 11.5L12 4.5l8 7"/><path d="M6.5 10v9.5h11V10M10 19.5v-5h4v5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  prev: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  trash: '<path d="M5 7h14M9.5 7V4.8h5V7M7 7l.8 12.5h8.4L17 7M10.3 10.5v6M13.7 10.5v6"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
}
