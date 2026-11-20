/* Magic Hand Play - guided first-run calibration. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var Settings = MG.Settings;

  var STEPS = [
    { id: 'welcome', title: 'Before we start', text: 'This takes about two minutes. Use whatever positions are comfortable for the child — never hold or force the arm. You can skip anything and change it later.' },
    { id: 'right', title: 'Test the hold button', text: 'Ask the child to rest a hand or forearm anywhere on the big round button. It should light up and a dot should appear on the picture.' },
    { id: 'left', title: 'Test the play side', text: 'Now touch anywhere on the play side. A soft ring should follow the contact, even with a wide palm or knuckle.' },
    { id: 'both', title: 'Both at the same time', text: 'Hold the button with one hand and touch the play side with the other. Both dots must appear together. If one disappears, this touchscreen limits simultaneous contacts.' },
    { id: 'reach', title: 'Find a comfortable reach', text: 'Let the child touch the play side three or four times where it feels natural. Then press Next and the play area will be fitted around those spots.' },
    { id: 'feel', title: 'Targets and feel', text: 'Quick starting choices. Everything here can be changed later in Accessibility.' },
    { id: 'done', title: 'Saved', text: 'Settings are stored on this computer only. Nothing is uploaded and no names or photos are recorded.' }
  ];

  var ui = {
    root: null,
    panel: null,
    live: null,
    canvas: null,
    ctx: null,
    source: null,
    raf: 0,
    index: 0,
    sat: {},
    pts: [],
    maxSim: 0,
    firstRun: true,
    app: null,
    built: false
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function build() {
    if (ui.built) return;
    ui.built = true;

    var root = document.createElement('div');
    root.className = 'overlay';
    root.id = 'calib-screen';
    root.hidden = true;
    root.style.zIndex = '60';
    root.innerHTML =
      '<div class="calib-wrap">' +
        '<div class="calib-top">' +
          '<div class="brand">' +
            '<div class="brand-mark"></div>' +
            '<div><h1>Calibration</h1><p id="calib-sub">A short, gentle set-up</p></div>' +
          '</div>' +
          '<button type="button" class="btn ghost" data-cal="cancel">Close</button>' +
        '</div>' +
        '<div class="calib-grid">' +
          '<div class="calib-stage">' +
            '<canvas id="calib-canvas" class="calib-canvas"></canvas>' +
            '<div class="chips" id="calib-live" style="margin-top:10px"></div>' +
          '</div>' +
          '<aside class="calib-panel" id="calib-panel"></aside>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);
    ui.root = root;
    ui.panel = root.querySelector('#calib-panel');
    ui.live = root.querySelector('#calib-live');
    ui.canvas = root.querySelector('#calib-canvas');
    ui.ctx = ui.canvas.getContext('2d');

    root.addEventListener('click', function (e) {
      var setBtn = e.target.closest('[data-set]');
      if (setBtn && setBtn.tagName === 'BUTTON') {
        var v = setBtn.dataset.value;
        var type = setBtn.dataset.type;
        Settings.set(setBtn.dataset.set, type === 'number' ? Number(v) : (type === 'bool' ? v === 'true' : v));
        renderPanel();
        return;
      }
      var act = e.target.closest('[data-cal]');
      if (!act) return;
      var a = act.dataset.cal;
      if (a === 'next') next();
      else if (a === 'back') { if (ui.index > 0) { ui.index -= 1; renderPanel(); } }
      else if (a === 'skip') { ui.index = Math.min(STEPS.length - 1, ui.index + 1); renderPanel(); }
      else if (a === 'cancel') finish(false);
      else if (a === 'finish') finish(true);
    });
  }

  function stepId() { return STEPS[ui.index].id; }

  function canNext() {
    var id = stepId();
    if (id === 'right') return !!ui.sat.right;
    if (id === 'left') return !!ui.sat.left;
    if (id === 'both') return !!ui.sat.both;
    if (id === 'reach') return ui.pts.length >= 2;
    return true;
  }

  function satisfy(key) {
    if (ui.sat[key]) return;
    ui.sat[key] = true;
    MG.Audio.play('chime', 6);
    renderPanel();
  }

  function seg(path, current, opts) {
    return '<div class="seg">' + opts.map(function (o) {
      return '<button type="button" class="' + (String(o.v) === String(current) ? 'on' : '') + '" data-set="' + path + '" data-value="' + o.v + '">' + esc(o.l) + '</button>';
    }).join('') + '</div>';
  }

  function renderPanel() {
    if (!ui.panel) return;
    var step = STEPS[ui.index];
    var s = Settings.data;
    var dots = STEPS.map(function (x, i) {
      var cls = i === ui.index ? 'on' : (i < ui.index ? 'done' : '');
      return '<span class="' + cls + '"></span>';
    }).join('');

    var body = '<div class="calib-step"><h3>' + esc(step.title) + '</h3><p>' + esc(step.text) + '</p>';

    if (step.id === 'right' || step.id === 'left' || step.id === 'both') {
      var ok = canNext();
      body += '<div class="detect ' + (ok ? '' : 'idle') + '">' + (ok ? '✓ Contact detected' : 'Waiting for a contact…') + '</div>';
    }

    if (step.id === 'reach') {
      body += '<div class="detect ' + (canNext() ? '' : 'idle') + '">' + (canNext() ? '✓ ' + ui.pts.length + ' comfortable spots' : ui.pts.length + ' of 2 spots needed') + '</div>';
      body += '<div class="note">The play area grows around the spots you touched. You can fine-tune it later with the sliders in Accessibility.</div>';
    }

    if (step.id === 'feel') {
      body += '<div class="field"><div class="field-label">Target size</div><div class="field-control">' +
        seg('targetSize', s.targetSize, [{ v: 'xlarge', l: 'Very large' }, { v: 'large', l: 'Large' }, { v: 'medium', l: 'Medium' }]) + '</div></div>' +
        '<div class="field"><div class="field-label">Touch activation</div><div class="field-control">' +
        seg('activation', s.activation, [{ v: 'new', l: 'New touch' }, { v: 'continuous', l: 'Continuous' }, { v: 'dwell', l: 'Dwell' }]) + '</div></div>' +
        '<div class="field"><div class="field-label">Sound</div><div class="field-control">' +
        seg('sound', s.sound, [{ v: 'off', l: 'Off' }, { v: 'quiet', l: 'Quiet' }, { v: 'normal', l: 'Normal' }]) + '</div></div>' +
        '<div class="field"><div class="field-label">Require the hold button</div><div class="field-control">' +
        '<button type="button" class="toggle ' + (s.holdRequired ? 'on' : '') + '" data-set="holdRequired" data-value="' + (!s.holdRequired) + '" data-type="bool"><span class="knob"></span><span>' + (s.holdRequired ? 'On' : 'Off') + '</span></button>' +
        '</div></div>';
    }

    if (step.id === 'done') {
      var hw = s.hardware;
      body += '<div class="chips" style="margin-top:12px">' +
        '<span class="chip">Contacts at once <b>' + (ui.maxSim || hw.maxSimultaneous || 0) + '</b></span>' +
        '<span class="chip">Button <b>' + (hw.rightTested ? 'tested' : 'skipped') + '</b></span>' +
        '<span class="chip">Play side <b>' + (hw.leftTested ? 'tested' : 'skipped') + '</b></span>' +
        '</div>';
    }

    body += '</div>';

    var nav = '<div class="progressdots">' + dots + '</div><div class="calib-actions">';
    if (ui.index > 0) nav += '<button type="button" class="btn ghost" data-cal="back">Back</button>';
    if (step.id === 'right' || step.id === 'left' || step.id === 'both' || step.id === 'reach') {
      nav += '<button type="button" class="btn ghost" data-cal="skip">Skip</button>';
    }
    if (step.id === 'done') {
      nav += '<button type="button" class="btn primary" data-cal="finish">Save and play</button>';
    } else {
      nav += '<button type="button" class="btn primary" data-cal="next" ' + (canNext() ? '' : 'disabled style="opacity:.45"') + '>Next</button>';
    }
    nav += '</div>';

    ui.panel.innerHTML = body + nav;

    var sub = document.getElementById('calib-sub');
    if (sub) sub.textContent = 'Step ' + (ui.index + 1) + ' of ' + STEPS.length;

    ui.live.innerHTML =
      '<span class="chip">Contacts now <b>' + (ui.source ? ui.source.pointers.size : 0) + '</b></span>' +
      '<span class="chip">Most at once <b>' + Math.max(ui.maxSim, s.hardware.maxSimultaneous || 0) + '</b></span>' +
      '<span class="chip">Screen <b>' + Math.round(ui.app.W) + ' × ' + Math.round(ui.app.H) + '</b></span>';
  }

  function next() {
    if (!canNext()) return;
    var id = stepId();
    if (id === 'reach') applyReach();
    if (ui.index >= STEPS.length - 1) { finish(true); return; }
    ui.index += 1;
    renderPanel();
    MG.Audio.play('tap');
  }

  function applyReach() {
    if (ui.pts.length < 2) return;
    var W = ui.app.W;
    var H = ui.app.H;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    ui.pts.forEach(function (p) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    var mx = W * 0.08;
    var my = H * 0.1;
    var left = Math.max(0, minX - mx);
    var right = Math.min(W, maxX + mx);
    var top = Math.max(0, minY - my);
    var bottom = Math.min(H, maxY + my);

    var width = U.clamp((right - left) / W, 0.46, 0.84);
    var height = U.clamp((bottom - top) / H, 0.52, 0.96);
    var swapped = !!Settings.data.swapSides;
    var offsetX = swapped ? U.clamp((W - right) / W, 0, 0.4) : U.clamp(left / W, 0, 0.4);
    var offsetY = U.clamp(top / H, 0, 0.4);

    Settings.data.zone = { width: width, height: height, offsetX: offsetX, offsetY: offsetY };
    Settings.data.hardware.reachTested = true;
    Settings.save(true);
    Settings.emit();
    if (MG.ParentUI) MG.ParentUI.toast('Play area fitted to the comfortable reach');
  }

  function finish(start) {
    var s = Settings.data;
    s.hardware.maxSimultaneous = Math.max(s.hardware.maxSimultaneous || 0, ui.maxSim || 0, ui.source ? ui.source.maxSimultaneous : 0);
    s.calibrated = true;
    Settings.save(true);
    Settings.emit();

    closeUI();

    if (ui.firstRun || !MG.ParentUI.isOpen()) {
      ui.app.backToPlay(false);
    } else {
      MG.ParentUI.open(ui.app, 'calibrate');
    }
  }

  function closeUI() {
    if (ui.raf) { cancelAnimationFrame(ui.raf); ui.raf = 0; }
    if (ui.source) { ui.source.destroy(); ui.source = null; }
    if (ui.root) ui.root.hidden = true;
  }

  function setupSource() {
    var c = ui.canvas;
    var app = ui.app;

    ui.source = MG.createTouchSource(c, {
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
      onDown: function (rec) {
        if (stepId() !== 'reach' || rec.role !== 'play') return;
        var rect = c.getBoundingClientRect();
        var sx = app.W / Math.max(1, rect.width);
        var sy = app.H / Math.max(1, rect.height);
        if (ui.pts.length >= 8) ui.pts.shift();
        ui.pts.push({ x: rec.x * sx, y: rec.y * sy });
        renderPanel();
      },
      onChange: function (src) {
        if (src.maxSimultaneous > ui.maxSim) {
          ui.maxSim = src.maxSimultaneous;
          Settings.set('hardware.maxSimultaneous', Math.max(Settings.data.hardware.maxSimultaneous || 0, ui.maxSim));
        }
        var id = stepId();
        if (id === 'right' && src.count('hold') > 0) {
          Settings.set('hardware.rightTested', true);
          satisfy('right');
        } else if (id === 'left' && src.count('play') > 0) {
          Settings.set('hardware.leftTested', true);
          satisfy('left');
        } else if (id === 'both' && src.count('hold') > 0 && src.count('play') > 0) {
          Settings.set('hardware.bothTested', true);
          satisfy('both');
        }
        if (ui.live) {
          ui.live.innerHTML =
            '<span class="chip">Contacts now <b>' + src.pointers.size + '</b></span>' +
            '<span class="chip">Most at once <b>' + Math.max(ui.maxSim, Settings.data.hardware.maxSimultaneous || 0) + '</b></span>' +
            '<span class="chip">Screen <b>' + Math.round(ui.app.W) + ' × ' + Math.round(ui.app.H) + '</b></span>';
        }
      }
    });
  }

  function draw() {
    var c = ui.canvas;
    if (!c || !ui.source) { ui.raf = 0; return; }
    ui.raf = requestAnimationFrame(draw);

    var w = Math.max(240, c.clientWidth || 560);
    var h = Math.round(w * 10 / 16);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    var ctx = ui.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var app = ui.app;
    var z = app.zone;
    var sx = w / Math.max(1, app.W);
    var sy = h / Math.max(1, app.H);
    var r = Math.min(w, h) * 0.03;

    ctx.fillStyle = '#0d0a1a';
    ctx.fillRect(0, 0, w, h);

    // hold console
    ctx.fillStyle = '#2f2033';
    U.rr(ctx, z.hold.x * sx, z.hold.y * sy, z.hold.w * sx, z.hold.h * sy, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,200,132,0.24)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // play window
    ctx.fillStyle = '#1a1430';
    U.rr(ctx, z.play.x * sx, z.play.y * sy, z.play.w * sx, z.play.h * sy, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,200,132,0.3)';
    ctx.stroke();

    // highlight the side for the current step
    var id = stepId();
    var hi = (id === 'right') ? 'hold' : ((id === 'left' || id === 'both' || id === 'reach') ? 'play' : null);
    if (hi) {
      var pulse = 0.45 + 0.35 * Math.sin(Date.now() / 320);
      var rect = z[hi];
      ctx.strokeStyle = 'rgba(242,200,132,' + pulse.toFixed(2) + ')';
      ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.012);
      U.rr(ctx, rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy, r);
      ctx.stroke();
    }

    var fs = Math.max(10, Math.min(w, h) * 0.042);
    U.text(ctx, 'HOLD', (z.hold.x + z.hold.w / 2) * sx, (z.hold.y + z.hold.h * 0.82) * sy, fs, 'rgba(242,200,132,0.65)', 700);
    U.text(ctx, 'PLAY', (z.play.x + z.play.w / 2) * sx, (z.play.y + z.play.h / 2) * sy, fs, 'rgba(195,180,214,0.55)', 700);

    // comfortable spots
    for (var i = 0; i < ui.pts.length; i++) {
      var p = ui.pts[i];
      ctx.strokeStyle = 'rgba(255,205,140,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x * sx, p.y * sy, 12 + i * 2, 0, U.TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,205,140,0.16)';
      ctx.fill();
    }

    ui.source.pointers.forEach(function (p) {
      var hue = p.role === 'hold' ? 34 : (p.role === 'play' ? 48 : 285);
      var rad = 20 + Math.min(30, (p.width || 0) * 0.2);
      var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      grad.addColorStop(0, U.hsl(hue, 92, 70, 0.85));
      grad.addColorStop(1, U.hsl(hue, 92, 70, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#fff8e6';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, U.TAU);
      ctx.fill();
    });
  }

  MG.Calibration = {
    open: function (app, firstRun) {
      build();
      ui.app = app;
      ui.firstRun = !!firstRun;
      ui.index = 0;
      ui.sat = {};
      ui.pts = [];
      ui.maxSim = 0;
      ui.root.hidden = false;

      if (app.mode !== 'parent') {
        app.priorMode = app.mode;
        app.mode = 'parent';
        if (app.touch) app.touch.disable();
      }
      if (MG.ParentUI && MG.ParentUI.suspendLab) MG.ParentUI.suspendLab();

      setupSource();
      renderPanel();
      if (!ui.raf) draw();
    },
    close: function () { closeUI(); },
    isOpen: function () { return !!(ui.root && !ui.root.hidden); }
  };
})(window.MG);
