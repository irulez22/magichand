/* Game - Three Goats (Bukkene Bruse).
   One contact sends the next goat to the bridge. The troll asks the classic
   question; a second contact lets the goat answer, and the troll waves it on.
   The troll is only ever curious: no threat, no failure, and the herd renews. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;

  var GOATS = [
    { scale: 0.84, look: 'bucket', coat: '#fdf7ea', shade: '#e2d2bc', ear: '#4b6079', answer: ['Ikke spis meg!', 'Ta den som kommer etter, han er mye større.'] },
    { scale: 1.0, look: 'shades', coat: '#f8f0e2', shade: '#ddcbb4', ear: '#46596f', answer: ['Ikke spis meg!', 'Vent til den største kommer, han er mye større.'] },
    { scale: 1.24, look: 'cap', coat: '#d9b892', shade: '#b99368', ear: '#4a4033', answer: ['Det er meg, den største bukken Bruse.'] }
  ];

  var TROLL_ASK = 'Hvem er det som tramper på min bru?';

  function Goats(app) {
    this.goatIndex = 0;
    this.done = [false, false, false];
    this.phase = 'idle';
    this.phaseT = 0;
    this.cross = 0;
    this.trollUp = 0;
    this.trollTarget = 0;
    this.line = null;
    this.cycle = 0;
    this.dusk = 0;
    this.stepT = 0;
    this._duskReset = false;
    this.walkInTime = 1.5;
    this.answerTime = 2.0;
    this.passTime = 1.6;
    this.nextTime = 1.1;
    this.finaleTime = 2.6;
    this.duskTime = 2.4;
    this.stopT = 0.42;
    this.bgStars = null;
    this.tufts = null;
    MG.BaseGame.call(this, app);
    this.id = 'goats';
    this.title = 'Three Goats';
  }

  Goats.prototype = Object.create(MG.BaseGame.prototype);
  Goats.prototype.constructor = Goats;

  Goats.prototype.layout = function () {
    var p = this.inset;
    this.unit = p.h * 0.072 * this.sizeFactor;
    this.groundY = p.y + p.h * 0.8;
    this.nearX = p.x + p.w * 0.18;
    this.farX = p.x + p.w * 0.84;
    this.bridge = { x0: p.x + p.w * 0.34, x1: p.x + p.w * 0.66 };
    this.bridgeY = this.groundY;
    this.arch = p.h * 0.022;
    this.trollU = p.h * 0.125;
    this.stream = { x0: p.x + p.w * 0.38, x1: p.x + p.w * 0.62, y0: this.groundY - p.h * 0.02 };

    if (!this.bgStars) this.bgStars = MG.Theme.stars(44, 5);
    if (!this.tufts) {
      this.tufts = [];
      for (var i = 0; i < 34; i++) {
        this.tufts.push({
          nx: U.rand(0.02, 0.98),
          ny: U.rand(0.82, 0.99),
          h: U.rand(0.5, 1.4),
          side: Math.random() < 0.5 ? -1 : 1
        });
      }
    }
  };

  Goats.prototype.goatPlaceX = function (want) {
    var p = this.inset;
    var margin = this.unit * 0.85;
    return U.clamp(want, p.x + margin, p.x + p.w - margin);
  };

  Goats.prototype.goatX = function (t) {
    return U.lerp(this.nearX, this.farX, t);
  };

  Goats.prototype.goatY = function (t) {
    return this.groundY - Math.sin(U.clamp(t, 0, 1) * Math.PI) * this.arch;
  };

  Goats.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);
    var p = this.inset;

    if (this.trollTarget > this.trollUp) this.trollUp = Math.min(this.trollTarget, this.trollUp + dt * 2.2);
    else if (this.trollTarget < this.trollUp) this.trollUp = Math.max(this.trollTarget, this.trollUp - dt * 1.7);

    this.stepT -= dt;

    if (this.phase === 'walkIn') {
      this.cross += (dt / this.walkInTime) * this.stopT;
      this.step();
      if (this.cross >= this.stopT) {
        this.cross = this.stopT;
        this.phase = 'challenge';
        this.phaseT = 0;
        this.trollTarget = 1;
        this.line = { who: 'troll', text: TROLL_ASK };
        MG.Audio.play('troll');
      }
    } else if (this.phase === 'challenge') {
      this.trollTarget = 1;
      this.stepT = 0.3;
    } else if (this.phase === 'answer') {
      this.phaseT += dt;
      if (this.phaseT >= this.answerTime) {
        this.phase = 'pass';
        this.phaseT = 0;
        this.trollTarget = 0;
        this.line = { who: 'troll', text: ['Så gå da, ' + (this.goatIndex === 2 ? 'store venn.' : 'lille venn.')] };
      }
    } else if (this.phase === 'pass') {
      this.cross += (dt / this.passTime) * (1 - this.stopT);
      this.step();
      if (this.cross >= 1) {
        this.cross = 1;
        this.arrive();
      }
    } else if (this.phase === 'next') {
      this.phaseT += dt;
      if (this.phaseT >= this.nextTime) {
        this.phase = 'idle';
        this.phaseT = 0;
        this.cross = 0;
        this.line = null;
        this.trollTarget = 0;
      }
    } else if (this.phase === 'finale') {
      this.phaseT += dt;
      this.trollTarget = 1;
      if (this.phaseT >= this.finaleTime) {
        this.phase = 'dusk';
        this.phaseT = 0;
        this.trollTarget = 0;
        this._duskReset = false;
      }
    } else if (this.phase === 'dusk') {
      this.phaseT += dt;
      this.dusk = Math.sin(U.clamp(this.phaseT / this.duskTime, 0, 1) * Math.PI);
      if (!this._duskReset && this.phaseT >= this.duskTime * 0.5) {
        this._duskReset = true;
        this.goatIndex = 0;
        this.done = [false, false, false];
        this.cross = 0;
        this.line = null;
        this.cycle += 1;
      }
      if (this.phaseT >= this.duskTime) {
        this.phase = 'idle';
        this.phaseT = 0;
        this.dusk = 0;
        this.trollUp = 0;
      }
    }
  };

  Goats.prototype.step = function () {
    if (this.stepT > 0) return;
    this.stepT = 0.3;
    MG.Audio.play('trip', (this.goatIndex + Math.floor(this.t * 2)) % 3);
  };

  Goats.prototype.arrive = function () {
    this.done[this.goatIndex] = true;
    MG.Audio.play('chime', this.goatIndex + 2);
    FX.sparkle(this.farX, this.groundY - this.unit, this.calm ? 4 : 8, 48);

    this.goatIndex += 1;
    this.phaseT = 0;
    this.cross = 0;
    this.line = null;

    if (this.goatIndex >= GOATS.length) {
      this.phase = 'finale';
      this.trollTarget = 1;
      MG.Audio.play('sparkle');
      FX.sparkle(this.inset.x + this.inset.w / 2, this.groundY - this.unit * 2, this.calm ? 5 : 10, 50);
    } else {
      this.phase = 'next';
    }
  };

  Goats.prototype.activate = function (x, y) {
    if (this.phase === 'idle') {
      this.phase = 'walkIn';
      this.phaseT = 0;
      this.cross = 0;
      this.line = null;
      this.trollTarget = 0;
      MG.Audio.play('trip', 0);
      return true;
    }
    if (this.phase === 'challenge') {
      var goat = GOATS[this.goatIndex] || GOATS[0];
      this.line = { who: 'goat', text: goat.answer };
      this.phase = 'answer';
      this.phaseT = 0;
      MG.Audio.play('bleat', this.goatIndex);
      FX.sparkle(x, y, this.calm ? 3 : 6, 48);
      return true;
    }
    /* Every other contact still gives a small, visible and audible reward. */
    MG.Audio.play('bleat', this.goatIndex);
    FX.sparkle(x, y, this.calm ? 3 : 5, 48);
    return true;
  };

  Goats.prototype.draw = function (ctx) {
    var p = this.inset;
    var T = MG.Theme;
    var i;

    var sky = ctx.createLinearGradient(0, p.y, 0, this.groundY);
    sky.addColorStop(0, '#070a18');
    sky.addColorStop(0.55, '#111a2e');
    sky.addColorStop(1, '#22303c');
    ctx.fillStyle = sky;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    for (i = 0; i < this.bgStars.length; i++) {
      var st = this.bgStars[i];
      var tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.t * st.sp + st.ph));
      ctx.globalAlpha = tw * 0.65;
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(p.x + st.nx * p.w, p.y + st.ny * p.h * 0.55, st.r, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // moon
    var mx = p.x + p.w * 0.82;
    var my = p.y + p.h * 0.14;
    var mr = Math.min(p.w, p.h) * 0.048;
    T.glow(ctx, mx, my, mr * 3.4, '#ffeec8', 0.4, 0.32);
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, U.TAU);
    ctx.fill();

    // distant hills
    ctx.fillStyle = 'rgba(10,24,26,0.85)';
    ctx.beginPath();
    ctx.moveTo(p.x, this.groundY - p.h * 0.02);
    ctx.quadraticCurveTo(p.x + p.w * 0.25, this.groundY - p.h * 0.14, p.x + p.w * 0.5, this.groundY - p.h * 0.04);
    ctx.quadraticCurveTo(p.x + p.w * 0.78, this.groundY - p.h * 0.11, p.x + p.w, this.groundY - p.h * 0.03);
    ctx.lineTo(p.x + p.w, this.groundY + 4);
    ctx.lineTo(p.x, this.groundY + 4);
    ctx.closePath();
    ctx.fill();

    // meadow
    var ground = ctx.createLinearGradient(0, this.groundY, 0, p.y + p.h);
    ground.addColorStop(0, '#17372c');
    ground.addColorStop(1, '#0b211c');
    ctx.fillStyle = ground;
    ctx.fillRect(p.x, this.groundY, p.w, p.y + p.h - this.groundY);

    // stream
    var water = ctx.createLinearGradient(0, this.groundY, 0, p.y + p.h);
    water.addColorStop(0, '#14384a');
    water.addColorStop(1, '#081c2a');
    ctx.fillStyle = water;
    ctx.fillRect(this.stream.x0, this.groundY - p.h * 0.01, this.stream.x1 - this.stream.x0, p.y + p.h - this.groundY + p.h * 0.01);

    ctx.strokeStyle = 'rgba(160,220,255,0.22)';
    ctx.lineWidth = 1.4;
    for (i = 0; i < 6; i++) {
      var gy = this.groundY + p.h * 0.035 + i * p.h * 0.045;
      var gx = this.stream.x0 + ((i * 37 + this.t * 14) % (this.stream.x1 - this.stream.x0) * 0.7);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + p.w * 0.05, gy);
      ctx.stroke();
    }

    // banks over the water edges
    ctx.fillStyle = '#102b23';
    ctx.fillRect(p.x, this.groundY, this.stream.x0 - p.x, p.y + p.h - this.groundY);
    ctx.fillRect(this.stream.x1, this.groundY, p.x + p.w - this.stream.x1, p.y + p.h - this.groundY);

    // grass tufts
    ctx.strokeStyle = 'rgba(126,214,176,0.22)';
    ctx.lineWidth = Math.max(1.2, this.unit * 0.06);
    for (i = 0; i < this.tufts.length; i++) {
      var tf = this.tufts[i];
      var tx = p.x + p.w * tf.nx;
      if (tx > this.stream.x0 && tx < this.stream.x1) continue;
      var ty = p.y + p.h * tf.ny;
      var th = this.unit * 0.55 * tf.h;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx - th * 0.3, ty - th * 0.6, tx - th * 0.4 * tf.side, ty - th);
      ctx.stroke();
    }

    this.drawTroll(ctx);
    this.drawBridge(ctx);
    this.drawTrollArms(ctx);

    for (i = 0; i < GOATS.length; i++) {
      if (this.done[i]) {
        this.drawGoat(ctx, this.goatPlaceX(this.farX + (i - 1) * this.unit * 1.5), this.groundY, GOATS[i], true);
      }
    }

    if (this.phase !== 'finale' && this.phase !== 'dusk' && this.goatIndex < GOATS.length) {
      var gx;
      var gy = this.groundY;
      if (this.phase === 'idle' || this.phase === 'next') {
        gx = this.nearX;
      } else {
        gx = this.goatX(this.cross);
        gy = this.goatY(this.cross);
      }
      this.drawGoat(ctx, gx, gy, GOATS[this.goatIndex], false);
    }

    // waiting goats behind the active one
    if (this.phase !== 'dusk') {
      for (i = 0; i < GOATS.length; i++) {
        if (this.done[i] || i <= this.goatIndex) continue;
        this.drawGoat(ctx, this.goatPlaceX(this.nearX - (i - this.goatIndex) * this.unit * 1.5), this.groundY, GOATS[i], false);
      }
    }

    this.drawBubble(ctx);

    if (this.dusk > 0.002) {
      ctx.fillStyle = 'rgba(4,4,12,' + (this.dusk * 0.82).toFixed(3) + ')';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  };

  Goats.prototype.drawBridge = function (ctx) {
    var T = MG.Theme;
    var b = this.bridge;
    var y = this.bridgeY;
    var planks = 9;
    var step = (b.x1 - b.x0) / planks;

    // posts
    ctx.fillStyle = '#4a3524';
    ctx.fillRect(b.x0 - 4, y - 10, 8, this.inset.h * 0.2);
    ctx.fillRect(b.x1 - 4, y - 10, 8, this.inset.h * 0.2);

    // deck
    for (var i = 0; i < planks; i++) {
      var t = (i + 0.5) / planks;
      var py = y - Math.sin(t * Math.PI) * this.arch;
      ctx.fillStyle = i % 2 ? '#5a422c' : '#674d33';
      U.rr(ctx, b.x0 + i * step + 1, py - 4, step - 2, 8, 3);
      ctx.fill();
    }

    // rail
    ctx.strokeStyle = 'rgba(230,200,150,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var k = 0; k <= 8; k++) {
      var tt = k / 8;
      var rx = U.lerp(b.x0, b.x1, tt);
      var ry = y - Math.sin(tt * Math.PI) * this.arch - this.inset.h * 0.075;
      if (k === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
    }
    ctx.stroke();
    for (var r = 1; r < 8; r += 2) {
      var t2 = r / 8;
      var px = U.lerp(b.x0, b.x1, t2);
      var py2 = y - Math.sin(t2 * Math.PI) * this.arch;
      ctx.beginPath();
      ctx.moveTo(px, py2 - 6);
      ctx.lineTo(px, py2 - this.inset.h * 0.075);
      ctx.stroke();
    }

    // lantern on the near post
    T.glow(ctx, b.x0, y - this.inset.h * 0.12, this.unit * 1.6, '#ffcf8a', 0.22, 0.4);
    ctx.fillStyle = T.C.gold;
    ctx.beginPath();
    ctx.arc(b.x0, y - this.inset.h * 0.1, Math.max(3, this.unit * 0.1), 0, U.TAU);
    ctx.fill();
  };

  Goats.prototype.drawTroll = function (ctx) {
    var T = MG.Theme;
    var p = this.inset;
    var u = this.trollU;
    var cx = p.x + p.w * 0.57;
    var baseY = this.groundY + u * 0.95 - this.trollUp * u * 1.2;
    var awake = this.trollUp > 0.35;
    var breathe = 1 + Math.sin(this.t * 1.1) * 0.012;
    var headY = baseY - u * 0.78;
    var headR = u * 0.58 * breathe;

    // warm lantern light catching the troll
    T.glow(ctx, cx, baseY - u * 0.5, u * 2.6, '#ffcf8a', 0.1 + 0.12 * this.trollUp, 0.4);

    // hunched body and shoulders
    ctx.fillStyle = '#3c3530';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, u * 1.02, u * 0.8, 0, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - u * 0.52, baseY - u * 0.3, u * 0.46, u * 0.36, -0.35, 0, U.TAU);
    ctx.ellipse(cx + u * 0.52, baseY - u * 0.3, u * 0.46, u * 0.36, 0.35, 0, U.TAU);
    ctx.fill();

    // lighter belly
    ctx.fillStyle = '#4c433c';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + u * 0.08, u * 0.62, u * 0.55, 0, 0, U.TAU);
    ctx.fill();

    // shaggy edge along the shoulders
    ctx.fillStyle = '#3c3530';
    for (var b = 0; b < 11; b++) {
      var ba = Math.PI + (b / 10) * Math.PI;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ba) * u * 0.95, baseY + Math.sin(ba) * u * 0.72, u * 0.12, 0, U.TAU);
      ctx.fill();
    }

    // big floppy ears
    ctx.fillStyle = '#332d28';
    for (var e = -1; e <= 1; e += 2) {
      ctx.save();
      ctx.translate(cx + e * headR * 0.88, headY + headR * 0.12);
      ctx.rotate(e * (0.62 + Math.sin(this.t * 0.9 + e) * 0.04));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(e * headR * 0.9, -headR * 0.55, e * headR * 1.1, headR * 0.05);
      ctx.quadraticCurveTo(e * headR * 0.9, headR * 0.5, 0, headR * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // skull
    ctx.fillStyle = '#443c36';
    ctx.beginPath();
    ctx.ellipse(cx, headY, headR * 0.98, headR, 0, 0, U.TAU);
    ctx.fill();

    // heavy brow
    ctx.strokeStyle = '#2b2622';
    ctx.lineWidth = Math.max(2, headR * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.54, headY - headR * 0.32);
    ctx.quadraticCurveTo(cx - headR * 0.28, headY - headR * 0.46, cx - headR * 0.08, headY - headR * 0.34);
    ctx.moveTo(cx + headR * 0.08, headY - headR * 0.34);
    ctx.quadraticCurveTo(cx + headR * 0.28, headY - headR * 0.46, cx + headR * 0.54, headY - headR * 0.32);
    ctx.stroke();

    // eyes: amber when awake, gentle closed curves asleep
    if (awake) {
      ctx.fillStyle = '#ffd39b';
      ctx.beginPath();
      ctx.ellipse(cx - headR * 0.27, headY - headR * 0.12, headR * 0.14, headR * 0.15, 0, 0, U.TAU);
      ctx.ellipse(cx + headR * 0.27, headY - headR * 0.12, headR * 0.14, headR * 0.15, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#1f1a16';
      ctx.beginPath();
      ctx.ellipse(cx - headR * 0.27, headY - headR * 0.1, headR * 0.05, headR * 0.09, 0, 0, U.TAU);
      ctx.ellipse(cx + headR * 0.27, headY - headR * 0.1, headR * 0.05, headR * 0.09, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6dd';
      ctx.beginPath();
      ctx.arc(cx - headR * 0.3, headY - headR * 0.16, headR * 0.025, 0, U.TAU);
      ctx.arc(cx + headR * 0.24, headY - headR * 0.16, headR * 0.025, 0, U.TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(226,244,232,0.75)';
      ctx.lineWidth = Math.max(1.4, headR * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx - headR * 0.42, headY - headR * 0.12);
      ctx.quadraticCurveTo(cx - headR * 0.27, headY - headR * 0.02, cx - headR * 0.12, headY - headR * 0.12);
      ctx.moveTo(cx + headR * 0.12, headY - headR * 0.12);
      ctx.quadraticCurveTo(cx + headR * 0.27, headY - headR * 0.02, cx + headR * 0.42, headY - headR * 0.12);
      ctx.stroke();
    }

    // long soft nose
    var noseG = ctx.createLinearGradient(cx, headY + headR * 0.05, cx, headY + headR * 0.7);
    noseG.addColorStop(0, '#8a7466');
    noseG.addColorStop(1, '#6a574b');
    ctx.fillStyle = noseG;
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.32, headR * 0.25, headR * 0.34, 0, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,244,225,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx - headR * 0.07, headY + headR * 0.2, headR * 0.08, headR * 0.1, -0.3, 0, U.TAU);
    ctx.fill();

    // wide toothy grin
    var my = headY + headR * 0.56;
    ctx.fillStyle = '#241a17';
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.46, my);
    ctx.quadraticCurveTo(cx, my + headR * 0.52, cx + headR * 0.46, my);
    ctx.quadraticCurveTo(cx, my + headR * 0.1, cx - headR * 0.46, my);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4ecd8';
    for (var ti = -2; ti <= 2; ti++) {
      U.rr(ctx, cx + ti * headR * 0.15 - headR * 0.052, my - headR * 0.015, headR * 0.104, headR * 0.14, headR * 0.03);
      ctx.fill();
    }

    // shaggy hair tuft
    ctx.strokeStyle = '#332d28';
    ctx.lineWidth = Math.max(1.4, headR * 0.07);
    ctx.lineCap = 'round';
    for (var m = -2; m <= 2; m++) {
      ctx.beginPath();
      ctx.moveTo(cx + m * headR * 0.14, headY - headR * 0.82);
      ctx.lineTo(cx + m * headR * 0.2, headY - headR * 1.05);
      ctx.stroke();
    }
  };

  /* Arms rest on the bridge deck while the troll is up. Drawn after the deck so
     the paws sit on top of the planks. */
  Goats.prototype.drawTrollArms = function (ctx) {
    var a = U.clamp(this.trollUp * 1.4, 0, 1);
    if (a <= 0.02) return;
    var p = this.inset;
    var u = this.trollU;
    var cx = p.x + p.w * 0.57;
    var deckY = this.groundY;
    var baseY = deckY + u * 0.95 - this.trollUp * u * 1.2;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#3c3530';
    ctx.lineCap = 'round';
    for (var e = -1; e <= 1; e += 2) {
      var shoulderX = cx + e * u * 0.72;
      var handX = cx + e * u * 0.95;
      ctx.lineWidth = u * 0.24;
      ctx.beginPath();
      ctx.moveTo(shoulderX, baseY - u * 0.28);
      ctx.quadraticCurveTo(handX + e * u * 0.12, deckY + u * 0.1, handX, deckY - u * 0.02);
      ctx.stroke();

      // paw with three rounded fingers
      ctx.fillStyle = '#443c36';
      ctx.beginPath();
      ctx.ellipse(handX, deckY - u * 0.04, u * 0.16, u * 0.1, 0, 0, U.TAU);
      ctx.fill();
      for (var f = -1; f <= 1; f++) {
        ctx.beginPath();
        ctx.ellipse(handX + f * u * 0.09, deckY - u * 0.02, u * 0.045, u * 0.07, 0, 0, U.TAU);
        ctx.fill();
      }
      ctx.strokeStyle = '#3c3530';
    }
    ctx.restore();
  };

  Goats.prototype.drawGoat = function (ctx, x, y, goat, graze) {
    var u = this.unit * goat.scale;
    var t = this.t;
    var phase = x * 0.04;
    var coat = goat.coat || '#fdf7ea';
    var shade = goat.shade || '#e2d2bc';
    var earCol = goat.ear || '#4b6079';
    var bodyR = u * 0.62;
    var bob = Math.sin(t * 5 + phase) * u * 0.02;
    var bodyY = y - bodyR * 1.55 + bob;
    var headR = u * 0.34;
    var headX = x + u * 0.34;
    var headY = bodyY - bodyR * 0.92;
    var gait = Math.sin(t * 5.5 + phase);

    // soft shadow
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#04100c';
    ctx.beginPath();
    ctx.ellipse(x, y + u * 0.02, u * 0.62, u * 0.11, 0, 0, U.TAU);
    ctx.fill();
    ctx.restore();

    // noodle legs with tiny hooves, diagonal gait
    var legs = [
      { dx: -0.34, swing: -gait, back: true },
      { dx: -0.2, swing: gait, back: false },
      { dx: 0.16, swing: gait, back: true },
      { dx: 0.3, swing: -gait, back: false }
    ];
    for (var l = 0; l < legs.length; l++) {
      var lg = legs[l];
      var lx = x + lg.dx * u;
      var lift = Math.max(0, Math.sin(t * 5.5 + phase + l * 1.6)) * u * 0.05;
      var footX = lx + lg.swing * u * 0.1;
      ctx.strokeStyle = lg.back ? shade : coat;
      ctx.lineWidth = Math.max(1.6, u * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx, bodyY + bodyR * 0.55);
      ctx.quadraticCurveTo(lx + lg.swing * u * 0.04, y - u * 0.28, footX, y - lift);
      ctx.stroke();
      ctx.fillStyle = '#3a302a';
      ctx.beginPath();
      ctx.ellipse(footX, y - lift, u * 0.045, u * 0.03, 0, 0, U.TAU);
      ctx.fill();
    }

    // tiny tail
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(x - bodyR * 0.95, bodyY + bodyR * 0.1, u * 0.07, u * 0.12, -0.6, 0, U.TAU);
    ctx.fill();

    // huge fluffy body
    var body = ctx.createRadialGradient(x - bodyR * 0.35, bodyY - bodyR * 0.45, bodyR * 0.15, x, bodyY, bodyR * 1.15);
    body.addColorStop(0, '#fffdf6');
    body.addColorStop(0.6, coat);
    body.addColorStop(1, shade);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, bodyY, bodyR, 0, U.TAU);
    ctx.fill();

    // fluff scallops around the body
    ctx.fillStyle = coat;
    for (var f = 0; f < 12; f++) {
      var fa = (f / 12) * U.TAU + 0.2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(fa) * bodyR * 0.96, bodyY + Math.sin(fa) * bodyR * 0.96, bodyR * 0.16, 0, U.TAU);
      ctx.fill();
    }
    // inner shading at the bottom
    ctx.fillStyle = 'rgba(120,95,65,0.12)';
    ctx.beginPath();
    ctx.ellipse(x + bodyR * 0.1, bodyY + bodyR * 0.55, bodyR * 0.7, bodyR * 0.3, 0.1, 0, U.TAU);
    ctx.fill();

    // small arm
    ctx.strokeStyle = coat;
    ctx.lineWidth = Math.max(1.6, u * 0.055);
    ctx.beginPath();
    ctx.moveTo(x + bodyR * 0.65, bodyY + bodyR * 0.15);
    ctx.lineTo(x + bodyR * 0.95, bodyY + bodyR * 0.5);
    ctx.stroke();

    // head (rotates down to graze)
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(graze ? 0.95 : 0);

    // long floppy ears behind the head
    for (var e = -1; e <= 1; e += 2) {
      ctx.save();
      ctx.translate(e * headR * 0.7, headR * 0.1);
      ctx.rotate(e * (0.9 + Math.sin(t * 2 + phase) * 0.06));
      ctx.fillStyle = earCol;
      ctx.beginPath();
      ctx.ellipse(0, e * headR * 0.55, headR * 0.34, headR * 0.78, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(0, e * headR * 0.5, headR * 0.18, headR * 0.55, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }

    // head
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(0, 0, headR * 0.95, headR, 0, 0, U.TAU);
    ctx.fill();

    // eyes: big white ovals with dark pupils
    var blink = Math.sin(t * 0.8 + phase) > 0.985;
    if (!blink) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-headR * 0.26, -headR * 0.12, headR * 0.28, headR * 0.32, 0, 0, U.TAU);
      ctx.ellipse(headR * 0.28, -headR * 0.12, headR * 0.28, headR * 0.32, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#201a16';
      ctx.beginPath();
      ctx.arc(-headR * 0.22, -headR * 0.08, headR * 0.12, 0, U.TAU);
      ctx.arc(headR * 0.32, -headR * 0.08, headR * 0.12, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-headR * 0.18, -headR * 0.14, headR * 0.045, 0, U.TAU);
      ctx.arc(headR * 0.36, -headR * 0.14, headR * 0.045, 0, U.TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#201a16';
      ctx.lineWidth = Math.max(1.2, headR * 0.06);
      ctx.beginPath();
      ctx.moveTo(-headR * 0.4, -headR * 0.1);
      ctx.lineTo(-headR * 0.12, -headR * 0.1);
      ctx.moveTo(headR * 0.12, -headR * 0.1);
      ctx.lineTo(headR * 0.4, -headR * 0.1);
      ctx.stroke();
    }

    // pink nose and small mouth
    ctx.fillStyle = '#e59aa0';
    ctx.beginPath();
    ctx.ellipse(0, headR * 0.38, headR * 0.2, headR * 0.14, 0, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,45,40,0.6)';
    ctx.lineWidth = Math.max(1, headR * 0.045);
    ctx.beginPath();
    ctx.arc(0, headR * 0.5, headR * 0.14, 0.3, Math.PI - 0.3);
    ctx.stroke();

    // accessories
    if (goat.look === 'shades') {
      ctx.fillStyle = 'rgba(20,20,24,0.92)';
      U.rr(ctx, -headR * 0.62, -headR * 0.34, headR * 0.52, headR * 0.32, headR * 0.1);
      ctx.fill();
      U.rr(ctx, headR * 0.1, -headR * 0.34, headR * 0.52, headR * 0.32, headR * 0.1);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,20,24,0.92)';
      ctx.lineWidth = Math.max(1, headR * 0.05);
      ctx.beginPath();
      ctx.moveTo(-headR * 0.1, -headR * 0.18);
      ctx.lineTo(headR * 0.1, -headR * 0.18);
      ctx.stroke();
    } else if (goat.look === 'bucket') {
      ctx.fillStyle = '#f0c64f';
      ctx.beginPath();
      ctx.ellipse(0, -headR * 0.78, headR * 0.66, headR * 0.2, 0, 0, U.TAU);
      ctx.fill();
      U.rr(ctx, -headR * 0.34, -headR * 1.32, headR * 0.68, headR * 0.58, headR * 0.12);
      ctx.fill();
    } else if (goat.look === 'cap') {
      ctx.fillStyle = '#c94f45';
      ctx.beginPath();
      ctx.arc(0, -headR * 0.85, headR * 0.5, Math.PI, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#b13f37';
      ctx.beginPath();
      ctx.ellipse(headR * 0.42, -headR * 0.82, headR * 0.42, headR * 0.12, 0.1, 0, U.TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  Goats.prototype.drawBubble = function (ctx) {
    if (!this.line) return;
    var p = this.inset;
    var T = MG.Theme;
    var who = this.line.who;
    var lines = Array.isArray(this.line.text) ? this.line.text : [this.line.text];
    var w = Math.min(p.w * 0.78, 640);
    var h = Math.max(52, p.h * (lines.length > 1 ? 0.22 : 0.16));
    var x = p.x + (p.w - w) / 2;
    var y = p.y + p.h * 0.06;
    var accent = who === 'troll' ? '#9fe3c0' : T.C.gold;

    /* opaque underlay so the moon and stars never show through the panel */
    ctx.fillStyle = 'rgba(19,13,31,0.98)';
    U.rr(ctx, x, y, w, h, h * 0.28);
    ctx.fill();
    T.cardPanel(ctx, x, y, w, h, h * 0.28, accent);

    var label = who === 'troll' ? 'TROLLET' : 'BUKKEN';
    var fs = U.clamp(h * 0.3, 11, 22);
    T.eyebrow(ctx, label, x + w / 2, y + h * 0.2, Math.max(8, fs * 0.5), T.rgba(accent, 0.8));

    var size = fs;
    T.font(ctx, size, 500, false);
    var longest = 0;
    for (var li = 0; li < lines.length; li++) {
      longest = Math.max(longest, ctx.measureText(lines[li]).width);
    }
    while (size > 10 && longest > w * 0.9) {
      size -= 1;
      T.font(ctx, size, 500, false);
      longest = 0;
      for (var lj = 0; lj < lines.length; lj++) {
        longest = Math.max(longest, ctx.measureText(lines[lj]).width);
      }
    }

    var lh = size * 1.32;
    var startY = y + h * 0.55 - ((lines.length - 1) * lh) / 2;
    for (var lk = 0; lk < lines.length; lk++) {
      T.text(ctx, lines[lk], x + w / 2, startY + lk * lh, size, T.C.ink, 500, false);
    }

    // little tail
    ctx.fillStyle = 'rgba(22,15,35,0.92)';
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 9, y + h - 1);
    ctx.lineTo(x + w / 2 + 9, y + h - 1);
    ctx.lineTo(x + w / 2, y + h + 12);
    ctx.closePath();
    ctx.fill();
  };

  MG.Games = MG.Games || {};
  MG.Games.goats = Goats;
})(window.MG);
