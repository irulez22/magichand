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

  /* a small dipper in the sky, normalised to the sky rectangle */
  var SKY_POINTS = [
    { nx: 0.17, ny: 0.34 },
    { nx: 0.245, ny: 0.24 },
    { nx: 0.32, ny: 0.31 },
    { nx: 0.295, ny: 0.45 },
    { nx: 0.195, ny: 0.48 },
    { nx: 0.135, ny: 0.4 }
  ];

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
    this.sky = null;
    this.clouds = null;
    this.holdStyle = 'pedal';
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
    this.carH = this.carW * 0.86;
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
    this.spawnIn = minDim * 0.7;
    this.carX = this.laneXAt(this.carU);
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
    this.spawnIn = Math.min(this.play.w, this.play.h) * 0.7;
  };

  Car.prototype.halfAt = function (y) {
    var t = U.clamp((y - this.horizonY) / (this.bottomY - this.horizonY), 0, 1);
    return this.horizonHalf + (this.bottomHalf - this.horizonHalf) * t;
  };

  Car.prototype.laneXAt = function (u) {
    var half = this.halfAt(this.carY);
    return this.vx - half + U.clamp(u, 0, 1) * half * 2;
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
    return U.clamp(app.light || 0, 0, 1);
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
        this.spawnIn = Math.min(p.w, p.h) * U.rand(1.0, 1.5);
      }
    }

    this.updateObstacles(dt, step, p);
  };

  Car.prototype.updateObstacles = function (dt, step, p) {
    for (var i = this.obstacles.length - 1; i >= 0; i--) {
      var o = this.obstacles[i];

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
    this.lightStar();
  };

  Car.prototype.lightStar = function () {
    if (this.skyGlow > 0) return;
    this.starsLit = Math.min(STARS, this.starsLit + 1);

    if (this.starsLit >= STARS) {
      this.skyGlow = 2.8;
      this.cycle += 1;
      this.shoot = { t: 0, nx: U.rand(0.6, 0.85), ny: U.rand(0.12, 0.3) };
      MG.Audio.play('sparkle');
      var p = this.inset;
      FX.sparkle(p.x + p.w * 0.22, p.y + p.h * 0.2, this.calm ? 8 : 16, 46);
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
    }

    MG.Audio.play('toot', 1);
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
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#b9c8e8';
      ctx.beginPath();
      ctx.ellipse(cx, cy, skyH * 0.16 * cl.s, skyH * 0.035 * cl.s, 0, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

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
  };

  Car.prototype.drawConstellation = function (ctx, p) {
    var skyH = this.horizonY - p.y;
    var lit = this.skyGlow > 0 ? STARS : this.starsLit;
    var pulse = this.skyGlow > 0 ? 0.6 + 0.4 * Math.sin(this.t * 3.4) : 0;
    var i;
    var pts = [];
    for (i = 0; i < SKY_POINTS.length; i++) {
      pts.push({
        x: p.x + SKY_POINTS[i].nx * p.w,
        y: p.y + SKY_POINTS[i].ny * skyH
      });
    }

    ctx.strokeStyle = 'rgba(143,184,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
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

    ctx.strokeStyle = 'rgba(120,180,140,0.06)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 6; i++) {
      var y = this.horizonY + (p.y + p.h - this.horizonY) * (i / 6);
      ctx.beginPath();
      ctx.moveTo(p.x, y);
      ctx.lineTo(p.x + p.w, y);
      ctx.stroke();
    }
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

    var g = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
    g.addColorStop(0, '#1c2433');
    g.addColorStop(0.45, '#232732');
    g.addColorStop(1, '#191b23');
    ctx.fillStyle = g;
    ctx.fill();

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

    /* warm reflection under the car's tail lights */
    var rg = ctx.createLinearGradient(0, this.carY - this.carH, 0, this.carY + this.carH * 0.8);
    rg.addColorStop(0, 'rgba(255,90,80,0)');
    rg.addColorStop(1, 'rgba(255,90,80,0.1)');
    ctx.fillStyle = rg;
    ctx.fillRect(this.carX - this.carW * 0.5, this.carY - this.carH, this.carW, this.carH * 1.8);
  };

  Car.prototype.drawRoadside = function (ctx, p) {
    var phase = (this.dist / this.worldLen) % 1;
    var items = [];
    var i;
    for (i = 0; i < 9; i++) {
      var d = ((i / 9) + phase) % 1;
      if (d < 0.02) continue;
      items.push({ d: d, side: -1, type: i % 3 === 0 ? 'lamp' : 'tree' });
      items.push({ d: d + 0.045 > 1 ? d + 0.045 - 1 : d + 0.045, side: 1, type: i % 4 === 0 ? 'lamp' : 'tree' });
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
      } else {
        this.drawRoadsideTree(ctx, x, y, size);
      }
    }
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

    ctx.fillStyle = '#0e2418';
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.55);
    ctx.lineTo(x + r * 0.62, y - r * 0.55);
    ctx.lineTo(x - r * 0.62, y - r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(159,227,192,0.08)';
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.55);
    ctx.lineTo(x + r * 0.3, y - r * 0.9);
    ctx.lineTo(x, y - r * 0.82);
    ctx.closePath();
    ctx.fill();
  };

  Car.prototype.drawRoadLamp = function (ctx, x, y, r) {
    if (r < 2) return;
    ctx.strokeStyle = 'rgba(160,180,190,0.4)';
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - r * 2.2);
    ctx.stroke();
    T.glow(ctx, x, y - r * 2.2, r * 1.8, T.C.lamp, 0.3, 0.3);
    ctx.fillStyle = 'rgba(255,232,180,0.95)';
    ctx.beginPath();
    ctx.arc(x, y - r * 2.2, Math.max(1.5, r * 0.18), 0, U.TAU);
    ctx.fill();
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

    ctx.restore();

    T.glow(ctx, this.carX, this.carY - this.carH * 0.45, this.carW * 1.1, T.C.lamp, 0.14, 0.35);
  };

  /* --------------------------------------------------------------- car art */

  Car.prototype.drawCar = function (ctx) {
    var w = this.carW;
    var h = this.carH;
    var bob = Math.sin(this.t * 9) * Math.min(2.2, this.speed / this.speedBase * 1.6);
    var wob = Math.sin(this.t * 22) * this.wobble * w * 0.03;

    ctx.save();
    ctx.translate(this.carX + wob, this.carY + bob);
    ctx.rotate(this.tilt * 0.35 + Math.sin(this.t * 18) * this.wobble * 0.04);

    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.42, w * 0.56, h * 0.22, 0, 0, U.TAU);
    ctx.fill();

    /* tyres */
    ctx.fillStyle = '#07070b';
    U.rr(ctx, -w * 0.5, h * 0.08, w * 0.14, h * 0.34, w * 0.05); ctx.fill();
    U.rr(ctx, w * 0.36, h * 0.08, w * 0.14, h * 0.34, w * 0.05); ctx.fill();

    /* exhaust glow while boosting */
    if (this.boost > 0.05) {
      T.glow(ctx, 0, h * 0.5, w * 0.4, T.C.amber, 0.18 + this.boost * 0.2, 0.3);
    }

    /* body: a friendly rear view, wider at the bottom */
    var body = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    body.addColorStop(0, 'hsl(205, 44%, 25%)');
    body.addColorStop(0.35, 'hsl(203, 52%, 42%)');
    body.addColorStop(0.68, 'hsl(202, 48%, 38%)');
    body.addColorStop(1, 'hsl(206, 38%, 24%)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-w * 0.36, -h * 0.52);
    ctx.quadraticCurveTo(0, -h * 0.58, w * 0.36, -h * 0.52);
    ctx.lineTo(w * 0.47, h * 0.26);
    ctx.quadraticCurveTo(w * 0.46, h * 0.46, w * 0.3, h * 0.47);
    ctx.lineTo(-w * 0.3, h * 0.47);
    ctx.quadraticCurveTo(-w * 0.46, h * 0.46, -w * 0.47, h * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,200,132,0.34)';
    ctx.lineWidth = Math.max(1.2, w * 0.014);
    ctx.stroke();

    /* roof and rear window */
    ctx.fillStyle = 'hsl(203, 50%, 47%)';
    U.rr(ctx, -w * 0.27, -h * 0.5, w * 0.54, h * 0.13, w * 0.06);
    ctx.fill();

    var glass = ctx.createLinearGradient(0, -h * 0.44, 0, -h * 0.15);
    glass.addColorStop(0, 'rgba(120,170,220,0.55)');
    glass.addColorStop(0.55, 'rgba(20,32,52,0.92)');
    glass.addColorStop(1, 'rgba(35,60,88,0.9)');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, -h * 0.44);
    ctx.lineTo(w * 0.24, -h * 0.44);
    ctx.lineTo(w * 0.2, -h * 0.18);
    ctx.lineTo(-w * 0.2, -h * 0.18);
    ctx.closePath();
    ctx.fill();

    /* moon reflection on the glass */
    ctx.strokeStyle = 'rgba(255,246,218,0.35)';
    ctx.lineWidth = Math.max(1, w * 0.016);
    ctx.beginPath();
    ctx.moveTo(-w * 0.08, -h * 0.41);
    ctx.lineTo(w * 0.02, -h * 0.3);
    ctx.stroke();

    /* tail lights: brighter when off the gas (braking) */
    var brake = U.clamp(1 - this.throttle, 0, 1);
    var tailA = 0.55 + brake * 0.45;
    ctx.fillStyle = 'rgba(255,96,88,' + tailA.toFixed(3) + ')';
    U.rr(ctx, -w * 0.43, -h * 0.02, w * 0.19, h * 0.12, w * 0.045); ctx.fill();
    U.rr(ctx, w * 0.24, -h * 0.02, w * 0.19, h * 0.12, w * 0.045); ctx.fill();
    if (!this.calm) {
      T.glow(ctx, -w * 0.33, h * 0.04, w * 0.34, '#ff6e68', 0.22 + brake * 0.14, 0.3);
      T.glow(ctx, w * 0.33, h * 0.04, w * 0.34, '#ff6e68', 0.22 + brake * 0.14, 0.3);
    }

    /* bumper and plate */
    ctx.fillStyle = 'rgba(12,14,22,0.85)';
    U.rr(ctx, -w * 0.43, h * 0.3, w * 0.86, h * 0.16, w * 0.05);
    ctx.fill();
    ctx.fillStyle = '#f2e6c8';
    U.rr(ctx, -w * 0.1, h * 0.33, w * 0.2, h * 0.08, w * 0.02);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,150,80,0.9)';
    ThemeStar(ctx, 0, h * 0.37, w * 0.035);
    ctx.fill();

    /* little roof antenna with a bead */
    ctx.strokeStyle = 'rgba(230,220,200,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, -h * 0.52);
    ctx.lineTo(w * 0.2, -h * 0.72);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,211,155,0.9)';
    ctx.beginPath();
    ctx.arc(w * 0.2, -h * 0.73, Math.max(1.5, w * 0.022), 0, U.TAU);
    ctx.fill();

    ctx.restore();
  };

  function ThemeStar(ctx, x, y, r) {
    U.starPath(ctx, x, y, r, r * 0.46, 5, 0);
  }

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
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  };

  Car.prototype.drawObstacleCar = function (ctx, w, h, hue) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.45, w * 0.54, h * 0.16, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#08080d';
    U.rr(ctx, -w * 0.5, h * 0.1, w * 0.14, h * 0.28, w * 0.05); ctx.fill();
    U.rr(ctx, w * 0.36, h * 0.1, w * 0.14, h * 0.28, w * 0.05); ctx.fill();

    var body = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    body.addColorStop(0, U.hsl(hue, 30, 24));
    body.addColorStop(0.5, U.hsl(hue, 38, 36));
    body.addColorStop(1, U.hsl(hue, 28, 22));
    ctx.fillStyle = body;
    U.rr(ctx, -w * 0.46, -h * 0.5, w * 0.92, h * 0.92, w * 0.2);
    ctx.fill();

    ctx.fillStyle = 'rgba(141,184,255,0.18)';
    U.rr(ctx, -w * 0.3, -h * 0.4, w * 0.6, h * 0.2, w * 0.06);
    ctx.fill();

    var blink = 0.7 + 0.3 * Math.sin(this.t * 3 + hue);
    ctx.fillStyle = 'rgba(255,110,100,' + blink.toFixed(3) + ')';
    U.rr(ctx, -w * 0.4, h * 0.22, w * 0.17, h * 0.1, w * 0.04); ctx.fill();
    U.rr(ctx, w * 0.23, h * 0.22, w * 0.17, h * 0.1, w * 0.04); ctx.fill();
    if (!this.calm) {
      T.glow(ctx, -w * 0.31, h * 0.27, w * 0.3, '#ff6e68', 0.16, 0.3);
      T.glow(ctx, w * 0.31, h * 0.27, w * 0.3, '#ff6e68', 0.16, 0.3);
    }
  };

  Car.prototype.drawObstacleVan = function (ctx, w, h, hue) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.46, w * 0.54, h * 0.14, 0, 0, U.TAU);
    ctx.fill();

    ctx.fillStyle = '#08080d';
    U.rr(ctx, -w * 0.5, h * 0.16, w * 0.13, h * 0.24, w * 0.04); ctx.fill();
    U.rr(ctx, w * 0.37, h * 0.16, w * 0.13, h * 0.24, w * 0.04); ctx.fill();

    var body = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    body.addColorStop(0, U.hsl(hue, 26, 24));
    body.addColorStop(0.5, U.hsl(hue, 34, 38));
    body.addColorStop(1, U.hsl(hue, 24, 22));
    ctx.fillStyle = body;
    U.rr(ctx, -w * 0.46, -h * 0.52, w * 0.92, h * 0.95, w * 0.12);
    ctx.fill();

    ctx.fillStyle = 'rgba(20,24,40,0.7)';
    U.rr(ctx, -w * 0.3, -h * 0.38, w * 0.6, h * 0.2, w * 0.04);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    U.rr(ctx, -w * 0.38, -h * 0.1, w * 0.76, h * 0.42, w * 0.03);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,110,100,0.85)';
    U.rr(ctx, -w * 0.4, h * 0.32, w * 0.17, h * 0.09, w * 0.03); ctx.fill();
    U.rr(ctx, w * 0.23, h * 0.32, w * 0.17, h * 0.09, w * 0.03); ctx.fill();
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
