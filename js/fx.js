/* Magic Hand Play - shared, capped particle effects. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;

  var FX = {
    parts: [],
    rings: [],
    cap: 420,
    calm: false,
    scale: 1
  };

  FX.reset = function () {
    FX.parts.length = 0;
    FX.rings.length = 0;
  };

  function push(p) {
    if (FX.parts.length >= FX.cap) FX.parts.splice(0, 40);
    FX.parts.push(p);
  }

  FX.confetti = function (x, y, n, o) {
    o = o || {};
    var count = Math.max(1, Math.round(n * FX.scale * (FX.calm ? 0.55 : 1)));
    for (var i = 0; i < count; i++) {
      var a = U.rand(0, U.TAU);
      var sp = U.rand(70, o.speed || 380);
      push({
        kind: Math.random() < 0.55 ? 'confetti' : 'dot',
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        g: U.rand(90, 220),
        rot: U.rand(0, U.TAU),
        vr: U.rand(-9, 9),
        w: U.rand(5, 13) * FX.scale,
        h: U.rand(4, 9) * FX.scale,
        hue: o.hue !== undefined ? o.hue + U.rand(-26, 26) : U.rand(0, 360),
        sat: o.sat || 88,
        lum: U.rand(56, 72),
        life: U.rand(0.5, 1.15),
        age: 0,
        alpha: o.alpha === undefined ? 0.95 : o.alpha
      });
    }
  };

  FX.sparkle = function (x, y, n, hue) {
    var count = Math.max(1, Math.round(n * FX.scale * (FX.calm ? 0.6 : 1)));
    for (var i = 0; i < count; i++) {
      var a = U.rand(0, U.TAU);
      var sp = U.rand(30, 190);
      push({
        kind: Math.random() < 0.4 ? 'star' : 'dot',
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        g: U.rand(0, 30),
        rot: U.rand(0, U.TAU),
        vr: U.rand(-3, 3),
        w: U.rand(5, 12) * FX.scale,
        h: U.rand(5, 12) * FX.scale,
        hue: hue === undefined ? U.rand(30, 60) : hue + U.rand(-18, 18),
        sat: 95,
        lum: U.rand(70, 88),
        life: U.rand(0.32, 0.8),
        age: 0,
        alpha: 1
      });
    }
  };

  FX.petals = function (x, y, n, hue) {
    var count = Math.max(1, Math.round(n * FX.scale));
    for (var i = 0; i < count; i++) {
      var a = U.rand(0, U.TAU);
      var sp = U.rand(20, 120);
      push({
        kind: 'petal',
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        g: 30,
        rot: U.rand(0, U.TAU),
        vr: U.rand(-2, 2),
        w: U.rand(9, 16) * FX.scale,
        h: U.rand(5, 9) * FX.scale,
        hue: hue + U.rand(-20, 20),
        sat: 80,
        lum: 74,
        life: U.rand(0.8, 1.7),
        age: 0,
        alpha: 0.9
      });
    }
  };

  FX.trail = function (x1, y1, x2, y2, hue) {
    var n = FX.calm ? 5 : 9;
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1 || 1);
      push({
        kind: 'dot',
        x: U.lerp(x1, x2, t) + U.rand(-6, 6),
        y: U.lerp(y1, y2, t) + U.rand(-6, 6),
        vx: U.rand(-20, 20),
        vy: U.rand(-40, 0),
        g: 0,
        rot: 0,
        vr: 0,
        w: U.rand(4, 9),
        h: U.rand(4, 9),
        hue: hue === undefined ? 48 : hue,
        sat: 95,
        lum: U.rand(72, 90),
        life: U.rand(0.2, 0.45),
        age: 0,
        alpha: 1
      });
    }
  };

  FX.ring = function (x, y, o) {
    o = o || {};
    FX.rings.push({
      x: x, y: y,
      r0: o.r0 === undefined ? 6 : o.r0,
      r1: o.r1 === undefined ? 120 : o.r1,
      hue: o.hue === undefined ? 45 : o.hue,
      width: o.width === undefined ? 7 : o.width,
      dur: o.dur === undefined ? 0.55 : o.dur,
      age: 0,
      alpha: o.alpha === undefined ? 0.85 : o.alpha
    });
    if (FX.rings.length > 26) FX.rings.splice(0, 6);
  };

  FX.update = function (dt) {
    var i, p;
    for (i = FX.parts.length - 1; i >= 0; i--) {
      p = FX.parts[i];
      p.age += dt;
      if (p.age >= p.life) { FX.parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= (1 - 1.4 * dt);
      p.vy *= (1 - 0.6 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (i = FX.rings.length - 1; i >= 0; i--) {
      var r = FX.rings[i];
      r.age += dt;
      if (r.age >= r.dur) FX.rings.splice(i, 1);
    }
  };

  FX.draw = function (ctx) {
    var i, p, t, a;

    for (i = 0; i < FX.rings.length; i++) {
      var r = FX.rings[i];
      t = U.clamp(r.age / r.dur, 0, 1);
      var rad = U.lerp(r.r0, r.r1, U.easeOutCubic(t));
      a = (1 - t) * r.alpha;
      ctx.globalAlpha = a;
      ctx.strokeStyle = U.hsl(r.hue, 90, 66);
      ctx.lineWidth = Math.max(1, r.width * (1 - t * 0.7));
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, U.TAU);
      ctx.stroke();
    }

    for (i = 0; i < FX.parts.length; i++) {
      p = FX.parts[i];
      t = p.age / p.life;
      a = (1 - t * t) * p.alpha;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      var fill = U.hsl(p.hue, p.sat, p.lum);

      if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = fill;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      } else if (p.kind === 'star') {
        ctx.fillStyle = fill;
        U.starPath(ctx, p.x, p.y, p.w, p.w * 0.45, 5, p.rot);
        ctx.fill();
      } else if (p.kind === 'petal') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w, p.h, 0, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, p.w / 2), 0, U.TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  FX.isBusy = function () { return FX.parts.length > 0 || FX.rings.length > 0; };

  MG.FX = FX;
})(window.MG);
