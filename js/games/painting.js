/* Game 4 - Magic Painting. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;

  function Painting(app) {
    this.cv = document.createElement('canvas');
    this.pctx = this.cv.getContext('2d');
    this.hue = U.rand(0, 360);
    this.stamps = 0;
    this.idle = 0;
    this.fadeBoost = 0;
    this.W = 1;
    this.H = 1;
    MG.BaseGame.call(this, app);
    this.id = 'painting';
    this.title = 'Magic Painting';
  }

  Painting.prototype = Object.create(MG.BaseGame.prototype);
  Painting.prototype.constructor = Painting;

  Painting.prototype.layout = function () {
    var p = this.inset;
    this.brush = Math.max(18, Math.min(p.w, p.h) * 0.095 * this.sizeFactor);
  };

  Painting.prototype.onResize = function (W, H, dpr) {
    this.W = W;
    this.H = H;
    this.dpr = dpr || 1;
    var cw = Math.max(1, Math.round(W * this.dpr));
    var ch = Math.max(1, Math.round(H * this.dpr));
    if (this.cv.width !== cw || this.cv.height !== ch) {
      this.cv.width = cw;
      this.cv.height = ch;
      this.pctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.pctx.clearRect(0, 0, W, H);
    }
  };

  Painting.prototype.enter = function () {
    this.clear();
  };

  Painting.prototype.clear = function () {
    if (!this.pctx) return;
    this.pctx.save();
    this.pctx.setTransform(1, 0, 0, 1, 0, 0);
    this.pctx.clearRect(0, 0, this.cv.width, this.cv.height);
    this.pctx.restore();
  };

  Painting.prototype.nextHue = function () {
    this.hue = (this.hue + U.rand(18, 52)) % 360;
    return this.hue;
  };

  Painting.prototype.splash = function (x, y, power) {
    var pc = this.pctx;
    if (!pc) return;
    power = power || 1;
    var R = this.brush * power;
    var hue = this.nextHue();

    pc.save();
    pc.globalCompositeOperation = 'lighter';

    for (var i = 0; i < 8; i++) {
      var a = U.rand(0, U.TAU);
      var d = U.rand(0, R * 0.55);
      var rr = R * U.rand(0.34, 0.7);
      pc.fillStyle = U.hsl(hue + U.rand(-28, 28), 92, U.rand(52, 66), 0.2);
      pc.beginPath();
      pc.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, U.TAU);
      pc.fill();
    }

    pc.fillStyle = U.hsl(hue, 100, 78, 0.34);
    pc.beginPath();
    pc.arc(x, y, R * 0.42, 0, U.TAU);
    pc.fill();

    for (var s = 0; s < (this.calm ? 4 : 9); s++) {
      pc.fillStyle = 'rgba(255,248,232,0.5)';
      pc.beginPath();
      pc.arc(x + U.rand(-R, R), y + U.rand(-R, R), U.rand(2, 5), 0, U.TAU);
      pc.fill();
    }

    pc.restore();

    this.stamps += 1;
    this.idle = 0;

    if (this.stamps % 6 === 0) FX.sparkle(x, y, this.calm ? 4 : 7, hue);
  };

  Painting.prototype.trail = function (x1, y1, x2, y2) {
    var pc = this.pctx;
    if (!pc) return;
    var d = U.dist(x1, y1, x2, y2);
    if (d < 0.6) return;

    this.hue = (this.hue + Math.min(30, d * 0.22)) % 360;

    pc.save();
    pc.globalCompositeOperation = 'lighter';
    pc.lineCap = 'round';
    pc.lineJoin = 'round';

    pc.strokeStyle = U.hsl(this.hue, 90, 58, 0.16);
    pc.lineWidth = this.brush * 0.52;
    pc.beginPath();
    pc.moveTo(x1, y1);
    pc.lineTo(x2, y2);
    pc.stroke();

    pc.strokeStyle = U.hsl(this.hue + 24, 96, 80, 0.14);
    pc.lineWidth = this.brush * 0.24;
    pc.beginPath();
    pc.moveTo(x1, y1);
    pc.lineTo(x2, y2);
    pc.stroke();
    pc.restore();

    this.idle = 0;
    this.stamps += 0.12;
    if (d > 8 && U.chance(0.18)) {
      pc.save();
      pc.globalCompositeOperation = 'lighter';
      pc.fillStyle = 'rgba(255,246,224,0.3)';
      pc.beginPath();
      pc.arc(x2 + U.rand(-8, 8), y2 + U.rand(-8, 8), U.rand(1.5, 4), 0, U.TAU);
      pc.fill();
      pc.restore();
    }
  };

  Painting.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);
    var p = this.inset;
    var pc = this.pctx;
    if (!pc) return;

    this.idle += dt;

    var list = this.app.playPointers();
    for (var i = 0; i < list.length; i++) {
      var rec = list[i];
      if (rec.role !== 'play') continue;
      if (!U.inRect(rec.x, rec.y, p)) { rec._paint = null; continue; }

      if (!rec._paint) {
        rec._paint = { x: rec.x, y: rec.y };
        this.splash(rec.x, rec.y, 1);
        MG.Audio.play('paint');
      } else {
        var st = rec._paint;
        if (U.dist(st.x, st.y, rec.x, rec.y) > 1.2) {
          this.trail(st.x, st.y, rec.x, rec.y);
          st.x = rec.x;
          st.y = rec.y;
          MG.Audio.play('paint');
        } else {
          rec.stampT = (rec.stampT || 0) + dt;
          if (rec.stampT > 0.45) {
            rec.stampT = 0;
            this.splash(rec.x, rec.y, 0.6);
            if (U.chance(0.4)) MG.Audio.play('chime', U.randInt(0, 8));
          }
        }
      }
    }

    // clear stale markers for released pointers
    if (list.length === 0) {
      this._paintSweep = 0;
    }

    // gentle fade when the child is not painting, so colours stay fresh
    var fade = 0;
    if (this.fadeBoost > 0) {
      this.fadeBoost -= dt;
      fade = 0.5 * dt;
    } else if (this.idle > 3.5) {
      fade = 0.055 * dt;
    }
    if (this.stamps > 240) {
      this.fadeBoost = 2.4;
      this.stamps = 0;
      MG.Audio.play('bloom', 4);
    }
    if (fade > 0) {
      pc.save();
      pc.globalCompositeOperation = 'destination-out';
      pc.fillStyle = 'rgba(0,0,0,' + fade.toFixed(4) + ')';
      pc.fillRect(0, 0, this.W || this.play.w, this.H || this.play.h);
      pc.restore();
    }
  };

  Painting.prototype.activate = function (x, y) {
    this.splash(x, y, 1.15);
    MG.Audio.play('bloom', U.randInt(0, 9));
    FX.ring(x, y, { r0: this.brush * 0.4, r1: this.brush * 3.4, hue: this.hue, width: this.brush * 0.25, dur: 0.6, alpha: 0.5 });
    return true;
  };

  Painting.prototype.draw = function (ctx) {
    var p = this.inset;
    var T = MG.Theme;
    var i;

    var paper = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    paper.addColorStop(0, '#0a0c1e');
    paper.addColorStop(0.6, '#111029');
    paper.addColorStop(1, '#1c1330');
    ctx.fillStyle = paper;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // a handful of faint stars on the night canvas
    ctx.fillStyle = 'rgba(210,220,255,0.16)';
    for (i = 0; i < 40; i++) {
      var sx = p.x + ((i * 97.31) % p.w);
      var sy = p.y + ((i * 53.77) % p.h);
      ctx.beginPath();
      ctx.arc(sx, sy, 1.1, 0, U.TAU);
      ctx.fill();
    }

    if (this.cv && this.W > 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.cv, 0, 0, this.W, this.H);
      ctx.restore();
    }

    // animated mandala for still hands
    if (this.settings.animation === 'stationary') {
      var list = this.app.playPointers();
      for (i = 0; i < list.length; i++) {
        var rec = list[i];
        if (rec.role !== 'play' || !U.inRect(rec.x, rec.y, p)) continue;
        this.drawMandala(ctx, rec);
      }
    }
  };

  Painting.prototype.drawMandala = function (ctx, rec) {
    var age = (U.now() - rec.downAt) / 1000;
    var hue = (this.hue + age * 22) % 360;
    var base = this.brush * 0.9;
    ctx.save();
    ctx.translate(rec.x, rec.y);
    ctx.rotate(age * 0.5);
    for (var k = 0; k < 3; k++) {
      var t = ((age * 0.32 + k / 3) % 1);
      var r = base * (0.25 + t * 1.9);
      ctx.globalAlpha = (1 - t) * 0.55;
      ctx.strokeStyle = U.hsl(hue + k * 55, 92, 72);
      ctx.lineWidth = Math.max(1.5, this.brush * 0.14 * (1 - t));
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, U.TAU);
      ctx.stroke();
    }
    var petals = 8;
    for (var i = 0; i < petals; i++) {
      var a = (i / petals) * U.TAU;
      var rr = base * (0.5 + 0.35 * Math.sin(age * 1.6 + i));
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = U.hsl(hue + i * 18, 90, 76);
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, base * 0.2, base * 0.34, a, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  MG.Games = MG.Games || {};
  MG.Games.painting = Painting;
})(window.MG);
