/* Game 1 - Magic Balloons. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;

  function Balloons(app) {
    this.list = [];
    this.clouds = [];
    this.pops = 0;
    this.sinceSalute = 0;
    this.salute = 0;
    this.hue = U.rand(0, 360);
    MG.BaseGame.call(this, app);
    this.id = 'balloons';
    this.title = 'Magic Balloons';
  }

  Balloons.prototype = Object.create(MG.BaseGame.prototype);
  Balloons.prototype.constructor = Balloons;

  Balloons.prototype.layout = function () {
    var p = this.inset;
    var sizes = { xlarge: 0.2, large: 0.145, medium: 0.1 };
    this.baseR = Math.max(30, Math.min(p.w, p.h) * (sizes[this.settings.targetSize] || 0.145));

    var per = Math.PI * this.baseR * this.baseR * 2.1;
    this.targetCount = U.clamp(Math.round((p.w * p.h) / per), 2, 6);

    if (!this.list) this.list = [];
    while (this.list.length > this.targetCount) this.list.pop();
    for (var i = 0; i < this.list.length; i++) {
      var b = this.list[i];
      b.r = this.baseR * b.sizeMul;
      b.x = U.clamp(b.x, p.x + b.r, p.x + p.w - b.r);
      b.y = U.clamp(b.y, p.y + b.r * 1.2, p.y + p.h + b.r);
    }
    while (this.list.length < this.targetCount) {
      this.list.push(this.spawn());
    }

    if (!this.clouds || this.clouds.length === 0) {
      this.clouds = [];
      for (var c = 0; c < 3; c++) {
        this.clouds.push({ nx: U.rand(0.1, 0.9), ny: U.rand(0.05, 0.4), s: U.rand(0.6, 1.1), v: U.rand(0.002, 0.006) });
      }
    }
  };

  /* Always place new balloons inside the play area so a popped balloon is
     replaced straight away instead of crawling up from below the screen. */
  Balloons.prototype.spawn = function (avoidX, avoidY) {
    var p = this.inset;
    var r = this.baseR * U.rand(0.88, 1.12);
    var margin = r + 10;
    var x = p.x + p.w / 2;
    var y = p.y + p.h / 2;

    for (var tries = 0; tries < 16; tries++) {
      x = U.rand(p.x + margin, p.x + p.w - margin);
      y = U.rand(p.y + margin, p.y + p.h - margin);
      var ok = true;
      for (var i = 0; i < this.list.length; i++) {
        var o = this.list[i];
        if (U.dist(x, y, o.x, o.y) < (o.r + r) * 0.78) { ok = false; break; }
      }
      if (ok && avoidX !== undefined && U.dist(x, y, avoidX, avoidY) < r * 1.15) ok = false;
      if (ok) break;
    }

    return {
      x: x,
      baseX: x,
      y: y,
      r: r,
      sizeMul: r / this.baseR,
      hue: this.nextHue(),
      phase: U.rand(0, U.TAU),
      sway: U.rand(8, 40),
      swayF: U.rand(0.3, 0.75) * U.pick([-1, 1]),
      vy: -U.rand(8, 19),
      bob: U.rand(0, U.TAU),
      blink: U.rand(1.4, 4.5),
      blinkT: 0,
      grow: 0
    };
  };

  Balloons.prototype.nextHue = function () {
    this.hue = (this.hue + U.rand(47, 83)) % 360;
    return this.hue;
  };

  Balloons.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);
    var p = this.inset;
    var m = this.motion;

    for (var i = 0; i < this.list.length; i++) {
      var b = this.list[i];
      b.y += b.vy * m * dt;
      var sway = Math.sin(this.t * b.swayF + b.phase) * b.sway * (0.25 + m * 0.75);
      b.x = b.baseX + sway;
      b.x = U.clamp(b.x, p.x + b.r * 0.96, p.x + p.w - b.r * 0.96);

      if (b.y + b.r * 1.25 < p.y) {
        this.recycle(b);
      }

      b.blinkT += dt;
      if (b.blinkT > b.blink) { b.blinkT = 0; b.blink = U.rand(1.6, 5); }

      if (b.grow < 1) b.grow = Math.min(1, b.grow + dt * 2.6);
    }

    if (this.salute > 0) this.salute = Math.max(0, this.salute - dt * 0.7);
  };

  Balloons.prototype.recycle = function (b) {
    var p = this.inset;
    b.hue = this.nextHue();
    b.r = this.baseR * U.rand(0.88, 1.12);
    b.sizeMul = b.r / this.baseR;
    b.baseX = U.rand(p.x + b.r + 8, p.x + p.w - b.r - 8);
    b.x = b.baseX;
    b.y = U.rand(p.y + b.r * 1.25, p.y + p.h - b.r * 1.2);
    b.vy = -U.rand(8, 19);
    b.phase = U.rand(0, U.TAU);
    b.grow = 0;
  };

  Balloons.prototype.activate = function (x, y) {
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < this.list.length; i++) {
      var b = this.list[i];
      var d = U.dist(x, y, b.x, b.y) - b.r * 0.6;
      if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) { FX.sparkle(x, y, 4, 50); return false; }

    var reach = best.r * (1.02 + this.rewardFactor * 0.22);
    var hit = U.dist(x, y, best.x, best.y) <= reach;

    if (!hit && this.settings.anyTouch) hit = true;
    if (!hit) { FX.sparkle(x, y, 3, 50); return false; }

    return this.pop(best, x, y);
  };

  Balloons.prototype.pop = function (b, fromX, fromY) {
    var p = this.inset;
    var big = this.calm ? 12 : 24;
    FX.confetti(b.x, b.y, big, { hue: b.hue, speed: 330, alpha: 0.95 });
    FX.sparkle(b.x, b.y, this.calm ? 5 : 11, 52);
    FX.ring(b.x, b.y, { r0: b.r * 0.3, r1: b.r * 2.5, hue: b.hue, width: b.r * 0.16, dur: 0.62 });
    if (fromX !== undefined && U.dist(fromX, fromY, b.x, b.y) > b.r * 0.9) {
      FX.trail(fromX, fromY, b.x, b.y, b.hue);
    }
    MG.Audio.play('pop', this.pops % 6);
    if (U.chance(0.5)) MG.Audio.play('chime', U.randInt(0, 7));

    this.pops += 1;

    /* A quiet milestone: every dozen pops the moon gives a little salute.
       Purely environmental, so there is nothing extra to aim at. */
    this.sinceSalute += 1;
    if (this.sinceSalute >= 12) {
      this.sinceSalute = 0;
      this.salute = 1;
      MG.Audio.play('chime', 5);
    }

    var idx = this.list.indexOf(b);
    if (idx >= 0) this.list.splice(idx, 1);

    var nb = this.spawn(fromX, fromY);
    this.list.push(nb);
    FX.sparkle(nb.x, nb.y, this.calm ? 3 : 5, nb.hue);
    return true;
  };

  Balloons.prototype.draw = function (ctx) {
    var p = this.inset;
    var T = MG.Theme;

    // deep night sky
    var sky = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    sky.addColorStop(0, '#090818');
    sky.addColorStop(0.5, this.calm ? '#151130' : '#191437');
    sky.addColorStop(1, '#35203f');
    ctx.fillStyle = sky;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // a quiet star field behind the lanterns
    if (!this.starsBg) this.starsBg = T.stars(64, 11);
    for (var s = 0; s < this.starsBg.length; s++) {
      var st = this.starsBg[s];
      var tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * st.sp + st.ph));
      ctx.globalAlpha = tw * 0.7;
      ctx.fillStyle = '#e8e6ff';
      ctx.beginPath();
      ctx.arc(p.x + st.nx * p.w, p.y + st.ny * p.h, st.r, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // moon
    var moonX = p.x + p.w - Math.min(p.w, p.h) * 0.16;
    var moonY = p.y + Math.min(p.w, p.h) * 0.14;
    var moonR = Math.min(p.w, p.h) * 0.052;
    T.glow(ctx, moonX, moonY, moonR * 4.2, '#ffe9bb', 0.4, 0.35);
    ctx.fillStyle = '#fff4d9';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(214,196,240,0.25)';
    ctx.beginPath();
    ctx.arc(moonX - moonR * 0.28, moonY + moonR * 0.18, moonR * 0.24, 0, U.TAU);
    ctx.arc(moonX + moonR * 0.3, moonY - moonR * 0.26, moonR * 0.16, 0, U.TAU);
    ctx.fill();

    /* moon salute */
    if (this.salute > 0) {
      var saluteT = 1 - this.salute;
      ctx.save();
      ctx.globalAlpha = this.salute * 0.65;
      ctx.strokeStyle = '#ffe9bb';
      ctx.lineWidth = Math.max(1.5, moonR * 0.14 * this.salute);
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR * (1.3 + saluteT * 1.6), 0, U.TAU);
      ctx.stroke();
      ctx.restore();
      T.glow(ctx, moonX, moonY, moonR * (3 + saluteT * 2), '#ffe9bb', 0.3 * this.salute, 0.35);
    }

    // low mist
    for (var c = 0; c < this.clouds.length; c++) {
      var cl = this.clouds[c];
      var cx = p.x + p.w * cl.nx + Math.sin(this.t * 0.07 + c) * p.w * 0.03 * (1 + this.motion);
      var cy = p.y + p.h * cl.ny;
      this.cloud(ctx, cx, cy, Math.min(p.w, p.h) * 0.09 * cl.s);
    }

    // distant hills
    var hillY = p.y + p.h * 0.9;
    ctx.fillStyle = 'rgba(10,8,24,0.55)';
    ctx.beginPath();
    ctx.moveTo(p.x, hillY + p.h * 0.06);
    ctx.quadraticCurveTo(p.x + p.w * 0.3, hillY - p.h * 0.05, p.x + p.w * 0.58, hillY + p.h * 0.02);
    ctx.quadraticCurveTo(p.x + p.w * 0.82, hillY - p.h * 0.04, p.x + p.w, hillY + p.h * 0.03);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.lineTo(p.x, p.y + p.h);
    ctx.closePath();
    ctx.fill();

    for (var i = 0; i < this.list.length; i++) this.balloon(ctx, this.list[i]);
  };

  Balloons.prototype.cloud = function (ctx, x, y, r) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.5);
    g.addColorStop(0, 'rgba(198,210,255,0.12)');
    g.addColorStop(0.55, 'rgba(198,210,255,0.06)');
    g.addColorStop(1, 'rgba(198,210,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r * 1.05, 0, 0, U.TAU);
    ctx.fill();
  };

  Balloons.prototype.balloon = function (ctx, b) {
    var grow = b.grow === undefined ? 1 : b.grow;
    if (grow <= 0.02) return;
    var r = b.r * Math.max(0.06, U.easeOutBack(Math.min(1, grow)));
    var bob = this.motion === 0 ? Math.sin(this.t * 0.8 + b.bob) * r * 0.02 : 0;
    var x = b.x;
    var y = b.y + bob;

    // lantern glow on the night air
    var halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
    halo.addColorStop(0, U.hsl(b.hue, 92, 72, 0.3));
    halo.addColorStop(1, U.hsl(b.hue, 92, 72, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, U.TAU);
    ctx.fill();

    // string
    ctx.strokeStyle = 'rgba(226,212,255,0.45)';
    ctx.lineWidth = Math.max(1.4, r * 0.026);
    ctx.beginPath();
    ctx.moveTo(x, y + r * 1.14);
    ctx.quadraticCurveTo(x + Math.sin(this.t * 1.1 + b.phase) * r * 0.3, y + r * 1.55,
      x + Math.sin(this.t * 0.8 + b.phase) * r * 0.16, y + r * 2.0);
    ctx.stroke();

    // knot
    ctx.fillStyle = U.hsl(b.hue, 80, 42);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.12, y + r * 1.0);
    ctx.lineTo(x + r * 0.12, y + r * 1.0);
    ctx.lineTo(x, y + r * 1.18);
    ctx.closePath();
    ctx.fill();

    // body: glassy, lit from within
    var grad = ctx.createRadialGradient(x - r * 0.32, y - r * 0.4, r * 0.08, x, y, r * 1.2);
    grad.addColorStop(0, U.hsl(b.hue, 100, 92));
    grad.addColorStop(0.45, U.hsl(b.hue, 92, 74));
    grad.addColorStop(1, U.hsl(b.hue + 12, 72, 46));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.93, r, 0, 0, U.TAU);
    ctx.fill();

    // highlight
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.34, y - r * 0.42, r * 0.17, r * 0.27, -0.5, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // friendly face
    var blink = (b.blinkT > b.blink - 0.12);
    ctx.fillStyle = 'rgba(38,26,52,0.8)';
    var ex = r * 0.24;
    var ey = y - r * 0.02;
    if (blink) {
      ctx.strokeStyle = 'rgba(38,26,52,0.8)';
      ctx.lineWidth = Math.max(1.5, r * 0.035);
      ctx.beginPath();
      ctx.moveTo(x - ex - r * 0.05, ey);
      ctx.lineTo(x - ex + r * 0.05, ey);
      ctx.moveTo(x + ex - r * 0.05, ey);
      ctx.lineTo(x + ex + r * 0.05, ey);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x - ex, ey, r * 0.055, 0, U.TAU);
      ctx.arc(x + ex, ey, r * 0.055, 0, U.TAU);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(38,26,52,0.72)';
    ctx.lineWidth = Math.max(1.4, r * 0.03);
    ctx.beginPath();
    ctx.arc(x, ey + r * 0.03, r * 0.11, 0.35, Math.PI - 0.35);
    ctx.stroke();

    // cheeks
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ff8fa8';
    ctx.beginPath();
    ctx.arc(x - r * 0.4, y + r * 0.2, r * 0.09, 0, U.TAU);
    ctx.arc(x + r * 0.4, y + r * 0.2, r * 0.09, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  };


  MG.Games = MG.Games || {};
  MG.Games.balloons = Balloons;
})(window.MG);
