/* Game - Magic Car.
   A moonlit drive. The hold button on the right is the accelerator: while it is
   held the play side is lit and the car rolls. The left hand steers by moving
   across the play side. Bumping another car or a roadside tree never ends
   anything: the car wobbles, slows for a moment and the obstacle tumbles away.

   Fireflies light the lantern garland above the road. Six of them finish the
   garland, it glows, holds, then fades and the drive begins again. No score. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;
  var T = MG.Theme;

  var LANES = 3;
  var GARLAND = 6;
  var OBSTACLE_HUES = [8, 26, 132, 282, 338];

  function Car(app) {
    this.obstacles = [];
    this.pickups = [];
    this.carU = 0.5;
    this.carX = 0;
    this.carY = 0;
    this.tilt = 0;
    this.bump = 0;
    this.wobble = 0;
    this.throttle = 0;
    this.speed = 0;
    this.scroll = 0;
    this.spawnIn = 0;
    this.pickupIn = 0;
    this.lights = 0;
    this.celebrate = 0;
    this.cycle = 0;
    this.verge = null;
    MG.BaseGame.call(this, app);
    this.id = 'car';
    this.title = 'Magic Car';
  }

  Car.prototype = Object.create(MG.BaseGame.prototype);
  Car.prototype.constructor = Car;

  /* ------------------------------------------------------------- geometry */

  Car.prototype.layout = function () {
    var p = this.inset;
    var minDim = Math.min(p.w, p.h);
    var sizes = { xlarge: 0.17, large: 0.132, medium: 0.1 };

    this.carW = Math.max(42, minDim * (sizes[this.settings.targetSize] || 0.132));
    this.carH = this.carW * 1.55;
    this.roadW = Math.max(this.carW * 2.9, Math.min(p.w * 0.82, this.carW * 4.7));
    this.roadW = Math.min(this.roadW, p.w * 0.9);
    this.roadX = p.x + (p.w - this.roadW) / 2;
    this.laneW = this.roadW / LANES;
    this.margin = this.carW * 0.55;
    this.carY = p.y + p.h * 0.72;
    this.speedBase = minDim * 0.34;

    this.carX = this.laneXForU(this.carU);

    if (!this.verge) {
      this.verge = [];
      for (var i = 0; i < 16; i++) {
        this.verge.push({
          side: i % 2 ? 1 : -1,
          n: U.rand(0.02, 0.98),
          size: U.rand(0.65, 1.25),
          type: i % 5 === 0 ? 'lamp' : 'tree',
          hue: U.rand(120, 160)
        });
      }
    }

    /* Only transient things are cleared; the garland and cycle are progress. */
    this.obstacles.length = 0;
    this.pickups.length = 0;
    this.spawnIn = minDim * 0.8;
    this.pickupIn = 0;
  };

  Car.prototype.laneX = function (lane) {
    return this.roadX + this.laneW * (lane + 0.5);
  };

  Car.prototype.laneXForU = function (u) {
    return this.roadX + this.margin + U.clamp(u, 0, 1) * (this.roadW - this.margin * 2);
  };

  Car.prototype.enter = function () {
    this.obstacles.length = 0;
    this.pickups.length = 0;
    this.carU = 0.5;
    this.carX = this.laneXForU(0.5);
    this.tilt = 0;
    this.bump = 0;
    this.wobble = 0;
    this.throttle = 0;
    this.speed = 0;
    this.scroll = 0;
    this.lights = 0;
    this.celebrate = 0;
    this.cycle = 0;
    this.spawnIn = Math.min(this.play.w, this.play.h) * 0.8;
    this.pickupIn = 0;
  };

  /* --------------------------------------------------------------- input */

  /* The accelerator is the hold side, so the lamp doubles as the pedal. With
     the hold requirement off (mouse fallback) the car simply drives itself. */
  Car.prototype.gasLevel = function () {
    var app = this.app;
    var needHold = app && app.holdRequiredNow ? app.holdRequiredNow() : true;
    if (!needHold) return 1;
    return U.clamp(app.light || 0, 0, 1);
  };

  /* Steering follows the first play-side contact. Roles are fixed at
     pointerdown by the app, so the accelerator hand can never steer. */
  Car.prototype.steerPointer = function () {
    var list = this.app.playPointers ? this.app.playPointers() : [];
    return list.length ? list[0] : null;
  };

  /* --------------------------------------------------------------- drive */

  Car.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);

    var p = this.inset;
    var playing = this.app.mode === 'playing';

    this.throttle = U.approach(this.throttle, this.gasLevel(), 3.0, dt);

    var ptr = this.steerPointer();
    if (ptr && this.roadW > this.carW * 2) {
      var u = U.clamp(U.invLerp(p.x, p.x + p.w, ptr.x), 0, 1);
      this.carU = U.approach(this.carU, u, 7.0, dt);
    }

    var prevX = this.carX;
    this.carX = U.approach(this.carX, this.laneXForU(this.carU), 9.0, dt);
    var vx = dt > 0.0001 ? (this.carX - prevX) / dt : 0;
    this.tilt = U.approach(this.tilt, U.clamp(vx / (this.carW * 8), -0.22, 0.22), 8, dt);

    if (this.bump > 0) this.bump = Math.max(0, this.bump - dt);
    this.wobble = U.approach(this.wobble, 0, 4.5, dt);

    if (this.celebrate > 0) {
      this.celebrate -= dt;
      if (this.celebrate <= 0) {
        this.celebrate = 0;
        this.lights = 0;
      }
    }

    /* Still animation slows the drive a little, never stops it. */
    var drive = 0.55 + 0.45 * this.motion;
    var want = this.speedBase * this.throttle * drive * (this.bump > 0 ? 0.45 : 1);
    if (!playing) want *= 0.2;
    this.speed = U.approach(this.speed, want, 2.4, dt);

    var step = this.speed * dt;
    this.scroll += step;

    if (playing && this.throttle > 0.2 && this.speed > 4) {
      this.spawnIn -= step;
      if (this.spawnIn <= 0) {
        this.spawnWave();
        this.spawnIn = Math.min(p.w, p.h) * U.rand(0.95, 1.55);
      }
    }

    if (playing && this.throttle > 0.2) {
      this.pickupIn -= dt;
      if (this.pickups.length === 0 && this.pickupIn <= 0) {
        this.spawnPickup();
        this.pickupIn = 2.2;
      }
    }

    this.updateObstacles(dt, step, p);
    this.updatePickups(step, p);
  };

  Car.prototype.updateObstacles = function (dt, step, p) {
    for (var i = this.obstacles.length - 1; i >= 0; i--) {
      var o = this.obstacles[i];
      o.y += step;

      if (o.bump) {
        o.age += dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.rot += o.spin * dt;
        if (o.age > 0.9) { this.obstacles.splice(i, 1); continue; }
        continue;
      }

      if (o.y - o.h / 2 > p.y + p.h + o.h) {
        if (!o.hit) this.cheerPass(o);
        this.obstacles.splice(i, 1);
        continue;
      }

      if (!o.hit && this.hits(o)) this.bumpInto(o);
    }
  };

  Car.prototype.updatePickups = function (step, p) {
    for (var i = this.pickups.length - 1; i >= 0; i--) {
      var s = this.pickups[i];
      s.y += step;
      s.ph += step * 0.02;

      if (s.y - s.r > p.y + p.h + s.r) { this.pickups.splice(i, 1); continue; }

      var reach = s.r + this.carW * 0.5;
      if (U.dist(this.carX, this.carY, s.x, s.y) < reach) this.collect(s, i);
    }
  };

  Car.prototype.hits = function (o) {
    if (o.kind === 'tree') {
      return U.dist(this.carX, this.carY, o.x, o.y) < o.r * 0.66 + this.carW * 0.34;
    }
    return Math.abs(this.carX - o.x) < this.carW * 0.42 + o.w * 0.42 &&
      Math.abs(this.carY - o.y) < this.carH * 0.44 + o.h * 0.44;
  };

  Car.prototype.occupiedLanes = function () {
    var used = {};
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (o.bump) continue;
      if (o.y > this.inset.y - this.carH && o.y < this.inset.y + this.inset.h * 0.45) {
        var lane = Math.floor((o.x - this.roadX) / this.laneW);
        if (lane >= 0 && lane < LANES) used[lane] = true;
      }
    }
    return used;
  };

  Car.prototype.spawnWave = function () {
    var p = this.inset;
    var two = this.speed > this.speedBase * 0.55 && U.chance(0.32);
    var used = two ? [0, 2] : [U.randInt(0, LANES - 1)];
    var y = p.y - this.carH * 0.75;

    for (var i = 0; i < used.length; i++) {
      var lane = used[i];
      var x = this.laneX(lane);
      if (U.chance(0.38)) {
        this.obstacles.push({
          kind: 'tree',
          x: x,
          y: y + U.rand(-this.carW * 0.18, this.carW * 0.18),
          r: this.carW * 0.6,
          w: this.carW * 1.2,
          h: this.carW * 1.2,
          hue: U.rand(110, 150),
          ph: U.rand(0, U.TAU),
          hit: false,
          bump: false,
          age: 0,
          rot: 0,
          vx: 0,
          vy: 0,
          spin: 0
        });
      } else {
        this.obstacles.push({
          kind: 'car',
          x: x,
          y: y + U.rand(-this.carW * 0.1, this.carW * 0.1),
          r: this.carW * 0.5,
          w: this.carW * 0.94,
          h: this.carH * 0.94,
          hue: U.pick(OBSTACLE_HUES),
          ph: U.rand(0, U.TAU),
          hit: false,
          bump: false,
          age: 0,
          rot: 0,
          vx: 0,
          vy: 0,
          spin: 0
        });
      }
    }

    var free = [];
    for (var l = 0; l < LANES; l++) {
      if (used.indexOf(l) < 0) free.push(l);
    }
    if (free.length && (this.pickups.length === 0 || U.chance(0.8))) {
      this.pickups.push({
        x: this.laneX(U.pick(free)),
        y: y - this.carH * 0.7,
        r: Math.max(12, this.carW * 0.19),
        hue: 46,
        ph: U.rand(0, U.TAU),
        born: this.t
      });
    }
  };

  Car.prototype.spawnPickup = function () {
    var used = this.occupiedLanes();
    var free = [];
    for (var l = 0; l < LANES; l++) {
      if (!used[l]) free.push(l);
    }
    var lane = free.length ? U.pick(free) : U.randInt(0, LANES - 1);
    this.pickups.push({
      x: this.laneX(lane),
      y: this.inset.y - this.carW * 0.4,
      r: Math.max(12, this.carW * 0.19),
      hue: 46,
      ph: U.rand(0, U.TAU),
      born: this.t
    });
  };

  Car.prototype.bumpInto = function (o) {
    o.hit = true;
    o.bump = true;
    o.age = 0;
    o.vx = (o.x < this.carX ? -1 : 1) * this.carW * U.rand(1.1, 1.9);
    o.vy = -this.speed * 0.12;
    o.spin = (o.x < this.carX ? -1 : 1) * 3.2;

    this.bump = 0.55;
    this.wobble = 1;
    var dir = o.x < this.carX ? 1 : -1;
    this.carU = U.clamp(this.carU + dir * 0.04, 0.04, 0.96);

    FX.sparkle(o.x, o.y, this.calm ? 5 : 9, 40);
    FX.ring(o.x, o.y, {
      r0: this.carW * 0.2,
      r1: this.carW * 1.1,
      hue: 40,
      width: this.carW * 0.09,
      dur: 0.5,
      alpha: 0.55
    });
    MG.Audio.play('tap');
  };

  Car.prototype.cheerPass = function (o) {
    if (o.kind !== 'car') return;
    if (U.chance(0.5)) MG.Audio.play('toot', U.randInt(0, 2));
  };

  /* ------------------------------------------------------------- rewards */

  Car.prototype.collect = function (s, idx) {
    var i = idx === undefined ? this.pickups.indexOf(s) : idx;
    if (i >= 0) this.pickups.splice(i, 1);

    FX.sparkle(s.x, s.y, this.calm ? 6 : 12, s.hue);
    FX.ring(s.x, s.y, {
      r0: s.r * 0.4,
      r1: s.r * 3.2,
      hue: s.hue,
      width: s.r * 0.45,
      dur: 0.62
    });

    if (this.celebrate > 0) {
      MG.Audio.play('chime', U.randInt(2, 8));
      return true;
    }

    this.lights += 1;

    if (this.lights >= GARLAND) {
      this.lights = GARLAND;
      this.celebrate = 2.6;
      this.cycle += 1;
      MG.Audio.play('sparkle');
      var p = this.inset;
      FX.sparkle(p.x + p.w * 0.5, p.y + p.h * 0.07, this.calm ? 8 : 16, 46);
      FX.ring(p.x + p.w * 0.5, p.y + p.h * 0.07, {
        r0: p.w * 0.05,
        r1: p.w * 0.3,
        hue: 46,
        width: Math.max(2, p.w * 0.004),
        dur: 0.9,
        alpha: 0.35
      });
    } else {
      MG.Audio.play('chime', this.lights + 1);
    }
    return true;
  };

  /* A direct touch on the play side also gathers the closest firefly, so
     "reward from any touch" works here. Every contact still gives a small
     visible and audible answer even when the sky is empty. */
  Car.prototype.activate = function (x, y) {
    var best = null;
    var bd = Infinity;
    for (var i = 0; i < this.pickups.length; i++) {
      var s = this.pickups[i];
      var d = U.dist(x, y, s.x, s.y);
      if (d < bd) { bd = d; best = s; }
    }

    if (best) {
      var reach = best.r * (1.5 + this.rewardFactor * 1.1);
      var hit = bd <= reach;
      if (!hit && this.settings.anyTouch) hit = true;
      if (hit) {
        if (bd > best.r * 1.3) FX.trail(x, y, best.x, best.y, best.hue);
        this.collect(best);
        return true;
      }
    }

    MG.Audio.play('toot', 1);
    FX.sparkle(x, y, this.calm ? 3 : 5, 46);
    return true;
  };

  /* --------------------------------------------------------------- drawing */

  Car.prototype.draw = function (ctx) {
    var p = this.inset;

    this.drawGround(ctx, p);
    this.drawRoad(ctx, p);
    this.drawVerge(ctx, p);
    this.drawGarland(ctx, p);

    for (var i = 0; i < this.pickups.length; i++) this.drawFirefly(ctx, this.pickups[i]);
    for (var j = 0; j < this.obstacles.length; j++) this.drawObstacle(ctx, this.obstacles[j]);

    this.drawHeadlights(ctx);
    this.drawPlayer(ctx);

    T.vignette(ctx, p.x, p.y, p.w, p.h, 0.4);
    T.grain(ctx, p.x, p.y, p.w, p.h, 0.2);
  };

  Car.prototype.drawGround = function (ctx, p) {
    var minDim = Math.min(p.w, p.h);
    var ground = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    ground.addColorStop(0, '#071219');
    ground.addColorStop(0.5, '#0a1a18');
    ground.addColorStop(1, '#091512');
    ctx.fillStyle = ground;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    T.glow(ctx, p.x + p.w * 0.22, p.y + p.h * 0.04, minDim * 0.9, '#8db8ff', 0.1, 0.5);
    T.glow(ctx, p.x + p.w * 0.85, p.y + p.h * 0.22, minDim * 0.7, '#9fe3c0', 0.05, 0.55);
  };

  Car.prototype.drawRoad = function (ctx, p) {
    var x = this.roadX;
    var w = this.roadW;
    var i;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 5, p.y, w + 10, p.h);

    var road = ctx.createLinearGradient(x, 0, x + w, 0);
    road.addColorStop(0, '#191426');
    road.addColorStop(0.45, '#241d33');
    road.addColorStop(1, '#171221');
    ctx.fillStyle = road;
    ctx.fillRect(x, p.y, w, p.h);

    /* distance mist where the road leaves the picture */
    var mist = ctx.createLinearGradient(0, p.y, 0, p.y + p.h * 0.24);
    mist.addColorStop(0, 'rgba(141,184,255,0.10)');
    mist.addColorStop(1, 'rgba(141,184,255,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(x, p.y, w, p.h * 0.24);

    /* moon sheen down one side of the tarmac */
    var sheen = ctx.createLinearGradient(x, 0, x + w, 0);
    sheen.addColorStop(0, 'rgba(141,184,255,0)');
    sheen.addColorStop(0.3, 'rgba(141,184,255,0.05)');
    sheen.addColorStop(0.55, 'rgba(141,184,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, p.y, w, p.h);

    ctx.fillStyle = 'rgba(255,255,255,0.022)';
    for (i = 0; i < 6; i++) {
      var py = p.y + ((i * 173.7 - this.scroll * 0.35) % (p.h + 120) + p.h + 120) % (p.h + 120) - 60;
      ctx.beginPath();
      ctx.ellipse(x + w * (0.18 + (i % 3) * 0.3), py, w * 0.13, w * 0.05, 0, 0, U.TAU);
      ctx.fill();
    }

    var inset = Math.max(4, w * 0.022);
    ctx.fillStyle = T.rgba(T.C.gold, 0.3);
    ctx.fillRect(x + inset, p.y, Math.max(2, w * 0.006), p.h);
    ctx.fillRect(x + w - inset - Math.max(2, w * 0.006), p.y, Math.max(2, w * 0.006), p.h);

    var dash = this.carH * 0.55;
    var gap = this.carH * 0.6;
    var period = dash + gap;
    var shift = ((this.scroll % period) + period) % period;
    var lw = Math.max(2, w * 0.008);
    ctx.fillStyle = T.rgba(T.C.gold, 0.5);
    for (i = 0; i < 2; i++) {
      var lx = x + this.laneW * (i + 1) - lw / 2;
      for (var y = p.y - period + shift; y < p.y + p.h + period; y += period) {
        U.rr(ctx, lx, y, lw, dash, lw * 0.5);
        ctx.fill();
      }
    }
  };

  Car.prototype.drawVerge = function (ctx, p) {
    var base = Math.min(p.w, p.h);
    var span = p.h + base * 0.5;
    var shift = ((this.scroll % span) + span) % span;
    var gap = span / 8;

    for (var i = 0; i < this.verge.length; i++) {
      var v = this.verge[i];
      var y = p.y - base * 0.25 + ((v.n * span + shift) % span);
      var off = base * (0.035 + 0.075 * ((i * 37) % 10) / 10);
      var x = v.side < 0 ? this.roadX - off : this.roadX + this.roadW + off;
      if (x < p.x + 6 || x > p.x + p.w - 6) continue;

      if (v.type === 'lamp') {
        this.drawVergeLamp(ctx, x, y, base * 0.022);
      } else {
        this.drawVergeTree(ctx, x, y, base * 0.04 * v.size, v.hue);
      }
    }

    /* small tufts, kept faint so they never read as targets */
    ctx.strokeStyle = 'rgba(159,227,192,0.16)';
    ctx.lineWidth = Math.max(1, base * 0.0025);
    ctx.lineCap = 'round';
    for (var g = 0; g < 18; g++) {
      var gx = p.x + ((g * p.w / 18 + this.scroll * 0.4) % p.w);
      var gy = p.y + ((g * 97.3 + this.scroll) % p.h);
      if (gx > this.roadX - 6 && gx < this.roadX + this.roadW + 6) continue;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx - base * 0.006, gy - base * 0.014, gx - base * 0.004, gy - base * 0.024);
      ctx.stroke();
    }
  };

  Car.prototype.drawVergeTree = function (ctx, x, y, r, hue) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.2, y + r * 0.5, r * 0.9, r * 0.3, 0, 0, U.TAU);
    ctx.fill();

    var blobs = [
      { x: 0, y: -r * 0.1, s: r * 0.8 },
      { x: -r * 0.55, y: r * 0.1, s: r * 0.55 },
      { x: r * 0.5, y: r * 0.08, s: r * 0.58 }
    ];
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      ctx.fillStyle = U.hsl(hue, 28, 12 + i * 1.5, 0.95);
      ctx.beginPath();
      ctx.arc(x + b.x, y + b.y, b.s, 0, U.TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(159,227,192,0.12)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.1, r * 0.8, Math.PI * 1.08, Math.PI * 1.85);
    ctx.stroke();
  };

  Car.prototype.drawVergeLamp = function (ctx, x, y, r) {
    ctx.strokeStyle = 'rgba(226,180,120,0.4)';
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(x, y + r * 2.6);
    ctx.lineTo(x, y);
    ctx.stroke();

    T.glow(ctx, x, y, r * 4.2, T.C.lamp, 0.14, 0.35);
    ctx.fillStyle = T.C.gold;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,244,218,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.3, 0, U.TAU);
    ctx.fill();
  };

  /* ------------------------------------------------------------ fireflies */

  Car.prototype.drawFirefly = function (ctx, s) {
    var bob = Math.sin(this.t * 2.2 + s.ph) * s.r * 0.18;
    var x = s.x + Math.sin(this.t * 0.7 + s.ph) * s.r * 0.22;
    var y = s.y + bob;
    var r = s.r;

    T.glow(ctx, x, y, r * 3.2, T.C.lamp, this.calm ? 0.3 : 0.42, 0.34);

    var wing = Math.sin(this.t * 18 + s.ph) * 0.5;
    ctx.fillStyle = 'rgba(255,246,218,0.3)';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5 + wing);
    ctx.beginPath();
    ctx.ellipse(-r * 0.45, -r * 0.2, r * 0.55, r * 0.24, -0.4, 0, U.TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.5 - wing);
    ctx.beginPath();
    ctx.ellipse(r * 0.45, -r * 0.2, r * 0.55, r * 0.24, 0.4, 0, U.TAU);
    ctx.fill();
    ctx.restore();

    var orb = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.1, x, y, r);
    orb.addColorStop(0, '#fffdf0');
    orb.addColorStop(0.55, U.hsl(s.hue, 100, 76));
    orb.addColorStop(1, U.hsl(s.hue, 92, 58));
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
    ctx.fill();
  };

  /* ------------------------------------------------------------- obstacles */

  Car.prototype.drawObstacle = function (ctx, o) {
    var alpha = 1;
    var rot = 0;

    if (o.bump) {
      var k = U.clamp(o.age / 0.9, 0, 1);
      alpha = 1 - k;
      rot = o.rot;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(o.x, o.y);
    ctx.rotate(rot);

    if (o.kind === 'tree') {
      this.drawRoadTree(ctx, o.r);
    } else {
      this.drawOtherCar(ctx, o.w, o.h, o.hue);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  };

  Car.prototype.drawOtherCar = function (ctx, w, h, hue) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(w * 0.05, h * 0.08, w * 0.58, h * 0.48, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#0a0912';
    var ww = w * 0.17;
    var wh = h * 0.19;
    var wx = w * 0.48;
    var wy = h * 0.24;
    U.rr(ctx, -wx - ww / 2, -wy - wh / 2, ww, wh, ww * 0.4); ctx.fill();
    U.rr(ctx, wx - ww / 2, -wy - wh / 2, ww, wh, ww * 0.4); ctx.fill();
    U.rr(ctx, -wx - ww / 2, wy - wh / 2, ww, wh, ww * 0.4); ctx.fill();
    U.rr(ctx, wx - ww / 2, wy - wh / 2, ww, wh, ww * 0.4); ctx.fill();

    var body = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    body.addColorStop(0, U.hsl(hue, 34, 26));
    body.addColorStop(0.45, U.hsl(hue, 40, 38));
    body.addColorStop(1, U.hsl(hue, 32, 25));
    ctx.fillStyle = body;
    U.rr(ctx, -w / 2, -h / 2, w, h, w * 0.3);
    ctx.fill();

    ctx.fillStyle = 'rgba(141,184,255,0.12)';
    U.rr(ctx, -w * 0.3, -h * 0.31, w * 0.6, h * 0.16, w * 0.09);
    ctx.fill();
    ctx.fillStyle = 'rgba(141,184,255,0.08)';
    U.rr(ctx, -w * 0.25, h * 0.18, w * 0.5, h * 0.12, w * 0.07);
    ctx.fill();

    ctx.fillStyle = U.hsl(hue, 38, 46);
    U.rr(ctx, -w * 0.3, -h * 0.13, w * 0.6, h * 0.32, w * 0.12);
    ctx.fill();

    /* tail lights facing the player */
    var blink = 0.7 + 0.3 * Math.sin(this.t * 3 + hue);
    ctx.fillStyle = 'rgba(255,120,110,' + blink.toFixed(3) + ')';
    U.rr(ctx, -w * 0.36, h * 0.45, w * 0.19, h * 0.04, w * 0.035); ctx.fill();
    U.rr(ctx, w * 0.17, h * 0.45, w * 0.19, h * 0.04, w * 0.035); ctx.fill();
    if (!this.calm) {
      T.glow(ctx, -w * 0.27, h * 0.47, w * 0.3, '#ff7a6e', 0.16, 0.3);
      T.glow(ctx, w * 0.27, h * 0.47, w * 0.3, '#ff7a6e', 0.16, 0.3);
    }
  };

  Car.prototype.drawRoadTree = function (ctx, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(r * 0.15, r * 0.85, r * 0.78, r * 0.26, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#5a4630';
    U.rr(ctx, -r * 0.13, r * 0.05, r * 0.26, r * 0.8, r * 0.09);
    ctx.fill();

    var blobs = [
      { x: 0, y: -r * 0.15, s: r * 0.76 },
      { x: -r * 0.48, y: r * 0.12, s: r * 0.54 },
      { x: r * 0.48, y: r * 0.1, s: r * 0.56 },
      { x: r * 0.08, y: -r * 0.6, s: r * 0.48 }
    ];
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var g = ctx.createRadialGradient(b.x - b.s * 0.3, b.y - b.s * 0.4, b.s * 0.1, b.x, b.y, b.s * 1.1);
      g.addColorStop(0, 'rgba(52,92,66,0.98)');
      g.addColorStop(1, 'rgba(16,38,27,0.98)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.s, 0, U.TAU);
      ctx.fill();
    }

    /* warm rim from the headlights, so a tree reads as an obstacle */
    ctx.strokeStyle = 'rgba(255,207,138,0.26)';
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.78, Math.PI * 0.2, Math.PI * 0.85);
    ctx.stroke();
  };

  /* ---------------------------------------------------------------- lights */

  Car.prototype.drawHeadlights = function (ctx) {
    if (this.throttle <= 0.02 && this.app.mode !== 'playing') return;
    var ox = this.carX;
    var oy = this.carY - this.carH * 0.46;
    var spread = this.carH * 1.7;
    var alpha = 0.12 + 0.08 * this.throttle;

    ctx.save();
    if (!this.calm) ctx.globalCompositeOperation = 'lighter';
    ctx.translate(ox, oy);
    ctx.scale(0.74, 1.85);
    var g = ctx.createRadialGradient(0, 0, this.carW * 0.1, 0, 0, spread);
    g.addColorStop(0, T.rgba(T.C.lampHot, alpha + 0.05));
    g.addColorStop(0.45, T.rgba(T.C.lamp, alpha * 0.55));
    g.addColorStop(1, T.rgba(T.C.lamp, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, spread, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  };

  /* ------------------------------------------------------------------- car */

  Car.prototype.drawPlayer = function (ctx) {
    var w = this.carW;
    var h = this.carH;
    var wob = Math.sin(this.t * 22) * this.wobble * w * 0.035;

    ctx.save();
    ctx.translate(this.carX + wob, this.carY);
    ctx.rotate(this.tilt + Math.sin(this.t * 18) * this.wobble * 0.05);

    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(w * 0.04, h * 0.06, w * 0.56, h * 0.5, 0, 0, U.TAU);
    ctx.fill();

    var wheelW = w * 0.17;
    var wheelH = h * 0.2;
    var wx = w * 0.47;
    var wy = h * 0.24;
    ctx.fillStyle = '#09080f';
    U.rr(ctx, -wx - wheelW / 2, -wy - wheelH / 2, wheelW, wheelH, wheelW * 0.4); ctx.fill();
    U.rr(ctx, wx - wheelW / 2, -wy - wheelH / 2, wheelW, wheelH, wheelW * 0.4); ctx.fill();
    U.rr(ctx, -wx - wheelW / 2, wy - wheelH / 2, wheelW, wheelH, wheelW * 0.4); ctx.fill();
    U.rr(ctx, wx - wheelW / 2, wy - wheelH / 2, wheelW, wheelH, wheelW * 0.4); ctx.fill();

    var body = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    body.addColorStop(0, 'hsl(204, 38%, 30%)');
    body.addColorStop(0.42, 'hsl(203, 48%, 44%)');
    body.addColorStop(1, 'hsl(205, 36%, 29%)');
    ctx.fillStyle = body;
    U.rr(ctx, -w / 2, -h / 2, w, h, w * 0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,200,132,0.35)';
    ctx.lineWidth = Math.max(1.2, w * 0.018);
    ctx.stroke();

    ctx.fillStyle = 'rgba(141,184,255,0.28)';
    U.rr(ctx, -w * 0.3, -h * 0.31, w * 0.6, h * 0.16, w * 0.09);
    ctx.fill();
    ctx.fillStyle = 'rgba(141,184,255,0.16)';
    U.rr(ctx, -w * 0.25, h * 0.18, w * 0.5, h * 0.12, w * 0.07);
    ctx.fill();

    var roof = ctx.createLinearGradient(0, -h * 0.14, 0, h * 0.2);
    roof.addColorStop(0, 'hsl(203, 46%, 52%)');
    roof.addColorStop(1, 'hsl(205, 38%, 37%)');
    ctx.fillStyle = roof;
    U.rr(ctx, -w * 0.3, -h * 0.13, w * 0.6, h * 0.32, w * 0.12);
    ctx.fill();

    /* headlights */
    ctx.fillStyle = 'rgba(255,244,218,0.95)';
    U.rr(ctx, -w * 0.35, -h * 0.5, w * 0.18, h * 0.04, w * 0.03); ctx.fill();
    U.rr(ctx, w * 0.17, -h * 0.5, w * 0.18, h * 0.04, w * 0.03); ctx.fill();
    if (!this.calm) {
      T.glow(ctx, -w * 0.26, -h * 0.5, w * 0.34, T.C.lampHot, 0.3, 0.3);
      T.glow(ctx, w * 0.26, -h * 0.5, w * 0.34, T.C.lampHot, 0.3, 0.3);
    }

    /* tail lights */
    ctx.fillStyle = 'rgba(255,110,104,0.95)';
    U.rr(ctx, -w * 0.35, h * 0.46, w * 0.18, h * 0.04, w * 0.03); ctx.fill();
    U.rr(ctx, w * 0.17, h * 0.46, w * 0.18, h * 0.04, w * 0.03); ctx.fill();
    if (!this.calm) {
      T.glow(ctx, -w * 0.26, h * 0.47, w * 0.3, '#ff6e68', 0.2, 0.3);
      T.glow(ctx, w * 0.26, h * 0.47, w * 0.3, '#ff6e68', 0.2, 0.3);
    }

    /* friendly face on the roof */
    var ey = h * 0.035;
    ctx.fillStyle = 'rgba(15,18,30,0.72)';
    ctx.beginPath();
    ctx.arc(-w * 0.115, ey, w * 0.042, 0, U.TAU);
    ctx.arc(w * 0.115, ey, w * 0.042, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,218,0.6)';
    ctx.lineWidth = Math.max(1.3, w * 0.022);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, ey + w * 0.02, w * 0.08, 0.35, Math.PI - 0.35);
    ctx.stroke();

    ctx.restore();
  };

  /* --------------------------------------------------------------- garland */

  Car.prototype.drawGarland = function (ctx, p) {
    var base = Math.min(p.w, p.h);
    var gw = Math.min(p.w * 0.62, base * 0.9);
    var cx = p.x + p.w * 0.5;
    var y = p.y + p.h * 0.075;
    var sag = base * 0.022;
    var lit = this.celebrate > 0 ? GARLAND : this.lights;
    var pulse = this.celebrate > 0 ? 0.6 + 0.4 * Math.sin(this.t * 3.2) : 0;

    ctx.strokeStyle = 'rgba(226,180,120,0.32)';
    ctx.lineWidth = Math.max(1.2, base * 0.003);
    ctx.beginPath();
    ctx.moveTo(cx - gw / 2, y - sag * 0.4);
    ctx.quadraticCurveTo(cx, y + sag, cx + gw / 2, y - sag * 0.4);
    ctx.stroke();

    for (var i = 0; i < GARLAND; i++) {
      var t = (i + 0.5) / GARLAND;
      var x = cx - gw / 2 + gw * t;
      var wireY = y - sag * 0.4 + Math.sin(Math.PI * t) * sag * 0.62;
      var r = Math.max(4.5, base * 0.017);
      var ly = wireY + r * 3.1;
      var on = i < lit;

      ctx.strokeStyle = 'rgba(226,180,120,0.34)';
      ctx.lineWidth = Math.max(1, base * 0.0018);
      ctx.beginPath();
      ctx.moveTo(x, wireY);
      ctx.lineTo(x, ly - r * 1.2);
      ctx.stroke();

      /* little brass cap */
      ctx.fillStyle = 'rgba(70,52,38,0.9)';
      U.rr(ctx, x - r * 0.34, ly - r * 1.55, r * 0.68, r * 0.5, r * 0.15);
      ctx.fill();

      if (on) {
        var a = this.celebrate > 0 ? 0.34 + 0.3 * pulse : 0.28;
        T.glow(ctx, x, ly, r * 5.6, T.C.lamp, a, 0.32);
      }

      ctx.fillStyle = on ? 'rgba(255,211,155,0.96)' : 'rgba(120,96,74,0.5)';
      ctx.beginPath();
      ctx.arc(x, ly, r, 0, U.TAU);
      ctx.fill();

      ctx.fillStyle = on ? 'rgba(255,248,224,0.95)' : 'rgba(180,150,110,0.35)';
      ctx.beginPath();
      ctx.arc(x, ly - r * 0.18, r * 0.38, 0, U.TAU);
      ctx.fill();
    }
  };

  MG.Games = MG.Games || {};
  MG.Games.car = Car;
})(window.MG);
