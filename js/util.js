/* Magic Hand Play - tiny utility library. No build step, no dependencies. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';

  var U = {};
  MG.U = U;

  U.TAU = Math.PI * 2;
  U.DEG = Math.PI / 180;

  U.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.invLerp = function (a, b, v) { return a === b ? 0 : U.clamp((v - a) / (b - a), 0, 1); };
  U.rand = function (min, max) {
    if (max === undefined) { max = min; min = 0; }
    return min + Math.random() * (max - min);
  };
  U.randInt = function (min, max) { return Math.floor(min + Math.random() * (max - min + 1)); };
  U.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  U.chance = function (p) { return Math.random() < p; };
  U.dist = function (x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  };
  U.dist2 = function (x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    return dx * dx + dy * dy;
  };
  U.approach = function (cur, target, rate, dt) {
    return cur + (target - cur) * Math.min(1, rate * dt);
  };

  U.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  U.easeInOutSine = function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; };
  U.easeOutBack = function (t) {
    var c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };
  U.easeOutElastic = function (t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var c = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  };

  U.hsl = function (h, s, l, a) {
    var hh = ((h % 360) + 360) % 360;
    return 'hsla(' + hh.toFixed(1) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')';
  };

  /* Rounded-rect path (does not stroke/fill). */
  U.rr = function (ctx, x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  };

  U.starPath = function (ctx, cx, cy, outer, inner, points, rot) {
    var p = points || 5;
    var step = Math.PI / p;
    var r0 = rot || 0;
    ctx.beginPath();
    for (var i = 0; i < p * 2; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = r0 - Math.PI / 2 + i * step;
      var x = cx + Math.cos(a) * r;
      var y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  U.inRect = function (x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  };
  U.inCircle = function (x, y, cx, cy, radius) {
    return U.dist2(x, y, cx, cy) <= radius * radius;
  };

  U.text = function (ctx, str, x, y, size, color, weight, align, baseline) {
    ctx.font = (weight || 600) + ' ' + size + 'px "Segoe UI", "Segoe UI Variable", system-ui, sans-serif';
    ctx.fillStyle = color || '#2b2540';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = baseline || 'middle';
    ctx.fillText(str, x, y);
  };

  U.storage = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        var value = JSON.parse(raw);
        return value === null || value === undefined ? fallback : value;
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  U.formatMs = function (ms) {
    var total = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  U.now = function () {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  };

  U.cap = function (str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; };

  U.isNum = function (v) { return typeof v === 'number' && isFinite(v); };

  /* Gentle palette used across the game so all screens feel related. */
  U.PALETTE = {
    ink: '#2f2a45',
    muted: '#6b6486',
    paper: '#fffaf3',
    cream: '#fff1dd',
    peach: '#ffd9c2',
    sky: '#dcf1ff',
    mint: '#d9f5e4',
    lemon: '#fff3c4',
    lilac: '#e9e2ff',
    rose: '#ffd9e5'
  };
})(window.MG);
