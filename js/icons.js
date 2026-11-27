/* Magic Hand Play - shared line icons (procedural SVG, no image files). */
window.MG = window.MG || {};
(function (MG) {
  'use strict';

  var GAME_ICONS = {
    balloons: '<circle cx="8.5" cy="8" r="4.2"/><circle cx="16" cy="6.6" r="3.2"/><path d="M8.5 12.2v2.2c0 2.4-2.2 3.4-2.2 5.6"/><path d="M16 9.8v2c0 2.2 1.8 3.2 1.8 5.2"/>',
    garden: '<circle cx="12" cy="8.4" r="2.1"/><path d="M12 10.5v9.2"/><path d="M12 15.2c-3.2 0-4.8-1.7-4.8-4.1 2.6 0 4.8 1.3 4.8 4.1Z"/><path d="M12 16.9c0-2.6 2-3.9 4.6-3.9 0 2.3-1.7 3.9-4.6 3.9Z"/><path d="M9.7 6.3a3.1 3.1 0 0 1 4.6 0"/>',
    stars: '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8Z"/>',
    painting: '<path d="M12 3.8c-4.6 0-8.2 3.4-8.2 7.9 0 4.3 3.4 7.9 8.2 7.9 1.5 0 2-1 1.5-2-.6-1.3.2-2.4 1.7-2.4h1.7c2 0 3.5-1.6 3.5-3.6 0-4.3-3.9-7.8-8.4-7.8Z"/><circle cx="8" cy="10" r=".95" fill="currentColor" stroke="none"/><circle cx="11.6" cy="7.6" r=".95" fill="currentColor" stroke="none"/><circle cx="15.4" cy="9" r=".95" fill="currentColor" stroke="none"/>',
    photos: '<rect x="3.4" y="5.6" width="13" height="11.4" rx="2"/><path d="m3.6 14.4 3.6-3.4 3.2 3"/><path d="m7.2 8.9 1.5 0"/><rect x="8.2" y="8.2" width="12.4" height="10.6" rx="2" fill="#1a1229"/><path d="m8.6 16.4 3.6-3.4 3.4 3.2"/><circle cx="18.1" cy="11.4" r="1.05"/>',
    goats: '<path d="M9.2 8.2C7.4 6.4 5.6 6 4.4 6.6c.7 1.9 1.9 2.8 3.8 3"/><path d="M14.8 8.2c1.8-1.8 3.6-2.2 4.8-1.6-.7 1.9-1.9 2.8-3.8 3"/><path d="M8.4 11.2c0-2 1.6-3.6 3.6-3.6s3.6 1.6 3.6 3.6v1.6c0 1.2-.9 2.1-2.1 2.1h-3c-1.2 0-2.1-.9-2.1-2.1z"/><path d="M12 14.9v2.5"/><path d="M10.6 11.4h.01M13.4 11.4h.01"/>',
    car: '<path d="M4 15.4h16"/><path d="M5.7 15.4v-3.2l2.1-3.1h8.4l2.1 3.1v3.2"/><path d="M7.8 9.1h8.4"/><path d="M9.7 12.2h4.6"/><circle cx="7.9" cy="15.4" r="1.4"/><circle cx="16.1" cy="15.4" r="1.4"/>',
    piano: '<rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2"/><path d="M3.4 13.4h17.2"/><path d="M7.4 5.6v7.8M11.3 5.6v7.8M15.2 5.6v7.8M19.1 5.6v7.8"/><path d="M5.6 13.6v5M9.4 13.6v5M13.2 13.6v5M17 13.6v5"/>'
  };

  var ACTION_ICONS = {
    menu: '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 15h3"/><path d="M11 15h9"/><circle cx="9" cy="15" r="2"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2.4"/><path d="M8.4 10V7.6a3.6 3.6 0 0 1 7.2 0V10"/>',
    chevron: '<path d="m6 14 6-6 6 6"/>'
  };

  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  MG.Icons = {
    game: function (id) { return svg(GAME_ICONS[id] || GAME_ICONS.balloons); },
    action: function (name) { return svg(ACTION_ICONS[name] || ACTION_ICONS.menu); }
  };
})(window.MG);
