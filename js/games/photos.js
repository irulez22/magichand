/* Game 5 - Picture Pairs.
   The parent's own pictures drift across both halves of the screen. The same
   picture must be held on both halves at the same time to catch it. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;

  function Photos(app) {
    this.pairs = [];
    this.pictures = MG.Pictures.placeholders();
    this.captured = 0;
    this.hearts = [];
    this.loaded = false;
    this.fullScreen = true;
    this.card = 120;
    this.split = 0;
    this.holdTime = 0.4;
    /* Captured pictures collect in an album strip. When the page is full the
       strip lifts away and a new page begins, so the scene never runs out. */
    this.album = [];
    this.albumCap = 6;
    this.turning = false;
    this.turnT = 0;
    this.pending = [];
    this.pages = 0;
    MG.BaseGame.call(this, app);
    this.id = 'photos';
    this.title = 'Picture Pairs';
  }

  Photos.prototype = Object.create(MG.BaseGame.prototype);
  Photos.prototype.constructor = Photos;

  Photos.prototype.layout = function () {
    /* Full-screen scene: use the whole window minus the tray. Reading the
       stageRect here would be wrong during construction, when App.game is
       still the previous scene. */
    var bottom = this.app.zone && this.app.zone.bottom ? this.app.zone.bottom : 0;
    var W = this.app.W || 800;
    var H = Math.max(200, (this.app.H || 600) - bottom);
    this.W = W;
    this.H = H;
    this.split = U.clamp(
      this.app.zone ? this.app.zone.splitX : W / 2,
      80,
      Math.max(120, W - 80)
    );

    this.card = Math.min(W, H) * ({ xlarge: 0.2, large: 0.155, medium: 0.115 }[this.settings.targetSize] || 0.155);
    this.wanted = { xlarge: 1, large: 2, medium: 3 }[this.settings.targetSize] || 2;
    this.holdTime = { low: 0.55, medium: 0.4, high: 0.3 }[this.settings.reward] || 0.4;

    if (!this.pairs) this.pairs = [];
    while (this.pairs.length > this.wantedCount()) this.pairs.pop();
    while (this.pairs.length < this.wantedCount()) this.pairs.push(this.makePair());
    for (var i = 0; i < this.pairs.length; i++) this.reflowPair(this.pairs[i]);
  };

  /* Never show the same picture twice: with only one photo there is one pair. */
  Photos.prototype.wantedCount = function () {
    var n = this.pictures && this.pictures.length ? this.pictures.length : 1;
    return Math.max(1, Math.min(this.wanted || 1, n));
  };

  Photos.prototype.enter = function () {
    var self = this;
    this.loaded = false;
    MG.Pictures.load().then(function (list) {
      if (list && list.length) {
        self.pictures = list;
        self.rebuild();
      }
      self.loaded = true;
    }).catch(function () {
      self.loaded = true;
    });
  };

  Photos.prototype.rebuild = function () {
    this.pairs = [];
    for (var i = 0; i < this.wantedCount(); i++) this.pairs.push(this.makePair());
  };

  /* Pick a picture no other pair is showing, so the same picture is never on
     screen twice (with duplicates, "the same picture" would be ambiguous).
     Returns null when every picture is already on screen. */
  Photos.prototype.pickPicture = function () {
    var used = this.pairs.map(function (p) { return p.pic.id; });
    var options = this.pictures.filter(function (p) { return used.indexOf(p.id) === -1; });
    return options.length ? U.pick(options) : null;
  };

  /* Each pair gets its own horizontal lane. Cards drift sideways only, so two
     pictures never sit under one finger and "the same picture" stays clear. */
  Photos.prototype.laneBounds = function (lane) {
    var n = Math.max(1, this.wantedCount());
    var index = U.clamp(lane || 0, 0, n - 1);
    var top = this.H * 0.1;
    var bottom = this.H * 0.85;
    var band = (bottom - top) / n;
    return { min: top + band * index, max: top + band * (index + 1) };
  };

  Photos.prototype.makePair = function () {
    var pic = this.pickPicture() || U.pick(this.pictures);
    var pair = {
      lane: this.pairs.length,
      pic: pic,
      left: null,
      right: null,
      hold: 0,
      captured: false,
      fade: 1,
      replaceAt: 0
    };
    pair.left = this.newCard('left', pair.lane);
    pair.right = this.newCard('right', pair.lane);
    return pair;
  };

  Photos.prototype.resetPair = function (pair) {
    // Keep the captured picture when nothing else is free; never duplicate it.
    pair.pic = this.pickPicture() || pair.pic;
    pair.left = this.newCard('left', pair.lane);
    pair.right = this.newCard('right', pair.lane);
    pair.hold = 0;
    pair.captured = false;
    pair.fade = 1;
    pair.replaceAt = 0;
  };

  Photos.prototype.halfBounds = function (side) {
    var pad = 10;
    if (side === 'left') return { min: pad, max: this.split - pad };
    return { min: this.split + pad, max: this.W - pad };
  };

  Photos.prototype.newCard = function (side, lane) {
    var b = this.halfBounds(side);
    var size = Math.max(24, Math.min(this.card * U.rand(0.95, 1.06), (b.max - b.min) * 0.82));
    var lb = this.laneBounds(lane);
    var half = size / 2;
    var yMin = Math.max(lb.min + half, lb.min);
    var yMax = Math.max(yMin, lb.max - half);
    var m = this.motion;
    var x = U.rand(b.min + size / 2, b.max - size / 2);
    var y = U.rand(yMin, yMax);
    return {
      side: side,
      x: x,
      y: y,
      s: size,
      vx: m ? U.rand(6, 16) * U.pick([-1, 1]) * m : 0,
      vy: 0,
      held: false,
      flash: 0
    };
  };

  Photos.prototype.reflowPair = function (pair) {
    var self = this;
    var lb = this.laneBounds(pair.lane);
    [pair.left, pair.right].forEach(function (card) {
      var b = self.halfBounds(card.side);
      card.s = Math.max(24, Math.min(card.s, (b.max - b.min) * 0.82));
      card.x = U.clamp(card.x, b.min + card.s / 2, b.max - card.s / 2);
      var half = card.s / 2;
      card.y = U.clamp(card.y, lb.min + half, Math.max(lb.min + half, lb.max - half));
    });
  };

  Photos.prototype.cardAt = function (x, y) {
    for (var i = 0; i < this.pairs.length; i++) {
      var pair = this.pairs[i];
      if (pair.captured) continue;
      var cards = [pair.left, pair.right];
      for (var c = 0; c < cards.length; c++) {
        var card = cards[c];
        var half = card.s * 0.5 * 1.2;
        if (Math.abs(x - card.x) <= half && Math.abs(y - card.y) <= half) return card;
      }
    }
    return null;
  };

  Photos.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);
    var i;

    for (i = 0; i < this.pairs.length; i++) {
      var pair = this.pairs[i];
      var cards = [pair.left, pair.right];
      for (var c = 0; c < cards.length; c++) {
        var card = cards[c];
        var b = this.halfBounds(card.side);
        card.x += card.vx * dt;
        if (card.x < b.min + card.s / 2) { card.x = b.min + card.s / 2; card.vx = Math.abs(card.vx); }
        if (card.x > b.max - card.s / 2) { card.x = b.max - card.s / 2; card.vx = -Math.abs(card.vx); }
        var lb = this.laneBounds(pair.lane);
        var half = card.s / 2;
        card.y = U.clamp(card.y, lb.min + half, Math.max(lb.min + half, lb.max - half));
        if (card.flash > 0) card.flash = Math.max(0, card.flash - dt * 2.4);
        card.held = false;
      }
      if (pair.captured) {
        pair.fade = Math.max(0, pair.fade - dt * 2.2);
        if (this.t >= pair.replaceAt) this.resetPair(pair);
      }
    }

    var pointers = this.app.playPointers();
    for (i = 0; i < pointers.length; i++) {
      var p = pointers[i];
      if (p.role !== 'play') continue;
      var hit = this.cardAt(p.x, p.y);
      if (hit) {
        hit.held = true;
        hit.flash = 1;
      }
    }

    for (i = 0; i < this.pairs.length; i++) {
      var pp = this.pairs[i];
      if (pp.captured) continue;
      if (pp.left.held && pp.right.held) {
        pp.hold += dt;
        if (pp.hold >= this.holdTime) this.capture(pp);
      } else {
        pp.hold = Math.max(0, pp.hold - dt * 2.5);
      }
    }

    for (i = this.hearts.length - 1; i >= 0; i--) {
      var h = this.hearts[i];
      h.age += dt;
      if (h.age >= h.life) { this.hearts.splice(i, 1); continue; }
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy += 10 * dt;
    }

    /* Album page turn: the finished page fades upward, then a new page of
       pictures captured during the turn slides in. */
    if (this.turning) {
      this.turnT += dt;
      if (this.turnT >= 0.9) {
        this.album = this.pending.slice(0, this.albumCap);
        this.pending = [];
        this.turning = false;
        this.turnT = 0;
        this.pages += 1;
      }
    }
  };

  Photos.prototype.addToAlbum = function (pic) {
    if (this.turning) {
      this.pending.push(pic);
      return;
    }
    this.album.push(pic);
    if (this.album.length >= this.albumCap) {
      this.turning = true;
      this.turnT = 0;
      MG.Audio.play('bloom', 5);
    }
  };

  Photos.prototype.capture = function (pair) {
    pair.captured = true;
    pair.hold = 0;
    pair.fade = 1;
    pair.replaceAt = this.t + 0.85;
    this.captured += 1;

    MG.Metrics.addActivation();
    MG.Audio.play('chime', this.captured % 8);
    MG.Audio.play('sparkle');
    this.addToAlbum(pair.pic);

    var a = pair.left;
    var b = pair.right;
    var calm = this.settings.visual === 'calm';
    FX.confetti(a.x, a.y, calm ? 7 : 13, { hue: 45, speed: 260 });
    FX.confetti(b.x, b.y, calm ? 7 : 13, { hue: 45, speed: 260 });
    FX.ring(a.x, a.y, { r0: a.s * 0.3, r1: a.s * 1.4, hue: 48, width: 5, dur: 0.6, alpha: 0.6 });
    FX.ring(b.x, b.y, { r0: b.s * 0.3, r1: b.s * 1.4, hue: 48, width: 5, dur: 0.6, alpha: 0.6 });
    FX.sparkle((a.x + b.x) / 2, (a.y + b.y) / 2, calm ? 4 : 8, 55);

    for (var i = 0; i < (calm ? 4 : 8); i++) {
      this.hearts.push({
        x: U.lerp(a.x, b.x, Math.random()),
        y: U.lerp(a.y, b.y, Math.random()),
        s: Math.max(8, this.card * 0.09),
        vx: U.rand(-20, 20),
        vy: U.rand(-55, -20),
        life: U.rand(0.9, 1.6),
        age: 0
      });
    }
  };

  Photos.prototype.draw = function (ctx) {
    var W = this.W;
    var H = this.H;
    var T = MG.Theme;
    var i;

    var bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, '#0b0818');
    bg.addColorStop(0.55, '#151029');
    bg.addColorStop(1, '#241634');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // two gallery spotlights
    T.glow(ctx, W * 0.22, -H * 0.06, Math.max(W, H) * 0.6, '#ffcf94', 0.16, 0.35);
    T.glow(ctx, W * 0.78, -H * 0.06, Math.max(W, H) * 0.6, '#ffcf94', 0.16, 0.35);

    T.vignette(ctx, 0, 0, W, H, 0.5);

    // the seam between the two halves: a soft beam of light
    var seam = ctx.createLinearGradient(this.split - 34, 0, this.split + 34, 0);
    seam.addColorStop(0, 'rgba(255,214,150,0)');
    seam.addColorStop(0.5, 'rgba(255,214,150,0.12)');
    seam.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = seam;
    ctx.fillRect(this.split - 34, 0, 68, H);

    // link between matching held pairs
    for (i = 0; i < this.pairs.length; i++) {
      var pair = this.pairs[i];
      if (!pair.left.held || !pair.right.held || pair.captured) continue;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#ffc94d';
      ctx.lineWidth = Math.max(3, this.card * 0.02);
      ctx.setLineDash([this.card * 0.08, this.card * 0.06]);
      ctx.lineDashOffset = -this.t * 40;
      ctx.beginPath();
      ctx.moveTo(pair.left.x, pair.left.y);
      ctx.quadraticCurveTo((pair.left.x + pair.right.x) / 2, Math.min(pair.left.y, pair.right.y) - this.card * 0.15, pair.right.x, pair.right.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    for (i = 0; i < this.pairs.length; i++) {
      var pr = this.pairs[i];
      var alpha = pr.captured ? pr.fade : 1;
      if (alpha <= 0.01) continue;
      this.drawCard(ctx, pr, pr.left, alpha);
      this.drawCard(ctx, pr, pr.right, alpha);

      // one side held: invite the other hand to the matching copy
      if (!pr.captured && pr.left.held !== pr.right.held) {
        var other = pr.left.held ? pr.right : pr.left;
        ctx.save();
        ctx.globalAlpha = 0.45 + 0.3 * Math.sin(this.t * 4);
        ctx.strokeStyle = 'rgba(255,190,70,0.95)';
        ctx.lineWidth = 3;
        ctx.setLineDash([other.s * 0.1, other.s * 0.08]);
        U.rr(ctx, other.x - other.s * 0.57, other.y - other.s * 0.57, other.s * 1.14, other.s * 1.14, other.s * 0.19);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    for (i = 0; i < this.hearts.length; i++) {
      var ht = this.hearts[i];
      var life = 1 - ht.age / ht.life;
      this.heart(ctx, ht.x, ht.y, ht.s, U.clamp(life, 0, 1) * 0.8);
    }

    this.drawAlbum(ctx);
  };

  Photos.prototype.drawCard = function (ctx, pair, card, alpha) {
    var T = MG.Theme;
    var s = card.s;
    var x = card.x;
    var y = card.y;
    var held = card.held && !pair.captured;
    var scale = pair.captured ? (0.82 + pair.fade * 0.18) : (held ? 1.04 : 1);
    var half = (s * scale) / 2;
    var r = s * 0.12;

    ctx.save();
    ctx.globalAlpha = alpha;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    U.rr(ctx, x - half + 3, y - half + 7, half * 2, half * 2, r);
    ctx.fill();

    // warm glow when held
    if (held) T.glow(ctx, x, y, half * 1.9, '#ffcf8a', 0.34, 0.4);

    // walnut frame with a brass edge
    var frame = ctx.createLinearGradient(x - half, y - half, x + half, y + half);
    frame.addColorStop(0, '#4a3524');
    frame.addColorStop(0.5, '#2c1f1c');
    frame.addColorStop(1, '#3d2a20');
    ctx.fillStyle = frame;
    U.rr(ctx, x - half, y - half, half * 2, half * 2, r);
    ctx.fill();

    ctx.strokeStyle = held ? T.rgba('#ffd68e', 0.9) : T.rgba('#e2b478', 0.4);
    ctx.lineWidth = held ? 3 : 1.5;
    U.rr(ctx, x - half + 0.75, y - half + 0.75, half * 2 - 1.5, half * 2 - 1.5, Math.max(2, r - 1));
    ctx.stroke();

    // picture
    ctx.save();
    U.rr(ctx, x - half + 6, y - half + 6, (half - 6) * 2, (half - 6) * 2, Math.max(2, r - 3));
    ctx.clip();
    this.drawPicture(ctx, pair.pic, x, y, (half - 6) * 2);
    ctx.restore();

    // hold progress
    if (held && pair.hold > 0.01 && !pair.captured) {
      var prog = U.clamp(pair.hold / this.holdTime, 0, 1);
      ctx.strokeStyle = T.C.lamp;
      ctx.lineWidth = Math.max(4, s * 0.03);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y, half * 1.16, -Math.PI / 2, -Math.PI / 2 + prog * U.TAU);
      ctx.stroke();
    }

    ctx.restore();
  };

  Photos.prototype.drawPicture = function (ctx, pic, x, y, size) {
    size = Math.max(4, size);
    if (pic.img) {
      var iw = pic.img.naturalWidth || 1;
      var ih = pic.img.naturalHeight || 1;
      var k = Math.min(size / iw, size / ih);
      var dw = iw * k;
      var dh = ih * k;
      ctx.fillStyle = '#fffdf8';
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.drawImage(pic.img, x - dw / 2, y - dh / 2, dw, dh);
      return;
    }
    if (pic.draw) {
      ctx.save();
      ctx.translate(x - size / 2, y - size / 2);
      pic.draw(ctx, size, size);
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#1b1430';
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  };

  Photos.prototype.heart = function (ctx, x, y, s, alpha) {
    if (alpha <= 0.02) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ef5f8a';
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.65);
    ctx.bezierCurveTo(x - s * 1.2, y - s * 0.15, x - s * 0.55, y - s * 1.1, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 1.1, x + s * 1.2, y - s * 0.15, x, y + s * 0.65);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  /* The album strip: the newest captured pictures sit in small frames at the
     bottom. A completed page lifts away and a new page starts. */
  Photos.prototype.drawAlbum = function (ctx) {
    var T = MG.Theme;
    var n = this.album.length;
    if (!n) return;

    var s = Math.max(20, Math.min(this.W, this.H) * 0.056);
    var gap = s * 1.28;
    var total = n * gap;
    var x0 = this.W / 2 - total / 2 + gap / 2;
    var baseY = this.H - s * 0.95;
    var fade = this.turning ? 1 - U.clamp(this.turnT / 0.9, 0, 1) : 1;
    var lift = this.turning ? U.clamp(this.turnT / 0.9, 0, 1) * s * 0.9 : 0;

    for (var i = 0; i < n; i++) {
      var x = x0 + i * gap;
      var y = baseY - lift;
      var half = (s * 0.92) / 2;

      ctx.save();
      ctx.globalAlpha = fade * 0.95;

      ctx.fillStyle = 'rgba(40,28,26,0.95)';
      U.rr(ctx, x - half, y - half, half * 2, half * 2, s * 0.16);
      ctx.fill();
      ctx.strokeStyle = T.rgba(T.C.brass, 0.45);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.save();
      U.rr(ctx, x - half + 3, y - half + 3, (half - 3) * 2, (half - 3) * 2, Math.max(2, s * 0.1));
      ctx.clip();
      this.drawPicture(ctx, this.album[i], x, y, (half - 3) * 2);
      ctx.restore();

      ctx.restore();
    }
  };

  MG.Games = MG.Games || {};
  MG.Games.photos = Photos;
})(window.MG);
