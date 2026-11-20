/* Magic Hand Play - shared visual language.
   The whole app is a warm, lamplit room at night: deep plum shadows, brass and
   amber light, soft grain. Every colour and surface helper lives here so the
   child surface, games and dashboard feel like one product. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;

  var Theme = {};
  MG.Theme = Theme;

  var C = Theme.C = {
    night0: '#0a0714',
    night1: '#130e22',
    night2: '#1e1533',
    night3: '#2a1c3a',
    plum: '#382541',
    ink: '#f8f1ff',
    inkSoft: '#c3b4d6',
    inkFaint: '#8f7fa6',
    gold: '#f2c884',
    goldDeep: '#c98f4e',
    brass: '#e2b478',
    amber: '#ffb469',
    lamp: '#ffd39b',
    lampHot: '#fff4da',
    moon: '#cfddff',
    mint: '#9fe3c0',
    rose: '#ffb6c8',
    sky: '#8db8ff'
  };

  Theme.serif = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
  Theme.sans = '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif';

  /* ------------------------------------------------------------ colour */

  var hexCache = {};

  /* hex (#rgb or #rrggbb) to rgba() string, with an opacity. */
  Theme.rgba = function (hex, a) {
    var rgb = hexCache[hex];
    if (!rgb) {
      var h = hex.replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      rgb = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      hexCache[hex] = rgb;
    }
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a === undefined ? 1 : a) + ')';
  };

  /* Mix two hex colours, t = 0 gives a, t = 1 gives b. */
  Theme.mix = function (a, b, t) {
    function rgb(hex) {
      var h = hex.replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    var ca = rgb(a);
    var cb = rgb(b);
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.round(U.lerp(ca[i], cb[i], U.clamp(t, 0, 1)));
      out += (v < 16 ? '0' : '') + v.toString(16);
    }
    return out;
  };

  /* ------------------------------------------------------------- text */

  Theme.font = function (ctx, size, weight, serif) {
    ctx.font = (weight || 500) + ' ' + Math.max(1, size) + 'px ' + (serif ? Theme.serif : Theme.sans);
  };

  Theme.text = function (ctx, str, x, y, size, color, weight, serif, align, baseline) {
    Theme.font(ctx, size, weight, serif);
    ctx.fillStyle = color || C.ink;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = baseline || 'middle';
    ctx.fillText(str, x, y);
  };

  /* Small spaced capitals, used as an eyebrow above titles. */
  Theme.eyebrow = function (ctx, str, x, y, size, color, align) {
    ctx.save();
    if ('letterSpacing' in ctx) ctx.letterSpacing = (size * 0.16).toFixed(2) + 'px';
    Theme.text(ctx, str.toUpperCase(), x, y, size, color || Theme.rgba(C.gold, 0.72), 600, false, align || 'center');
    ctx.restore();
  };

  /* ----------------------------------------------------------- surfaces */

  var grainTile = null;

  Theme.grainTile = function () {
    if (grainTile) return grainTile;
    var s = 96;
    var c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    var g = c.getContext('2d');
    var img = g.createImageData(s, s);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 128 + Math.round((Math.random() - 0.5) * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 22;
    }
    g.putImageData(img, 0, 0);
    grainTile = c;
    return c;
  };

  /* Fixed film grain. The pattern origin sits at the canvas corner, so it
     never shimmers while the room is still. */
  Theme.grain = function (ctx, x, y, w, h, alpha) {
    var pat = ctx.__mgGrain;
    if (!pat) {
      pat = ctx.createPattern(Theme.grainTile(), 'repeat');
      if (!pat) return;
      ctx.__mgGrain = pat;
    }
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.5 : alpha;
    ctx.fillStyle = pat;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  };

  Theme.vignette = function (ctx, x, y, w, h, strength) {
    var cx = x + w / 2;
    var cy = y + h / 2;
    var g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.24, cx, cy, Math.max(w, h) * 0.76);
    g.addColorStop(0, 'rgba(4,2,10,0)');
    g.addColorStop(0.7, 'rgba(4,2,10,' + (strength * 0.35).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(4,2,10,' + strength.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  };

  /* Soft round light pool. */
  Theme.glow = function (ctx, x, y, r, hex, alpha, mid) {
    if (r <= 0 || alpha <= 0) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Theme.rgba(hex, alpha));
    g.addColorStop(mid === undefined ? 0.42 : mid, Theme.rgba(hex, alpha * 0.26));
    g.addColorStop(1, Theme.rgba(hex, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  /* The room behind everything: night gradient, cool moonlight, warm spill
     from the hold side, vignette and grain. */
  Theme.room = function (ctx, W, H, opts) {
    opts = opts || {};
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.night0);
    g.addColorStop(0.55, C.night1);
    g.addColorStop(1, C.night2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* cool moonlight, upper left */
    Theme.glow(ctx, W * 0.2, -H * 0.12, Math.max(W, H) * 0.8, '#7d90ff', 0.13, 0.55);

    /* deep plum floor */
    var floor = ctx.createLinearGradient(0, H * 0.72, 0, H);
    floor.addColorStop(0, 'rgba(56,37,65,0)');
    floor.addColorStop(1, 'rgba(56,37,65,0.5)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    if (opts.warmX !== undefined && opts.warmA) {
      Theme.glow(ctx, opts.warmX, H * 0.5, Math.max(W, H) * 0.62, C.amber, opts.warmA, 0.5);
    }

    Theme.vignette(ctx, 0, 0, W, H, 0.6);
    Theme.grain(ctx, 0, 0, W, H, 0.34);
  };

  /* A velvet panel with a brass hairline: the hold console and dashboard cards. */
  Theme.panel = function (ctx, x, y, w, h, r, opts) {
    opts = opts || {};
    var warm = !!opts.warm;
    var g = ctx.createLinearGradient(x, y, x, y + h);
    if (warm) {
      g.addColorStop(0, '#2f2033');
      g.addColorStop(0.5, '#251a2b');
      g.addColorStop(1, '#1a1122');
    } else {
      g.addColorStop(0, '#1c1430');
      g.addColorStop(0.55, '#161027');
      g.addColorStop(1, '#110c1e');
    }
    ctx.save();
    if (opts.shadow !== false) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.min(40, Math.max(10, r * 2));
      ctx.shadowOffsetY = Math.min(14, r * 0.8);
    }
    U.rr(ctx, x, y, w, h, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    /* top sheen */
    ctx.save();
    U.rr(ctx, x, y, w, h, r);
    ctx.clip();
    var sheen = ctx.createLinearGradient(x, y, x, y + h * 0.45);
    sheen.addColorStop(0, 'rgba(255,238,214,' + (warm ? 0.1 : 0.07) + ')');
    sheen.addColorStop(1, 'rgba(255,238,214,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    /* brass hairline */
    ctx.strokeStyle = Theme.rgba(C.brass, opts.hairline === undefined ? 0.2 : opts.hairline);
    ctx.lineWidth = 1.5;
    U.rr(ctx, x + 0.75, y + 0.75, Math.max(1, w - 1.5), Math.max(1, h - 1.5), Math.max(2, r - 1));
    ctx.stroke();
  };

  /* Inner shadow for the picture window, so the game sits inside the room. */
  Theme.inset = function (ctx, x, y, w, h, r, strength) {
    ctx.save();
    U.rr(ctx, x, y, w, h, r);
    ctx.clip();
    var s = strength === undefined ? 0.55 : strength;
    var edge = Math.min(w, h) * 0.09;
    var top = ctx.createLinearGradient(0, y, 0, y + edge);
    top.addColorStop(0, 'rgba(0,0,0,' + (s * 0.7).toFixed(3) + ')');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(x, y, w, edge);
    var bottom = ctx.createLinearGradient(0, y + h - edge, 0, y + h);
    bottom.addColorStop(0, 'rgba(0,0,0,0)');
    bottom.addColorStop(1, 'rgba(0,0,0,' + (s * 0.5).toFixed(3) + ')');
    ctx.fillStyle = bottom;
    ctx.fillRect(x, y + h - edge, w, edge);
    var left = ctx.createLinearGradient(x, 0, x + edge, 0);
    left.addColorStop(0, 'rgba(0,0,0,' + (s * 0.5).toFixed(3) + ')');
    left.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = left;
    ctx.fillRect(x, y, edge, h);
    var right = ctx.createLinearGradient(x + w - edge, 0, x + w, 0);
    right.addColorStop(0, 'rgba(0,0,0,0)');
    right.addColorStop(1, 'rgba(0,0,0,' + (s * 0.35).toFixed(3) + ')');
    ctx.fillStyle = right;
    ctx.fillRect(x + w - edge, y, edge, h);
    ctx.restore();
  };

  /* A thin gold rule; used under titles. */
  Theme.rule = function (ctx, cx, y, w, alpha) {
    var g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, Theme.rgba(C.gold, 0));
    g.addColorStop(0.5, Theme.rgba(C.gold, alpha === undefined ? 0.5 : alpha));
    g.addColorStop(1, Theme.rgba(C.gold, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - w / 2, y, w, 1.5);
  };

  /* Dark obsidian card with a warm inner light, used for the ready / end cards. */
  Theme.cardPanel = function (ctx, x, y, w, h, r, accent) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.min(70, r * 3);
    ctx.shadowOffsetY = r * 0.7;
    U.rr(ctx, x, y, w, h, r);
    ctx.fillStyle = 'rgba(22,15,35,0.92)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    U.rr(ctx, x, y, w, h, r);
    ctx.clip();
    var sheen = ctx.createLinearGradient(0, y, 0, y + h);
    sheen.addColorStop(0, Theme.rgba(accent || C.gold, 0.14));
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h);
    Theme.grain(ctx, x, y, w, h, 0.3);
    ctx.restore();

    ctx.strokeStyle = Theme.rgba(accent || C.gold, 0.28);
    ctx.lineWidth = 1.5;
    U.rr(ctx, x + 0.75, y + 0.75, Math.max(1, w - 1.5), Math.max(1, h - 1.5), Math.max(2, r - 1));
    ctx.stroke();
  };

  /* ------------------------------------------------------------ widgets */

  /* A small four-point sparkle, handy for night scenes. */
  Theme.sparklePath = function (ctx, x, y, r) {
    var k = r * 0.22;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + k, y - k, x + r, y);
    ctx.quadraticCurveTo(x + k, y + k, x, y + r);
    ctx.quadraticCurveTo(x - k, y + k, x - r, y);
    ctx.quadraticCurveTo(x - k, y - k, x, y - r);
    ctx.closePath();
  };

  /* Deterministic night sky for scenes that need a stable star field. */
  Theme.stars = function (count, seed) {
    var out = [];
    var s = seed || 1;
    function rnd() {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    }
    for (var i = 0; i < count; i++) {
      out.push({
        nx: rnd(),
        ny: rnd() * 0.85,
        r: 0.5 + rnd() * 1.5,
        ph: rnd() * U.TAU,
        sp: 0.5 + rnd() * 1.4
      });
    }
    return out;
  };

  /* Run a draw pass with additive blending, restored afterwards. */
  Theme.lighten = function (ctx, fn) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    fn();
    ctx.restore();
  };
})(window.MG);
