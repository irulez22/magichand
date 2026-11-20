/* Magic Hand Play - parent / therapist dashboard. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var Settings = MG.Settings;
  var Metrics = MG.Metrics;

  var ui = {
    root: null,
    body: null,
    nav: null,
    tab: 'play',
    lastTab: null,
    app: null,
    labTouch: null,
    labRaf: 0,
    maxSeen: 0,
    thumbUrls: [],
    built: false
  };

  var GAMES = [
    { id: 'balloons', name: 'Magic Balloons', desc: 'Glowing lanterns drift through the night. Any contact makes one burst.' },
    { id: 'garden', name: 'Magic Garden', desc: 'Every touch blooms a flower and wakes the fireflies.' },
    { id: 'stars', name: 'Reach for the Stars', desc: 'Glowing stars placed inside a comfortable reach.' },
    { id: 'painting', name: 'Magic Painting', desc: 'Light trails and colour that glows on the dark.' },
    { id: 'photos', name: 'Picture Pairs', desc: 'Your own photos drift by. Hold the same picture on both sides to catch it.' },
    { id: 'goats', name: 'Three Goats', desc: 'The three goats cross the bridge. The troll asks who is tramping; a touch lets each goat answer.' }
  ];

  /* Icons live in js/icons.js so the dashboard and the scene tray share one set. */

  var SIZES = [
    { v: 'xlarge', l: 'Very large' },
    { v: 'large', l: 'Large' },
    { v: 'medium', l: 'Medium' }
  ];

  var ACTIVATION = [
    { v: 'new', l: 'New touch' },
    { v: 'continuous', l: 'Continuous' },
    { v: 'dwell', l: 'Dwell' }
  ];

  var REWARD = [
    { v: 'low', l: 'Low' },
    { v: 'medium', l: 'Medium' },
    { v: 'high', l: 'High' }
  ];

  var ANIM = [
    { v: 'stationary', l: 'Still' },
    { v: 'slow', l: 'Slow' },
    { v: 'normal', l: 'Normal' }
  ];

  var SOUND = [
    { v: 'off', l: 'Off' },
    { v: 'quiet', l: 'Quiet' },
    { v: 'normal', l: 'Normal' }
  ];

  var VISUAL = [
    { v: 'calm', l: 'Calm' },
    { v: 'standard', l: 'Standard' }
  ];

  var REACH = [
    { v: 1, l: '1 · closest' },
    { v: 2, l: '2' },
    { v: 3, l: '3 · middle' },
    { v: 4, l: '4' },
    { v: 5, l: '5 · furthest' }
  ];

  /* ------------------------------------------------------------- helpers */

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function pct(v) { return Math.round(v * 100) + '%'; }
  function secs(v) { return (Math.round(Number(v) * 100) / 100).toFixed(2) + ' s'; }

  function fmt(kind, v) {
    if (kind === 'pct') return pct(v);
    if (kind === 'sec') return secs(v);
    if (kind === 'reach') {
      var found = null;
      REACH.forEach(function (r) { if (Number(r.v) === Number(v)) found = r; });
      return found ? found.l.split(' ')[0] + ' / 5' : v;
    }
    if (kind === 'bool') return v ? 'On' : 'Off';
    return String(v);
  }

  function seg(path, current, opts, type) {
    return '<div class="seg">' + opts.map(function (o) {
      var on = String(o.v) === String(current);
      return '<button type="button" class="' + (on ? 'on' : '') + '" data-set="' + path + '"' +
        ' data-value="' + esc(o.v) + '"' + (type ? ' data-type="' + type + '"' : '') + '>' + esc(o.l) + '</button>';
    }).join('') + '</div>';
  }

  function toggle(path, on) {
    return '<button type="button" class="toggle ' + (on ? 'on' : '') + '"' +
      ' data-set="' + path + '" data-value="' + (on ? 'false' : 'true') + '" data-type="bool">' +
      '<span class="knob"></span><span>' + (on ? 'On' : 'Off') + '</span></button>';
  }

  function slider(path, value, min, max, step, kind) {
    return '<div class="slider-row">' +
      '<input type="range" data-set="' + path + '" data-type="number" data-fmt="' + kind + '"' +
      ' min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">' +
      '<output>' + fmt(kind, value) + '</output></div>';
  }

  function field(label, hint, control) {
    return '<div class="field"><div class="field-head"><span class="field-label">' + esc(label) + '</span>' +
      (hint ? '<span class="field-hint">' + esc(hint) + '</span>' : '') + '</div>' +
      (control ? '<div class="field-control">' + control + '</div>' : '') + '</div>';
  }

  function card(title, stepNo, lead, inner) {
    return '<section class="card"><h2>' + (stepNo ? '<span class="step">' + stepNo + '</span>' : '') + esc(title) + '</h2>' +
      (lead ? '<p class="lead">' + lead + '</p>' : '') + inner + '</section>';
  }

  function toast(msg) {
    var el = document.getElementById('mg-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mg-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* --------------------------------------------------------------- build */

  function build() {
    if (ui.built) return;
    ui.built = true;

    var root = document.createElement('div');
    root.className = 'overlay';
    root.id = 'parent-screen';
    root.hidden = true;
    root.innerHTML =
      '<header class="parent-header">' +
        '<div class="brand">' +
          '<div class="brand-mark"></div>' +
          '<div><h1>Magic Hand Play</h1><p>Parent &amp; therapist settings · everything stays on this PC</p></div>' +
        '</div>' +
        '<div class="header-actions">' +
          '<button type="button" class="btn ghost" data-action="fullscreen">Fullscreen</button>' +
          '<button type="button" class="btn primary" data-action="start">Start playing</button>' +
          '<button type="button" class="btn" data-action="close">Back to play</button>' +
        '</div>' +
      '</header>' +
      '<nav class="tabs" id="parent-tabs">' +
        '<button type="button" data-tab="play">Play</button>' +
        '<button type="button" data-tab="pictures">Pictures</button>' +
        '<button type="button" data-tab="access">Accessibility</button>' +
        '<button type="button" data-tab="calibrate">Calibration</button>' +
        '<button type="button" data-tab="touch">Touch test</button>' +
        '<button type="button" data-tab="data">Progress</button>' +
        '<button type="button" data-tab="help">Help</button>' +
      '</nav>' +
      '<main class="parent-body" id="parent-body"></main>';

    document.body.appendChild(root);

    ui.root = root;
    ui.body = root.querySelector('#parent-body');
    ui.nav = root.querySelector('#parent-tabs');

    ui.nav.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (b) {
        ui.tab = b.dataset.tab;
        syncTabs();
        renderTab();
      }
    });

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-set]');
      if (b && b.tagName === 'BUTTON') {
        var type = b.dataset.type;
        var value = b.dataset.value;
        apply(b.dataset.set, value, type);
        if (b.dataset.quiet === '1') return;
        renderTab();
        return;
      }
      var act = e.target.closest('[data-action]');
      if (act) doAction(act.dataset.action, act.dataset.arg);
    });

    ui.body.addEventListener('input', function (e) {
      var el = e.target;
      if (el.matches('input[type="range"][data-set]')) {
        apply(el.dataset.set, el.value, 'number');
        var out = el.parentNode.querySelector('output');
        if (out) out.textContent = fmt(el.dataset.fmt, Number(el.value));
        if (ui.tab === 'access') drawZonePreview();
      }
    });

    ui.root.addEventListener('change', function (e) {
      if (!e.target || e.target.id !== 'pic-files') return;
      var files = e.target.files;
      if (!files || !files.length) return;
      toast('Adding pictures…');
      MG.Pictures.addFiles(files).then(function (n) {
        toast(n + ' picture' + (n === 1 ? '' : 's') + ' added');
        if (ui.app && ui.app.mode === 'parent') ui.app.newGame();
        refreshPictures();
        e.target.value = '';
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ui.root && !ui.root.hidden) {
        if (MG.Calibration && MG.Calibration.isOpen()) return;
        doAction('close');
      }
    });
  }

  function syncTabs() {
    Array.prototype.forEach.call(ui.nav.querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.dataset.tab === ui.tab);
    });
  }

  function apply(path, value, type) {
    var v = value;
    if (type === 'number') v = Number(value);
    if (type === 'bool') v = value === 'true' || value === true;
    Settings.set(path, v);
  }

  function doAction(action, arg) {
    var s = Settings.data;
    if (action === 'close') {
      closeUI();
      if (ui.app) ui.app.backToPlay(false);
    } else if (action === 'start') {
      closeUI();
      if (ui.app) ui.app.backToPlay(true);
    } else if (action === 'fullscreen') {
      if (ui.app) ui.app.goFullscreen();
    } else if (action === 'calibrate') {
      if (MG.Calibration) MG.Calibration.open(ui.app, false);
    } else if (action === 'pick-pictures') {
      var input = document.getElementById('pic-files');
      if (input) input.click();
    } else if (action === 'clear-pictures') {
      if (window.confirm('Remove all pictures from this browser? The built-in doodles will be used.')) {
        MG.Pictures.clear().then(function () {
          if (ui.app && ui.app.mode === 'parent') ui.app.newGame();
          refreshPictures();
          toast('Pictures cleared');
        });
      }
    } else if (action === 'test-sound') {
      MG.Audio.unlock();
      MG.Audio.play('chime', 4);
      setTimeout(function () { MG.Audio.play('bloom', 5); }, 260);
    } else if (action === 'reset-zone') {
      s.zone = { width: 0.6, height: 0.86, offsetX: 0.02, offsetY: 0.07 };
      s.swapSides = false;
      Settings.save(true);
      Settings.emit();
      renderTab();
      toast('Play area reset');
    } else if (action === 'reset-settings') {
      if (window.confirm('Reset every setting to its default? Recorded interaction metrics are kept.')) {
        Settings.reset();
        renderTab();
        toast('Settings reset');
      }
    } else if (action === 'clear-data') {
      if (window.confirm('Delete all locally recorded interaction metrics? This cannot be undone.')) {
        Metrics.reset();
        renderTab();
        toast('Recorded metrics deleted');
      }
    }
  }

  /* -------------------------------------------------------------- render */

  function renderTab() {
    if (!ui.body) return;
    var entering = ui.tab !== ui.lastTab;
    ui.lastTab = ui.tab;
    destroyLab();
    revokeThumbs();
    if (ui.tab === 'touch' && entering) ui.maxSeen = 0;

    var html = '';
    if (ui.tab === 'play') html = renderPlay();
    else if (ui.tab === 'pictures') html = renderPictures();
    else if (ui.tab === 'access') html = renderAccess();
    else if (ui.tab === 'calibrate') html = renderCalibrate();
    else if (ui.tab === 'touch') html = renderTouch();
    else if (ui.tab === 'data') html = renderData();
    else html = renderHelp();

    ui.body.innerHTML = html;

    if (ui.tab === 'access') drawZonePreview();
    if (ui.tab === 'touch') setupLab();
    if (ui.tab === 'data') drawHeat();
    if (ui.tab === 'pictures') refreshPictures();
  }

  function renderPictures() {
    return card('Picture Pairs', '',
      'Choose a folder of your own pictures. They drift across both halves of the screen; the child catches a picture by holding <b>the same picture</b> on both sides at the same time.',
      '<div class="actions">' +
        '<button type="button" class="btn primary" data-action="pick-pictures">Choose pictures folder</button>' +
        '<button type="button" class="btn ghost" data-action="clear-pictures">Clear pictures</button>' +
      '</div>' +
      '<div class="note">Pictures are copied into this browser on this PC and downscaled to 512 pixels. Nothing is uploaded. Until you add pictures, the game uses friendly built-in doodles, and it also works with any mix of photos and drawings.</div>' +
      '<div id="pic-grid" class="pic-grid"><div class="note">Loading…</div></div>' +
      '<input type="file" id="pic-files" accept="image/*" webkitdirectory multiple style="display:none">') +
      card('How this scene works', '',
        'A two-handed matching activity.',
        '<ol class="steps">' +
          '<li><span class="num">1</span><span>Each picture appears twice: once on the left half, once on the right half.</span></li>' +
          '<li><span class="num">2</span><span>The child holds one copy with the left hand and the matching copy with the right hand.</span></li>' +
          '<li><span class="num">3</span><span>When both are held at the same time for a moment, the pair is caught and a new picture drifts in.</span></li>' +
        '</ol>' +
        '<div class="note">The switch/lamp is not used in this scene, so both halves are active at once. Target size changes the picture size; reward sensitivity changes how long the pair must be held.</div>');
  }

  function revokeThumbs() {
    if (ui.thumbUrls && ui.thumbUrls.length) {
      ui.thumbUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
    }
    ui.thumbUrls = [];
  }

  function refreshPictures() {
    var grid = document.getElementById('pic-grid');
    if (!grid) return;
    revokeThumbs();
    Promise.resolve(MG.Pictures.thumbs()).then(function (list) {
      if (!document.getElementById('pic-grid')) return;
      if (!list || !list.length) {
        grid.innerHTML = '<div class="note">No pictures yet — the game uses friendly doodles.</div>';
        return;
      }
      ui.thumbUrls = list.map(function (x) { return x.url; });
      grid.innerHTML = list.map(function (x) {
        return '<figure class="pic-tile"><img src="' + x.url + '" alt=""><figcaption>' + esc(x.name) + '</figcaption></figure>';
      }).join('');
    }).catch(function () {
      if (grid) grid.innerHTML = '<div class="note">Pictures could not be read in this browser.</div>';
    });
  }

  function renderPlay() {
    var s = Settings.data;
    var games = GAMES.map(function (g) {
      return '<button type="button" class="game-card ' + (s.game === g.id ? 'on' : '') + '"' +
        ' data-set="game" data-value="' + g.id + '">' +
        '<span class="ico">' + MG.Icons.game(g.id) + '</span>' +
        '<span class="name">' + esc(g.name) + '</span>' +
        '<span class="desc">' + esc(g.desc) + '</span></button>';
    }).join('');

    var running = ui.app && ui.app.session && ui.app.session.running;

    var sessionInner =
      field('Session length', 'A calm ending, never a countdown.', seg('sessionMinutes', s.sessionMinutes, [
        { v: 2, l: '2 min' }, { v: 5, l: '5 min' }, { v: 10, l: '10 min' }, { v: 0, l: 'Unlimited' }
      ], 'number')) +
      '<div class="actions">' +
        '<button type="button" class="btn primary" data-action="start">Start playing</button>' +
        '<button type="button" class="btn ghost" data-action="close">' + (running ? 'Return without stopping' : 'Back to play') + '</button>' +
        '<span class="chip">' + (running ? 'Session in progress' : 'Ready to play') + '</span>' +
      '</div>' +
      '<div class="note">The timer starts when the button is first held. Releasing the button pauses gently and never counts as a mistake.</div>';

    return card('Choose a game', '1', 'Touch the card, then press <b>Start playing</b>. You can change this at any time.',
        '<div class="game-grid">' + games + '</div>') +
      card('Session', '2', 'Keep sessions short and comfortable. Stop whenever the child wants to.', sessionInner);
  }

  function renderAccess() {
    var s = Settings.data;

    var holdCard = card('The hold button', '1',
      'The right side of the screen is a big round hold button. While it is held, the play side wakes up. Letting go dims it gently — there is no failure message.',
      field('Button style', 'The hand image is an alternative to the round button.', seg('holdMetaphor', s.holdMetaphor, [
        { v: 'light', l: 'Big button' }, { v: 'hand', l: 'Hand rest' }
      ])) +
      field('Require the hold button', s.holdRequired ? 'The child must hold the button for the game to stay awake.' : 'The game stays awake on its own.', toggle('holdRequired', s.holdRequired)) +
      field('Pause delay after letting go', 'A short grace period so a wobble does not dim the game.', slider('holdGrace', s.holdGrace, 0, 4, 0.1, 'sec')) +
      '<div class="note">Hold with the right hand, the left hand, or both — the game only knows <b>where</b> the screen is touched, never which hand it is. The hold area is always the large side the parent chooses.</div>');

    var playCard = card('Play area and reach', '2',
      'Move the play area to wherever the left hand can comfortably reach. Nothing is dragged or dropped — just touch.',
      '<div class="grid2">' +
        '<div class="preview-wrap"><canvas id="zone-preview" class="preview"></canvas>' +
        '<div class="preview-caption">Live layout preview. The round button is on the warm side.</div></div>' +
        '<div>' +
          field('Play area width', null, slider('zone.width', s.zone.width, 0.34, 0.84, 0.01, 'pct')) +
          field('Play area height', null, slider('zone.height', s.zone.height, 0.36, 0.96, 0.01, 'pct')) +
          field('Distance from edge', 'Horizontal inset of the play area.', slider('zone.offsetX', s.zone.offsetX, 0, 0.4, 0.01, 'pct')) +
          field('Height position', 'Vertical inset of the play area.', slider('zone.offsetY', s.zone.offsetY, 0, 0.4, 0.01, 'pct')) +
        '</div>' +
      '</div>' +
      field('Swap sides', 'Put the play area on the other half of the screen and the button on the left.', toggle('swapSides', s.swapSides)) +
      '<div class="actions"><button type="button" class="btn ghost" data-action="reset-zone">Reset layout</button></div>' +
      '<div class="note">For a left arm that reaches best near the body, keep the play area close to the button side or use a wider play area. Adjust until the child can reach without leaning or stretching.</div>');

    var touchCard = card('How touches count', '3',
      'Touch modes decide how often one contact gives a reward. Every mode is forgiving: a palm, a knuckle or a whole hand works.',
      field('Touch activation', null, seg('activation', s.activation, ACTIVATION)) +
      field('Dwell time', 'Only used when activation is set to Dwell. The ring around the contact shows progress.', slider('dwellTime', s.dwellTime, 0.25, 3, 0.05, 'sec')) +
      field('Reward from any touch', 'If nothing is under the hand, the nearest target still responds. This guarantees a reward from a single contact.', toggle('anyTouch', s.anyTouch)) +
      field('Reward sensitivity', 'High makes targets and hit areas larger and rewards arrive sooner.', seg('reward', s.reward, REWARD)) +
      '<div class="note good">With "New touch" a fresh contact always gives a reward once. Moving the hand further than a short threshold gives another, so sweeping also works.</div>');

    var targetCard = card('Targets', '4',
      'Very large targets are easier to see and hit. Stars are placed only as far as you choose — never automatically.',
      field('Target size', null, seg('targetSize', s.targetSize, SIZES)) +
      field('Star reach (Reach for the Stars)', '1 places stars closest to the button side; 5 reaches further across.', slider('starReach', s.starReach, 1, 5, 1, 'reach')) +
      '<div class="note warn">Reach is only changed here, by you. The game never moves targets further away based on how well the child is doing.</div>');

    var feelCard = card('Motion, colour and sound', '5', 'Gentle by default. No flashing, no sudden loud sounds, no countdown.',
      field('Animation speed', 'Affects background movement. Reward animations stay short and clear.', seg('animation', s.animation, ANIM)) +
      field('Visual stimulation', 'Calm uses softer colours and fewer particles.', seg('visual', s.visual, VISUAL)) +
      field('Sound', null, seg('sound', s.sound, SOUND)) +
      '<div class="actions"><button type="button" class="btn" data-action="test-sound">Test sound</button>' +
      '<button type="button" class="btn ghost" data-action="reset-settings">Reset all settings</button></div>' +
      field('On-screen words', 'Show short labels such as "Hold" on the button.', toggle('showHints', s.showHints)));

    return holdCard + playCard + touchCard + targetCard + feelCard;
  }

  function renderCalibrate() {
    var hw = Settings.data.hardware;
    var stepsDone = [
      { n: '1', text: 'Test the hold button', done: !!hw.rightTested },
      { n: '2', text: 'Test the play side', done: !!hw.leftTested },
      { n: '3', text: 'Test both at the same time', done: !!hw.bothTested },
      { n: '4', text: 'Find a comfortable reach', done: !!hw.reachTested },
      { n: '5', text: 'Choose target size and save', done: !!Settings.data.calibrated }
    ];
    var list = stepsDone.map(function (s) {
      return '<li class="' + (s.done ? 'done' : '') + '"><span class="num">' + (s.done ? '✓' : s.n) + '</span><span>' + esc(s.text) + '</span></li>';
    }).join('');

    return card('Calibration', '', 'A short guide for the first run, and whenever the tablet or monitor changes. Go at the child\'s pace — there is nothing to pass.',
        '<ol class="steps">' + list + '</ol>' +
        '<div class="actions">' +
          '<button type="button" class="btn primary" data-action="calibrate">' + (Settings.data.calibrated ? 'Run calibration again' : 'Start calibration') + '</button>' +
        '</div>' +
        '<div class="note">Calibration only records whether this screen reports one touch, two touches, and a wide palm contact. It never asks the child to hold a position for long, and it saves nothing outside this PC.</div>') +
      card('Recorded hardware notes', '',
        'What this touchscreen reported during testing.',
        '<div class="chips">' +
          '<span class="chip">Most contacts at once <b>' + (hw.maxSimultaneous || 0) + '</b></span>' +
          '<span class="chip">Palm contact <b>' + (hw.palmTested ? 'detected' : 'not confirmed') + '</b></span>' +
          '<span class="chip">Knuckle contact <b>' + (hw.knuckleTested ? 'detected' : 'not confirmed') + '</b></span>' +
        '</div>' +
        '<div class="note warn">Some touchscreens ignore palms, report them as a mouse, or limit simultaneous contacts. Software cannot override the hardware. Test on the device you will use, with the child\'s own hand positions.</div>');
  }

  function renderTouch() {
    var s = Settings.data;
    var hw = s.hardware;
    return card('Touch test', '',
      'Use the real touchscreen. Place a palm, a knuckle, the side of a hand and several fingers on the panel below. Every contact this screen reports appears as a dot.',
      '<div class="grid2">' +
        '<div>' +
          '<canvas id="lab-canvas" class="preview"></canvas>' +
          '<div class="chips" style="margin-top:10px">' +
            '<span class="chip">Contacts now <b id="lab-now">0</b></span>' +
            '<span class="chip">Most at once <b id="lab-max">' + (ui.maxSeen || hw.maxSimultaneous || 0) + '</b></span>' +
            '<span class="chip">Pointer types <b id="lab-types">–</b></span>' +
          '</div>' +
          '<div class="preview-caption">Circles show exactly what the browser received. A dot that never appears means the hardware or driver did not report that contact.</div>' +
        '</div>' +
        '<div>' +
          '<ol class="steps">' +
            '<li><span class="num">1</span><span>One finger, then the whole hand flat on the screen.</span></li>' +
            '<li><span class="num">2</span><span>Try a knuckle and the side of the hand.</span></li>' +
            '<li><span class="num">3</span><span>Hold the button with one hand and touch the play side with the other. Both dots must appear together.</span></li>' +
            '<li><span class="num">4</span><span>If palms or second touches never appear, keep targets large, or turn off the hold button.</span></li>' +
          '</ol>' +
          '<div class="actions">' +
            '<button type="button" class="toggle ' + (hw.palmTested ? 'on' : '') + '" data-set="hardware.palmTested" data-value="' + (!hw.palmTested) + '" data-type="bool">' +
              '<span class="knob"></span><span>Palm works</span></button>' +
            '<button type="button" class="toggle ' + (hw.knuckleTested ? 'on' : '') + '" data-set="hardware.knuckleTested" data-value="' + (!hw.knuckleTested) + '" data-type="bool">' +
              '<span class="knob"></span><span>Knuckle works</span></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="note warn">A browser only receives what the operating system reports. Palm rejection, "press and hold" drivers and touch limits are set in Windows and the touchscreen firmware — not by this app.</div>');
  }

  function renderData() {
    var totals = Metrics.data.totals;
    var running = ui.app && ui.app.session && ui.app.session.running;
    var live = Metrics.live;
    var t = {
      sessions: totals.sessions + (running ? 1 : 0),
      playMs: totals.playMs + (running ? live.playMs : 0),
      activations: totals.activations + (running ? live.activations : 0),
      touches: totals.touches + (running ? live.touches : 0),
      longestContactMs: Math.max(totals.longestContactMs, running ? live.contactMs : 0),
      distancePx: totals.distancePx + (running ? live.distancePx : 0)
    };
    var metres = (t.distancePx / 96) * 0.0254;
    var rows = Metrics.data.sessions.slice().reverse().slice(0, 8).map(function (s) {
      return '<tr><td>' + new Date(s.at).toLocaleString() + '</td>' +
        '<td>' + U.formatMs(s.playMs) + '</td>' +
        '<td>' + s.activations + '</td>' +
        '<td>' + s.touches + '</td>' +
        '<td>' + U.formatMs(s.longestContactMs) + '</td></tr>';
    }).join('');

    var tableHtml = rows
      ? '<table class="sessions"><thead><tr><th>Started</th><th>Active play</th><th>Rewards</th><th>Contacts</th><th>Longest contact</th></tr></thead><tbody>' + rows + '</tbody></table>'
      : '<div class="note">No sessions recorded yet.</div>';

    return card('Interaction metrics', '',
      '<b>These are interaction counts, not medical measures.</b> They describe what the touchscreen reported in this game. They are not a measure of strength, motor recovery or therapeutic progress, and they are not medical advice.',
      '<div class="chips" style="margin-bottom:14px">' +
        '<span class="chip">' + (running ? 'Current session included live' : 'All recorded sessions') + '</span>' +
      '</div>' +
      '<div class="kpis">' +
        '<div class="kpi"><div class="v">' + t.sessions + '</div><div class="k">Sessions</div></div>' +
        '<div class="kpi"><div class="v">' + U.formatMs(t.playMs) + '</div><div class="k">Active play time</div></div>' +
        '<div class="kpi"><div class="v">' + t.activations + '</div><div class="k">Rewards from touches</div></div>' +
        '<div class="kpi"><div class="v">' + t.touches + '</div><div class="k">Contacts on the play side</div></div>' +
        '<div class="kpi"><div class="v">' + U.formatMs(t.longestContactMs) + '</div><div class="k">Longest sustained contact</div></div>' +
        '<div class="kpi"><div class="v">' + (metres < 10 ? metres.toFixed(1) : Math.round(metres)) + ' m</div><div class="k">Hand movement (rough)</div></div>' +
      '</div>' +
      '<div class="note">Movement distance is estimated from screen pixels and is only a rough indication of activity, not of range or control.</div>') +
      card('Where touches happened', '', 'A simple heat map of contact positions across every recorded session.',
        '<div class="preview-wrap"><canvas id="heat" class="preview"></canvas>' +
        '<div class="preview-caption">Brighter areas had more registered contacts. The play/button outline follows the current layout.</div></div>') +
      card('Recent sessions', '', 'Stored only in this browser on this PC.',
        tableHtml +
        '<div class="actions"><button type="button" class="btn danger" data-action="clear-data">Delete recorded metrics</button></div>') +
      card('Privacy', '', 'No accounts, no uploads, no identifiers.',
        '<div class="note good">Everything is saved in this browser\'s local storage on this computer. Nothing is sent anywhere, and no name, age or photo is recorded. Clearing browser data or using "Delete recorded metrics" removes it.</div>');
  }

  function renderHelp() {
    return card('How to run it', '', 'Open <b>index.html</b> in Edge or Chrome, or use the launcher for a kiosk-style full screen.',
      '<ol class="steps">' +
        '<li><span class="num">1</span><span>Double-click <b>Launch-Kiosk.cmd</b> for full-screen play, or <b>index.html</b> for a normal window.</span></li>' +
        '<li><span class="num">2</span><span>Press <b>Start playing</b> here, or just hold the big round button.</span></li>' +
        '<li><span class="num">3</span><span>To leave a session, release the button. It pauses gently; nothing is lost.</span></li>' +
      '</ol>' +
      '<div class="note">During play the button must be held. When it is released, the play side fades gently to black — like a room with the light off — until the button is held again.</div>') +
      card('Opening this dashboard', '', 'The settings sit behind a quick grown-up check.',
        '<ol class="steps">' +
          '<li><span class="num">1</span><span>Tap the small lock circle in the <b>top-right corner</b> of the screen.</span></li>' +
          '<li><span class="num">2</span><span>Solve the short maths question, then press <b>Enter</b>. Or press <b>Ctrl + Shift + P</b> on a keyboard.</span></li>' +
        '</ol>' +
        '<div class="note">The bottom bar switches games but has no settings button. The check keeps small hands out without a long press.</div>') +
      card('Mouse testing', '', 'A normal mouse works for trying the games.',
        '<div class="note">A mouse is one pointer: it can hold the button or play, not both. Turn off <b>Require the hold button</b> in Accessibility to test with one pointer.</div>') +
      card('Hardware limits', '', 'Some panels cannot report palms or many contacts.',
        '<div class="note warn">Windows touch drivers may reject palm-sized contacts, report them as a mouse, or cap simultaneous touches. No app can override that. If a whole hand never registers, keep targets at <b>Very large</b>, enable <b>Reward from any touch</b>, or turn off the hold requirement.</div>') +
      card('Troubleshooting', '', null,
        '<ol class="steps">' +
          '<li><span class="num">?</span><span><b>No sound:</b> click once anywhere, then check the Sound setting and the Windows volume mixer.</span></li>' +
          '<li><span class="num">?</span><span><b>Page scrolls or zooms:</b> use the kiosk launcher. Normal browsers may still allow edge-swipe gestures.</span></li>' +
          '<li><span class="num">?</span><span><b>Layout looks wrong after changing monitors:</b> the layout recalculates automatically; press F5 or re-run calibration.</span></li>' +
          '<li><span class="num">?</span><span><b>A contact sticks:</b> lift all hands, then press Esc and start again. Lost contacts are cleared when the window loses focus.</span></li>' +
        '</ol>');
  }

  /* ---------------------------------------------------------- zone preview */

  function drawZonePreview() {
    var c = document.getElementById('zone-preview');
    if (!c) return;
    var w = Math.max(240, c.clientWidth || 480);
    var h = Math.round(w * 9 / 16);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#0d0a1a';
    ctx.fillRect(0, 0, w, h);

    var z = MG.Zones.compute(Settings.data, w, h, Math.round((MG.Tray ? MG.Tray.inset() : 0) * h / Math.max(1, MG.App.H)));
    var r = Math.min(w, h) * 0.035;

    ctx.fillStyle = '#2f2033';
    U.rr(ctx, z.hold.x, z.hold.y, z.hold.w, z.hold.h, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,200,132,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // the lamp
    var lx = z.hold.x + z.hold.w / 2;
    var ly = z.hold.y + z.hold.h * 0.44;
    var lr = Math.min(z.hold.w * 0.3, z.hold.h * 0.26);
    var lg = ctx.createRadialGradient(lx, ly, lr * 0.2, lx, ly, lr * 2.2);
    lg.addColorStop(0, 'rgba(255,214,150,0.5)');
    lg.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, ly, lr * 2.2, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#e8b87c';
    ctx.beginPath();
    ctx.arc(lx, ly, lr * 0.8, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#fff3d8';
    ctx.beginPath();
    ctx.arc(lx, ly, lr * 0.5, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#1a1430';
    U.rr(ctx, z.play.x, z.play.y, z.play.w, z.play.h, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,200,132,0.3)';
    ctx.stroke();

    var fs = Math.max(9, Math.min(w, h) * 0.042);
    U.text(ctx, 'HOLD', z.hold.x + z.hold.w / 2, z.hold.y + z.hold.h * 0.82, fs, 'rgba(242,200,132,0.7)', 700);
    U.text(ctx, 'PLAY', z.play.x + z.play.w / 2, z.play.y + z.play.h / 2, fs, 'rgba(195,180,214,0.6)', 700);
  }

  /* -------------------------------------------------------------- heat map */

  function drawHeat() {
    var c = document.getElementById('heat');
    if (!c) return;
    var w = Math.max(240, c.clientWidth || 560);
    var h = Math.round(w * 9 / 16);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#0d0a1a';
    ctx.fillRect(0, 0, w, h);

    var g = Metrics.data.grid;
    var max = 1;
    for (var i = 0; i < g.counts.length; i++) if (g.counts[i] > max) max = g.counts[i];

    var cw = w / g.cols;
    var ch = h / g.rows;
    for (var y = 0; y < g.rows; y++) {
      for (var x = 0; x < g.cols; x++) {
        var v = g.counts[y * g.cols + x] / max;
        if (v <= 0) continue;
        ctx.fillStyle = U.hsl(44 - v * 26, 92, 58 + v * 10, 0.06 + 0.72 * Math.pow(v, 0.6));
        ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
      }
    }

    var z = MG.Zones.compute(Settings.data, w, h, Math.round((MG.Tray ? MG.Tray.inset() : 0) * h / Math.max(1, MG.App.H)));
    ctx.strokeStyle = 'rgba(242,200,132,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    U.rr(ctx, z.play.x, z.play.y, z.play.w, z.play.h, Math.min(w, h) * 0.03);
    ctx.stroke();
    U.rr(ctx, z.hold.x, z.hold.y, z.hold.w, z.hold.h, Math.min(w, h) * 0.03);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* --------------------------------------------------------------- touch lab */

  function setupLab() {
    var c = document.getElementById('lab-canvas');
    if (!c || !ui.app) return;
    var app = ui.app;

    ui.labTouch = MG.createTouchSource(c, {
      zoneOf: function (x, y) {
        var rect = c.getBoundingClientRect();
        var sx = app.W / Math.max(1, rect.width);
        var sy = app.H / Math.max(1, rect.height);
        var ax = x * sx;
        var ay = y * sy;
        if (U.inRect(ax, ay, app.zone.play)) return 'play';
        if (U.inRect(ax, ay, app.zone.hold)) return 'hold';
        return 'outside';
      },
      onChange: updateLabCounters
    });

    updateLabCounters(ui.labTouch);
    drawLab();
  }

  function destroyLab() {
    if (ui.labRaf) { cancelAnimationFrame(ui.labRaf); ui.labRaf = 0; }
    if (ui.labTouch) { ui.labTouch.destroy(); ui.labTouch = null; }
  }

  function updateLabCounters(src) {
    var now = document.getElementById('lab-now');
    var max = document.getElementById('lab-max');
    var types = document.getElementById('lab-types');
    if (!now || !src) return;
    now.textContent = String(src.pointers.size);
    if (src.maxSimultaneous > ui.maxSeen) {
      ui.maxSeen = src.maxSimultaneous;
      Settings.set('hardware.maxSimultaneous', Math.max(Settings.data.hardware.maxSimultaneous || 0, ui.maxSeen));
    }
    if (max) max.textContent = String(Math.max(ui.maxSeen, Settings.data.hardware.maxSimultaneous || 0));

    var names = [];
    src.pointers.forEach(function (p) {
      var t = p.type + (p.width ? ' ' + Math.round(p.width) + 'px' : '');
      if (names.indexOf(t) === -1) names.push(t);
    });
    if (types) types.textContent = names.length ? names.join(', ') : '–';
  }

  function drawLab() {
    var c = document.getElementById('lab-canvas');
    if (!c || !ui.labTouch) { ui.labRaf = 0; return; }
    ui.labRaf = requestAnimationFrame(drawLab);

    var w = Math.max(240, c.clientWidth || 480);
    var h = Math.round(w * 9 / 16);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var app = ui.app;
    var sx = w / Math.max(1, app.W);
    var sy = h / Math.max(1, app.H);
    var z = app.zone;
    var r = Math.min(w, h) * 0.03;

    ctx.fillStyle = '#2f2033';
    U.rr(ctx, z.hold.x * sx, z.hold.y * sy, z.hold.w * sx, z.hold.h * sy, r);
    ctx.fill();

    ctx.fillStyle = '#1a1430';
    U.rr(ctx, z.play.x * sx, z.play.y * sy, z.play.w * sx, z.play.h * sy, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,200,132,0.32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    var fs = Math.max(9, Math.min(w, h) * 0.04);
    U.text(ctx, 'HOLD', (z.hold.x + z.hold.w / 2) * sx, (z.hold.y + z.hold.h * 0.82) * sy, fs, 'rgba(242,200,132,0.7)', 700);
    U.text(ctx, 'PLAY', (z.play.x + z.play.w / 2) * sx, (z.play.y + z.play.h / 2) * sy, fs, 'rgba(195,180,214,0.6)', 700);

    ui.labTouch.pointers.forEach(function (p) {
      var hue = p.role === 'hold' ? 34 : (p.role === 'play' ? 48 : 285);
      var rad = 16 + Math.min(26, (p.width || 0) * 0.2);
      var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      grad.addColorStop(0, U.hsl(hue, 92, 72, 0.85));
      grad.addColorStop(1, U.hsl(hue, 92, 72, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#fff8e6';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, U.TAU);
      ctx.fill();
      U.text(ctx, '#' + p.id, p.x, p.y - rad * 0.75, Math.max(9, fs * 0.8), 'rgba(248,241,255,0.85)', 700);
    });
  }

  /* ----------------------------------------------------------------- API */

  function closeUI() {
    destroyLab();
    revokeThumbs();
    if (ui.root) ui.root.hidden = true;
  }

  MG.ParentUI = {
    open: function (app, tab) {
      build();
      ui.app = app;
      ui.tab = tab || 'play';
      ui.lastTab = null;
      ui.root.hidden = false;
      syncTabs();
      renderTab();
      var b = ui.root.querySelector('.parent-body');
      if (b) b.scrollTop = 0;
    },
    close: function () { closeUI(); },
    suspendLab: destroyLab,
    isOpen: function () { return !!(ui.root && !ui.root.hidden); },
    toast: toast
  };
})(window.MG);
