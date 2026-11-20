/* Game 3 - Reach for the Stars. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;

  /* Constellations the child assembles one star at a time. Finishing one gives
     a moment of light, then a new sky begins; the loop never runs out. */
  var SKY_PATTERNS = [
    [[0.06, 0.72], [0.22, 0.44], [0.4, 0.56], [0.56, 0.24], [0.73, 0.42], [0.93, 0.2]],
    [[0.08, 0.28], [0.26, 0.52], [0.45, 0.34], [0.62, 0.64], [0.8, 0.42], [0.95, 0.7]],
    [[0.1, 0.76], [0.24, 0.34], [0.42, 0.7], [0.6, 0.28], [0.77, 0.66], [0.94, 0.36]]
  ];

  function Stars(app) {
    this.stars = [];
    this.q = [];
    this.flyers = [];
    this.bg = [];
    this.collected = 0;
    this.total = 0;
    this.spawnDelay = 0;
    this.skyIndex = 0;
    this.skyProgress = 0;
    this.skyFade = 1;
    this.skyResetAt = 0;
    this.skyBox = null;
    this.cycle = 0;
    this.shoot = { wait: U.rand(4, 10), t: -1, x: 0, y: 0, dir: 1 };
    MG.BaseGame.call(this, app);
    this.id = 'stars';
    this.title = 'Reach for the Stars';
  }

  Stars.prototype = Object.create(MG.BaseGame.prototype);
  Stars.prototype.constructor = Stars;

  Stars.prototype.layout = function () {
    var p = this.inset;
    var minDim = Math.min(p.w, p.h);
    var sizes = { xlarge: 0.155, large: 0.115, medium: 0.085 };
    this.R = Math.max(28, minDim * (sizes[this.settings.targetSize] || 0.115));

    var level = U.clamp(Math.round(this.settings.starReach), 1, 5);
    var reach = [0.1, 0.25, 0.4, 0.56, 0.72][level - 1];
    var swapped = !!(this.app.zone && this.app.zone.swapped);
    var dir = swapped ? 1 : -1;
    var edge = swapped ? p.x : p.x + p.w;

    this.cx = U.clamp(edge + dir * p.w * reach, p.x + this.R * 1.4, p.x + p.w - this.R * 1.4);
    this.cy = p.y + p.h * 0.52;
    this.rx = Math.max(this.R * 1.1, p.w * 0.3);
    this.ry = Math.max(this.R * 1.1, p.h * 0.32);

    this.countWanted = { xlarge: 1, large: 2, medium: 3 }[this.settings.targetSize] || 2;

    /* The constellation sits in the quiet upper-left band, away from targets. */
    var bw = Math.max(60, Math.min(p.w * 0.42, this.R * 4.2));
    var bh = Math.max(34, Math.min(p.h * 0.26, this.R * 1.7));
    this.skyBox = {
      x: p.x + this.R * 0.42,
      y: p.y + this.R * 0.36,
      w: bw,
      h: bh
    };

    if (!this.bg || this.bg.length === 0) this.makeBackground();

    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      s.r = this.R;
      s.x = U.clamp(s.x, p.x + this.R + 8, p.x + p.w - this.R - 8);
      s.y = U.clamp(s.y, p.y + this.R + 8, p.y + p.h - this.R - 8);
    }

    while (this.stars.length < this.countWanted) {
      var ns = this.makeStar();
      if (ns) this.stars.push(ns); else break;
    }
    while (this.stars.length > this.countWanted) this.stars.pop();
  };

  Stars.prototype.makeBackground = function () {
    this.bg = [];
    var n = this.calm ? 26 : 46;
    for (var i = 0; i < n; i++) {
      this.bg.push({ nx: Math.random(), ny: Math.random(), r: U.rand(0.6, 1.8), ph: U.rand(0, U.TAU), sp: U.rand(0.4, 1.4) });
    }
  };

  Stars.prototype.makeStar = function () {
    var p = this.inset;
    var m = this.R * 0.55 + 10;
    var avoid = this.stars;
    for (var attempt = 0; attempt < 26; attempt++) {
      var a = U.rand(0, U.TAU);
      var rad = Math.sqrt(Math.random());
      var x = this.cx + Math.cos(a) * this.rx * rad;
      var y = this.cy + Math.sin(a) * this.ry * rad;
      x = U.clamp(x, p.x + this.R + m, p.x + p.w - this.R - m);
      y = U.clamp(y, p.y + this.R + m, p.y + p.h - this.R - m);

      /* keep the constellation band clear so it stays readable */
      var b = this.skyBox;
      if (b) {
        var pad = this.R * 0.7;
        if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) continue;
      }

      var ok = true;
      for (var i = 0; i < avoid.length; i++) {
        if (U.dist(x, y, avoid[i].x, avoid[i].y) < this.R * 1.9) { ok = false; break; }
      }
      if (ok) {
        return {
          x: x, y: y, r: this.R,
          ph: U.rand(0, U.TAU),
          hue: U.pick([45, 45, 48, 190, 280, 330]),
          born: this.t
        };
      }
    }
    return null;
  };

  Stars.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);

    for (var i = this.flyers.length - 1; i >= 0; i--) {
      var f = this.flyers[i];
      f.t += dt * 1.8;
      if (f.t >= 1) this.flyers.splice(i, 1);
    }

    /* Constellation cycle: hold the finished shape for a moment, fade it,
       then begin a new sky. */
    if (this.skyResetAt > 0 && this.t >= this.skyResetAt) {
      this.cycle += 1;
      this.skyIndex = (this.skyIndex + 1) % SKY_PATTERNS.length;
      this.skyProgress = 0;
      this.skyResetAt = 0;
      this.skyFade = 0;
    }
    if (this.skyFade < 1) this.skyFade = Math.min(1, this.skyFade + dt * 2.2);

    if (this.q.length > 0 && this.stars.length < this.countWanted) {
      this.spawnDelay -= dt;
      if (this.spawnDelay <= 0) {
        var s = this.makeStar();
        if (s) this.stars.push(s);
        this.q.pop();
        this.spawnDelay = 0.55;
      }
    }

    var sh = this.shoot;
    if (this.motion > 0.01) {
      if (sh.t < 0) {
        sh.wait -= dt;
        if (sh.wait <= 0) {
          sh.t = 0;
          sh.x = U.rand(0.15, 0.85);
          sh.y = U.rand(0.06, 0.34);
          sh.dir = U.pick([-1, 1]);
        }
      } else {
        sh.t += dt;
        if (sh.t > 1.5) {
          sh.t = -1;
          sh.wait = U.rand(7, 16);
        }
      }
    }
  };

  Stars.prototype.skyNode = function (index) {
    var pat = SKY_PATTERNS[this.skyIndex];
    var q = pat[index % pat.length];
    var b = this.skyBox || { x: 0, y: 0, w: 1, h: 1 };
    return { x: b.x + q[0] * b.w, y: b.y + q[1] * b.h };
  };

  Stars.prototype.activate = function (x, y) {
    var best = null;
    var bd = Infinity;
    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      var d = U.dist(x, y, s.x, s.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) { FX.sparkle(x, y, 4, 48); return false; }

    var reach = best.r * (0.95 + this.rewardFactor * 0.3);
    var hit = bd <= reach;
    if (!hit && this.settings.anyTouch) hit = true;
    if (!hit) { FX.sparkle(x, y, 3, 48); return false; }

    if (U.dist(x, y, best.x, best.y) > best.r * 0.8) FX.trail(x, y, best.x, best.y, best.hue);
    FX.sparkle(best.x, best.y, this.calm ? 8 : 16, best.hue);
    FX.ring(best.x, best.y, { r0: best.r * 0.35, r1: best.r * 2.6, hue: best.hue, width: best.r * 0.2, dur: 0.7 });
    MG.Audio.play('star', this.total % 8);
    if (U.chance(0.4)) MG.Audio.play('chime', U.randInt(3, 9));

    var idx = this.stars.indexOf(best);
    if (idx >= 0) this.stars.splice(idx, 1);

    this.total += 1;
    this.collected = Math.min(10, this.collected + 1);

    var pat = SKY_PATTERNS[this.skyIndex];
    var spot = this.skyNode(Math.min(this.skyProgress, pat.length - 1));
    this.flyers.push({ x: best.x, y: best.y, tx: spot.x, ty: spot.y, t: 0, hue: best.hue, r: best.r * 0.55 });

    if (this.skyResetAt === 0 && this.skyProgress < pat.length) {
      this.skyProgress += 1;
      if (this.skyProgress >= pat.length) {
        this.skyResetAt = this.t + 1.8;
        MG.Audio.play('chime', 7);
        var box = this.skyBox;
        FX.sparkle(box.x + box.w / 2, box.y + box.h / 2, this.calm ? 5 : 11, 48);
        FX.ring(box.x + box.w / 2, box.y + box.h / 2, {
          r0: this.R * 0.2,
          r1: this.R * 1.6,
          hue: 48,
          width: this.R * 0.1,
          dur: 0.9,
          alpha: 0.35
        });
      }
    }

    this.q.push(1);
    this.spawnDelay = 0.5;
    return true;
  };

  Stars.prototype.draw = function (ctx) {
    var p = this.inset;
    var T = MG.Theme;
    var i;

    var sky = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    sky.addColorStop(0, '#06081a');
    sky.addColorStop(0.5, '#101132');
    sky.addColorStop(1, '#2a1a43');
    ctx.fillStyle = sky;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // two soft nebula washes
    var neb = ctx.createRadialGradient(p.x + p.w * 0.28, p.y + p.h * 0.74, 10, p.x + p.w * 0.28, p.y + p.h * 0.74, p.w * 0.82);
    neb.addColorStop(0, 'rgba(255,150,210,0.12)');
    neb.addColorStop(1, 'rgba(255,150,210,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    var neb2 = ctx.createRadialGradient(p.x + p.w * 0.78, p.y + p.h * 0.66, 8, p.x + p.w * 0.78, p.y + p.h * 0.66, p.w * 0.7);
    neb2.addColorStop(0, 'rgba(120,180,255,0.1)');
    neb2.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // distant stars
    for (i = 0; i < this.bg.length; i++) {
      var b = this.bg[i];
      var tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * b.sp + b.ph));
      ctx.globalAlpha = tw * 0.8;
      ctx.fillStyle = '#eef1ff';
      ctx.beginPath();
      ctx.arc(p.x + b.nx * p.w, p.y + b.ny * p.h, b.r, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // a faint constellation, for the pleasure of noticing it
    var con = [[0.16, 0.2], [0.24, 0.14], [0.31, 0.22], [0.28, 0.32], [0.18, 0.34]];
    ctx.strokeStyle = 'rgba(190,205,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i < con.length; i++) {
      var cxp = p.x + con[i][0] * p.w;
      var cyp = p.y + con[i][1] * p.h;
      if (i === 0) ctx.moveTo(cxp, cyp); else ctx.lineTo(cxp, cyp);
    }
    ctx.stroke();

    // soft moon
    var mx = p.x + p.w * 0.85;
    var my = p.y + p.h * 0.16;
    var mr = Math.min(p.w, p.h) * 0.055;
    T.glow(ctx, mx, my, mr * 3.4, '#ffeec8', 0.4, 0.32);
    ctx.fillStyle = 'rgba(255,247,222,0.97)';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,205,240,0.2)';
    ctx.beginPath();
    ctx.arc(mx - mr * 0.3, my + mr * 0.22, mr * 0.22, 0, U.TAU);
    ctx.arc(mx + mr * 0.28, my - mr * 0.24, mr * 0.13, 0, U.TAU);
    ctx.fill();

    for (i = 0; i < this.stars.length; i++) this.drawStar(ctx, this.stars[i], false);

    // occasional shooting star
    if (this.shoot.t >= 0) {
      var sh = this.shoot;
      var k = U.clamp(sh.t / 1.5, 0, 1);
      var sx = p.x + sh.x * p.w;
      var sy = p.y + sh.y * p.h;
      var len = Math.min(p.w, p.h) * 0.2;
      var ex = sx - sh.dir * len * k;
      var ey = sy - len * 0.35 * k;
      var alpha = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.7;
      var sg = ctx.createLinearGradient(sx, sy, ex, ey);
      sg.addColorStop(0, 'rgba(255,250,220,' + alpha.toFixed(3) + ')');
      sg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.strokeStyle = sg;
      ctx.lineWidth = Math.max(1.5, this.R * 0.02);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,252,235,' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.6, this.R * 0.022), 0, U.TAU);
      ctx.fill();
    }

    for (var i = 0; i < this.flyers.length; i++) {
      var f = this.flyers[i];
      var t = U.easeInOutSine(U.clamp(f.t, 0, 1));
      var fx = U.lerp(f.x, f.tx, t);
      var fy = U.lerp(f.y, f.ty, t) - Math.sin(t * Math.PI) * this.R * 0.8;
      var fa = 1 - Math.max(0, f.t - 0.75) * 4;
      this.drawStarShape(ctx, fx, fy, f.r * (1 - t * 0.45), f.hue, Math.max(0, fa));
    }

    this.drawConstellation(ctx);
  };

  Stars.prototype.drawStar = function (ctx, s, small) {
    var pulse = 1 + Math.sin(this.t * 2.2 + s.ph) * 0.035;
    var r = s.r * pulse;
    var glowR = r * 2.1;

    var g = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, glowR);
    g.addColorStop(0, 'rgba(255,240,180,0.42)');
    g.addColorStop(0.45, 'rgba(255,220,140,0.16)');
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, glowR, 0, U.TAU);
    ctx.fill();

    var shown = U.clamp((this.t - s.born) * 3, 0, 1);
    var sc = U.easeOutBack(shown);
    this.drawStarShape(ctx, s.x, s.y, r * sc, s.hue, 1);
  };

  Stars.prototype.drawStarShape = function (ctx, x, y, r, hue, alpha) {
    ctx.globalAlpha = alpha;
    var grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.1, x, y, r);
    grad.addColorStop(0, '#fffdf0');
    grad.addColorStop(0.5, U.hsl(hue, 100, 76));
    grad.addColorStop(1, U.hsl(hue, 92, 60));
    ctx.fillStyle = grad;
    U.starPath(ctx, x, y, r, r * 0.47, 5, 0);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.stroke();

    // sparkle highlight
    ctx.globalAlpha = alpha * 0.75;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.18, y - r * 0.28, r * 0.08, r * 0.16, -0.5, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  /* The collected stars assemble into a constellation. When it is complete it
     glows for a moment, then a new pattern fades in and the cycle repeats. */
  Stars.prototype.drawConstellation = function (ctx) {
    var T = MG.Theme;
    var b = this.skyBox;
    if (!b) return;
    var pat = SKY_PATTERNS[this.skyIndex];
    var a = U.clamp(this.skyFade, 0, 1);
    var done = this.skyResetAt > 0 ? pat.length : this.skyProgress;

    /* the whole shape, barely there, so the next target is visible */
    ctx.strokeStyle = 'rgba(198,212,255,' + (0.09 * a).toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < pat.length; i++) {
      var pn = this.skyNode(i);
      if (i === 0) ctx.moveTo(pn.x, pn.y); else ctx.lineTo(pn.x, pn.y);
    }
    ctx.stroke();

    if (done > 1) {
      ctx.strokeStyle = 'rgba(214,226,255,' + (0.28 * a).toFixed(3) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (var j = 0; j < done; j++) {
        var q = this.skyNode(j);
        if (j === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }

    if (done >= pat.length) {
      T.glow(ctx, b.x + b.w / 2, b.y + b.h / 2, this.R * 1.3, '#ffe6b0', 0.18 * a, 0.4);
    }

    for (var k = 0; k < pat.length; k++) {
      var node = this.skyNode(k);
      if (k < done) {
        T.glow(ctx, node.x, node.y, this.R * 0.5, '#ffe6b0', 0.16 * a, 0.5);
        this.drawStarShape(ctx, node.x, node.y, this.R * 0.15, 48, a);
      } else {
        ctx.fillStyle = 'rgba(198,212,255,' + (0.32 * a).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(1.5, this.R * 0.045), 0, U.TAU);
        ctx.fill();
      }
    }
  };

  MG.Games = MG.Games || {};
  MG.Games.stars = Stars;
})(window.MG);
