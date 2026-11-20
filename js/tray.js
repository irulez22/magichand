/* Magic Hand Play - the scene tray: instant game switching at the bottom of
   the screen, plus a direct way into the parent settings. It is DOM chrome, not
   gameplay: pointer events here never reach the canvas. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';

  /* The tray follows MG.GameTitles (registry.js), so adding a game there puts it
     in the switcher automatically. The fallback keeps the tray usable if the
     registry is ever loaded late. */
  function gameList() {
    var fallback = [
      { id: 'balloons', name: 'Magic Balloons' },
      { id: 'garden', name: 'Magic Garden' },
      { id: 'stars', name: 'Reach for the Stars' },
      { id: 'painting', name: 'Magic Painting' },
      { id: 'photos', name: 'Picture Pairs' },
      { id: 'goats', name: 'Three Goats' }
    ];
    if (!MG.GameTitles) return fallback;
    return Object.keys(MG.GameTitles).map(function (id) {
      return { id: id, name: MG.GameTitles[id] };
    });
  }

  var Tray = {
    root: null,
    app: null,
    buttons: [],
    _inset: 0,
    _built: false
  };

  MG.Tray = Tray;

  Tray.build = function () {
    if (Tray._built) return;
    Tray._built = true;

    var root = document.createElement('div');
    root.id = 'scene-tray';
    root.className = 'scene-tray';
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'Choose a game');

    var gameButtons = gameList().map(function (g) {
      return '<button type="button" class="tray-game" data-game="' + g.id + '"' +
        ' aria-label="' + g.name + '" title="' + g.name + '">' + MG.Icons.game(g.id) + '</button>';
    }).join('');

    root.innerHTML = '<div class="tray-games">' + gameButtons + '</div>';

    document.body.appendChild(root);
    Tray.root = root;
    Tray.buttons = Array.prototype.slice.call(root.querySelectorAll('[data-game]'));

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-game]');
      if (!b) return;
      MG.Settings.set('game', b.dataset.game);
    });
  };

  Tray.measure = function () {
    if (!Tray.root) { Tray._inset = 0; return 0; }
    var r = Tray.root.getBoundingClientRect();
    var margin = Math.max(0, window.innerHeight - r.bottom);
    Tray._inset = Math.ceil(r.height + margin + 10);
    return Tray._inset;
  };

  /* Space the scene layout must leave free at the bottom of the screen. */
  Tray.inset = function () {
    return Tray.measure();
  };

  Tray.sync = function (game) {
    for (var i = 0; i < Tray.buttons.length; i++) {
      var b = Tray.buttons[i];
      var on = b.dataset.game === game;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  };

  Tray.init = function (app) {
    Tray.app = app;
    Tray.build();
    Tray.sync(MG.Settings.data.game);
    MG.Settings.subscribe(function (s) { Tray.sync(s.game); });
  };
})(window.MG);
