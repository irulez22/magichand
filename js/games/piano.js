/* Game - Magic Piano.
   An original rainbow keyboard: hold the power side to wake it, then touch
   one or more keys. Four synthesised instruments and four public-domain tunes
   are always available. No score, timer or failure. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;
  var T = MG.Theme;

  var WHITE = [
    { midi: 60, label: 'C', kind: 'cat' },
    { midi: 62, label: 'D', kind: 'dog' },
    { midi: 64, label: 'E', kind: 'bird' },
    { midi: 65, label: 'F', kind: 'frog' },
    { midi: 67, label: 'G', kind: 'fish' },
    { midi: 69, label: 'A', kind: 'rabbit' },
    { midi: 71, label: 'B', kind: 'bear' },
    { midi: 72, label: 'C', kind: 'owl' },
    { midi: 74, label: 'D', kind: 'fox' },
    { midi: 76, label: 'E', kind: 'sheep' },
    { midi: 77, label: 'F', kind: 'duck' },
    { midi: 79, label: 'G', kind: 'mouse' }
  ];
  var BLACK = [
    { midi: 61, after: 0 },
    { midi: 63, after: 1 },
    { midi: 66, after: 3 },
    { midi: 68, after: 4 },
    { midi: 70, after: 5 }
  ];
  var HUES = [8, 26, 44, 92, 132, 168, 196, 220, 248, 276, 300, 330];
  var INSTRUMENTS = [
    { id: 'piano', label: 'Piano' },
    { id: 'xylophone', label: 'Xylophone' },
    { id: 'flute', label: 'Flute' },
    { id: 'musicbox', label: 'Music box' },
    { id: 'drum', label: 'Drums' },
    { id: 'animal', label: 'Animals' }
  ];
  var SONGS = {
    twinkle: {
      label: 'Twinkle',
      notes: [
        [60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2],
        [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2]
      ]
    },
    mary: {
      label: 'Mary',
      notes: [
        [64, 1], [62, 1], [60, 1], [62, 1], [64, 1], [64, 1], [64, 2],
        [62, 1], [62, 1], [62, 2], [64, 1], [67, 1], [67, 2]
      ]
    },
    ode: {
      label: 'Ode',
      notes: [
        [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1],
        [60, 1], [60, 1], [62, 1], [64, 1], [64, 1.5], [62, 0.5], [62, 2]
      ]
    },
    birthday: {
      label: 'Birthday',
      notes: [
        [67, 1], [67, 1], [69, 1], [67, 1], [72, 1], [71, 2],
        [67, 1], [67, 1], [69, 1], [67, 1], [74, 1], [72, 2],
        [67, 1], [67, 1], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
        [77, 1], [77, 1], [76, 1], [72, 1], [74, 1], [72, 2]
      ]
    }
  };
  var BEAT = 0.48;

  function Piano(app) {
    this.instrument = 'piano';
    this.songId = null;
    this.song = null;
    this.songIndex = 0;
    this.songT = 0;
    this.songStarted = false;
    this.songKey = -1;
    this.songGlow = 0;
    this.keys = [];
    this.chips = [];
    this.keyGlow = [];
    this.power = 0;
    this.powered = false;
    this.lastNote = null;
    this.holdStyle = 'power';
    this.keepLit = true;
    MG.BaseGame.call(this, app);
    this.id = 'piano';
    this.title = 'Magic Piano';
  }

  Piano.prototype = Object.create(MG.BaseGame.prototype);
  Piano.prototype.constructor = Piano;

  /* --------------------------------------------------------------- layout */

  Piano.prototype.layout = function () {
    var p = this.inset;
    var top = p.y + p.h * 0.3;
    var keyH = p.h * 0.64;
    var keyW = p.w / WHITE.length;
    var i;

    this.keyboard = { x: p.x, y: top, w: p.w, h: keyH };
    this.keys = [];
    this.keyGlow = [];

    for (i = 0; i < WHITE.length; i++) {
      this.keys.push({
        index: this.keys.length,
        black: false,
        midi: WHITE[i].midi,
        label: WHITE[i].label,
        kind: WHITE[i].kind,
        hue: HUES[i],
        x: p.x + i * keyW + 1,
        y: top,
        w: Math.max(8, keyW - 2),
        h: keyH
      });
      this.keyGlow.push(0);
    }
    for (i = 0; i < BLACK.length; i++) {
      var b = BLACK[i];
      var bx = p.x + (b.after + 1) * keyW - keyW * 0.31;
      this.keys.push({
        index: this.keys.length,
        black: true,
        midi: b.midi,
        label: '',
        kind: '',
        hue: HUES[b.after],
        x: bx,
        y: top,
        w: Math.max(5, keyW * 0.62),
        h: keyH * 0.56
      });
      this.keyGlow.push(0);
    }

    this.chips = [];
    var by = p.y + p.h * 0.04;
    var bh = p.h * 0.085;
    var bw = p.w * 0.15;
    for (i = 0; i < INSTRUMENTS.length; i++) {
      this.chips.push({
        type: 'instrument', id: INSTRUMENTS[i].id, label: INSTRUMENTS[i].label,
        x: p.x + p.w * 0.018 + i * p.w * 0.1605, y: by, w: bw, h: bh
      });
    }
    var sy = p.y + p.h * 0.145;
    var ids = Object.keys(SONGS);
    for (i = 0; i < ids.length; i++) {
      this.chips.push({
        type: 'song', id: ids[i], label: SONGS[ids[i]].label,
        x: p.x + p.w * 0.02 + i * p.w * 0.245, y: sy, w: bw, h: bh
      });
    }
  };

  Piano.prototype.enter = function () {
    this.songId = null;
    this.song = null;
    this.songIndex = 0;
    this.songT = 0;
    this.songStarted = false;
    this.songKey = -1;
    this.songGlow = 0;
    this.lastNote = null;
    this.power = 0;
  };

  /* ---------------------------------------------------------------- input */

  Piano.prototype.keyAt = function (x, y) {
    for (var i = 0; i < this.keys.length; i++) {
      var k = this.keys[i];
      if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) {
        if (k.black) return k;
      }
    }
    for (var j = 0; j < this.keys.length; j++) {
      var w = this.keys[j];
      if (!w.black && x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return w;
    }
    return null;
  };

  Piano.prototype.chipAt = function (x, y) {
    for (var i = 0; i < this.chips.length; i++) {
      var c = this.chips[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
    }
    return null;
  };

  Piano.prototype.keyForMidi = function (midi) {
    for (var i = 0; i < this.keys.length; i++) {
      if (this.keys[i].midi === midi) return this.keys[i];
    }
    return null;
  };

  Piano.prototype.playKey = function (key, soft) {
    if (!key) return;
    var midi = key.midi;
    var pan = U.clamp((key.x + key.w / 2 - this.play.x) / this.play.w * 2 - 1, -1, 1) * 0.45;
    MG.Audio.note(midi, this.instrument, soft ? 0.065 : 0.1, pan, key.kind);
    this.lastNote = { midi: midi, instrument: this.instrument, key: key.index, at: this.t };
    this.keyGlow[key.index] = 1;
    this.songKey = key.index;
    this.songGlow = 1;
    if (!this.calm) {
      FX.sparkle(key.x + key.w / 2, key.y + key.h * 0.42,
        key.black ? 2 : 4, key.hue);
      FX.ring(key.x + key.w / 2, key.y + key.h * 0.42, {
        r0: 3, r1: Math.min(key.w, key.h) * 0.4, hue: key.hue,
        width: 2, dur: 0.45, alpha: 0.35
      });
    }
  };

  Piano.prototype.selectInstrument = function (id) {
    this.instrument = id;
    var key = this.keyForMidi(67);
    if (key && this.powered) this.playKey(key, true);
  };

  Piano.prototype.selectSong = function (id) {
    if (this.songId === id) {
      this.songId = null;
      this.song = null;
      this.songStarted = false;
      return;
    }
    this.songId = id;
    this.song = SONGS[id];
    this.songIndex = 0;
    this.songT = 0;
    this.songStarted = false;
  };

  Piano.prototype.activate = function (x, y, info) {
    var deliberate = !info || info.reason === 'touch' || info.reason === 'dwell';
    var chip = this.chipAt(x, y);
    if (chip) {
      if (!deliberate || !this.powered) return true;
      if (chip.type === 'instrument') this.selectInstrument(chip.id);
      else this.selectSong(chip.id);
      return true;
    }
    var key = this.keyAt(x, y);
    if (key && this.powered) {
      if (!info || !info.pointer || info.pointer._pianoKey !== key.index) {
        this.playKey(key);
      }
      if (info && info.pointer) info.pointer._pianoKey = key.index;
    }
    return true;
  };

  /* --------------------------------------------------------------- update */

  Piano.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);
    var app = this.app;
    var active = app.mode === 'playing';
    var wantPower = active && (app.holdRequiredNow() ? app.holdCount > 0 : true);
    this.power = U.approach(this.power, wantPower ? 1 : 0, 4.5, dt);
    this.powered = wantPower;

    for (var g = 0; g < this.keyGlow.length; g++) {
      if (this.keyGlow[g] > 0) this.keyGlow[g] = Math.max(0, this.keyGlow[g] - dt * 2.2);
    }
    if (this.songGlow > 0) this.songGlow = Math.max(0, this.songGlow - dt * 1.5);

    if (!active) return;

    /* keys currently under play-side contacts */
    var ptrs = app.playPointers ? app.playPointers() : [];
    for (var i = 0; i < ptrs.length; i++) {
      var p = ptrs[i];
      var key = this.powered ? this.keyAt(p.x, p.y) : null;
      if (key) {
        if (p._pianoKey !== key.index) {
          this.playKey(key);
          p._pianoKey = key.index;
        }
      } else {
        p._pianoKey = -1;
      }
    }

    /* automatic song, paused whenever the power is off */
    if (this.song && this.powered) {
      if (!this.songStarted) {
        this.songStarted = true;
        var first = this.song.notes[0];
        var firstKey = first ? this.keyForMidi(first[0]) : null;
        if (firstKey) this.playKey(firstKey, true);
        this.songIndex = 1;
      } else {
        this.songT += dt;
        var guard = 0;
        while (this.song && guard < 8) {
          var note = this.song.notes[this.songIndex];
          var beats = note ? note[1] * BEAT : 0;
          if (this.songT < beats) break;
          this.songT -= beats;
          var target = this.keyForMidi(note[0]);
          if (target) this.playKey(target, true);
          this.songIndex += 1;
          if (this.songIndex >= this.song.notes.length) {
            this.song = null;
            this.songId = null;
            this.songStarted = false;
            this.songKey = -1;
          }
          guard += 1;
        }
      }
    }
  };

  /* ----------------------------------------------------------------- draw */

  Piano.prototype.draw = function (ctx) {
    var p = this.inset;
    var i;

    var bg = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    bg.addColorStop(0, '#150e22');
    bg.addColorStop(0.55, '#100b19');
    bg.addColorStop(1, '#08060e');
    ctx.fillStyle = bg;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    /* a warm glow under the keyboard wakes with the power */
    if (this.power > 0.01) {
      T.glow(ctx, p.x + p.w / 2, this.keyboard.y + this.keyboard.h * 0.2,
        p.w * 0.55, T.C.amber, 0.06 + 0.08 * this.power, 0.5);
    }

    for (i = 0; i < this.chips.length; i++) this.drawChip(ctx, this.chips[i]);

    for (i = 0; i < this.keys.length; i++) {
      if (!this.keys[i].black) this.drawKey(ctx, this.keys[i]);
    }
    for (i = 0; i < this.keys.length; i++) {
      if (this.keys[i].black) this.drawKey(ctx, this.keys[i]);
    }

    /* power indicator */
    var px = p.x + p.w - p.w * 0.035;
    var py = p.y + p.h * 0.255;
    ctx.fillStyle = this.powered ? 'rgba(255,220,150,0.9)' : 'rgba(180,170,190,0.28)';
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2.5, p.w * 0.006), 0, U.TAU);
    ctx.fill();
  };

  Piano.prototype.drawChip = function (ctx, chip) {
    var selected = chip.type === 'instrument'
      ? this.instrument === chip.id
      : this.songId === chip.id;
    var r = Math.min(chip.w, chip.h) * 0.3;
    ctx.fillStyle = selected ? 'rgba(232,198,128,0.16)' : 'rgba(255,255,255,0.035)';
    U.rr(ctx, chip.x, chip.y, chip.w, chip.h, r);
    ctx.fill();
    ctx.strokeStyle = selected ? 'rgba(232,198,128,0.7)' : 'rgba(232,198,128,0.16)';
    ctx.lineWidth = 1;
    U.rr(ctx, chip.x + 0.5, chip.y + 0.5, chip.w - 1, chip.h - 1, r);
    ctx.stroke();
    var fs = U.clamp(chip.h * 0.42, 9, 15);
    U.text(ctx, chip.label, chip.x + chip.w / 2, chip.y + chip.h / 2,
      fs, selected ? T.C.gold : 'rgba(220,212,230,0.62)', 600, 'center', 'middle');
  };

  Piano.prototype.drawKey = function (ctx, key) {
    var glow = this.keyGlow[key.index] || 0;
    var power = this.power;
    var hue = key.hue;
    var sat = key.black ? 12 : Math.round(18 + 40 * power);
    var lum = key.black ? Math.round(7 + 7 * power) : Math.round(21 + 37 * power);
    var r = Math.max(3, Math.min(key.w, key.h) * 0.08);

    if (glow > 0.01) {
      T.glow(ctx, key.x + key.w / 2, key.y + key.h * 0.4,
        Math.max(key.w, key.h) * (0.5 + glow * 0.2), '#ffd39b',
        0.12 + glow * 0.22, 0.35);
    }

    var grad = ctx.createLinearGradient(0, key.y, 0, key.y + key.h);
    grad.addColorStop(0, U.hsl(hue, sat, lum + 18));
    grad.addColorStop(0.5, U.hsl(hue, sat, lum + 8));
    grad.addColorStop(1, U.hsl(hue, sat, lum - 7));
    ctx.fillStyle = grad;
    U.rr(ctx, key.x, key.y, key.w, key.h, r);
    ctx.fill();
    ctx.strokeStyle = glow > 0.05
      ? 'rgba(255,235,185,' + (0.5 + glow * 0.4).toFixed(3) + ')'
      : 'rgba(8,6,14,0.7)';
    ctx.lineWidth = glow > 0.05 ? 2 : 1;
    U.rr(ctx, key.x + 0.5, key.y + 0.5, key.w - 1, key.h - 1, r);
    ctx.stroke();

    if (!key.black) {
      /* gloss */
      ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + 0.08 * power).toFixed(3) + ')';
      U.rr(ctx, key.x + key.w * 0.12, key.y + 4, key.w * 0.76, key.h * 0.16, r);
      ctx.fill();

      var faceR = Math.min(key.w * 0.22, key.h * 0.1);
      this.drawFace(ctx, key.x + key.w / 2, key.y + key.h * 0.38,
        faceR, key.kind, key.hue, 0.25 + 0.65 * power);

      var fs = U.clamp(key.w * 0.22, 8, 14);
      U.text(ctx, key.label, key.x + key.w / 2, key.y + key.h * 0.88,
        fs, 'rgba(255,250,235,' + (0.25 + 0.6 * power).toFixed(3) + ')', 700, 'center', 'middle');
    } else {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.04 + 0.06 * power).toFixed(3) + ')';
      U.rr(ctx, key.x + key.w * 0.2, key.y + 4, key.w * 0.6, key.h * 0.18, r);
      ctx.fill();
    }
  };

  /* One small, original face per white key. No image assets. */
  Piano.prototype.drawFace = function (ctx, x, y, r, kind, hue, alpha) {
    if (r < 2) return;
    ctx.save();
    ctx.globalAlpha = U.clamp(alpha, 0, 1);
    ctx.fillStyle = 'rgba(255,246,226,0.92)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
    ctx.fill();

    /* ears */
    ctx.fillStyle = U.hsl(hue, 45, 42);
    if (kind === 'rabbit') {
      ctx.beginPath();
      ctx.ellipse(x - r * 0.45, y - r * 0.95, r * 0.22, r * 0.5, -0.2, 0, U.TAU);
      ctx.ellipse(x + r * 0.45, y - r * 0.95, r * 0.22, r * 0.5, 0.2, 0, U.TAU);
      ctx.fill();
    } else if (kind === 'cat' || kind === 'fox') {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.85, y - r * 0.35);
      ctx.lineTo(x - r * 0.7, y - r * 1.25);
      ctx.lineTo(x - r * 0.2, y - r * 0.72);
      ctx.closePath();
      ctx.moveTo(x + r * 0.85, y - r * 0.35);
      ctx.lineTo(x + r * 0.7, y - r * 1.25);
      ctx.lineTo(x + r * 0.2, y - r * 0.72);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'bear' || kind === 'mouse' || kind === 'sheep') {
      ctx.beginPath();
      ctx.arc(x - r * 0.78, y - r * 0.7, r * 0.32, 0, U.TAU);
      ctx.arc(x + r * 0.78, y - r * 0.7, r * 0.32, 0, U.TAU);
      ctx.fill();
    } else if (kind === 'bird' || kind === 'owl' || kind === 'duck') {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, y + r * 0.35);
      ctx.lineTo(x - r * 0.5, y - r * 0.1);
      ctx.lineTo(x - r * 0.15, y + r * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    /* eyes and beak/smile */
    ctx.fillStyle = '#241a14';
    ctx.beginPath();
    ctx.arc(x - r * 0.34, y - r * 0.05, Math.max(0.8, r * 0.11), 0, U.TAU);
    ctx.arc(x + r * 0.34, y - r * 0.05, Math.max(0.8, r * 0.11), 0, U.TAU);
    ctx.fill();
    if (kind === 'bird' || kind === 'owl' || kind === 'duck') {
      ctx.fillStyle = 'rgba(230,150,60,0.9)';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.16, y + r * 0.18);
      ctx.lineTo(x + r * 0.16, y + r * 0.18);
      ctx.lineTo(x, y + r * 0.45);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = '#241a14';
      ctx.lineWidth = Math.max(0.8, r * 0.1);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y + r * 0.22, r * 0.24, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
    ctx.restore();
  };

  MG.Games = MG.Games || {};
  MG.Games.piano = Piano;
})(window.MG);
