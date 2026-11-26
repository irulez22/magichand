/* Magic Hand Play - app shell: layout, lamp button, pointer routing, session. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;
  var Zones = MG.Zones;
  var T = MG.Theme;

  var END_TO_READY = 1.2;  // seconds on the "Well done" card before the ready screen

  var App = {
    W: 0,
    H: 0,
    dpr: 1,
    settings: null,
    zone: null,
    pad: null,
    canvas: null,
    ctx: null,
    game: null,
    gameId: null,
    mode: 'boot',
    priorMode: 'ready',
    clock: 0,
    light: 0,
    dark: 0,
    holdCount: 0,
    playCount: 0,
    grace: 0,
    readyTime: 0,
    padPressed: false,
    ripples: [],
    endingAt: 0,
    awaitingRelease: false,
    touch: null,
    session: { running: false, playMs: 0, limitMs: 0 },
    _lastTs: 0,
    _endBurst: 0,
    _wake: null,
    modeAt: 0,
    _seenMode: 'boot',
    motes: []
  };

  MG.App = App;

  /* ---------------------------------------------------------------- boot */

  App.boot = function () {
    MG.Settings.load();
    App.settings = MG.Settings.data;
    MG.Metrics.load();
    MG.Settings.subscribe(App.onSettingsChanged);

    App.canvas = document.getElementById('scene');
    App.ctx = App.canvas.getContext('2d', { alpha: false, desynchronized: true });

    if (MG.Tray) MG.Tray.init(App);
    App.resize();
    App.seedMotes();

    App.touch = MG.createTouchSource(App.canvas, {
      zoneOf: App.zoneOf,
      onDown: App.onDown,
      onMove: App.onMove,
      onUp: App.onUp,
      onCancel: App.onCancel,
      onChange: App.onPointerChange
    });

    MG.Audio.setLevel(App.settings.sound);
    App.installGuards();
    App.newGame();

    App.mode = 'ready';
    App.readyTime = 0;

    window.addEventListener('resize', App.resize);
    window.addEventListener('orientationchange', App.resize);
    document.addEventListener('fullscreenchange', function () { setTimeout(App.resize, 80); });

    /* Installable-app metadata only works over http(s); on file:// the browser
       rejects the manifest request, so add it only where it is meaningful. */
    if (/^https?:$/.test(window.location.protocol)) {
      var man = document.createElement('link');
      man.rel = 'manifest';
      man.href = 'manifest.webmanifest';
      document.head.appendChild(man);
    }

    requestAnimationFrame(App.frame);

    if (!App.settings.calibrated) {
      setTimeout(function () {
        if (MG.Calibration) MG.Calibration.open(App, true);
      }, 400);
    }
  };

  App.resize = function () {
    if (!App.settings) return;
    var W = Math.max(320, window.innerWidth || 320);
    var H = Math.max(320, window.innerHeight || 320);
    App.W = W;
    App.H = H;
    App.dpr = Math.min(2, window.devicePixelRatio || 1);

    var c = App.canvas;
    c.width = Math.round(W * App.dpr);
    c.height = Math.round(H * App.dpr);
    c.style.width = W + 'px';
    c.style.height = H + 'px';

    var bottom = MG.Tray ? MG.Tray.inset() : 0;
    App.zone = Zones.compute(App.settings, W, H, bottom);
    App.pad = Zones.padCenter(W, H);

    if (App.game) {
      if (App.game.onResize) App.game.onResize(W, H, App.dpr);
      App.game.setZone(App.zone.play);
    }
    if (App.touch) App.touch.measure();
  };

  App.onSettingsChanged = function (s) {
    MG.Audio.setLevel(s.sound);
    App.resize();
    if (App.session && App.session.running) {
      App.session.limitMs = (s.sessionMinutes || 0) * 60000;
    }
    if (App.game && s.game !== App.gameId) App.newGame();
  };

  App.newGame = function () {
    var prev = App.game;
    App.game = null;
    if (prev) {
      try { prev.exit(); } catch (e) { console.error('Game exit failed', e); }
    }
    App.gameId = App.settings.game;
    try {
      App.game = MG.createGame(App, App.settings.game);
      if (App.game.onResize) App.game.onResize(App.W, App.H, App.dpr);
      App.game.setZone(App.zone.play);
      App.game.enter();
    } catch (e) {
      console.error('Game failed to start; falling back to balloons', e);
      App.gameId = 'balloons';
      App.game = new MG.Games.balloons(App);
      App.game.setZone(App.zone.play);
    }
  };

  App.playPointers = function () {
    var out = [];
    if (!App.touch) return out;
    App.touch.pointers.forEach(function (p) { if (p.role === 'play') out.push(p); });
    return out;
  };

  /* Some scenes (Picture Pairs) use the whole screen and do not need the lamp
     button at all. */
  App.holdRequiredNow = function () {
    if (!App.settings.holdRequired) return false;
    if (App.game && App.game.fullScreen) return false;
    return true;
  };

  App.stageRect = function () {
    if (App.game && App.game.fullScreen) {
      var bottom = App.zone && App.zone.bottom ? App.zone.bottom : 0;
      return { x: 0, y: 0, w: App.W, h: Math.max(120, App.H - bottom) };
    }
    return App.zone.play;
  };

  /* --------------------------------------------------------- hit regions */

  App.zoneOf = function (x, y) {
    if (!App.zone) return 'outside';
    if (App.pad && U.dist(x, y, App.pad.x, App.pad.y) <= App.pad.r * 1.4) return 'pad';
    if (App.game && App.game.fullScreen) return 'play';
    if (U.inRect(x, y, App.zone.play)) return 'play';
    if (U.inRect(x, y, App.zone.hold)) return 'hold';
    return 'outside';
  };

  /* -------------------------------------------------------- pointer flow */

  App.onDown = function (rec) {
    MG.Audio.unlock();
    App.ripples.push({ x: rec.x, y: rec.y, role: rec.role, t: 0 });

    if (rec.role === 'play') {
      MG.Metrics.addTouch(rec.x, rec.y, App.W, App.H);
    }
    if (rec.role === 'pad') {
      App.padPressed = true;
      return;
    }

    if (App.mode === 'playing' && rec.role === 'play') {
      var a = App.settings.activation;
      if (a === 'new' || a === 'continuous') App.activate(rec, 'touch');
    } else if (App.mode === 'ready' && !App.holdRequiredNow()) {
      if (rec.role === 'play' || rec.role === 'hold') {
        App.startSession();
        if (rec.role === 'play') App.activate(rec, 'touch');
      }
    } else if (App.mode === 'resting' && (rec.role === 'hold' || !App.holdRequiredNow())) {
      App.resume();
    }
  };

  App.onMove = function (rec, dx, dy, step) {
    if (rec.role !== 'play' || App.mode !== 'playing') return;
    MG.Metrics.addDistance(step);

    if (App.settings.activation !== 'new') return;
    if (!App.game || App.game.id === 'painting') return;

    rec.sweep += step;
    var minDim = Math.min(App.zone.play.w, App.zone.play.h);
    var need = minDim * ({ low: 0.2, medium: 0.13, high: 0.09 }[App.settings.reward] || 0.13);
    if (rec.sweep >= need) {
      rec.sweep = 0;
      App.activate(rec, 'sweep');
    }
  };

  App.onUp = function (rec) {
    if (rec.role === 'pad') {
      App.padPressed = false;
      var quick = (rec.duration || (U.now() - rec.downAt)) < 500;
      var still = U.dist(rec.x, rec.y, rec.sx, rec.sy) < 18;
      if (quick && still) {
        if (MG.ParentGate) MG.ParentGate.ask(function () { App.openParent(); });
        else App.openParent();
      }
      return;
    }
    if (rec.role === 'play') {
      MG.Metrics.addContact(rec.duration || (U.now() - rec.downAt));
      rec._paint = null;
    }
    App.checkRelease();
  };

  App.onCancel = function (rec) {
    if (rec.role === 'pad') App.padPressed = false;
    if (rec.role === 'play') {
      MG.Metrics.addContact(U.now() - rec.downAt);
      rec._paint = null;
    }
    App.checkRelease();
  };

  App.onPointerChange = function (src) {
    App.holdCount = src.count('hold');
    App.playCount = src.count('play');
  };

  App.checkRelease = function () {
    if (App.mode === 'ended' && App.awaitingRelease && App.touch && App.touch.pointers.size === 0) {
      App.awaitingRelease = false;
      App.endingAt = App.clock;
    }
  };

  /* ------------------------------------------------------------- session */

  App.startSession = function () {
    if (App.mode === 'parent') return;
    App.newGame();
    App.session.running = true;
    App.session.playMs = 0;
    App.session.limitMs = (App.settings.sessionMinutes || 0) * 60000;
    App.mode = 'playing';
    App.grace = 0;
    App.readyTime = 0;
    App.awaitingRelease = false;
    MG.Metrics.beginSession();
    MG.Audio.play('switchOn');
    MG.Audio.play('start');
    App.requestWakeLock();
  };

  App.enterRest = function () {
    App.mode = 'resting';
    App.grace = 0;
    MG.Audio.play('switchOff');
  };

  App.resume = function () {
    if (App.mode !== 'resting') return;
    App.mode = 'playing';
    App.grace = 0;
    App.awaitingRelease = false;
    MG.Audio.play('switchOn');
    App.requestWakeLock();
  };

  App.endSession = function (celebrate) {
    if (!App.session.running) return;
    App.session.running = false;
    MG.Metrics.endSession();
    App.releaseWakeLock();
    if (celebrate === false) return;

    App.mode = 'ended';
    App.endingAt = App.clock;
    App.awaitingRelease = true;
    App._endBurst = 0;
    MG.Audio.play('end');
    var p = App.zone.play;
    FX.confetti(p.x + p.w / 2, p.y + p.h * 0.42, 30, { speed: 340 });
    FX.sparkle(p.x + p.w / 2, p.y + p.h * 0.42, 14, 50);
    if (App.touch && App.touch.pointers.size === 0) App.awaitingRelease = false;
  };

  App.toReady = function () {
    App.mode = 'ready';
    App.readyTime = 0;
    App.grace = 0;
    App.session.running = false;
    App.awaitingRelease = false;
    if (App.settings.game !== App.gameId) App.newGame();
  };

  App.activate = function (rec, reason) {
    if (App.mode !== 'playing' || !App.game) return false;
    if (App.holdRequiredNow() && App.light < 0.3) return false;
    var ok = App.game.activate(rec.x, rec.y, { reason: reason, pointer: rec });
    if (ok) {
      MG.Metrics.addActivation();
      FX.ring(rec.x, rec.y, { r0: 3, r1: 34, hue: 48, width: 3, dur: 0.4, alpha: 0.4 });
    }
    return ok;
  };

  /* ------------------------------------------------------- parent screen */

  App.openParent = function () {
    if (App.mode === 'parent' || App.mode === 'boot') return;
    if (MG.ParentGate) MG.ParentGate.close();
    App.priorMode = App.mode;
    App.mode = 'parent';
    App.padPressed = false;
    App.releaseWakeLock();
    if (MG.ParentUI) MG.ParentUI.open(App);
  };

  App.backToPlay = function (start) {
    // Always make sure both overlays are gone, even if a caller skips the UI.
    if (MG.Calibration && MG.Calibration.isOpen()) MG.Calibration.close();
    if (MG.ParentUI) MG.ParentUI.close();
    if (App.mode !== 'parent') return;
    if (App.session.running) App.endSession(false);
    App.mode = 'ready';
    App.readyTime = 0;
    App.awaitingRelease = false;
    App.session.running = false;
    if (App.settings.game !== App.gameId) App.newGame();
    if (App.touch) App.touch.enable();
    App.priorMode = 'ready';
    if (start === true) App.startSession();
  };

  App.requestWakeLock = function () {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (lock) {
          App._wake = lock;
        }).catch(function () {});
      }
    } catch (e) { /* not supported */ }
  };

  App.releaseWakeLock = function () {
    try {
      if (App._wake) { App._wake.release(); App._wake = null; }
    } catch (e) { /* ignore */ }
  };

  App.goFullscreen = function () {
    var el = document.documentElement;
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      }
    } catch (e) { /* ignore */ }
  };

  /* ----------------------------------------------------------- main loop */

  /* Tiny dust motes catching the lamplight. Purely atmospheric, and capped. */
  App.seedMotes = function () {
    App.motes = [];
    var n = App.settings && App.settings.visual === 'calm' ? 14 : 26;
    for (var i = 0; i < n; i++) {
      App.motes.push({
        nx: Math.random(),
        ny: Math.random(),
        r: U.rand(0.6, 2.2),
        ph: U.rand(0, U.TAU),
        sp: U.rand(0.25, 0.8),
        a: U.rand(0.12, 0.4)
      });
    }
  };

  App.frame = function (ts) {
    requestAnimationFrame(App.frame);
    if (!App._lastTs) App._lastTs = ts;
    var dt = (ts - App._lastTs) / 1000;
    App._lastTs = ts;
    if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
    dt = Math.min(0.05, dt);

    App.update(dt);
    App.render();
  };

  App.update = function (dt) {
    App.clock += dt;
    if (App.mode !== App._seenMode) {
      App._seenMode = App.mode;
      App.modeAt = App.clock;
    }
    if (App.mode === 'parent') return;

    App.updatePointerModes(dt);

    if (App.mode === 'playing') MG.Metrics.addPlayTime(dt * 1000);

    var wantLight = App.holdRequiredNow() ? (App.holdCount > 0 ? 1 : 0) : 1;
    App.light = U.approach(App.light, wantLight, wantLight > App.light ? 7 : 2.2, dt);

    var wantDark = App.mode === 'resting' ? 1 : 0;
    App.dark = U.approach(App.dark, wantDark, wantDark > App.dark ? 3.4 : 8, dt);

    if (App.mode === 'ready') {
      App.readyTime += dt;
      if (App.holdCount > 0) App.startSession();
      else if (!App.holdRequiredNow() && App.readyTime > 4) App.startSession();
      if (App.game) App.game.update(dt * 0.25);
    } else if (App.mode === 'playing') {
      App.session.playMs += dt * 1000;

      if (App.holdRequiredNow() && App.holdCount === 0) {
        App.grace += dt;
        if (App.grace > App.settings.holdGrace) App.enterRest();
      } else {
        App.grace = 0;
      }

      if (App.mode === 'playing') {
        if (App.game) App.game.update(dt * (0.4 + 0.6 * App.light));
        if (App.session.limitMs > 0 && App.session.playMs >= App.session.limitMs) App.endSession(true);
      }
    } else if (App.mode === 'resting') {
      if (App.holdCount > 0 || !App.holdRequiredNow()) App.resume();
      if (App.game) App.game.update(dt * 0.05);
    } else if (App.mode === 'ended') {
      App.checkRelease();
      if (!App.awaitingRelease && App.clock - App.endingAt > END_TO_READY) App.toReady();
      if (App.game) App.game.update(dt * 0.4);
      App._endBurst -= dt;
      if (App._endBurst <= 0) {
        App._endBurst = 2.6;
        var p = App.zone.play;
        FX.confetti(p.x + U.rand(0.2, 0.8) * p.w, p.y + p.h * 0.12,
          App.settings.visual === 'calm' ? 8 : 18, { speed: 220 });
      }
    }

    for (var i = App.ripples.length - 1; i >= 0; i--) {
      App.ripples[i].t += dt;
      if (App.ripples[i].t > 0.7) App.ripples.splice(i, 1);
    }

    for (var mi = 0; mi < App.motes.length; mi++) {
      var mo = App.motes[mi];
      mo.ny -= mo.sp * dt * 0.018;
      mo.ph += dt * 0.5;
      if (mo.ny < -0.02) {
        mo.ny = 1.02;
        mo.nx = Math.random();
      }
    }

    FX.calm = App.settings.visual === 'calm';
    FX.update(dt);
  };

  App.updatePointerModes = function (dt) {
    var s = App.settings;
    var list = App.playPointers();
    var dwellR = Math.max(22, Math.min(App.W, App.H) * 0.055);

    for (var i = 0; i < list.length; i++) {
      var rec = list[i];

      if (s.activation === 'dwell') {
        if (!rec.armed) {
          if (U.dist(rec.x, rec.y, rec.dwellX, rec.dwellY) > dwellR * 1.5) {
            rec.armed = true;
            rec.dwellX = rec.x;
            rec.dwellY = rec.y;
            rec.dwell = 0;
          }
          continue;
        }
        rec.dwell += dt;
        if (U.dist(rec.x, rec.y, rec.dwellX, rec.dwellY) > dwellR) {
          rec.dwellX = rec.x;
          rec.dwellY = rec.y;
          rec.dwell = 0;
        } else if (rec.dwell >= s.dwellTime) {
          rec.armed = false;
          rec.dwell = 0;
          if (App.mode === 'playing') App.activate(rec, 'dwell');
        }
      } else if (s.activation === 'continuous') {
        rec.pulseT += dt;
        var interval = { low: 0.78, medium: 0.5, high: 0.34 }[s.reward] || 0.5;
        if (rec.pulseT >= interval) {
          rec.pulseT = 0;
          if (App.mode === 'playing' && App.game && App.game.id !== 'painting') {
            App.activate(rec, 'continuous');
          }
        }
      }
    }
  };

  /* -------------------------------------------------------------- render */

  App.render = function () {
    var ctx = App.ctx;
    if (!ctx || !App.zone) return;
    var W = App.W;
    var H = App.H;

    ctx.setTransform(App.dpr, 0, 0, App.dpr, 0, 0);

    var full = !!(App.game && App.game.fullScreen);
    var stage = App.stageRect();
    var src = Zones.lightSource(App.zone);

    /* The room: cool moonlight, a warm pool from the lamp side, film grain. */
    T.room(ctx, W, H, {
      warmX: src.x,
      warmA: full ? 0.05 : 0.06 + 0.2 * App.light
    });

    if (!full) App.drawHoldZone(ctx);

    var r = full ? 0 : Math.min(W, H) * 0.035;
    ctx.save();
    U.rr(ctx, stage.x, stage.y, stage.w, stage.h, r);
    ctx.clip();

    ctx.fillStyle = T.C.night1;
    ctx.fillRect(stage.x, stage.y, stage.w, stage.h);

    if (App.game) App.game.draw(ctx);

    App.drawMotes(ctx, stage);
    App.drawLamp(ctx);
    T.inset(ctx, stage.x, stage.y, stage.w, stage.h, r, full ? 0.5 : 0.66);
    T.grain(ctx, stage.x, stage.y, stage.w, stage.h, 0.22);

    FX.draw(ctx);
    App.drawTouchFeedback(ctx);
    App.drawCards(ctx);

    ctx.restore();

    if (!full) App.drawStageFrame(ctx, stage, r);

    App.drawPad(ctx);
  };

  /* Dust in the lamplight: the small sign that the room is alive. */
  App.drawMotes = function (ctx, p) {
    var lit = 0.3 + 0.7 * App.light;
    for (var i = 0; i < App.motes.length; i++) {
      var m = App.motes[i];
      var x = p.x + m.nx * p.w + Math.sin(m.ph) * p.w * 0.012;
      var y = p.y + m.ny * p.h;
      var tw = 0.55 + 0.45 * Math.sin(m.ph * 1.7 + i);
      var a = m.a * lit * tw;
      if (a <= 0.01) continue;
      ctx.fillStyle = T.rgba(T.C.lampHot, a);
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, U.TAU);
      ctx.fill();
    }
  };

  App.drawStageFrame = function (ctx, p, r) {
    ctx.strokeStyle = T.rgba(T.C.brass, 0.24);
    ctx.lineWidth = 1.5;
    U.rr(ctx, p.x + 0.75, p.y + 0.75, Math.max(1, p.w - 1.5), Math.max(1, p.h - 1.5), Math.max(2, r - 1));
    ctx.stroke();

    /* a whisper of light catching the top edge of the frame */
    var g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h * 0.2);
    g.addColorStop(0, T.rgba(T.C.lampHot, 0.1));
    g.addColorStop(1, T.rgba(T.C.lampHot, 0));
    ctx.fillStyle = g;
    U.rr(ctx, p.x + 1, p.y + 1, p.w - 2, p.h * 0.2, r);
    ctx.fill();
  };

  App.drawLamp = function (ctx) {
    if (App.game && App.game.fullScreen) return;
    var p = App.zone.play;
    var lit = App.light;
    var src = Zones.lightSource(App.zone);

    /* Dusk, not a grey veil: the play side sinks into blue-plum darkness. */
    var shade = U.clamp(0.84 * (1 - lit) + 0.28 * App.dark, 0, 0.95);
    if (shade > 0.002) {
      ctx.fillStyle = T.rgba('#06040e', shade);
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = T.rgba('#241a44', shade * 0.34);
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    if (lit > 0.02) {
      var R = Math.max(p.w, p.h) * 1.25;
      var g = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, R);
      g.addColorStop(0, T.rgba(T.C.lamp, 0.22 * lit));
      g.addColorStop(0.4, T.rgba(T.C.amber, 0.075 * lit));
      g.addColorStop(1, T.rgba(T.C.amber, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  };


  App.drawHoldZone = function (ctx) {
    var z = App.zone;
    var h = z.hold;
    var s = App.settings;
    var r = Math.min(App.W, App.H) * 0.035;
    var held = App.holdCount > 0;
    /* A scene can ask for its own hold-side object (the car wants a pedal);
       otherwise the parent's lamp/hand choice applies everywhere. */
    var style = (App.game && App.game.holdStyle) || s.holdMetaphor;

    T.panel(ctx, h.x, h.y, h.w, h.h, r, { warm: true });

    /* shallow recess, so the button looks set into a console */
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    U.rr(ctx, h.x + h.w * 0.06, h.y + h.h * 0.06, h.w * 0.88, h.h * 0.88, Math.max(8, r * 0.8));
    ctx.stroke();
    ctx.strokeStyle = T.rgba(T.C.brass, 0.1);
    ctx.lineWidth = 1;
    U.rr(ctx, h.x + h.w * 0.06 - 1.5, h.y + h.h * 0.06 - 1.5, h.w * 0.88 + 3, h.h * 0.88 + 3, Math.max(8, r * 0.8));
    ctx.stroke();
    ctx.restore();

    var cx = h.x + h.w / 2;
    var cy = h.y + h.h * 0.44;
    var size = Math.min(h.w * 0.72, h.h * 0.44);
    var br = Math.min(h.w * 0.3, h.h * 0.26);

    /* warm pool behind the lamp: breathes while idle, blooms while held */
    if (style === 'light') {
      var breathe = 0.5 + 0.5 * Math.sin(App.clock * 1.2);
      var glowA = 0.12 + 0.12 * App.light + 0.05 * breathe * (1 - App.light);
      T.glow(ctx, cx, cy, br * 3.2, T.C.amber, glowA, 0.4);
    }

    if (style === 'pedal') {
      App.drawPedal(ctx, cx, cy, size, held, App.light);
    } else if (style === 'light') {
      App.drawHoldButton(ctx, cx, cy, br, held, App.light);
    } else {
      T.glow(ctx, cx, cy, br * 2.2, T.C.amber, 0.08 + 0.1 * App.light, 0.4);
      App.drawHand(ctx, cx, cy, size * 0.85, held);
    }

    if (s.showHints) {
      var label = style === 'pedal' ? (held ? 'Go' : 'Gas') : (held ? 'Shining' : 'Hold');
      var fs = U.clamp(Math.min(h.w, h.h) * 0.072, 12, 28);
      T.eyebrow(ctx, label, cx, h.y + h.h * 0.86, fs, T.rgba(T.C.gold, held ? 0.9 : 0.55));
    }

    if (held && style === 'hand') {
      var tt = (App.clock * 0.55) % 1;
      ctx.save();
      ctx.globalAlpha = (1 - tt) * 0.4;
      ctx.strokeStyle = T.C.lampHot;
      ctx.lineWidth = 6 * (1 - tt) + 1;
      ctx.beginPath();
      ctx.arc(cx, cy, size * (0.34 + tt * 0.45), 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    }
  };

  /* Big accelerator pedal for the car scene: brass hinge, ribbed rubber pad,
     pressed and rim-lit while the hold side is held. */
  /* Big accelerator pedal for the car scene: a mounting plate, brass hinge,
     a rubber pad with diamond tread, pressed and rim-lit while held. */
  App.drawPedal = function (ctx, cx, cy, size, held, lit) {
    var pw = size * 0.7;
    var ph = size * 0.6;
    var hingeY = cy - size * 0.58;
    var padTop = hingeY + size * 0.18;
    var press = held ? 0.055 : 0;

    T.glow(ctx, cx, cy, size * 1.15, T.C.amber, 0.1 + 0.32 * lit, 0.38);

    /* mounting plate */
    ctx.fillStyle = 'rgba(16,11,24,0.6)';
    U.rr(ctx, cx - size * 0.48, hingeY - size * 0.1, size * 0.96, size * 0.92, size * 0.08);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,180,120,0.16)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    for (var b = 0; b < 4; b++) {
      var bx = cx + (b % 2 ? 1 : -1) * size * 0.4;
      var by = hingeY - size * 0.02 + (b < 2 ? 0 : size * 0.72);
      ctx.fillStyle = '#4a3a26';
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(2, size * 0.016), 0, U.TAU);
      ctx.fill();
    }

    /* hinge bar */
    var barW = size * 0.78;
    var barH = size * 0.09;
    var metal = ctx.createLinearGradient(0, hingeY - barH / 2, 0, hingeY + barH / 2);
    metal.addColorStop(0, '#f4ecda');
    metal.addColorStop(0.45, '#c9b794');
    metal.addColorStop(1, '#8a775a');
    ctx.fillStyle = metal;
    U.rr(ctx, cx - barW / 2, hingeY - barH / 2, barW, barH, barH * 0.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,20,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (var a = -1; a <= 1; a += 2) {
      ctx.fillStyle = '#4a3a26';
      ctx.beginPath();
      ctx.arc(cx + a * barW * 0.38, hingeY, barH * 0.18, 0, U.TAU);
      ctx.fill();
    }

    /* linkage arm down to the pad */
    ctx.strokeStyle = '#9c8a6d';
    ctx.lineWidth = Math.max(3, size * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, hingeY + barH * 0.4);
    ctx.lineTo(cx, padTop + ph * 0.18);
    ctx.stroke();

    /* pad, hinged at the top and tilting while pressed */
    ctx.save();
    ctx.translate(cx, padTop);
    ctx.rotate(press);

    var pad = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0);
    pad.addColorStop(0, '#171220');
    pad.addColorStop(0.35, held ? '#3c3549' : '#2d2738');
    pad.addColorStop(1, '#120e19');
    ctx.fillStyle = pad;
    U.rr(ctx, -pw / 2, 0, pw, ph, size * 0.085);
    ctx.fill();
    ctx.strokeStyle = held ? 'rgba(255,207,138,0.55)' : 'rgba(226,180,120,0.22)';
    ctx.lineWidth = Math.max(1.5, size * 0.012);
    ctx.stroke();

    /* diamond tread, clipped to the pad */
    ctx.save();
    U.rr(ctx, -pw / 2, 0, pw, ph, size * 0.085);
    ctx.clip();
    ctx.strokeStyle = held ? 'rgba(255,236,198,0.13)' : 'rgba(255,255,255,0.07)';
    ctx.lineWidth = Math.max(1, size * 0.01);
    for (var d = -5; d <= 5; d++) {
      var dx = d * (pw / 6);
      ctx.beginPath();
      ctx.moveTo(-pw / 2 + dx, 0);
      ctx.lineTo(-pw / 2 + dx + ph * 0.62, ph);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-pw / 2 + dx, ph);
      ctx.lineTo(-pw / 2 + dx + ph * 0.62, 0);
      ctx.stroke();
    }

    /* soft top sheen */
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-pw * 0.18, ph * 0.2, pw * 0.24, ph * 0.1, -0.08, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    /* chrome toe lip */
    ctx.fillStyle = 'rgba(201,183,148,0.5)';
    U.rr(ctx, -pw * 0.44, ph - size * 0.055, pw * 0.88, size * 0.028, size * 0.014);
    ctx.fill();

    T.eyebrow(ctx, 'Gas', 0, ph - size * 0.1, Math.max(8, size * 0.038),
      held ? 'rgba(255,238,198,0.7)' : 'rgba(226,180,120,0.35)');

    ctx.restore();
  };

  /* Big round press-and-hold lamp. Brushed brass bezel, warm glass face, a
     visible filament, and a halo that blooms as the play side lights up. */
  App.drawHoldButton = function (ctx, cx, cy, r, held, lit) {
    var press = held ? r * 0.045 : 0;

    T.glow(ctx, cx, cy, r * 3.2, T.C.lamp, 0.1 + 0.34 * lit, 0.38);

    /* socket shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.16, r * 1.06, r * 0.98, 0, 0, U.TAU);
    ctx.fill();

    /* brass bezel */
    var bez = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    bez.addColorStop(0, '#f8e5c2');
    bez.addColorStop(0.26, '#e3b87c');
    bez.addColorStop(0.6, '#b0814f');
    bez.addColorStop(1, '#6b482a');
    ctx.fillStyle = bez;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, U.TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,246,226,0.5)';
    ctx.lineWidth = Math.max(1, r * 0.014);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.955, 0, U.TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,35,18,0.4)';
    ctx.lineWidth = Math.max(1, r * 0.02);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.895, 0, U.TAU);
    ctx.stroke();

    /* glass face */
    var fr = r * 0.79;
    var fy = cy + press;
    var face = ctx.createRadialGradient(cx - fr * 0.26, fy - fr * 0.36, fr * 0.05, cx, fy, fr * 1.12);
    if (lit > 0.02) {
      face.addColorStop(0, T.mix('#a8643c', '#fff4d8', lit));
      face.addColorStop(0.42, T.mix('#7a452b', '#ffce8e', lit));
      face.addColorStop(1, T.mix('#3b211a', '#c67f42', lit));
    } else {
      face.addColorStop(0, '#7a4c33');
      face.addColorStop(0.55, '#5a3325');
      face.addColorStop(1, '#331d18');
    }
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(cx, fy, fr, 0, U.TAU);
    ctx.fill();

    /* pressed-in shading at the top edge */
    if (held) {
      var shade = ctx.createLinearGradient(cx, fy - fr, cx, fy + fr * 0.1);
      shade.addColorStop(0, 'rgba(30,12,6,0.45)');
      shade.addColorStop(0.6, 'rgba(30,12,6,0)');
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, fy, fr * 0.99, 0, U.TAU);
      ctx.clip();
      ctx.fillStyle = shade;
      ctx.fillRect(cx - fr, fy - fr, fr * 2, fr * 1.2);
      ctx.restore();
    }

    /* glass highlight */
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff9ec';
    ctx.beginPath();
    ctx.ellipse(cx - fr * 0.24, fy - fr * 0.44, fr * 0.42, fr * 0.18, -0.4, 0, U.TAU);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = lit > 0.2 ? T.rgba(T.C.lampHot, 0.9) : 'rgba(255,240,214,0.32)';
    ctx.lineWidth = Math.max(2, r * 0.035);
    ctx.beginPath();
    ctx.arc(cx, fy, fr * 0.985, 0, U.TAU);
    ctx.stroke();

    App.drawBulbGlyph(ctx, cx, fy - r * 0.02, r * 0.56, lit);

    /* hold feedback: a quiet ring that blooms; idle: a slow brass ring */
    if (held) {
      var tt = (App.clock * 0.7) % 1;
      ctx.save();
      ctx.globalAlpha = (1 - tt) * 0.5;
      ctx.strokeStyle = T.C.lampHot;
      ctx.lineWidth = Math.max(2, r * 0.06 * (1 - tt) + 1);
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1.02 + tt * 0.38), 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    } else {
      var pulse = 0.5 + 0.5 * Math.sin(App.clock * 1.6);
      ctx.strokeStyle = T.rgba(T.C.lamp, 0.1 + 0.16 * pulse);
      ctx.lineWidth = Math.max(2, r * 0.028);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.16, 0, U.TAU);
      ctx.stroke();
    }
  };

  /* A filament bulb: glass, two stems, a coil, brass base. */
  App.drawBulbGlyph = function (ctx, cx, cy, r, lit) {
    var br = r * 0.58;
    var by = cy - r * 0.22;

    if (lit > 0.08) T.glow(ctx, cx, by, r * 1.9, T.C.lampHot, 0.55 * lit, 0.3);

    /* glass */
    ctx.fillStyle = lit > 0.25 ? T.rgba('#fffaea', 0.98) : T.rgba('#f6e3c8', 0.42);
    ctx.beginPath();
    ctx.arc(cx, by, br, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = T.rgba('#fff6e0', lit > 0.2 ? 0.6 : 0.28);
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.arc(cx, by, br, 0, U.TAU);
    ctx.stroke();

    /* stems and coil */
    ctx.strokeStyle = lit > 0.2 ? '#fffdf2' : 'rgba(255,241,216,0.6)';
    ctx.lineWidth = Math.max(1.4, r * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - br * 0.36, by + br * 0.86);
    ctx.lineTo(cx - br * 0.36, by + br * 0.1);
    ctx.moveTo(cx + br * 0.36, by + br * 0.86);
    ctx.lineTo(cx + br * 0.36, by + br * 0.1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - br * 0.34, by + br * 0.1);
    ctx.lineTo(cx - br * 0.19, by - br * 0.3);
    ctx.lineTo(cx - br * 0.04, by + br * 0.1);
    ctx.lineTo(cx + br * 0.11, by - br * 0.3);
    ctx.lineTo(cx + br * 0.26, by + br * 0.1);
    ctx.stroke();

    /* brass base with ridges */
    var bw = br * 0.92;
    var bh = br * 0.52;
    var bx = cx - bw / 2;
    var byy = by + br * 0.8;
    var bgrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    bgrad.addColorStop(0, '#8d6238');
    bgrad.addColorStop(0.45, '#e7bd82');
    bgrad.addColorStop(1, '#7d5530');
    ctx.fillStyle = bgrad;
    U.rr(ctx, bx, byy, bw, bh, bh * 0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,36,18,0.4)';
    ctx.lineWidth = Math.max(1, r * 0.02);
    for (var i = 1; i <= 3; i++) {
      var yy = byy + (bh * i) / 4;
      ctx.beginPath();
      ctx.moveTo(bx + bw * 0.1, yy);
      ctx.lineTo(bx + bw * 0.9, yy);
      ctx.stroke();
    }
  };

  App.drawHand = function (ctx, cx, cy, s, on) {
    ctx.save();
    ctx.translate(cx + s * 0.02, cy);
    ctx.fillStyle = on ? '#fff3dd' : '#f2e2cc';
    ctx.strokeStyle = 'rgba(40,24,18,0.3)';
    ctx.lineWidth = 2;

    var fingers = [
      { x: -0.25, y: -0.52, w: 0.17, h: 0.56, r: 0.085 },
      { x: -0.05, y: -0.64, w: 0.17, h: 0.68, r: 0.085 },
      { x: 0.15, y: -0.58, w: 0.17, h: 0.62, r: 0.085 },
      { x: 0.34, y: -0.4, w: 0.16, h: 0.46, r: 0.08 }
    ];
    for (var i = 0; i < fingers.length; i++) {
      var f = fingers[i];
      U.rr(ctx, s * f.x - s * f.w / 2, s * f.y, s * f.w, s * f.h, s * f.r);
      ctx.fill();
      ctx.stroke();
    }

    U.rr(ctx, -s * 0.36, -s * 0.06, s * 0.72, s * 0.64, s * 0.22);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(-s * 0.38, s * 0.2);
    ctx.rotate(-0.55);
    U.rr(ctx, -s * 0.11, -s * 0.25, s * 0.22, s * 0.48, s * 0.11);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  };


  App.drawTouchFeedback = function (ctx) {
    var i;

    for (i = 0; i < App.ripples.length; i++) {
      var rp = App.ripples[i];
      var t = U.clamp(rp.t / 0.7, 0, 1);
      var rad = 10 + t * 74;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.5;
      ctx.strokeStyle = rp.role === 'hold' ? T.C.lamp : T.C.lampHot;
      ctx.lineWidth = 4 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rad, 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    }

    if (!App.touch) return;
    App.touch.pointers.forEach(function (p) {
      if (p.role !== 'play') return;
      var stage = App.stageRect();
      var rad = Math.min(stage.w, stage.h) * 0.05 + 18;
      T.glow(ctx, p.x, p.y, rad, T.C.lampHot, 0.28, 0.5);

      if (App.settings.activation === 'dwell' && p.armed) {
        var prog = U.clamp(p.dwell / App.settings.dwellTime, 0, 1);
        var rr = rad * 1.25;
        ctx.fillStyle = T.rgba(T.C.lamp, 0.1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr * prog, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, U.TAU);
        ctx.stroke();
        ctx.strokeStyle = T.C.lamp;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, -Math.PI / 2, -Math.PI / 2 + prog * U.TAU);
        ctx.stroke();
      }
    });
  };

  App.drawCards = function (ctx) {
    if (App.mode === 'ready') App.drawReady(ctx);
    else if (App.mode === 'resting') App.drawRest(ctx);
    else if (App.mode === 'ended') App.drawEnd(ctx);
  };

  App.card = function (ctx, title, sub, accent) {
    var p = App.stageRect();
    var base = Math.min(App.W, App.H);
    var cw = Math.min(p.w * 0.78, base * 0.64);
    var ch = cw * 0.46;
    var x = p.x + (p.w - cw) / 2;
    var y = p.y + (p.h - ch) / 2;
    var r = ch * 0.13;

    /* Cards arrive with a slow exhale, never a pop. */
    var tin = U.easeOutCubic(U.clamp((App.clock - App.modeAt) / 0.55, 0, 1));
    var sc = 0.97 + 0.03 * tin;

    ctx.save();
    ctx.globalAlpha = tin;
    ctx.translate(x + cw / 2, y + ch / 2);
    ctx.scale(sc, sc);
    ctx.translate(-(x + cw / 2), -(y + ch / 2));

    T.cardPanel(ctx, x, y, cw, ch, r, accent || T.C.gold);

    var ts = U.clamp(cw * 0.072, 16, 42);
    var ss = U.clamp(cw * 0.034, 11, 21);
    T.eyebrow(ctx, 'Magic Hand Play', x + cw / 2, y + ch * 0.235, ss * 0.7, T.rgba(T.C.gold, 0.5));
    T.text(ctx, title, x + cw / 2, y + ch * 0.475, ts, T.C.ink, 600, true);
    T.rule(ctx, x + cw / 2, y + ch * 0.655, cw * 0.24, 0.32);
    T.text(ctx, sub, x + cw / 2, y + ch * 0.785, ss, T.C.inkSoft, 500, false);

    ctx.restore();
    return { x: x, y: y, w: cw, h: ch };
  };

  App.drawReady = function (ctx) {
    var p = App.stageRect();
    var holdRequired = App.holdRequiredNow();
    var title = holdRequired ? 'Magic is sleeping' : 'Magic play';
    var sub = holdRequired ? 'Hold the big button' : 'Touch anywhere to begin';
    App.card(ctx, title, sub);

    if (holdRequired) {
      var dir = App.zone.swapped ? -1 : 1;
      var ax = p.x + p.w * (App.zone.swapped ? 0.13 : 0.87);
      var ay = p.y + p.h * 0.86;
      App.drawArrow(ctx, ax, ay, Math.min(p.w, p.h) * 0.075, dir);
    }
  };

  App.drawRest = function (ctx) {
    var p = App.zone.play;
    var base = Math.min(p.w, p.h);
    var pulse = 0.5 + 0.5 * Math.sin(App.clock * 1.7);

    /* Light still leaking in from the button side, so the dark feels alive. */
    var src = Zones.lightSource(App.zone);
    T.glow(ctx, src.x, src.y, base * 1.05, T.C.amber, 0.08 + 0.06 * pulse, 0.4);

    /* a sleepy filament, barely there */
    ctx.save();
    ctx.globalAlpha = 0.1 + 0.06 * pulse;
    App.drawBulbGlyph(ctx, p.x + p.w / 2, p.y + p.h * 0.5, base * 0.075, 0);
    ctx.restore();

    if (App.holdRequiredNow()) {
      var dir = App.zone.swapped ? -1 : 1;
      App.drawArrow(ctx, p.x + p.w * (App.zone.swapped ? 0.13 : 0.87), p.y + p.h * 0.86, base * 0.075, dir);
    }
  };

  App.drawEnd = function (ctx) {
    var p = App.stageRect();
    var base = Math.min(App.W, App.H);
    var cx = p.x + p.w / 2;
    var cy = p.y + p.h * 0.3;

    T.glow(ctx, cx, cy, base * 0.3, T.C.lamp, 0.5, 0.35);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(App.clock * 0.16);
    ctx.strokeStyle = T.rgba(T.C.gold, 0.62);
    ctx.lineWidth = base * 0.007;
    ctx.lineCap = 'round';
    for (var i = 0; i < 10; i++) {
      var a = (i / 10) * U.TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * base * 0.065, Math.sin(a) * base * 0.065);
      ctx.lineTo(Math.cos(a) * base * (0.1 + 0.012 * Math.sin(App.clock * 1.4 + i)), Math.sin(a) * base * (0.1 + 0.012 * Math.sin(App.clock * 1.4 + i)));
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = T.C.lampHot;
    ctx.beginPath();
    ctx.arc(cx, cy, base * 0.042, 0, U.TAU);
    ctx.fill();
    T.sparklePath(ctx, cx, cy, base * 0.085);
    ctx.fillStyle = T.rgba('#fff8e2', 0.85);
    ctx.fill();

    App.card(ctx, 'Well done!', App.holdRequiredNow() ? 'Let go, then hold the button to play again' : 'Touch to play again', T.C.gold);
  };

  App.drawArrow = function (ctx, cx, cy, s, dir) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(dir, 1);
    var bob = Math.sin(App.clock * 2.2) * s * 0.1;
    T.glow(ctx, bob, 0, s * 1.6, T.C.gold, 0.22, 0.4);
    ctx.fillStyle = T.rgba(T.C.gold, 0.9);
    ctx.beginPath();
    ctx.moveTo(-s * 0.52 + bob, -s * 0.19);
    ctx.lineTo(s * 0.02 + bob, -s * 0.19);
    ctx.lineTo(s * 0.02 + bob, -s * 0.4);
    ctx.lineTo(s * 0.56 + bob, 0);
    ctx.lineTo(s * 0.02 + bob, s * 0.4);
    ctx.lineTo(s * 0.02 + bob, s * 0.19);
    ctx.lineTo(-s * 0.52 + bob, s * 0.19);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  App.drawPad = function (ctx) {
    var pad = App.pad;
    if (!pad) return;
    var pressed = !!App.padPressed;

    ctx.save();
    ctx.globalAlpha = pressed ? 0.95 : 0.55;
    ctx.strokeStyle = T.rgba(T.C.brass, 0.45);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, pad.r, 0, U.TAU);
    ctx.stroke();

    ctx.fillStyle = pressed ? 'rgba(242,200,132,0.24)' : 'rgba(10,7,20,0.55)';
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, pad.r - 1, 0, U.TAU);
    ctx.fill();

    ctx.globalAlpha = pressed ? 0.95 : 0.5;
    ctx.fillStyle = T.C.gold;
    var lw = pad.r * 0.58;
    var lh = pad.r * 0.46;
    U.rr(ctx, pad.x - lw / 2, pad.y - lh * 0.12, lw, lh, lh * 0.25);
    ctx.fill();
    ctx.strokeStyle = T.rgba(T.C.gold, 0.85);
    ctx.lineWidth = Math.max(2, pad.r * 0.11);
    ctx.beginPath();
    ctx.arc(pad.x, pad.y - lh * 0.16, lw * 0.26, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  };


  /* --------------------------------------------------------- global bits */

  App.installGuards = function () {
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('selectstart', function (e) {
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
    });
    window.addEventListener('keydown', function (e) {
      var t = e.target;
      var typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      if (!typing && [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].indexOf(e.key) !== -1) {
        e.preventDefault();
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        if (App.mode === 'parent') App.backToPlay(false);
        else App.openParent();
      }
    }, { passive: false });

    window.addEventListener('pointerdown', function () { MG.Audio.unlock(); }, true);

    document.addEventListener('visibilitychange', function () {
      App._lastTs = 0;
      if (!document.hidden && App.mode === 'playing') App.requestWakeLock();
      if (App.touch) App.touch.measure();
    });

    window.addEventListener('beforeunload', function () {
      if (App.session.running) MG.Metrics.endSession();
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    App.boot();
  });
})(window.MG);
