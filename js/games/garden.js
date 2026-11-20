/* Game 2 - Magic Garden. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;

  function Garden(app) {
    this.slots = [];
    this.flowers = [];
    this.butterflies = [];
    this.animals = [];
    this.clouds = [];
    this.motes = [];
    this.grows = 0;
    /* The garden never runs out: when every bed is full it drifts to seed,
       frees itself in a gentle wave, and begins again. */
    this.renewIn = 0;
    this.seeding = false;
    this.cycle = 0;
    MG.BaseGame.call(this, app);
    this.id = 'garden';
    this.title = 'Magic Garden';
  }

  Garden.prototype = Object.create(MG.BaseGame.prototype);
  Garden.prototype.constructor = Garden;

  Garden.prototype.buildSlots = function () {
    var slots = [];
    var cols = 6;
    var rows = 3;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        slots.push({
          nx: U.clamp(0.05 + ((c + 0.5) / cols) * 0.9 + U.rand(-0.025, 0.025), 0.04, 0.96),
          ny: U.clamp(0.705 + (r / Math.max(1, rows - 1)) * 0.245 + U.rand(-0.02, 0.02), 0.69, 0.97),
          used: false
        });
      }
    }
    // sort back to front so blooms land in a natural depth order
    slots.sort(function (a, b) { return a.ny - b.ny; });
    this.slots = slots;
  };

  Garden.prototype.layout = function () {
    var p = this.inset;
    var unit = Math.min(p.w, p.h);
    this.horizon = p.y + p.h * 0.655;
    this.petal = Math.max(5, unit * 0.035 * this.sizeFactor);
    this.sun = { x: p.x + p.w * 0.8, y: p.y + p.h * 0.14, r: unit * 0.072 };
    if (this.slots.length === 0) this.buildSlots();
    if (this.clouds.length === 0) {
      for (var i = 0; i < 3; i++) {
        this.clouds.push({ nx: U.rand(0.1, 0.85), ny: U.rand(0.06, 0.36), s: U.rand(0.55, 1) });
      }
    }
    this.tufts = this.tufts || this.makeTufts();
    if (this.motes.length === 0) {
      for (var m = 0; m < (this.calm ? 7 : 13); m++) {
        this.motes.push({
          nx: U.rand(0.03, 0.97),
          ny: U.rand(0.55, 0.98),
          r: this.petal * U.rand(0.35, 0.8),
          phase: U.rand(0, U.TAU),
          speed: U.rand(0.35, 0.9),
          hue: U.rand(40, 60)
        });
      }
    }
  };

  Garden.prototype.makeTufts = function () {
    var list = [];
    for (var i = 0; i < 38; i++) {
      list.push({ nx: U.rand(0.02, 0.98), ny: U.rand(0.68, 0.99), h: U.rand(0.5, 1.4), hue: U.rand(96, 135) });
    }
    return list;
  };

  Garden.prototype.slotPos = function (slot) {
    var p = this.inset;
    return { x: p.x + slot.nx * p.w, y: p.y + slot.ny * p.h };
  };

  Garden.prototype.enter = function () {
    if (this.slots.length === 0) this.buildSlots();
  };

  Garden.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);

    var i;
    var used = 0;
    for (i = 0; i < this.slots.length; i++) if (this.slots[i].used) used++;

    /* Full garden: wait a moment for the child to enjoy it, then renew. */
    if (used >= this.slots.length && !this.seeding) {
      if (this.renewIn <= 0) this.renewIn = 1.4;
      this.renewIn -= dt;
      if (this.renewIn <= 0) this.beginRenewal();
    }

    for (i = this.flowers.length - 1; i >= 0; i--) {
      var f = this.flowers[i];
      if (f.fade === undefined) f.fade = 1;
      if (f.fadeAt !== undefined && this.t >= f.fadeAt) {
        f.fade -= dt * 1.1;
        if (f.fade <= 0) {
          f.slot.used = false;
          this.flowers.splice(i, 1);
        }
      }
    }

    if (this.seeding) {
      var stillFading = false;
      for (i = 0; i < this.flowers.length; i++) {
        if (this.flowers[i].fadeAt !== undefined) { stillFading = true; break; }
      }
      if (!stillFading) {
        this.seeding = false;
        this.cycle += 1;
        this.seedVolunteers(this.calm ? 3 : 4);
      }
    }

    for (i = 0; i < this.flowers.length; i++) {
      var fl = this.flowers[i];
      if (fl.bloom < 1) fl.bloom = Math.min(1, fl.bloom + dt * 1.25);
      if (fl.wiggle > 0) fl.wiggle = Math.max(0, fl.wiggle - dt * 1.6);
    }

    var p = this.inset;
    var m = 0.35 + this.motion * 0.65;
    for (i = 0; i < this.butterflies.length; i++) {
      var b = this.butterflies[i];
      b.phase += dt * b.speed * m;
      b.ax += Math.cos(b.phase) * 26 * dt * m;
      b.ay += Math.sin(b.phase * 1.7) * 20 * dt * m;
      b.ax = U.clamp(b.ax, -1, 1);
      b.ay = U.clamp(b.ay, -1, 1);
      b.x = p.x + p.w * b.nx + b.ax * p.w * 0.09;
      b.y = b.baseY + b.ay * p.h * 0.05;
      if (b.y > this.horizon) b.y = this.horizon;
    }

    var mm = 0.4 + this.motion * 0.6;
    for (i = 0; i < this.motes.length; i++) {
      var mo = this.motes[i];
      mo.phase += dt * 0.5 * mm;
      mo.ny -= dt * 0.012 * mo.speed * mm;
      if (mo.ny < 0.5) { mo.ny = 0.99; mo.nx = U.rand(0.03, 0.97); }
    }
  };

  /* A wave from the back of the garden to the front, so the change reads as
     the garden settling rather than everything vanishing at once. */
  Garden.prototype.beginRenewal = function () {
    this.seeding = true;
    this.renewIn = 0;
    var ordered = this.flowers.slice().sort(function (a, b) { return a.ny - b.ny; });
    for (var i = 0; i < ordered.length; i++) {
      if (ordered[i].fadeAt !== undefined) continue;
      ordered[i].fade = 1;
      ordered[i].fadeAt = this.t + 0.3 + i * 0.05;
    }
    MG.Audio.play('sparkle');
    var p = this.inset;
    FX.petals(p.x + p.w * 0.5, p.y + p.h * 0.72, this.calm ? 8 : 16, 120);
  };

  Garden.prototype.addFlower = function (slot, quiet) {
    slot.used = true;
    var kind = U.pick(['daisy', 'daisy', 'puff', 'bell', 'tulip']);
    var flower = {
      slot: slot,
      nx: slot.nx,
      ny: slot.ny,
      hue: U.rand(0, 360),
      kind: kind,
      bloom: 0,
      seed: U.rand(0, U.TAU),
      wiggle: quiet ? 0 : 1,
      fade: 1
    };
    this.flowers.push(flower);
    if (!quiet) this.grows += 1;
    return flower;
  };

  /* A few blooms return by themselves after the turn-over, so the garden
     never sits empty waiting to be noticed. */
  Garden.prototype.seedVolunteers = function (n) {
    var free = [];
    for (var i = 0; i < this.slots.length; i++) if (!this.slots[i].used) free.push(this.slots[i]);
    for (var k = 0; k < n && free.length > 0; k++) {
      var idx = U.randInt(0, free.length - 1);
      this.addFlower(free[idx], true);
      free.splice(idx, 1);
    }
    MG.Audio.play('sparkle');
  };

  Garden.prototype.activate = function (x, y) {
    var p = this.inset;
    var best = null;
    var bestD = Infinity;
    var i;

    for (i = 0; i < this.slots.length; i++) {
      var s = this.slots[i];
      if (s.used) continue;
      var pos = this.slotPos(s);
      var d = U.dist(x, y, pos.x, pos.y);
      if (d < bestD) { bestD = d; best = s; }
    }

    if (best) {
      var flower = this.addFlower(best);

      var fp = this.slotPos(best);
      FX.petals(fp.x, fp.y - this.petal * 4, this.calm ? 6 : 12, flower.hue);
      FX.ring(fp.x, fp.y - this.petal * 4, { r0: 4, r1: this.petal * 7, hue: flower.hue, width: this.petal * 0.9, dur: 0.75, alpha: 0.6 });
      MG.Audio.play('bloom', this.grows % 9);

      this.addButterfly();
      this.maybeAnimal();
      return true;
    }

    // Garden is full: celebrate the nearest bloom instead. Still a reward.
    var near = null;
    var nd = Infinity;
    for (i = 0; i < this.flowers.length; i++) {
      var f = this.flowers[i];
      var fx = p.x + f.nx * p.w;
      var fy = p.y + f.ny * p.h;
      var dd = U.dist(x, y, fx, fy);
      if (dd < nd) { nd = dd; near = f; }
    }
    if (near) {
      near.wiggle = 1;
      /* Touching a full garden begins the turn-over a little sooner. */
      if (!this.seeding) this.renewIn = Math.min(this.renewIn > 0 ? this.renewIn : 1.4, 0.9);
      var nx = p.x + near.nx * p.w;
      var ny = p.y + near.ny * p.h;
      FX.petals(nx, ny - this.petal * 5, this.calm ? 5 : 10, near.hue);
      FX.sparkle(nx, ny - this.petal * 5, 6, near.hue);
      MG.Audio.play('chime', U.randInt(2, 8));
      this.addButterfly();
      return true;
    }

    FX.sparkle(x, y, 4, 120);
    return false;
  };

  Garden.prototype.addButterfly = function () {
    var limit = this.calm ? 4 : 8;
    var want = Math.min(limit, 1 + Math.floor(this.grows / 2));
    if (this.butterflies.length >= want) return;
    var p = this.inset;
    this.butterflies.push({
      nx: U.rand(0.15, 0.85),
      baseY: U.rand(this.horizon - p.h * 0.28, this.horizon - p.h * 0.04),
      x: p.x + p.w * 0.5,
      y: this.horizon,
      ax: U.rand(-0.5, 0.5),
      ay: U.rand(-0.5, 0.5),
      phase: U.rand(0, U.TAU),
      speed: U.rand(1.1, 2.2),
      hue: U.rand(0, 360)
    });
  };

  Garden.prototype.maybeAnimal = function () {
    var plan = [
      { at: 4, kind: 'bunny', nx: 0.78, ny: 0.9 },
      { at: 8, kind: 'bird', nx: 0.22, ny: 0.6 },
      { at: 12, kind: 'snail', nx: 0.14, ny: 0.95 }
    ];
    for (var i = 0; i < plan.length; i++) {
      var a = plan[i];
      if (this.grows === a.at) {
        this.animals.push({ kind: a.kind, nx: a.nx, ny: a.ny, born: this.t, twitch: 0 });
        var p = this.inset;
        FX.sparkle(p.x + p.w * a.nx, p.y + p.h * a.ny, 8, 50);
        MG.Audio.play('sparkle');
      }
    }
  };

  Garden.prototype.draw = function (ctx) {
    var p = this.inset;
    var T = MG.Theme;
    var i;

    var sky = ctx.createLinearGradient(0, p.y, 0, this.horizon + p.h * 0.1);
    sky.addColorStop(0, '#080a1c');
    sky.addColorStop(0.5, '#121a33');
    sky.addColorStop(1, '#233444');
    ctx.fillStyle = sky;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // quiet stars
    if (!this.starsBg) this.starsBg = T.stars(46, 23);
    for (i = 0; i < this.starsBg.length; i++) {
      var st = this.starsBg[i];
      var tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.t * st.sp + st.ph));
      ctx.globalAlpha = tw * 0.65;
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(p.x + st.nx * p.w, p.y + st.ny * p.h * 0.6, st.r, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // moon
    T.glow(ctx, this.sun.x, this.sun.y, this.sun.r * 4, '#ffeec4', 0.42, 0.32);
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.arc(this.sun.x, this.sun.y, this.sun.r, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,190,235,0.22)';
    ctx.beginPath();
    ctx.arc(this.sun.x - this.sun.r * 0.3, this.sun.y + this.sun.r * 0.2, this.sun.r * 0.22, 0, U.TAU);
    ctx.arc(this.sun.x + this.sun.r * 0.32, this.sun.y - this.sun.r * 0.2, this.sun.r * 0.14, 0, U.TAU);
    ctx.fill();

    // night mist
    for (i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      var cx = p.x + p.w * c.nx + Math.sin(this.t * 0.08 + i) * p.w * 0.02 * (1 + this.motion);
      this.cloud(ctx, cx, p.y + p.h * c.ny, Math.min(p.w, p.h) * 0.075 * c.s);
    }

    // hills
    var hillY = this.horizon;
    ctx.fillStyle = '#14302f';
    ctx.beginPath();
    ctx.moveTo(p.x, hillY + p.h * 0.05);
    ctx.quadraticCurveTo(p.x + p.w * 0.25, hillY - p.h * 0.09, p.x + p.w * 0.55, hillY + p.h * 0.02);
    ctx.quadraticCurveTo(p.x + p.w * 0.8, hillY - p.h * 0.07, p.x + p.w, hillY + p.h * 0.03);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.lineTo(p.x, p.y + p.h);
    ctx.closePath();
    ctx.fill();

    var ground = ctx.createLinearGradient(0, hillY, 0, p.y + p.h);
    ground.addColorStop(0, '#123a2e');
    ground.addColorStop(1, '#0b241d');
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(p.x, hillY + p.h * 0.07);
    ctx.quadraticCurveTo(p.x + p.w * 0.5, hillY - p.h * 0.02, p.x + p.w, hillY + p.h * 0.07);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.lineTo(p.x, p.y + p.h);
    ctx.closePath();
    ctx.fill();

    // grass tufts, catching moonlight
    ctx.strokeStyle = 'rgba(126,214,176,0.26)';
    ctx.lineWidth = Math.max(1.5, this.petal * 0.3);
    for (i = 0; i < this.tufts.length; i++) {
      var tf = this.tufts[i];
      var tx = p.x + p.w * tf.nx;
      var ty = p.y + p.h * tf.ny;
      var th = this.petal * 1.5 * tf.h;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx - th * 0.2, ty - th * 0.6, tx - th * 0.35, ty - th);
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + th * 0.15, ty - th * 0.7, tx + th * 0.2, ty - th * 1.1);
      ctx.stroke();
    }

    // flowers, back to front
    var ordered = this.flowers.slice().sort(function (a, b) { return a.ny - b.ny; });
    for (i = 0; i < ordered.length; i++) {
      var f = ordered[i];
      var depth = U.invLerp(0.69, 0.98, f.ny);
      var unit = this.petal * (0.72 + depth * 0.6);
      ctx.save();
      ctx.globalAlpha = f.fade === undefined ? 1 : U.clamp(f.fade, 0, 1);
      this.drawFlower(ctx, p.x + f.nx * p.w, p.y + f.ny * p.h, unit, f);
      ctx.restore();
    }

    // animals
    for (i = 0; i < this.animals.length; i++) {
      var an = this.animals[i];
      var ax = p.x + p.w * an.nx;
      var ay = p.y + p.h * an.ny;
      var un = this.petal * 1.5;
      if (an.kind === 'bunny') this.drawBunny(ctx, ax, ay, un);
      else if (an.kind === 'bird') this.drawBird(ctx, ax, ay, un * 0.9);
      else this.drawSnail(ctx, ax, ay, un);
    }

    // drifting pollen, now fireflies
    for (i = 0; i < this.motes.length; i++) {
      var mo = this.motes[i];
      var mx = p.x + mo.nx * p.w + Math.sin(this.t * 0.8 + mo.phase) * p.h * 0.01;
      var my = p.y + mo.ny * p.h;
      var tw = 0.35 + 0.4 * Math.sin(this.t * 1.6 + mo.phase);
      ctx.globalAlpha = Math.max(0, tw);
      T.glow(ctx, mx, my, mo.r * 4, '#ffe6a8', 0.32, 0.3);
      ctx.fillStyle = U.hsl(mo.hue, 95, 86);
      ctx.beginPath();
      ctx.arc(mx, my, mo.r * 0.8, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // butterflies on top
    for (i = 0; i < this.butterflies.length; i++) this.drawButterfly(ctx, this.butterflies[i]);

    // count flowers on a little wooden sign
    this.drawSign(ctx);
  };

  Garden.prototype.cloud = function (ctx, x, y, r) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
    g.addColorStop(0, 'rgba(190,205,245,0.12)');
    g.addColorStop(0.55, 'rgba(190,205,245,0.06)');
    g.addColorStop(1, 'rgba(190,205,245,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r * 1.05, 0, 0, U.TAU);
    ctx.fill();
  };

  Garden.prototype.drawFlower = function (ctx, x, y, unit, f) {
    var bloom = U.clamp(f.bloom, 0, 1);
    var grow = U.easeOutBack(bloom);
    var wig = f.wiggle * Math.sin(this.t * 12) * unit * 0.25;
    var sway = Math.sin(this.t * 0.9 + f.seed) * unit * 0.35 * (0.4 + this.motion) + wig;
    var stemH = unit * (1.4 + 4.6 * grow);
    var headX = x + sway;
    var headY = y - stemH;

    ctx.strokeStyle = '#3f8f72';
    ctx.lineWidth = Math.max(2, unit * 0.32);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway * 0.5, y - stemH * 0.55, headX, headY);
    ctx.stroke();

    // leaves
    ctx.fillStyle = '#4c9d7c';
    var leafY = y - stemH * 0.42;
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.ellipse(x + s * unit * 0.5, leafY, unit * 0.62, unit * 0.26, s * 0.6, 0, U.TAU);
      ctx.fill();
    }

    if (grow <= 0.03) return;

    var head = unit * 2.05 * grow;
    var hue = f.hue;

    // the bloom carries its own light
    var glowR = head * 2.6;
    var gg = ctx.createRadialGradient(headX, headY, head * 0.2, headX, headY, glowR);
    gg.addColorStop(0, U.hsl(hue, 90, 70, 0.2));
    gg.addColorStop(1, U.hsl(hue, 90, 70, 0));
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(headX, headY, glowR, 0, U.TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(Math.sin(this.t * 0.7 + f.seed) * 0.05);

    if (f.kind === 'puff' || f.kind === 'bell') {
      var n = f.kind === 'puff' ? 9 : 6;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * U.TAU + f.seed;
        var rr = head * (f.kind === 'puff' ? 0.55 : 0.42);
        ctx.fillStyle = U.hsl(hue, 82, 68);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr + (f.kind === 'bell' ? head * 0.15 : 0), head * (f.kind === 'puff' ? 0.34 : 0.3), 0, U.TAU);
        ctx.fill();
      }
    } else {
      var petals = f.kind === 'tulip' ? 4 : 8;
      for (var j = 0; j < petals; j++) {
        var ang = (j / petals) * U.TAU + f.seed;
        ctx.save();
        ctx.rotate(ang);
        ctx.fillStyle = U.hsl(hue + j * 4, 84, 70);
        ctx.beginPath();
        if (f.kind === 'tulip') {
          ctx.ellipse(0, -head * 0.62, head * 0.34, head * 0.52, 0, 0, U.TAU);
        } else {
          ctx.ellipse(0, -head * 0.6, head * 0.29, head * 0.6, 0, 0, U.TAU);
        }
        ctx.fill();
        ctx.restore();
      }
    }

    // centre
    var grad = ctx.createRadialGradient(-head * 0.1, -head * 0.14, head * 0.05, 0, 0, head * 0.44);
    grad.addColorStop(0, '#fff2b3');
    grad.addColorStop(1, '#ffcf5c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, head * 0.4, 0, U.TAU);
    ctx.fill();

    if (grow > 0.55) {
      ctx.fillStyle = 'rgba(70,50,40,0.8)';
      ctx.beginPath();
      ctx.arc(-head * 0.13, -head * 0.03, head * 0.045, 0, U.TAU);
      ctx.arc(head * 0.13, -head * 0.03, head * 0.045, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,50,40,0.7)';
      ctx.lineWidth = Math.max(1, head * 0.035);
      ctx.beginPath();
      ctx.arc(0, head * 0.06, head * 0.1, 0.25, Math.PI - 0.25);
      ctx.stroke();
    }
    ctx.restore();
  };

  Garden.prototype.drawButterfly = function (ctx, b) {
    var flap = Math.abs(Math.sin(this.t * 7 + b.phase)) * 0.9 + 0.15;
    var s = this.petal * 0.85;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.sin(b.phase) * 0.25);
    ctx.fillStyle = U.hsl(b.hue, 85, 72);
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      ctx.save();
      ctx.scale(sgn, 1);
      ctx.beginPath();
      ctx.ellipse(s * 0.65 * flap, -s * 0.35, s * 0.75 * flap, s * 0.55, -0.4, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(s * 0.5 * flap, s * 0.42, s * 0.55 * flap, s * 0.42, 0.45, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    ctx.fillStyle = '#4a3f5f';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.12, s * 0.5, 0, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = '#4a3f5f';
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.45);
    ctx.lineTo(-s * 0.3, -s * 0.85);
    ctx.moveTo(0, -s * 0.45);
    ctx.lineTo(s * 0.3, -s * 0.85);
    ctx.stroke();
    ctx.restore();
  };

  Garden.prototype.drawBunny = function (ctx, x, y, u) {
    var bob = Math.sin(this.t * 1.4) * u * 0.05;
    ctx.fillStyle = '#fdf6f0';
    ctx.beginPath();
    ctx.ellipse(x, y - u * 0.5 + bob, u * 0.65, u * 0.55, 0, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - u * 1.15 + bob, u * 0.42, 0, U.TAU);
    ctx.fill();
    // ears
    var tw = Math.sin(this.t * 2.2) * 0.12;
    for (var s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(x + s * u * 0.2, y - u * 1.5 + bob);
      ctx.rotate(s * tw);
      ctx.fillStyle = '#fdf6f0';
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.28, u * 0.16, u * 0.46, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#ffc7d8';
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.28, u * 0.07, u * 0.3, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(70,50,60,0.85)';
    ctx.beginPath();
    ctx.arc(x - u * 0.15, y - u * 1.18 + bob, u * 0.05, 0, U.TAU);
    ctx.arc(x + u * 0.15, y - u * 1.18 + bob, u * 0.05, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#ff9db4';
    ctx.beginPath();
    ctx.arc(x, y - u * 1.04 + bob, u * 0.055, 0, U.TAU);
    ctx.fill();
  };

  Garden.prototype.drawBird = function (ctx, x, y, u) {
    var bob = Math.sin(this.t * 3) * u * 0.09;
    var wing = Math.sin(this.t * 7) * 0.5;
    ctx.fillStyle = '#7fd0e8';
    ctx.beginPath();
    ctx.ellipse(x, y + bob, u * 0.5, u * 0.38, 0, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + u * 0.32, y - u * 0.3 + bob, u * 0.26, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#58b9d8';
    ctx.save();
    ctx.translate(x - u * 0.08, y + bob);
    ctx.rotate(wing);
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 0.34, u * 0.16, -0.35, 0, U.TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffb547';
    ctx.beginPath();
    ctx.moveTo(x + u * 0.55, y - u * 0.3 + bob);
    ctx.lineTo(x + u * 0.78, y - u * 0.22 + bob);
    ctx.lineTo(x + u * 0.55, y - u * 0.14 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(60,50,70,0.85)';
    ctx.beginPath();
    ctx.arc(x + u * 0.4, y - u * 0.36 + bob, u * 0.045, 0, U.TAU);
    ctx.fill();
  };

  Garden.prototype.drawSnail = function (ctx, x, y, u) {
    ctx.fillStyle = '#c9b6f0';
    ctx.beginPath();
    ctx.ellipse(x, y, u * 0.75, u * 0.22, 0, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x, y - u * 0.3, u * 0.42, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = '#e0a94a';
    ctx.lineWidth = Math.max(1.5, u * 0.08);
    ctx.beginPath();
    ctx.arc(x, y - u * 0.3, u * 0.22, 0, U.TAU * 1.4);
    ctx.stroke();
    ctx.strokeStyle = '#c9b6f0';
    ctx.lineWidth = Math.max(1.5, u * 0.07);
    ctx.beginPath();
    ctx.moveTo(x + u * 0.35, y - u * 0.45);
    ctx.lineTo(x + u * 0.45, y - u * 0.8);
    ctx.moveTo(x + u * 0.22, y - u * 0.48);
    ctx.lineTo(x + u * 0.2, y - u * 0.82);
    ctx.stroke();
  };

  /* The sign became a cycle medallion: a ring fills as the garden grows and
     empties as it drifts to seed. No number, so it stays a picture, not a score. */
  Garden.prototype.drawSign = function (ctx) {
    var p = this.inset;
    var T = MG.Theme;
    var d = this.petal * 3.1;
    var x = p.x + p.w - d - p.h * 0.03;
    var y = p.y + p.h - d - p.h * 0.03;
    var cx = x + d / 2;
    var cy = y + d / 2;

    var used = 0;
    for (var s = 0; s < this.slots.length; s++) if (this.slots[s].used) used++;
    var prog = this.slots.length ? used / this.slots.length : 0;

    T.panel(ctx, x, y, d, d, d * 0.36, { hairline: 0.3 });
    ctx.strokeStyle = T.rgba(T.C.brass, 0.2);
    ctx.lineWidth = Math.max(2, d * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, d * 0.3, 0, U.TAU);
    ctx.stroke();

    if (prog > 0.01) {
      ctx.strokeStyle = T.C.gold;
      ctx.lineWidth = Math.max(2, d * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, d * 0.3, -Math.PI / 2, -Math.PI / 2 + prog * U.TAU);
      ctx.stroke();
    }

    ctx.fillStyle = U.hsl(330, 78, 74);
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * U.TAU;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d * 0.11, cy + Math.sin(a) * d * 0.11, d * 0.075, 0, U.TAU);
      ctx.fill();
    }
    ctx.fillStyle = T.C.gold;
    ctx.beginPath();
    ctx.arc(cx, cy, d * 0.07, 0, U.TAU);
    ctx.fill();
  };

  MG.Games = MG.Games || {};
  MG.Games.garden = Garden;
})(window.MG);
