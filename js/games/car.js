/* Game - Magic Car.
   A moonlit third-person drive. The hold side is a gas pedal; the play-side
   hand steers. There are no pickups and no failure: bumping another car, a van,
   a hay bale or a roadside tree bursts into sparks/leaves/straw and lights one
   star in the sky. Six stars finish a constellation; it glows and fades, then
   the drive renews. Crashing is the reward, so the left hand has a reason to
   reach across the road. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;
  var T = MG.Theme;

  var LANES = 3;
  var STARS = 6;
  var LANE_U = [1 / 6, 3 / 6, 5 / 6];
  var OBSTACLE_HUES = [8, 26, 132, 282, 338];

  /* The sky pictures a run builds, one per completed constellation, so the
     sixth crash keeps feeling new. Coordinates are normalised to the sky
     rectangle and every picture is exactly STARS points. */
  var CONSTELLATIONS = [
    {
      closed: true,
      pts: [
        { nx: 0.17, ny: 0.34 }, { nx: 0.245, ny: 0.24 }, { nx: 0.32, ny: 0.31 },
        { nx: 0.295, ny: 0.45 }, { nx: 0.195, ny: 0.48 }, { nx: 0.135, ny: 0.4 }
      ]
    },
    {
      closed: false,
      pts: [
        { nx: 0.17, ny: 0.46 }, { nx: 0.2, ny: 0.26 }, { nx: 0.31, ny: 0.16 },
        { nx: 0.41, ny: 0.27 }, { nx: 0.49, ny: 0.17 }, { nx: 0.52, ny: 0.46 }
      ]
    },
    {
      closed: true,
      pts: [
        { nx: 0.1, ny: 0.4 }, { nx: 0.22, ny: 0.28 }, { nx: 0.36, ny: 0.32 },
        { nx: 0.44, ny: 0.4 }, { nx: 0.36, ny: 0.48 }, { nx: 0.22, ny: 0.52 }
      ]
    },
    {
      closed: true,
      pts: [
        { nx: 0.5, ny: 0.12 }, { nx: 0.59, ny: 0.29 }, { nx: 0.55, ny: 0.5 },
        { nx: 0.5, ny: 0.6 }, { nx: 0.45, ny: 0.5 }, { nx: 0.41, ny: 0.29 }
      ]
    },
    {
      closed: true,
      pts: [
        { nx: 0.5, ny: 0.52 }, { nx: 0.4, ny: 0.36 }, { nx: 0.31, ny: 0.38 },
        { nx: 0.34, ny: 0.5 }, { nx: 0.42, ny: 0.56 }, { nx: 0.58, ny: 0.5 }
      ]
    },
    {
      closed: true,
      pts: [
        { nx: 0.38, ny: 0.52 }, { nx: 0.48, ny: 0.2 }, { nx: 0.6, ny: 0.52 },
        { nx: 0.55, ny: 0.6 }, { nx: 0.43, ny: 0.6 }, { nx: 0.34, ny: 0.54 }
      ]
    }
  ];

  var FRIEND_KINDS = ['fox', 'rabbit', 'bear', 'owl', 'sheep'];

  /* One cached procedural noise tile per drawing context; used to break up
     the flat grass and asphalt without binary assets. */
  function noisePattern(ctx, kind) {
    var key = kind === 'road' ? '__mgRoadNoise' : '__mgGrassNoise';
    if (ctx[key]) return ctx[key];
    var tile = document.createElement('canvas');
    tile.width = 96;
    tile.height = 96;
    var g = tile.getContext('2d');
    var i;
    if (kind === 'road') {
      for (i = 0; i < 900; i++) {
        var a = Math.random() * 0.16;
        g.fillStyle = (i % 3 === 0 ? 'rgba(210,220,230,' : 'rgba(0,0,0,') + a.toFixed(3) + ')';
        g.fillRect(Math.random() * 96, Math.random() * 96, Math.random() < 0.7 ? 1 : 2, 1);
      }
    } else {
      for (i = 0; i < 700; i++) {
        var ga = 0.05 + Math.random() * 0.16;
        g.strokeStyle = (i % 4 === 0 ? 'rgba(120,170,110,' : 'rgba(8,24,14,') + ga.toFixed(3) + ')';
        g.lineWidth = 1;
        var gx = Math.random() * 96;
        var gy = Math.random() * 96;
        g.beginPath();
        g.moveTo(gx, gy);
        g.lineTo(gx + (Math.random() - 0.5) * 2, gy - 2 - Math.random() * 4);
        g.stroke();
      }
    }
    var pattern = ctx.createPattern(tile, 'repeat');
    ctx[key] = pattern;
    return pattern;
  }

  function Car(app) {
    this.obstacles = [];
    this.carU = 0.5;
    this.carX = 0;
    this.carY = 0;
    this.carS = 0.7;
    this.tilt = 0;
    this.bump = 0;
    this.wobble = 0;
    this.throttle = 0;
    this.speed = 0;
    this.boost = 0;
    this.dist = 0;
    this.spawnIn = 0;
    this.starsLit = 0;
    this.skyGlow = 0;
    this.cycle = 0;
    this.combo = 0;
    this.comboT = 0;
    this.engine = 0;
    this.shoot = null;
    this.starFly = null;
    this.completedPat = 0;
    this.honk = 0;
    this.cheer = 0;
    this.dogJoy = 0;
    this.friends = [];
    this.grass = [];
    this.sky = null;
    this.clouds = null;
    this.holdStyle = 'pedal';
    this.keepLit = true;
    this.model = 'vw-up';
    this.carColor = 'red';
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
    var sizes = { xlarge: 0.19, large: 0.15, medium: 0.115 };

    this.carW = Math.max(44, minDim * (sizes[this.settings.targetSize] || 0.15));
    this.carH = this.carW * 0.9;
    this.horizonY = p.y + p.h * 0.32;
    this.bottomY = p.y + p.h * 1.1;
    this.vx = p.x + p.w * 0.5;
    this.carY = p.y + p.h * 0.85;
    this.bottomHalf = Math.min(p.w * 0.43, this.carW * 3.2);
    this.horizonHalf = this.bottomHalf * 0.085;
    this.roadW = this.bottomHalf * 2;
    this.speedBase = minDim * 0.55;
    this.worldLen = minDim * 1.55;
    this.carS = (this.carY - this.horizonY) / (this.bottomY - this.horizonY);

    if (!this.sky) this.sky = T.stars(this.calm ? 34 : 62, 19);
    if (!this.clouds) {
      this.clouds = [];
      for (var c = 0; c < 3; c++) {
        this.clouds.push({ nx: U.rand(0.1, 0.9), ny: U.rand(0.12, 0.55), s: U.rand(0.5, 1.1), v: U.rand(0.004, 0.012) });
      }
    }

    /* transient only; the constellation and cycle survive a resize */
    this.obstacles.length = 0;
    this.spawnIn = minDim * 0.45;
    this.carX = this.laneXAt(this.carU);
    if (!this.friends || !this.friends.length) this.seedFriends();
    if (!this.grass || !this.grass.length) this.seedGrass();
  };

  Car.prototype.enter = function () {
    this.obstacles.length = 0;
    this.carU = 0.5;
    this.carX = this.laneXAt(0.5);
    this.tilt = 0;
    this.bump = 0;
    this.wobble = 0;
    this.throttle = 0;
    this.speed = 0;
    this.boost = 0;
    this.dist = 0;
    this.starsLit = 0;
    this.skyGlow = 0;
    this.cycle = 0;
    this.combo = 0;
    this.comboT = 0;
    this.engine = 0;
    this.shoot = null;
    this.starFly = null;
    this.completedPat = 0;
    this.honk = 0;
    this.cheer = 0;
    this.dogJoy = 0;
    this.friends.length = 0;
    this.seedFriends();
    this.grass.length = 0;
    this.seedGrass();
    this.spawnIn = Math.min(this.play.w, this.play.h) * 0.45;
  };

  Car.prototype.halfAt = function (y) {
    var t = U.clamp((y - this.horizonY) / (this.bottomY - this.horizonY), 0, 1);
    return this.horizonHalf + (this.bottomHalf - this.horizonHalf) * t;
  };

  Car.prototype.laneXAt = function (u) {
    var half = this.halfAt(this.carY);
    return this.vx - half + U.clamp(u, 0, 1) * half * 2;
  };

  Car.prototype.constellation = function (index) {
    return CONSTELLATIONS[(index === undefined ? this.cycle : index) % CONSTELLATIONS.length];
  };

  /* ---------------------------------------------------------- verge friends */

  Car.prototype.seedFriends = function () {
    this.friends.length = 0;
    for (var i = 0; i < 4; i++) {
      this.friends.push({
        d: (i + 0.35 + U.rand(0, 0.3)) / 4,
        side: i % 2 === 0 ? -1 : 1,
        kind: U.pick(FRIEND_KINDS),
        ph: U.rand(0, U.TAU)
      });
    }
  };

  Car.prototype.updateFriends = function (step) {
    for (var i = 0; i < this.friends.length; i++) {
      var f = this.friends[i];
      f.d += step / this.worldLen;
      if (f.d > 1.08) {
        f.d -= 1.16;
        f.side = Math.random() < 0.5 ? -1 : 1;
        f.kind = U.pick(FRIEND_KINDS);
        f.ph = U.rand(0, U.TAU);
      }
    }
  };

  Car.prototype.seedGrass = function () {
    this.grass.length = 0;
    for (var i = 0; i < 14; i++) {
      this.grass.push({
        d: (i + 0.4 + U.rand(0, 0.4)) / 14,
        side: i % 2 === 0 ? -1 : 1,
        ph: U.rand(0, U.TAU),
        h: U.rand(0.6, 1.25)
      });
    }
  };

  Car.prototype.updateGrass = function (step) {
    for (var i = 0; i < this.grass.length; i++) {
      var g = this.grass[i];
      g.d += step / this.worldLen;
      if (g.d > 1.06) {
        g.d -= 1.12;
        g.side = Math.random() < 0.5 ? -1 : 1;
        g.ph = U.rand(0, U.TAU);
        g.h = U.rand(0.6, 1.25);
      }
    }
  };

  /* depth 0 = horizon, 1 = just below the picture; screen depth eases in */
  Car.prototype.project = function (d, laneN) {
    var s = U.clamp(d, 0, 1);
    s = s * s;
    var y = this.horizonY + (this.bottomY - this.horizonY) * s;
    var half = this.horizonHalf + (this.bottomHalf - this.horizonHalf) * s;
    return {
      x: this.vx - half + U.clamp(laneN, 0, 1) * half * 2,
      y: y,
      half: half,
      scale: 0.16 + 0.84 * s,
      s: s
    };
  };

  /* --------------------------------------------------------------- input */

  Car.prototype.gasLevel = function () {
    var app = this.app;
    var needHold = app && app.holdRequiredNow ? app.holdRequiredNow() : true;
    if (!needHold) return 1;
    /* The pedal is speed, not the lamp: it reads the contact directly, so
       releasing it coasts to a stop without changing the light. */
    return app.holdCount > 0 ? 1 : 0;
  };

  Car.prototype.steerPointer = function () {
    var list = this.app.playPointers ? this.app.playPointers() : [];
    return list.length ? list[0] : null;
  };

  /* --------------------------------------------------------------- drive */

  Car.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);

    var p = this.inset;
    var playing = this.app.mode === 'playing';

    this.throttle = U.approach(this.throttle, this.gasLevel(), 3.4, dt);
    if (this.throttle > 0.5 && this.engine < 0.25) MG.Audio.play('vroom');
    this.engine = this.throttle;

    var ptr = this.steerPointer();
    if (ptr && this.roadW > this.carW * 2) {
      var u = U.clamp(U.invLerp(p.x, p.x + p.w, ptr.x), 0.06, 0.94);
      this.carU = U.approach(this.carU, u, 7.5, dt);
    }

    var prevX = this.carX;
    this.carX = U.approach(this.carX, this.laneXAt(this.carU), 10, dt);
    var vx = dt > 0.0001 ? (this.carX - prevX) / dt : 0;
    this.tilt = U.approach(this.tilt, U.clamp(vx / (this.carW * 7), -0.26, 0.26), 9, dt);

    if (this.bump > 0) this.bump = Math.max(0, this.bump - dt);
    this.wobble = U.approach(this.wobble, 0, 4.2, dt);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.honk > 0) this.honk = Math.max(0, this.honk - dt);
    if (this.cheer > 0) this.cheer = Math.max(0, this.cheer - dt);
    if (this.dogJoy > 0) this.dogJoy = Math.max(0, this.dogJoy - dt);
    if (this.starFly) {
      this.starFly.t += dt * 1.6;
      if (this.starFly.t >= 1) this.starFly = null;
    }

    if (this.skyGlow > 0) {
      this.skyGlow -= dt;
      if (this.skyGlow <= 0) {
        this.skyGlow = 0;
        this.starsLit = 0;
      }
    }
    if (this.shoot) {
      this.shoot.t += dt * 0.75;
      if (this.shoot.t > 1.4) this.shoot = null;
    }

    var drive = 0.65 + 0.35 * this.motion;
    var want = this.speedBase * this.throttle * drive * (1 + this.boost * 0.4);
    if (!playing) want *= 0.25;
    this.speed = U.approach(this.speed, want, 3.5, dt);
    this.boost = Math.max(0, this.boost - dt * 0.9);

    var step = this.speed * dt;
    this.dist += step;

    if (playing && this.throttle > 0.15 && this.speed > 4) {
      this.spawnIn -= step;
      if (this.spawnIn <= 0) {
        this.spawnWave();
        this.spawnIn = Math.min(p.w, p.h) * U.rand(0.8, 1.2);
      }
    }

    this.updateObstacles(dt, step, p);
    this.updateFriends(step);
    this.updateGrass(step);
  };

  Car.prototype.updateObstacles = function (dt, step, p) {
    for (var i = this.obstacles.length - 1; i >= 0; i--) {
      var o = this.obstacles[i];

      if (o.flash > 0) o.flash = Math.max(0, o.flash - dt);

      if (!o.bump) o.d += (step / this.worldLen);

      var pr = this.project(o.d, o.laneN);
      o.x = pr.x;
      o.y = pr.y;
      o.scale = pr.scale;

      if (o.bump) {
        o.age += dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.rot += o.spin * dt;
        if (o.age > 0.85) { this.obstacles.splice(i, 1); continue; }
        continue;
      }

      if (pr.y > this.carY - this.carH * 0.3 && pr.y < this.carY + this.carH * 0.9 &&
          Math.abs(pr.x - this.carX) < this.carW * 0.46 + o.w * pr.scale * 0.42) {
        this.smash(o);
        continue;
      }

      if (pr.y > p.y + p.h + o.h * pr.scale * 2) this.obstacles.splice(i, 1);
    }
  };

  Car.prototype.makeObstacle = function (kind, laneN, d) {
    var carW = this.carW;
    var carH = this.carH;
    var w;
    var h;
    var hue;

    if (kind === 'van') {
      w = carW * 1.04; h = carH * 1.28; hue = U.pick([24, 132, 210, 338]);
    } else if (kind === 'tree') {
      w = carW * 1.16; h = carW * 1.32; hue = U.rand(112, 150);
    } else if (kind === 'bale') {
      w = carW * 0.74; h = carW * 0.62; hue = 44;
    } else {
      kind = 'car';
      w = carW * 0.96; h = carH; hue = U.pick(OBSTACLE_HUES);
    }

    var pr = this.project(d, laneN);
    return {
      kind: kind,
      laneN: laneN,
      d: d,
      x: pr.x,
      y: pr.y,
      scale: pr.scale,
      w: w,
      h: h,
      hue: hue,
      ph: U.rand(0, U.TAU),
      hit: false,
      bump: false,
      flash: 0,
      age: 0,
      rot: 0,
      vx: 0,
      vy: 0,
      spin: 0
    };
  };

  Car.prototype.spawnWave = function () {
    var two = U.chance(0.45);
    var lanes = two ? [0, 2] : [U.randInt(0, LANES - 1)];

    for (var i = 0; i < lanes.length; i++) {
      var roll = Math.random();
      var kind;
      if (roll < 0.4) kind = 'car';
      else if (roll < 0.56) kind = 'van';
      else if (roll < 0.84) kind = 'tree';
      else kind = 'bale';
      this.obstacles.push(this.makeObstacle(kind, LANE_U[lanes[i]], 0.02 + U.rand(0, 0.02)));
    }
  };

  /* ------------------------------------------------------------- crashing */

  Car.prototype.smash = function (o, fromX, fromY) {
    o.hit = true;
    o.bump = true;
    o.age = 0;
    o.vx = (o.x < this.carX ? -1 : 1) * this.carW * U.rand(1.4, 2.5);
    o.vy = -this.carH * U.rand(0.5, 1.0);
    o.spin = (o.x < this.carX ? -1 : 1) * U.rand(2.5, 4.5);

    this.bump = 0.55;
    this.wobble = 1;
    this.boost = Math.min(1.1, this.boost + 0.45);
    this.combo = this.comboT > 0 ? Math.min(4, this.combo + 1) : 1;
    this.comboT = 1.8;
    this.cheer = 1.2;
    this.dogJoy = 1.4;

    /* neighbours flash their lights back at the crash */
    for (var f = 0; f < this.obstacles.length; f++) {
      var near = this.obstacles[f];
      if (near !== o && !near.bump && near.d < 0.55) near.flash = 0.8;
    }

    var n = (this.calm ? 10 : 16) + this.combo * 4;
    var hue = o.kind === 'tree' ? 122 : (o.kind === 'bale' ? 44 : 28);

    if (o.kind === 'tree') {
      FX.petals(o.x, o.y, this.calm ? 6 : 12, 122);
    } else if (o.kind === 'bale') {
      FX.confetti(o.x, o.y, n, { hue: 44, speed: 280, sat: 80 });
    } else {
      FX.confetti(o.x, o.y, n, { hue: hue, speed: 320 });
      FX.sparkle(o.x, o.y, this.calm ? 5 : 9, 46);
    }
    FX.ring(o.x, o.y, {
      r0: this.carW * 0.2,
      r1: this.carW * (1.1 + this.combo * 0.12),
      hue: hue,
      width: this.carW * 0.1,
      dur: 0.55,
      alpha: 0.6
    });
    if (fromX !== undefined) FX.trail(fromX, fromY, o.x, o.y, hue);

    MG.Audio.play('crash', this.combo - 1);
    this.lightStar(o.x, o.y);
  };

  Car.prototype.lightStar = function (fromX, fromY) {
    if (this.skyGlow > 0) return;
    this.starsLit = Math.min(STARS, this.starsLit + 1);

    if (fromX !== undefined) {
      this.starFly = {
        x0: fromX,
        y0: fromY,
        idx: this.starsLit - 1,
        pat: this.cycle % CONSTELLATIONS.length,
        t: 0
      };
    }

    if (this.starsLit >= STARS) {
      this.completedPat = this.cycle % CONSTELLATIONS.length;
      this.skyGlow = 2.8;
      this.cycle += 1;
      this.shoot = { t: 0, nx: U.rand(0.6, 0.85), ny: U.rand(0.12, 0.3) };
      MG.Audio.play('sparkle');
      var p = this.inset;
      var pat = CONSTELLATIONS[this.completedPat];
      var skyH = this.horizonY - p.y;
      for (var i = 0; i < pat.pts.length; i++) {
        FX.sparkle(p.x + pat.pts[i].nx * p.w, p.y + pat.pts[i].ny * skyH, this.calm ? 3 : 6, 46);
      }
    } else {
      MG.Audio.play('chime', this.starsLit + 1);
    }
  };

  /* Tapping on an obstacle crashes it directly (the left-arm reach); tapping
     anywhere else still gives a friendly honk and sparkle. */
  Car.prototype.activate = function (x, y) {
    var best = null;
    var bd = Infinity;
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (o.bump) continue;
      var d = U.dist(x, y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }

    if (best) {
      var reach = best.w * best.scale * 0.55 + this.carW * 0.18 * this.rewardFactor;
      if (bd <= reach) {
        this.smash(best, x, y);
        return true;
      }
      best.flash = 0.8;
    }

    /* An imprecise touch is never wrong: the car honks and flashes, and a
       nearby car politely honks back. */
    this.honk = 0.75;
    MG.Audio.play('toot', 1);
    MG.Audio.play('toot', 2);
    FX.sparkle(x, y, this.calm ? 3 : 6, 46);
    return true;
  };

  /* --------------------------------------------------------------- drawing */

  Car.prototype.draw = function (ctx) {
    var p = this.inset;
    this.drawSky(ctx, p);
    this.drawConstellation(ctx, p);
    this.drawGround(ctx, p);
    this.drawRoad(ctx, p);
    this.drawRoadside(ctx, p);
    this.drawGrass(ctx);
    this.drawFriends(ctx);
    this.drawHeadlights(ctx);

    var carD = Math.sqrt(U.clamp(this.carS, 0, 1));
    var far = [];
    var near = [];
    for (var i = 0; i < this.obstacles.length; i++) {
      (this.obstacles[i].d < carD ? far : near).push(this.obstacles[i]);
    }
    far.sort(function (a, b) { return a.d - b.d; });
    near.sort(function (a, b) { return a.d - b.d; });

    for (var f = 0; f < far.length; f++) this.drawObstacle(ctx, far[f]);
    this.drawCar(ctx);
    for (var n = 0; n < near.length; n++) this.drawObstacle(ctx, near[n]);

    this.drawSpeedLines(ctx, p);

    /* gentle colour grade: cool sky, warm ground */
    var grade = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    grade.addColorStop(0, 'rgba(28,46,84,0.10)');
    grade.addColorStop(0.55, 'rgba(10,16,30,0.02)');
    grade.addColorStop(1, 'rgba(62,30,30,0.06)');
    ctx.fillStyle = grade;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    T.vignette(ctx, p.x, p.y, p.w, p.h, 0.42);
    T.grain(ctx, p.x, p.y, p.w, p.h, 0.2);
  };

  Car.prototype.drawSky = function (ctx, p) {
    var skyH = this.horizonY - p.y;
    var g = ctx.createLinearGradient(0, p.y, 0, this.horizonY);
    g.addColorStop(0, '#04050e');
    g.addColorStop(0.55, '#0a1020');
    g.addColorStop(1, '#182338');
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, p.w, skyH);

    /* a faint galactic band, so the night sky has depth beyond the stars */
    ctx.save();
    ctx.translate(p.x + p.w * 0.5, p.y + skyH * 0.42);
    ctx.rotate(-0.24);
    var mwA = this.calm ? 0.03 : 0.055;
    var mw = ctx.createLinearGradient(0, -skyH * 0.18, 0, skyH * 0.18);
    mw.addColorStop(0, 'rgba(150,170,230,0)');
    mw.addColorStop(0.45, 'rgba(170,185,235,' + mwA.toFixed(3) + ')');
    mw.addColorStop(0.55, 'rgba(206,196,236,' + (mwA * 1.1).toFixed(3) + ')');
    mw.addColorStop(1, 'rgba(150,170,230,0)');
    ctx.fillStyle = mw;
    ctx.fillRect(-p.w, -skyH * 0.18, p.w * 2, skyH * 0.36);
    ctx.restore();

    for (var i = 0; i < this.sky.length; i++) {
      var s = this.sky[i];
      var tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.t * s.sp + s.ph));
      ctx.globalAlpha = tw * 0.7;
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(p.x + s.nx * p.w, p.y + s.ny * skyH * 0.9, s.r, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (var c = 0; c < this.clouds.length; c++) {
      var cl = this.clouds[c];
      var cx = p.x + p.w * cl.nx + Math.sin(this.t * 0.05 + c) * p.w * 0.02;
      var cy = p.y + skyH * cl.ny;
      var crx = skyH * 0.22 * cl.s;
      var cry = skyH * 0.05 * cl.s;
      var cg = ctx.createRadialGradient(0, 0, 0, 0, 0, crx);
      cg.addColorStop(0, 'rgba(172,190,222,0.10)');
      cg.addColorStop(0.55, 'rgba(150,170,205,0.06)');
      cg.addColorStop(1, 'rgba(150,170,205,0)');
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, cry / crx);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, crx, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    /* faint light pollution behind the village */
    var hg = ctx.createLinearGradient(0, this.horizonY - skyH * 0.22, 0, this.horizonY);
    hg.addColorStop(0, 'rgba(255,158,96,0)');
    hg.addColorStop(1, 'rgba(255,158,96,0.055)');
    ctx.fillStyle = hg;
    ctx.fillRect(p.x, this.horizonY - skyH * 0.22, p.w, skyH * 0.22);

    var mx = p.x + p.w * 0.8;
    var my = p.y + skyH * 0.3;
    var mr = skyH * 0.105;
    T.glow(ctx, mx, my, mr * 4.2, '#fff1cf', 0.32, 0.32);
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(214,205,182,0.35)';
    ctx.beginPath();
    ctx.arc(mx - mr * 0.28, my - mr * 0.18, mr * 0.2, 0, U.TAU);
    ctx.arc(mx + mr * 0.3, my + mr * 0.22, mr * 0.13, 0, U.TAU);
    ctx.fill();

    /* distant hills and a fog band */
    ctx.fillStyle = '#0a1418';
    ctx.beginPath();
    ctx.moveTo(p.x, this.horizonY);
    ctx.quadraticCurveTo(p.x + p.w * 0.2, this.horizonY - skyH * 0.16, p.x + p.w * 0.42, this.horizonY - skyH * 0.03);
    ctx.quadraticCurveTo(p.x + p.w * 0.66, this.horizonY - skyH * 0.14, p.x + p.w * 0.85, this.horizonY - skyH * 0.04);
    ctx.quadraticCurveTo(p.x + p.w * 0.94, this.horizonY - skyH * 0.08, p.x + p.w, this.horizonY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0d1a1a';
    ctx.beginPath();
    ctx.moveTo(p.x, this.horizonY);
    ctx.quadraticCurveTo(p.x + p.w * 0.28, this.horizonY - skyH * 0.07, p.x + p.w * 0.55, this.horizonY - skyH * 0.01);
    ctx.quadraticCurveTo(p.x + p.w * 0.78, this.horizonY - skyH * 0.06, p.x + p.w, this.horizonY - skyH * 0.02);
    ctx.lineTo(p.x + p.w, this.horizonY);
    ctx.closePath();
    ctx.fill();

    var fog = ctx.createLinearGradient(0, this.horizonY - skyH * 0.08, 0, this.horizonY + 4);
    fog.addColorStop(0, 'rgba(160,185,205,0)');
    fog.addColorStop(1, 'rgba(160,185,205,0.16)');
    ctx.fillStyle = fog;
    ctx.fillRect(p.x, this.horizonY - skyH * 0.08, p.w, skyH * 0.08 + 4);

    /* a fringe of distant firs along the horizon */
    ctx.fillStyle = '#07110e';
    for (var f = 0; f < 46; f++) {
      var fx = p.x + (f / 46) * p.w + (f % 3) * 4;
      var fh = skyH * (0.014 + ((f * 37) % 10) / 10 * 0.03);
      ctx.beginPath();
      ctx.moveTo(fx - fh * 0.42, this.horizonY + 1);
      ctx.lineTo(fx, this.horizonY - fh);
      ctx.lineTo(fx + fh * 0.42, this.horizonY + 1);
      ctx.closePath();
      ctx.fill();
    }

    this.drawVillage(ctx, p, skyH);
  };

  /* One small village on the horizon gives the night a destination without
     scattering lights across the whole road. */
  Car.prototype.drawVillage = function (ctx, p, skyH) {
    var s = Math.min(p.w, p.h);
    var bx = p.x + p.w * 0.115;
    var by = this.horizonY - skyH * 0.012;
    var houses = [
      { x: 0.0, y: 0.0, w: 0.055, h: 0.022 },
      { x: 0.06, y: 0.004, w: 0.042, h: 0.018 },
      { x: 0.108, y: -0.002, w: 0.05, h: 0.024 }
    ];
    ctx.save();
    ctx.fillStyle = '#06100d';
    for (var i = 0; i < houses.length; i++) {
      var h = houses[i];
      var x = bx + h.x * s;
      var y = by + h.y * s;
      var w = h.w * s;
      var hh = h.h * s;
      ctx.fillRect(x, y - hh, w, hh);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.08, y - hh);
      ctx.lineTo(x + w * 0.5, y - hh - hh * 0.55);
      ctx.lineTo(x + w * 1.08, y - hh);
      ctx.closePath();
      ctx.fill();
    }
    /* a thin church spire */
    var cx = bx + 0.085 * s;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.006, by);
    ctx.lineTo(cx, by - s * 0.085);
    ctx.lineTo(cx + s * 0.006, by);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,205,132,0.62)';
    ctx.fillRect(bx + 0.014 * s, by - 0.012 * s, Math.max(1, s * 0.004), Math.max(1, s * 0.004));
    ctx.fillRect(bx + 0.028 * s, by - 0.008 * s, Math.max(1, s * 0.003), Math.max(1, s * 0.003));
    ctx.fillRect(bx + 0.122 * s, by - 0.014 * s, Math.max(1, s * 0.004), Math.max(1, s * 0.004));
    ctx.restore();
  };

  Car.prototype.drawConstellation = function (ctx, p) {
    var skyH = this.horizonY - p.y;
    var pat = this.constellation(this.skyGlow > 0 ? this.completedPat : this.cycle);
    var lit = this.skyGlow > 0 ? STARS : this.starsLit;
    var pulse = this.skyGlow > 0 ? 0.6 + 0.4 * Math.sin(this.t * 3.4) : 0;
    var i;
    var pts = [];
    for (i = 0; i < pat.pts.length; i++) {
      pts.push({
        x: p.x + pat.pts[i].nx * p.w,
        y: p.y + pat.pts[i].ny * skyH
      });
    }

    ctx.strokeStyle = 'rgba(143,184,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (pat.closed) ctx.lineTo(pts[0].x, pts[0].y);
    ctx.stroke();

    for (i = 0; i < pts.length; i++) {
      var on = i < lit;
      var r = Math.max(2.5, Math.min(p.w, p.h) * (on ? 0.011 : 0.007));
      if (on) {
        T.glow(ctx, pts[i].x, pts[i].y, r * (5 + pulse * 2), '#ffd39b', 0.3 + 0.2 * pulse, 0.32);
      }
      ctx.fillStyle = on ? 'rgba(255,225,170,' + (0.8 + 0.2 * pulse).toFixed(3) + ')' : 'rgba(150,170,205,0.35)';
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, r, 0, U.TAU);
      ctx.fill();
    }

    /* the crash star flies from the impact up into the sky */
    if (this.starFly) {
      var f = this.starFly;
      var fPat = CONSTELLATIONS[f.pat % CONSTELLATIONS.length];
      var tgt = fPat.pts[f.idx];
      var tx = p.x + tgt.nx * p.w;
      var ty = p.y + tgt.ny * skyH;
      var k = U.easeInOutSine(U.clamp(f.t, 0, 1));
      var cx = (f.x0 + tx) * 0.5 + p.w * 0.06;
      var cy = Math.min(f.y0, ty) - p.h * 0.2;
      var qx = U.lerp(U.lerp(f.x0, cx, k), U.lerp(cx, tx, k), k);
      var qy = U.lerp(U.lerp(f.y0, cy, k), U.lerp(cy, ty, k), k);

      for (var s = 1; s <= 4; s++) {
        var kt = U.clamp(k - s * 0.06, 0, 1);
        var sx = U.lerp(U.lerp(f.x0, cx, kt), U.lerp(cx, tx, kt), kt);
        var sy = U.lerp(U.lerp(f.y0, cy, kt), U.lerp(cy, ty, kt), kt);
        ctx.globalAlpha = (1 - s / 5) * 0.5;
        ctx.fillStyle = 'rgba(255,226,160,0.9)';
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1.5, 4 - s * 0.5), 0, U.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      T.glow(ctx, qx, qy, Math.max(14, p.w * 0.03), '#ffe6a8', 0.5, 0.3);
      ctx.fillStyle = '#fff4cf';
      U.starPath(ctx, qx, qy, Math.max(4, p.w * 0.011), Math.max(2, p.w * 0.005), 5, k * 4);
      ctx.fill();
    }

    if (this.shoot) {
      var k = U.clamp(this.shoot.t, 0, 1);
      var sx = p.x + p.w * this.shoot.nx;
      var sy = p.y + skyH * this.shoot.ny;
      var ex = sx - p.w * 0.18 * k;
      var ey = sy + skyH * 0.1 * k;
      var a = Math.sin(k * Math.PI) * 0.8;
      var sg = ctx.createLinearGradient(sx, sy, ex, ey);
      sg.addColorStop(0, 'rgba(255,250,225,' + a.toFixed(3) + ')');
      sg.addColorStop(1, 'rgba(255,250,225,0)');
      ctx.strokeStyle = sg;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  };

  Car.prototype.drawGround = function (ctx, p) {
    var g = ctx.createLinearGradient(0, this.horizonY, 0, p.y + p.h);
    g.addColorStop(0, '#0a1512');
    g.addColorStop(0.55, '#0a1711');
    g.addColorStop(1, '#07110d');
    ctx.fillStyle = g;
    ctx.fillRect(p.x, this.horizonY, p.w, p.y + p.h - this.horizonY);

    /* grass texture, so the verge is not a flat wash */
    ctx.save();
    ctx.globalAlpha = this.calm ? 0.16 : 0.3;
    ctx.fillStyle = noisePattern(ctx, 'grass');
    ctx.fillRect(p.x, this.horizonY, p.w, p.y + p.h - this.horizonY);
    ctx.restore();

    ctx.strokeStyle = 'rgba(120,180,140,0.06)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 6; i++) {
      var y = this.horizonY + (p.y + p.h - this.horizonY) * (i / 6);
      ctx.beginPath();
      ctx.moveTo(p.x, y);
      ctx.lineTo(p.x + p.w, y);
      ctx.stroke();
    }

    /* ground fog, so the far verge melts into the night */
    var gf = ctx.createLinearGradient(0, this.horizonY, 0, this.horizonY + (p.y + p.h - this.horizonY) * 0.16);
    gf.addColorStop(0, 'rgba(150,175,200,0.1)');
    gf.addColorStop(1, 'rgba(150,175,200,0)');
    ctx.fillStyle = gf;
    ctx.fillRect(p.x, this.horizonY, p.w, (p.y + p.h - this.horizonY) * 0.16);
  };

  Car.prototype.drawRoad = function (ctx, p) {
    var x0 = this.vx - this.horizonHalf;
    var x1 = this.vx + this.horizonHalf;
    var x2 = this.vx + this.bottomHalf;
    var x3 = this.vx - this.bottomHalf;

    ctx.beginPath();
    ctx.moveTo(x0, this.horizonY);
    ctx.lineTo(x1, this.horizonY);
    ctx.lineTo(x2, this.bottomY);
    ctx.lineTo(x3, this.bottomY);
    ctx.closePath();

    /* gravel shoulders just outside the verge lines */
    var shW = this.carW * 0.12;
    ctx.fillStyle = 'rgba(120,118,100,0.08)';
    ctx.beginPath();
    ctx.moveTo(x0, this.horizonY);
    ctx.lineTo(x3, this.bottomY);
    ctx.lineTo(x3 - shW, this.bottomY);
    ctx.lineTo(x0 - this.carW * 0.015, this.horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x1, this.horizonY);
    ctx.lineTo(x2, this.bottomY);
    ctx.lineTo(x2 + shW, this.bottomY);
    ctx.lineTo(x1 + this.carW * 0.015, this.horizonY);
    ctx.closePath();
    ctx.fill();

    /* the road itself */
    ctx.beginPath();
    ctx.moveTo(x0, this.horizonY);
    ctx.lineTo(x1, this.horizonY);
    ctx.lineTo(x2, this.bottomY);
    ctx.lineTo(x3, this.bottomY);
    ctx.closePath();

    var g = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
    g.addColorStop(0, '#1c2433');
    g.addColorStop(0.45, '#232732');
    g.addColorStop(1, '#191b23');
    ctx.fillStyle = g;
    ctx.fill();

    /* asphalt grain */
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = this.calm ? 0.14 : 0.26;
    ctx.fillStyle = noisePattern(ctx, 'road');
    ctx.fillRect(x3, this.horizonY, this.bottomHalf * 2, this.bottomY - this.horizonY);
    ctx.restore();

    /* wet sheen down the middle */
    var sheen = ctx.createLinearGradient(this.vx - this.bottomHalf, 0, this.vx + this.bottomHalf, 0);
    sheen.addColorStop(0, 'rgba(120,170,220,0)');
    sheen.addColorStop(0.35, 'rgba(120,170,220,0.07)');
    sheen.addColorStop(0.55, 'rgba(255,225,170,0.04)');
    sheen.addColorStop(1, 'rgba(120,170,220,0)');
    ctx.save();
    ctx.clip();
    ctx.fillStyle = sheen;
    ctx.fillRect(x3, this.horizonY, this.bottomHalf * 2, this.bottomY - this.horizonY);
    ctx.restore();

    /* verge lines */
    ctx.strokeStyle = 'rgba(242,200,132,0.34)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, this.horizonY);
    ctx.lineTo(x3, this.bottomY);
    ctx.moveTo(x1, this.horizonY);
    ctx.lineTo(x2, this.bottomY);
    ctx.stroke();

    /* dashed lane boundaries in perspective */
    var phase = (this.dist / 60) % 1;
    var dashes = 18;
    ctx.lineCap = 'butt';
    for (var lane = 1; lane < LANES; lane++) {
      var lu = lane / LANES;
      for (var k = 0; k < dashes; k++) {
        var d0 = (k + phase) / dashes;
        var d1 = d0 + 0.022;
        if (d1 > 1) continue;
        var a = this.project(d0, lu);
        var b = this.project(d1, lu);
        ctx.strokeStyle = 'rgba(242,225,190,0.55)';
        ctx.lineWidth = Math.max(1, 3.2 * a.scale);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    /* twin tail-light reflections running down the wet tarmac */
    var brake = U.clamp(1 - this.throttle, 0, 1);
    var rg = ctx.createLinearGradient(0, this.carY + this.carH * 0.2, 0, this.carY + this.carH * 1.55);
    rg.addColorStop(0, 'rgba(255,78,64,' + (0.12 + brake * 0.16).toFixed(3) + ')');
    rg.addColorStop(0.55, 'rgba(255,78,64,' + (0.05 + brake * 0.08).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(255,78,64,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(this.carX - this.carW * 0.43, this.carY + this.carH * 0.2, this.carW * 0.14, this.carH * 1.35);
    ctx.fillRect(this.carX + this.carW * 0.29, this.carY + this.carH * 0.2, this.carW * 0.14, this.carH * 1.35);
  };

  Car.prototype.drawRoadside = function (ctx, p) {
    var phase = (this.dist / this.worldLen) % 1;
    var items = [];
    var i;
    for (i = 0; i < 5; i++) {
      var d = ((i / 5) + phase) % 1;
      if (d < 0.04) continue;
      items.push({ d: d, side: -1, type: i === 1 ? 'lamp' : (i === 3 ? 'barn' : 'tree') });
      items.push({ d: d + 0.03 > 1 ? d + 0.03 - 1 : d + 0.03, side: 1, type: i === 3 ? 'lamp' : (i === 1 ? 'windmill' : 'tree') });
    }
    items.sort(function (a, b) { return a.d - b.d; });

    for (i = 0; i < items.length; i++) {
      var it = items[i];
      var pr = this.project(it.d, it.side < 0 ? 0 : 1);
      var off = it.side * (pr.half * 0.42 + this.carW * 0.18 * pr.scale);
      var x = pr.x + off;
      var y = pr.y;
      var size = this.carW * 0.62 * pr.scale;

      if (it.type === 'lamp') {
        this.drawRoadLamp(ctx, x, y, size);
      } else if (it.type === 'barn') {
        this.drawBarn(ctx, x, y, size);
      } else if (it.type === 'windmill') {
        this.drawWindmill(ctx, x, y, size);
      } else {
        this.drawRoadsideTree(ctx, x, y, size);
      }
    }
  };

  /* ---------------------------------------------------------- verge friends */

  Car.prototype.drawGrass = function (ctx) {
    for (var i = 0; i < this.grass.length; i++) {
      var g = this.grass[i];
      var pr = this.project(g.d, g.side < 0 ? 0 : 1);
      if (pr.scale < 0.08) continue;
      var r = this.carW * 0.17 * pr.scale * g.h;
      if (r < 1.2) continue;
      var x = pr.x + g.side * (pr.half * 1.02 + r * 0.2);
      var y = pr.y;
      var sway = Math.sin(this.t * 1.35 + g.ph) * r * 0.22;

      ctx.strokeStyle = 'rgba(24,56,36,0.8)';
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.lineCap = 'round';
      for (var b = 0; b < 3; b++) {
        var off = (b - 1) * r * 0.16;
        var lean = sway * (0.7 + b * 0.18);
        ctx.beginPath();
        ctx.moveTo(x + off, y);
        ctx.quadraticCurveTo(x + off + lean * 0.55, y - r * 0.55, x + off + lean, y - r * (0.85 + b * 0.08));
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(126,182,134,0.16)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway * 0.5, y - r * 0.6, x + sway, y - r * 0.9);
      ctx.stroke();
    }
  };

  Car.prototype.drawFriends = function (ctx) {
    for (var i = 0; i < this.friends.length; i++) {
      var f = this.friends[i];
      var pr = this.project(f.d, f.side < 0 ? 0 : 1);
      if (pr.s < 0.06) continue;
      var r = this.carW * 0.4 * pr.scale;
      if (r < 5) continue;
      var x = pr.x + f.side * (pr.half * 0.6 + r * 1.35);
      var wave = 0.28 + 0.16 * Math.sin(this.t * 2.1 + f.ph);
      var hop = 0;
      if (this.cheer > 0) {
        wave = 0.75 + 0.25 * Math.sin(this.t * 14 + f.ph);
        hop = Math.abs(Math.sin(this.t * 9 + f.ph)) * r * 0.32;
      }
      this.drawFriend(ctx, f.kind, x, pr.y, r, wave, hop);
    }
  };

  Car.prototype.drawFriend = function (ctx, kind, x, y, r, wave, hop) {
    var body = '#c98a52';
    var belly = '#f0dcc0';
    var limb = body;
    var face = body;

    if (kind === 'rabbit') { body = '#ded2c2'; belly = '#fbf6ee'; limb = body; }
    else if (kind === 'bear') { body = '#7a5233'; belly = '#b98f63'; limb = body; }
    else if (kind === 'owl') { body = '#7a8a9c'; belly = '#cfd8e0'; limb = body; }
    else if (kind === 'sheep') { body = '#ece6da'; belly = '#fbf8f0'; limb = body; face = '#4a4038'; }
    else if (kind === 'fox') { body = '#c2652f'; belly = '#f4e3cd'; limb = '#7a3a18'; }

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.8, r * 0.2, 0, 0, U.TAU);
    ctx.fill();

    ctx.translate(0, -hop);

    /* ears or tufts behind the head */
    if (kind === 'rabbit') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 1.55, r * 0.13, r * 0.42, -0.16, 0, U.TAU);
      ctx.ellipse(r * 0.2, -r * 1.55, r * 0.13, r * 0.42, 0.16, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#e7b3b0';
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 1.52, r * 0.06, r * 0.3, -0.16, 0, U.TAU);
      ctx.ellipse(r * 0.2, -r * 1.52, r * 0.06, r * 0.3, 0.16, 0, U.TAU);
      ctx.fill();
    } else if (kind === 'fox') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-r * 0.38, -r * 1.22);
      ctx.lineTo(-r * 0.5, -r * 1.72);
      ctx.lineTo(-r * 0.12, -r * 1.34);
      ctx.closePath();
      ctx.moveTo(r * 0.38, -r * 1.22);
      ctx.lineTo(r * 0.5, -r * 1.72);
      ctx.lineTo(r * 0.12, -r * 1.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f0c9a0';
      ctx.beginPath();
      ctx.moveTo(-r * 0.36, -r * 1.3);
      ctx.lineTo(-r * 0.42, -r * 1.58);
      ctx.lineTo(-r * 0.22, -r * 1.36);
      ctx.closePath();
      ctx.moveTo(r * 0.36, -r * 1.3);
      ctx.lineTo(r * 0.42, -r * 1.58);
      ctx.lineTo(r * 0.22, -r * 1.36);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'bear') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(-r * 0.34, -r * 1.34, r * 0.17, 0, U.TAU);
      ctx.arc(r * 0.34, -r * 1.34, r * 0.17, 0, U.TAU);
      ctx.fill();
    } else if (kind === 'owl') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 1.24);
      ctx.lineTo(-r * 0.5, -r * 1.62);
      ctx.lineTo(-r * 0.14, -r * 1.36);
      ctx.closePath();
      ctx.moveTo(r * 0.4, -r * 1.24);
      ctx.lineTo(r * 0.5, -r * 1.62);
      ctx.lineTo(r * 0.14, -r * 1.36);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'sheep') {
      ctx.fillStyle = '#f4f0e8';
      for (var w = 0; w < 5; w++) {
        var wa = -Math.PI * 0.85 + (w / 4) * Math.PI * 0.7;
        ctx.beginPath();
        ctx.arc(Math.cos(wa) * r * 0.36, -r * 1.02 + Math.sin(wa) * r * 0.36, r * 0.16, 0, U.TAU);
        ctx.fill();
      }
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.ellipse(-r * 0.46, -r * 1.06, r * 0.16, r * 0.1, -0.5, 0, U.TAU);
      ctx.ellipse(r * 0.46, -r * 1.06, r * 0.16, r * 0.1, 0.5, 0, U.TAU);
      ctx.fill();
    }

    /* body */
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.52, r * 0.48, r * 0.56, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, -r * 1.04, r * 0.42, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.46, r * 0.27, r * 0.34, 0, 0, U.TAU);
    ctx.fill();

    /* muzzle and eyes */
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.94, r * 0.22, r * 0.17, 0, 0, U.TAU);
    ctx.fill();

    var blink = Math.sin(this.t * 1.7 + wave) > 0.985;
    ctx.fillStyle = kind === 'sheep' ? '#f8f4ea' : '#241a14';
    if (blink) {
      ctx.strokeStyle = '#241a14';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 1.12); ctx.lineTo(-r * 0.08, -r * 1.12);
      ctx.moveTo(r * 0.08, -r * 1.12); ctx.lineTo(r * 0.2, -r * 1.12);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-r * 0.14, -r * 1.12, r * (kind === 'sheep' ? 0.085 : 0.055), 0, U.TAU);
      ctx.arc(r * 0.14, -r * 1.12, r * (kind === 'sheep' ? 0.085 : 0.055), 0, U.TAU);
      ctx.fill();
      if (kind === 'sheep') {
        ctx.fillStyle = '#241a14';
        ctx.beginPath();
        ctx.arc(-r * 0.14, -r * 1.12, r * 0.04, 0, U.TAU);
        ctx.arc(r * 0.14, -r * 1.12, r * 0.04, 0, U.TAU);
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.arc(0, -r * 0.92, r * 0.05, 0, U.TAU);
    ctx.fill();

    /* waving arm, always on the road side */
    ctx.strokeStyle = limb;
    ctx.lineWidth = Math.max(1.5, r * 0.17);
    ctx.lineCap = 'round';
    ctx.save();
    ctx.translate(r * 0.4, -r * 0.62);
    ctx.rotate(-0.45 - wave * 0.85);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r * 0.5);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  };

  Car.prototype.drawRoadsideTree = function (ctx, x, y, r) {
    if (r < 3) return;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.15, r * 0.5, r * 0.12, 0, 0, U.TAU);
    ctx.fill();

    ctx.strokeStyle = '#0a1510';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - r * 0.7);
    ctx.stroke();

    var tiers = [
      { top: 1.35, base: -r * 0.05, half: 0.82, col: '#081a11' },
      { top: 1.75, base: r * 0.3, half: 0.62, col: '#0c2116' },
      { top: 2.15, base: r * 0.7, half: 0.42, col: '#10291b' }
    ];
    for (var t = 0; t < tiers.length; t++) {
      var ti = tiers[t];
      ctx.fillStyle = ti.col;
      ctx.beginPath();
      ctx.moveTo(x, y - r * ti.top);
      ctx.lineTo(x + r * ti.half, y - ti.base);
      ctx.lineTo(x - r * ti.half, y - ti.base);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(159,227,192,0.12)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2.12);
    ctx.lineTo(x + r * 0.38, y - r * 0.78);
    ctx.stroke();
  };

  Car.prototype.drawBarn = function (ctx, x, y, r) {
    if (r < 4) return;
    var w = r * 1.5;
    var h = r * 0.95;

    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.05, w * 0.62, r * 0.16, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#0a1411';
    ctx.fillRect(x - w * 0.5, y - h, w, h);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.56, y - h);
    ctx.lineTo(x, y - h - r * 0.52);
    ctx.lineTo(x + w * 0.56, y - h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x, y);
    ctx.stroke();

    var wg = ctx.createRadialGradient(x - w * 0.24, y - h * 0.62, 0, x - w * 0.24, y - h * 0.62, r * 0.3);
    wg.addColorStop(0, 'rgba(255,206,132,0.75)');
    wg.addColorStop(1, 'rgba(255,206,132,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(x - w * 0.42, y - h * 0.82, r * 0.36, r * 0.36);
    ctx.fillStyle = 'rgba(255,214,146,0.9)';
    ctx.fillRect(x - w * 0.28, y - h * 0.68, Math.max(1.5, r * 0.09), Math.max(1.5, r * 0.11));
  };

  Car.prototype.drawWindmill = function (ctx, x, y, r) {
    if (r < 5) return;
    var h = r * 2.1;
    var hubY = y - h;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.05, r * 0.5, r * 0.13, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#0a1512';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y);
    ctx.lineTo(x - r * 0.12, hubY);
    ctx.lineTo(x + r * 0.12, hubY);
    ctx.lineTo(x + r * 0.3, y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.16, hubY);
    ctx.lineTo(x, hubY - r * 0.16);
    ctx.lineTo(x + r * 0.16, hubY);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(x, hubY);
    ctx.rotate(this.t * 0.22);
    ctx.strokeStyle = 'rgba(12,26,20,0.95)';
    ctx.lineWidth = Math.max(1, r * 0.045);
    for (var b = 0; b < 4; b++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r * 0.92);
      ctx.stroke();
      ctx.fillStyle = 'rgba(12,26,20,0.9)';
      ctx.fillRect(-r * 0.09, -r * 0.92, r * 0.18, r * 0.34);
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255,205,132,0.5)';
    ctx.beginPath();
    ctx.arc(x, hubY, Math.max(1, r * 0.05), 0, U.TAU);
    ctx.fill();
  };

  Car.prototype.drawRoadLamp = function (ctx, x, y, r) {
    if (r < 2) return;
    var poleH = r * 2.6;

    /* warm pool on the verge and the road edge */
    var pool = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    pool.addColorStop(0, 'rgba(255,214,150,0.12)');
    pool.addColorStop(0.5, 'rgba(255,214,150,0.05)');
    pool.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 2.6, r * 0.8, 0, 0, U.TAU);
    ctx.fill();

    /* pole with a short curved arm */
    ctx.strokeStyle = 'rgba(158,176,190,0.5)';
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - poleH);
    ctx.quadraticCurveTo(x, y - poleH - r * 0.16, x + r * 0.3, y - poleH - r * 0.16);
    ctx.stroke();

    /* luminaire and halo */
    ctx.fillStyle = 'rgba(255,234,186,0.96)';
    U.rr(ctx, x + r * 0.18, y - poleH - r * 0.23, r * 0.3, r * 0.11, r * 0.05);
    ctx.fill();
    T.glow(ctx, x + r * 0.33, y - poleH - r * 0.18, r * 2.1, T.C.lamp, 0.34, 0.3);
  };

  Car.prototype.drawHeadlights = function (ctx) {
    if (this.app.mode !== 'playing' && this.throttle < 0.05) return;
    var p = this.inset;
    var top = this.carY - this.carH * 0.5;

    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, this.carY - p.y + this.carH * 0.12);
    ctx.clip();
    if (!this.calm) ctx.globalCompositeOperation = 'lighter';

    /* broad soft pool spread up the road */
    ctx.save();
    ctx.translate(this.carX, top + this.carH * 0.1);
    ctx.scale(0.72, 1.9);
    var r1 = this.carW * 2.6;
    var g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, r1);
    g1.addColorStop(0, 'rgba(255,238,196,0.22)');
    g1.addColorStop(0.45, 'rgba(255,228,175,0.1)');
    g1.addColorStop(1, 'rgba(255,228,175,0)');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(0, 0, r1, 0, U.TAU);
    ctx.fill();
    ctx.restore();

    /* brighter core */
    ctx.save();
    ctx.translate(this.carX, top + this.carH * 0.16);
    ctx.scale(0.42, 2.2);
    var r2 = this.carW * 2.1;
    var g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r2);
    g2.addColorStop(0, 'rgba(255,246,214,0.2)');
    g2.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(0, 0, r2, 0, U.TAU);
    ctx.fill();
    ctx.restore();

    /* two soft cones fanning down the road */
    var srcY = this.carY - this.carH * 0.42;
    for (var s = -1; s <= 1; s += 2) {
      var srcX = this.carX + s * this.carW * 0.24;
      var farX = this.vx + s * this.bottomHalf * 0.34;
      var farY = this.horizonY + 4;
      var bg = ctx.createLinearGradient(srcX, srcY, farX, farY);
      bg.addColorStop(0, 'rgba(255,240,200,0.15)');
      bg.addColorStop(0.4, 'rgba(255,236,192,0.06)');
      bg.addColorStop(1, 'rgba(255,236,192,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(srcX - this.carW * 0.04, srcY);
      ctx.lineTo(srcX + this.carW * 0.04, srcY);
      ctx.lineTo(farX + this.carW * 0.55, farY);
      ctx.lineTo(farX - this.carW * 0.55, farY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    if (this.honk > 0) {
      var hk = this.honk / 0.75;
      T.glow(ctx, this.carX, this.carY - this.carH * 0.5, this.carW * (1.3 + hk * 0.7), '#fff2c4', 0.22 + 0.26 * hk, 0.3);
    }

    T.glow(ctx, this.carX, this.carY - this.carH * 0.45, this.carW * 1.1, T.C.lamp, 0.14, 0.35);
  };

  /* --------------------------------------------------------------- car art */

  Car.prototype.drawCar = function (ctx) {
    var w = this.carW;
    var h = this.carH;
    var speedK = U.clamp(this.speed / this.speedBase, 0, 1.2);
    var bob = Math.sin(this.t * 9) * Math.min(2.2, speedK * 1.6);
    var wob = Math.sin(this.t * 22) * this.wobble * w * 0.03;
    var brake = U.clamp(1 - this.throttle, 0, 1);

    ctx.save();
    ctx.translate(this.carX + wob, this.carY + bob);
    ctx.rotate(this.tilt * 0.35 + Math.sin(this.t * 18) * this.wobble * 0.04);

    /* soft contact shadow */
    var shadow = ctx.createRadialGradient(0, h * 0.44, w * 0.08, 0, h * 0.44, w * 0.62);
    shadow.addColorStop(0, 'rgba(0,0,0,0.62)');
    shadow.addColorStop(0.55, 'rgba(0,0,0,0.34)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.44, w * 0.62, h * 0.21, 0, 0, U.TAU);
    ctx.fill();

    /* tyres, just peeking past the body */
    ctx.fillStyle = '#07070b';
    U.rr(ctx, -w * 0.545, h * 0.12, w * 0.13, h * 0.32, w * 0.05); ctx.fill();
    U.rr(ctx, w * 0.415, h * 0.12, w * 0.13, h * 0.32, w * 0.05); ctx.fill();

    /* exhaust heat while boosting */
    if (this.boost > 0.05) {
      T.glow(ctx, -w * 0.3, h * 0.44, w * 0.35, T.C.amber, 0.16 + this.boost * 0.2, 0.3);
    }

    /* VW up! rear: a tall, upright hatch in Tornado Red */
    var body = ctx.createLinearGradient(-w * 0.52, 0, w * 0.52, 0);
    body.addColorStop(0, 'hsl(0, 60%, 20%)');
    body.addColorStop(0.12, 'hsl(1, 66%, 30%)');
    body.addColorStop(0.34, 'hsl(4, 78%, 48%)');
    body.addColorStop(0.52, 'hsl(5, 82%, 55%)');
    body.addColorStop(0.72, 'hsl(2, 72%, 43%)');
    body.addColorStop(0.9, 'hsl(0, 62%, 29%)');
    body.addColorStop(1, 'hsl(0, 55%, 17%)');

    ctx.beginPath();
    ctx.moveTo(-w * 0.31, -h * 0.555);
    ctx.quadraticCurveTo(0, -h * 0.605, w * 0.31, -h * 0.555);
    ctx.quadraticCurveTo(w * 0.435, -h * 0.52, w * 0.455, -h * 0.4);
    ctx.lineTo(w * 0.475, h * 0.3);
    ctx.quadraticCurveTo(w * 0.475, h * 0.455, w * 0.38, h * 0.46);
    ctx.lineTo(-w * 0.38, h * 0.46);
    ctx.quadraticCurveTo(-w * 0.475, h * 0.455, -w * 0.475, h * 0.3);
    ctx.lineTo(-w * 0.455, -h * 0.4);
    ctx.quadraticCurveTo(-w * 0.435, -h * 0.52, -w * 0.31, -h * 0.555);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();

    /* clear-coat sheen, clipped to the body */
    ctx.save();
    ctx.clip();
    var coat = ctx.createLinearGradient(-w * 0.5, 0, -w * 0.1, 0);
    coat.addColorStop(0, 'rgba(255,220,210,0)');
    coat.addColorStop(0.55, 'rgba(255,230,220,0.14)');
    coat.addColorStop(1, 'rgba(255,230,220,0)');
    ctx.fillStyle = coat;
    ctx.fillRect(-w * 0.5, -h * 0.6, w * 0.45, h);

    /* lower-body ambient shade and a soft hip highlight */
    var low = ctx.createLinearGradient(0, h * 0.04, 0, h * 0.46);
    low.addColorStop(0, 'rgba(35,0,0,0)');
    low.addColorStop(1, 'rgba(28,0,0,0.42)');
    ctx.fillStyle = low;
    ctx.fillRect(-w * 0.5, h * 0.04, w, h * 0.46);
    var hip = ctx.createLinearGradient(w * 0.18, 0, w * 0.46, 0);
    hip.addColorStop(0, 'rgba(255,190,170,0)');
    hip.addColorStop(0.7, 'rgba(255,190,170,0.1)');
    hip.addColorStop(1, 'rgba(255,190,170,0)');
    ctx.fillStyle = hip;
    ctx.fillRect(w * 0.18, -h * 0.45, w * 0.3, h * 0.9);
    ctx.restore();

    /* panel seam and warm rim light */
    ctx.strokeStyle = 'rgba(255,210,190,0.22)';
    ctx.lineWidth = Math.max(1, w * 0.012);
    ctx.beginPath();
    ctx.moveTo(-w * 0.31, -h * 0.55);
    ctx.quadraticCurveTo(0, -h * 0.6, w * 0.31, -h * 0.55);
    ctx.stroke();

    /* rear spoiler with the high-mount brake light */
    ctx.fillStyle = 'hsl(0, 52%, 16%)';
    U.rr(ctx, -w * 0.30, -h * 0.60, w * 0.60, h * 0.035, w * 0.02);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,62,52,' + (0.35 + brake * 0.6).toFixed(3) + ')';
    U.rr(ctx, -w * 0.11, -h * 0.585, w * 0.22, h * 0.012, w * 0.006);
    ctx.fill();
    if (!this.calm && brake > 0.15) {
      T.glow(ctx, 0, -h * 0.578, w * 0.35, '#ff5a50', 0.12 + brake * 0.22, 0.3);
    }

    /* the up!'s rear glass covers most of the tailgate */
    var glass = ctx.createLinearGradient(0, -h * 0.53, 0, h * 0.13);
    glass.addColorStop(0, 'rgba(120,152,192,0.52)');
    glass.addColorStop(0.24, 'rgba(18,27,42,0.97)');
    glass.addColorStop(0.68, 'rgba(9,14,24,0.98)');
    glass.addColorStop(1, 'rgba(26,40,58,0.95)');
    ctx.beginPath();
    ctx.moveTo(-w * 0.335, -h * 0.515);
    ctx.quadraticCurveTo(0, -h * 0.545, w * 0.335, -h * 0.515);
    ctx.quadraticCurveTo(w * 0.355, -h * 0.40, w * 0.35, -h * 0.14);
    ctx.quadraticCurveTo(w * 0.345, h * 0.10, w * 0.30, h * 0.125);
    ctx.lineTo(-w * 0.30, h * 0.125);
    ctx.quadraticCurveTo(-w * 0.345, h * 0.10, -w * 0.35, -h * 0.14);
    ctx.quadraticCurveTo(-w * 0.355, -h * 0.40, -w * 0.335, -h * 0.515);
    ctx.closePath();
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(1, w * 0.012);
    ctx.stroke();

    /* glass reflections: sky band, a little landscape, moon streak */
    var skyBand = ctx.createLinearGradient(0, -h * 0.50, 0, -h * 0.36);
    skyBand.addColorStop(0, 'rgba(150,180,215,0.24)');
    skyBand.addColorStop(1, 'rgba(150,180,215,0)');
    ctx.fillStyle = skyBand;
    ctx.fillRect(-w * 0.31, -h * 0.50, w * 0.62, h * 0.15);

    ctx.fillStyle = 'rgba(40,70,58,0.16)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.08, h * 0.075, w * 0.24, h * 0.06, -0.08, 0, U.TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,246,218,0.22)';
    ctx.lineWidth = Math.max(1, w * 0.014);
    ctx.beginPath();
    ctx.moveTo(-w * 0.11, -h * 0.46);
    ctx.lineTo(w * 0.0, -h * 0.35);
    ctx.stroke();

    /* rear wiper */
    ctx.strokeStyle = 'rgba(6,8,12,0.9)';
    ctx.lineWidth = Math.max(1, w * 0.012);
    ctx.beginPath();
    ctx.moveTo(-w * 0.16, -h * 0.115);
    ctx.lineTo(w * 0.03, -h * 0.15);
    ctx.stroke();

    /* the little dog riding along in the back window */
    this.drawDog(ctx, w, h);

    /* tall, narrow up! tail lights set into the glass edges */
    var tailA = U.clamp(0.62 + brake * 0.34 + this.honk * 0.2, 0, 1);

    ctx.fillStyle = 'rgba(18,2,4,0.97)';
    U.rr(ctx, -w * 0.438, -h * 0.305, w * 0.13, h * 0.43, w * 0.03); ctx.fill();
    U.rr(ctx, w * 0.308, -h * 0.305, w * 0.13, h * 0.43, w * 0.03); ctx.fill();

    var tl = ctx.createLinearGradient(0, -h * 0.29, 0, h * 0.1);
    tl.addColorStop(0, 'rgba(255,90,74,' + (0.55 + tailA * 0.4).toFixed(3) + ')');
    tl.addColorStop(0.24, 'rgba(232,34,30,' + tailA.toFixed(3) + ')');
    tl.addColorStop(0.66, 'rgba(140,10,14,0.99)');
    tl.addColorStop(0.9, 'rgba(255,120,86,' + (0.55 + tailA * 0.4).toFixed(3) + ')');
    tl.addColorStop(1, 'rgba(90,6,10,0.99)');
    ctx.fillStyle = tl;
    U.rr(ctx, -w * 0.425, -h * 0.29, w * 0.105, h * 0.4, w * 0.022); ctx.fill();
    U.rr(ctx, w * 0.32, -h * 0.29, w * 0.105, h * 0.4, w * 0.022); ctx.fill();

    /* LED outline: the bright ring that makes an up! light readable */
    ctx.strokeStyle = 'rgba(255,120,100,' + (0.5 + tailA * 0.45).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, w * 0.012);
    U.rr(ctx, -w * 0.419, -h * 0.282, w * 0.093, h * 0.384, w * 0.018); ctx.stroke();
    U.rr(ctx, w * 0.326, -h * 0.282, w * 0.093, h * 0.384, w * 0.018); ctx.stroke();

    /* clear reverse sliver at the bottom of each light */
    ctx.fillStyle = 'rgba(255,248,238,' + (0.45 + brake * 0.4).toFixed(3) + ')';
    U.rr(ctx, -w * 0.416, h * 0.062, w * 0.087, h * 0.03, w * 0.01); ctx.fill();
    U.rr(ctx, w * 0.329, h * 0.062, w * 0.087, h * 0.03, w * 0.01); ctx.fill();

    if (!this.calm) {
      T.glow(ctx, -w * 0.372, -h * 0.06, w * 0.3, '#ff5a54', 0.18 + brake * 0.2, 0.3);
      T.glow(ctx, w * 0.372, -h * 0.06, w * 0.3, '#ff5a54', 0.18 + brake * 0.2, 0.3);
    }

    /* VW roundel sits on the glass, as it does on the real up! */
    this.drawVWBadge(ctx, 0, -h * 0.025, w * 0.072);

    /* up! badge on the lower-left body panel */
    U.text(ctx, 'up!', -w * 0.30, h * 0.162, Math.max(6, w * 0.065), 'rgba(240,240,244,0.92)', 700, 'center', 'middle');

    /* body-colour bumper with a recessed plate and a black lower lip */
    ctx.fillStyle = 'rgba(42,2,4,0.36)';
    U.rr(ctx, -w * 0.19, h * 0.205, w * 0.38, h * 0.12, w * 0.025);
    ctx.fill();
    ctx.fillStyle = '#f4ecd9';
    U.rr(ctx, -w * 0.165, h * 0.216, w * 0.33, h * 0.098, w * 0.018);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,150,80,0.9)';
    ThemeStar(ctx, 0, h * 0.265, w * 0.03);
    ctx.fill();

    ctx.fillStyle = 'rgba(225,58,50,0.92)';
    U.rr(ctx, -w * 0.38, h * 0.348, w * 0.09, h * 0.022, w * 0.01); ctx.fill();
    U.rr(ctx, w * 0.29, h * 0.348, w * 0.09, h * 0.022, w * 0.01); ctx.fill();

    ctx.fillStyle = 'rgba(12,8,10,0.92)';
    U.rr(ctx, -w * 0.445, h * 0.418, w * 0.89, h * 0.05, w * 0.014);
    ctx.fill();

    ctx.fillStyle = '#9aa0a8';
    U.rr(ctx, -w * 0.315, h * 0.435, w * 0.085, h * 0.024, w * 0.012);
    ctx.fill();

    /* little roof antenna with a bead */
    ctx.strokeStyle = 'rgba(230,220,200,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, -h * 0.595);
    ctx.lineTo(w * 0.2, -h * 0.78);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,211,155,0.9)';
    ctx.beginPath();
    ctx.arc(w * 0.2, -h * 0.79, Math.max(1.5, w * 0.022), 0, U.TAU);
    ctx.fill();

    ctx.restore();
  };

  /* The chrome VW roundel: a ring with the V above the W, kept legible at
     small sizes rather than trying to draw the real monogram exactly. */
  Car.prototype.drawVWBadge = function (ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#c6cad1';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#20283a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.84, 0, U.TAU);
    ctx.fill();

    ctx.strokeStyle = '#e6e9ee';
    ctx.lineWidth = Math.max(0.8, r * 0.16);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.46);
    ctx.lineTo(0, -r * 0.02);
    ctx.lineTo(r * 0.5, -r * 0.46);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.56, r * 0.06);
    ctx.lineTo(-r * 0.3, r * 0.5);
    ctx.lineTo(0, r * 0.12);
    ctx.lineTo(r * 0.3, r * 0.5);
    ctx.lineTo(r * 0.56, r * 0.06);
    ctx.stroke();
    ctx.restore();
  };

  function ThemeStar(ctx, x, y, r) {
    U.starPath(ctx, x, y, r, r * 0.46, 5, 0);
  }

  /* A small, happy passenger in the rear window. Ears flap with speed and the
     head bounces with a crash; it never blocks the road. */
  Car.prototype.drawDog = function (ctx, w, h) {
    var speedK = U.clamp(this.speed / this.speedBase, 0, 1.2);
    var joy = U.clamp(this.dogJoy, 0, 1);
    var r = w * 0.115;
    var bob = Math.sin(this.t * 8) * (0.5 + speedK * 1.5) + joy * Math.sin(this.t * 17) * r * 0.3;
    var flap = 0.35 + 0.18 * Math.sin(this.t * (8 + speedK * 12)) + joy * 0.45;

    ctx.save();
    ctx.translate(0, -h * 0.35 + bob);

    for (var s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * r * 0.78, -r * 0.16);
      ctx.rotate(s * flap);
      ctx.fillStyle = '#7d4f2c';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.4, r * 0.28, r * 0.5, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#d9a86f';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#f4e2c4';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.38, r * 0.56, r * 0.4, 0, 0, U.TAU);
    ctx.fill();

    if (Math.sin(this.t * 1.3) > 0.97) {
      ctx.strokeStyle = '#2a1a12';
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.12); ctx.lineTo(-r * 0.2, -r * 0.12);
      ctx.moveTo(r * 0.14, -r * 0.12); ctx.lineTo(r * 0.34, -r * 0.12);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#2a1a12';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.12, r * 0.09, 0, U.TAU);
      ctx.arc(r * 0.26, -r * 0.12, r * 0.09, 0, U.TAU);
      ctx.fill();
    }

    ctx.fillStyle = '#2a1a12';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2, r * 0.16, r * 0.11, 0, 0, U.TAU);
    ctx.fill();

    if (joy > 0.1 || speedK > 0.72) {
      ctx.fillStyle = '#e8868f';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.58, r * 0.13, r * (0.2 + joy * 0.18), 0, 0, U.TAU);
      ctx.fill();
    }

    ctx.restore();
  };

  /* ------------------------------------------------------------- obstacles */

  Car.prototype.drawObstacle = function (ctx, o) {
    var alpha = 1;
    var rot = 0;
    if (o.bump) {
      var k = U.clamp(o.age / 0.85, 0, 1);
      alpha = 1 - k;
      rot = o.rot;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(o.x, o.y);
    ctx.rotate(rot);

    if (o.kind === 'tree') {
      this.drawObstacleTree(ctx, o.w * o.scale, o.hue);
    } else if (o.kind === 'bale') {
      this.drawObstacleBale(ctx, o.w * o.scale, o.hue);
    } else if (o.kind === 'van') {
      this.drawObstacleVan(ctx, o.w * o.scale, o.h * o.scale, o.hue);
    } else {
      this.drawObstacleCar(ctx, o.w * o.scale, o.h * o.scale, o.hue);
    }

    /* a small target sparkle, so bumps read as invitations */
    if (!o.bump) {
      var tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * 3 + o.ph));
      ctx.globalAlpha = alpha * tw * 0.8;
      T.glow(ctx, 0, -o.h * o.scale * 0.62, o.w * o.scale * 0.5, T.C.lamp, 0.25, 0.3);
      ctx.fillStyle = 'rgba(255,240,200,0.85)';
      ThemeStar(ctx, 0, -o.h * o.scale * 0.62, Math.max(2, o.w * o.scale * 0.09));
      ctx.fill();

      if (o.kind === 'car' || o.kind === 'van') {
        var rg = ctx.createLinearGradient(0, o.h * o.scale * 0.22, 0, o.h * o.scale * 1.6);
        rg.addColorStop(0, 'rgba(255,70,60,0.12)');
        rg.addColorStop(1, 'rgba(255,70,60,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(-o.w * o.scale * 0.42, o.h * o.scale * 0.22, o.w * o.scale * 0.84, o.h * o.scale * 1.38);
      }
    }

    if (o.flash > 0) {
      T.glow(ctx, 0, -o.h * o.scale * 0.3, o.w * o.scale * 0.7, '#ffe3ae', 0.32 * o.flash, 0.3);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  };

  Car.prototype.drawObstacleCar = function (ctx, w, h, hue) {
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.45, w * 0.54, h * 0.16, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#08080d';
    U.rr(ctx, -w * 0.5, h * 0.1, w * 0.14, h * 0.28, w * 0.05); ctx.fill();
    U.rr(ctx, w * 0.36, h * 0.1, w * 0.14, h * 0.28, w * 0.05); ctx.fill();

    var body = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    body.addColorStop(0, U.hsl(hue, 30, 20));
    body.addColorStop(0.35, U.hsl(hue, 38, 34));
    body.addColorStop(0.55, U.hsl(hue, 42, 42));
    body.addColorStop(1, U.hsl(hue, 28, 20));
    ctx.fillStyle = body;
    U.rr(ctx, -w * 0.46, -h * 0.5, w * 0.92, h * 0.92, w * 0.2);
    ctx.fill();

    /* cabin and rear window */
    ctx.fillStyle = 'rgba(12,16,24,0.55)';
    U.rr(ctx, -w * 0.37, -h * 0.44, w * 0.74, h * 0.2, w * 0.08);
    ctx.fill();
    var win = ctx.createLinearGradient(0, -h * 0.42, 0, -h * 0.26);
    win.addColorStop(0, 'rgba(150,185,235,0.35)');
    win.addColorStop(1, 'rgba(20,32,52,0.85)');
    ctx.fillStyle = win;
    U.rr(ctx, -w * 0.32, -h * 0.42, w * 0.64, h * 0.16, w * 0.05);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(-w * 0.18, -h * 0.4);
    ctx.lineTo(-w * 0.05, -h * 0.28);
    ctx.stroke();

    /* bumper and plate */
    ctx.fillStyle = 'rgba(10,10,14,0.55)';
    U.rr(ctx, -w * 0.44, h * 0.28, w * 0.88, h * 0.12, w * 0.05);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,232,212,0.75)';
    U.rr(ctx, -w * 0.1, h * 0.31, w * 0.2, h * 0.06, w * 0.015);
    ctx.fill();

    var blink = 0.7 + 0.3 * Math.sin(this.t * 3 + hue);
    ctx.fillStyle = 'rgba(255,110,100,' + blink.toFixed(3) + ')';
    U.rr(ctx, -w * 0.4, h * 0.18, w * 0.17, h * 0.1, w * 0.04); ctx.fill();
    U.rr(ctx, w * 0.23, h * 0.18, w * 0.17, h * 0.1, w * 0.04); ctx.fill();
    if (!this.calm) {
      T.glow(ctx, -w * 0.31, h * 0.23, w * 0.3, '#ff6e68', 0.16, 0.3);
      T.glow(ctx, w * 0.31, h * 0.23, w * 0.3, '#ff6e68', 0.16, 0.3);
    }

    ctx.strokeStyle = 'rgba(255,230,200,0.16)';
    ctx.lineWidth = Math.max(1, w * 0.012);
    U.rr(ctx, -w * 0.46, -h * 0.5, w * 0.92, h * 0.92, w * 0.2);
    ctx.stroke();
  };

  Car.prototype.drawObstacleVan = function (ctx, w, h, hue) {
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.46, w * 0.54, h * 0.14, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#08080d';
    U.rr(ctx, -w * 0.5, h * 0.16, w * 0.13, h * 0.24, w * 0.04); ctx.fill();
    U.rr(ctx, w * 0.37, h * 0.16, w * 0.13, h * 0.24, w * 0.04); ctx.fill();

    var body = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    body.addColorStop(0, U.hsl(hue, 26, 22));
    body.addColorStop(0.4, U.hsl(hue, 34, 40));
    body.addColorStop(1, U.hsl(hue, 24, 20));
    ctx.fillStyle = body;
    U.rr(ctx, -w * 0.46, -h * 0.52, w * 0.92, h * 0.95, w * 0.12);
    ctx.fill();

    /* twin rear doors and windows */
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = Math.max(1, w * 0.018);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.4);
    ctx.lineTo(0, h * 0.34);
    ctx.stroke();

    var win = ctx.createLinearGradient(0, -h * 0.38, 0, -h * 0.18);
    win.addColorStop(0, 'rgba(150,185,235,0.3)');
    win.addColorStop(1, 'rgba(18,26,40,0.85)');
    ctx.fillStyle = win;
    U.rr(ctx, -w * 0.32, -h * 0.4, w * 0.28, h * 0.2, w * 0.03); ctx.fill();
    U.rr(ctx, w * 0.04, -h * 0.4, w * 0.28, h * 0.2, w * 0.03); ctx.fill();

    ctx.fillStyle = 'rgba(10,10,14,0.55)';
    U.rr(ctx, -w * 0.44, h * 0.3, w * 0.88, h * 0.1, w * 0.04);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,232,212,0.7)';
    U.rr(ctx, -w * 0.09, h * 0.325, w * 0.18, h * 0.05, w * 0.012);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,110,100,0.85)';
    U.rr(ctx, -w * 0.4, h * 0.25, w * 0.17, h * 0.09, w * 0.03); ctx.fill();
    U.rr(ctx, w * 0.23, h * 0.25, w * 0.17, h * 0.09, w * 0.03); ctx.fill();
  };

  Car.prototype.drawObstacleTree = function (ctx, r, hue) {
    if (r <= 0.5) return;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(r * 0.15, r * 0.82, r * 0.8, r * 0.24, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#4b3a28';
    U.rr(ctx, -r * 0.13, r * 0.05, r * 0.26, r * 0.8, r * 0.08);
    ctx.fill();

    var blobs = [
      { x: 0, y: -r * 0.18, s: r * 0.78 },
      { x: -r * 0.5, y: r * 0.08, s: r * 0.54 },
      { x: r * 0.5, y: r * 0.06, s: r * 0.56 },
      { x: r * 0.08, y: -r * 0.62, s: r * 0.5 }
    ];
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var g = ctx.createRadialGradient(b.x - b.s * 0.3, b.y - b.s * 0.4, b.s * 0.1, b.x, b.y, b.s * 1.1);
      g.addColorStop(0, U.hsl(hue, 44, 26));
      g.addColorStop(1, U.hsl(hue, 48, 12));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.s, 0, U.TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,207,138,0.24)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.arc(0, -r * 0.12, r * 0.78, Math.PI * 0.18, Math.PI * 0.85);
    ctx.stroke();
  };

  Car.prototype.drawObstacleBale = function (ctx, r) {
    if (r <= 0.5) return;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(r * 0.12, r * 0.55, r * 0.78, r * 0.2, 0, 0, U.TAU);
    ctx.fill();

    var g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r * 0.8);
    g.addColorStop(0, '#e8cd83');
    g.addColorStop(0.6, '#c9a95c');
    g.addColorStop(1, '#8f7436');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, U.TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120,92,40,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    for (var i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7 * (i / 4), 0, U.TAU);
      ctx.stroke();
    }
  };

  /* ---------------------------------------------------------------- effects */

  Car.prototype.drawSpeedLines = function (ctx, p) {
    var k = U.clamp((this.speed / this.speedBase - 0.55) / 0.6, 0, 1) * (this.calm ? 0.4 : 1);
    if (k <= 0.02) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(200,225,255,' + (0.05 + 0.08 * k).toFixed(3) + ')';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (var i = 0; i < 12; i++) {
      var d = ((i / 12) + (this.dist / 120)) % 1;
      var pr = this.project(0.06 + d * 0.8, i % 2 ? 0 : 1);
      var side = i % 2 ? 1 : -1;
      var x = pr.x + side * (pr.half * 0.5 + this.carW * 0.2);
      if (x < p.x || x > p.x + p.w) continue;
      var len = 8 + 26 * k * pr.scale;
      ctx.beginPath();
      ctx.moveTo(x, pr.y);
      ctx.lineTo(x, pr.y + len);
      ctx.stroke();
    }
    ctx.restore();
  };

  MG.Games = MG.Games || {};
  MG.Games.car = Car;
})(window.MG);
