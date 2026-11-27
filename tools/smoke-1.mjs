import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.MG_CDP_PORT || 9222);
const SHOTS = path.join(os.tmpdir(), 'magichand-smoke');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = list.find((t) => t.type === 'page' && /MagicHand|index\.html/.test(t.url));
  if (!page) throw new Error('page target not found: ' + JSON.stringify(list.map((t) => t.url)));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id) {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      }
    } else {
      events.push(msg);
    }
  };
  const send = (method, params = {}) => {
    const i = ++id;
    ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((res, rej) => pending.set(i, { resolve: res, reject: rej }));
  };
  return { ws, send, events };
}

const { ws, send, events } = await connect();
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await sleep(1200);

const errors = [];
function collect() {
  for (const e of events) {
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails;
      const top = d.stackTrace && d.stackTrace.callFrames && d.stackTrace.callFrames[0];
      errors.push('EXCEPTION: ' + (d.exception?.description || d.text).split('\n')[0] +
        (top ? ' @ ' + (top.functionName || '?') + ':' + (top.lineNumber + 1) : ''));
    }
    if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') {
      errors.push('LOG: ' + e.params.entry.text);
    }
    if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
      errors.push('CONSOLE: ' + e.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  }
}

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error('eval failed: ' + expr + ' :: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail === undefined ? '' : ' :: ' + JSON.stringify(detail))); }
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOTS, `mg-${name}.png`), Buffer.from(r.data, 'base64'));
}

// ---------------------------------------------------------------- boot state
const boot = await ev(`(() => ({
  hasApp: !!(window.MG && MG.App),
  mode: MG.App && MG.App.mode,
  calibrated: MG.Settings.data.calibrated,
  calibOpen: MG.Calibration.isOpen(),
  size: [MG.App.W, MG.App.H],
  storage: (() => { try { localStorage.setItem('mg-probe','1'); return localStorage.getItem('mg-probe'); } catch (e) { return 'ERR:' + e.name; } })(),
  touchAction: getComputedStyle(document.getElementById('scene')).touchAction
}))()`);
console.log('boot:', JSON.stringify(boot));
check('app booted', boot.hasApp && (boot.mode === 'ready' || boot.mode === 'parent'), boot);
check('localStorage works on file://', boot.storage === '1', boot.storage);
check('touch-action none', boot.touchAction === 'none', boot.touchAction);
check('calibration auto-opens on first run', boot.calibOpen === true, boot);
await shot('01-calibration');

// ------------------------------------------------------------- calibration flow
async function nextStep() {
  const ok = await ev(`(() => { const b = document.querySelector('[data-cal="next"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
  await sleep(120);
  return ok;
}
function pd(id, x, y) { return `document.getElementById('scene').dispatchEvent(new PointerEvent('pointerdown',{pointerId:${id},pointerType:'touch',clientX:${x},clientY:${y},bubbles:true,cancelable:true}));`; }
function pu(id, x, y) { return `window.dispatchEvent(new PointerEvent('pointerup',{pointerId:${id},pointerType:'touch',clientX:${x},clientY:${y},bubbles:true,cancelable:true}));`; }

const cz = await ev(`(() => { const z = MG.App.zone; return { play: z.play, hold: z.hold, pad: MG.App.pad }; })()`);
const holdPt = { x: Math.round(cz.hold.x + cz.hold.w * 0.5), y: Math.round(cz.hold.y + cz.hold.h * 0.5) };

// step 1: welcome -> right
check('advance from welcome', await nextStep());
// step 2: right contact (need canvas of the calibration overlay, which is on top)
await ev(`(() => {
  const c = document.getElementById('calib-canvas');
  const r = c.getBoundingClientRect();
  const sx = r.width / MG.App.W, sy = r.height / MG.App.H;
  const x = (${holdPt.x}) * sx + r.left, y = (${holdPt.y}) * sy + r.top;
  c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:41,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
})()`);
await sleep(160);
check('right side detects contact', await ev(`!document.querySelector('[data-cal="next"]').disabled`));
await ev(pu(41, 100, 100));
await nextStep();
check('left side step active', (await ev(`document.querySelector('.calib-step h3').textContent`)) === 'Test the play side');

await ev(`(() => {
  const c = document.getElementById('calib-canvas');
  const r = c.getBoundingClientRect();
  const sx = r.width / MG.App.W, sy = r.height / MG.App.H;
  const z = MG.App.zone.play;
  const x = (z.x + z.w*0.5) * sx + r.left, y = (z.y + z.h*0.5) * sy + r.top;
  c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:42,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
})()`);
await sleep(160);
check('play side detects contact', await ev(`!document.querySelector('[data-cal="next"]').disabled`));
await ev(pu(42, 100, 100));
await nextStep();
check('both step active', (await ev(`document.querySelector('.calib-step h3').textContent`)) === 'Both at the same time');

// simultaneous: hold + play on the calibration canvas
await ev(`(() => {
  const c = document.getElementById('calib-canvas');
  const r = c.getBoundingClientRect();
  const sx = r.width / MG.App.W, sy = r.height / MG.App.H;
  const z = MG.App.zone;
  const x1 = (z.hold.x + z.hold.w/2) * sx + r.left, y1 = (z.hold.y + z.hold.h/2) * sy + r.top;
  const x2 = (z.play.x + z.play.w*0.5) * sx + r.left, y2 = (z.play.y + z.play.h*0.5) * sy + r.top;
  c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:43,pointerType:'touch',clientX:x1,clientY:y1,bubbles:true,cancelable:true}));
  c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:44,pointerType:'touch',clientX:x2,clientY:y2,bubbles:true,cancelable:true}));
  window.__bothSeen = MG.Calibration.isOpen();
})()`);
await sleep(200);
check('both-sides step satisfied', await ev(`!document.querySelector('[data-cal="next"]').disabled`));
await ev(pu(43, 100, 100) + pu(44, 100, 100));
await nextStep();
check('reach step active', (await ev(`document.querySelector('.calib-step h3').textContent`)) === 'Find a comfortable reach');

// reach: 3 points
for (let i = 0; i < 3; i++) {
  await ev(`(() => {
    const c = document.getElementById('calib-canvas');
    const r = c.getBoundingClientRect();
    const sx = r.width / MG.App.W, sy = r.height / MG.App.H;
    const z = MG.App.zone.play;
    const px = z.x + z.w * (0.35 + ${i} * 0.15), py = z.y + z.h * (0.4 + ${i} * 0.08);
    c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:50+${i},pointerType:'touch',clientX:px*sx+r.left,clientY:py*sy+r.top,bubbles:true,cancelable:true}));
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:50+${i},pointerType:'touch',clientX:px*sx+r.left,clientY:py*sy+r.top,bubbles:true,cancelable:true}));
  })()`);
  await sleep(90);
}
check('reach step collected spots', (await ev(`document.querySelector('.calib-step .detect').textContent.indexOf('comfortable spots') >= 0`)));
await ev(`(() => { const before = JSON.stringify(MG.Settings.data.zone); window.__zoneBefore = before; return before; })()`);
await nextStep();
const zoneAfter = await ev(`(() => JSON.stringify(MG.Settings.data.zone))()`);
console.log('zone before/after:', await ev('window.__zoneBefore'), zoneAfter);
check('reach fitting changed the play area', zoneAfter !== (await ev('window.__zoneBefore')));
check('feel step active', (await ev(`document.querySelector('.calib-step h3').textContent`)) === 'Targets and feel');
await nextStep();
check('done step active', (await ev(`document.querySelector('.calib-step h3').textContent`)) === 'Saved');
await shot('02-calibration-done');
await ev(`document.querySelector('[data-cal="finish"]').click()`);
await sleep(600);
check('calibration saved', await ev(`MG.Settings.data.calibrated === true`));
check('back to play after calibration', (await ev(`MG.App.mode`)) === 'ready');
await shot('03-ready');

// ------------------------------------------------------------------ gameplay
const zones = await ev(`(() => { const z = MG.App.zone; return { play: z.play, hold: z.hold, swapped: z.swapped }; })()`);
const hp = { x: Math.round(zones.hold.x + zones.hold.w * 0.5), y: Math.round(zones.hold.y + zones.hold.h * 0.5) };
const pp = { x: Math.round(zones.play.x + zones.play.w * 0.5), y: Math.round(zones.play.y + zones.play.h * 0.5) };

await ev(pd(1, hp.x, hp.y));
await sleep(400);
const afterHold = await ev(`(() => ({ mode: MG.App.mode, light: MG.App.light, hold: MG.App.holdCount, game: MG.App.game && MG.App.game.id, balloons: MG.App.game && MG.App.game.list ? MG.App.game.list.length : null }))()`);
console.log('after hold:', JSON.stringify(afterHold));
check('holding the switch starts the session', afterHold.mode === 'playing', afterHold);
check('lamp is lit', afterHold.light > 0.5, afterHold.light);
await shot('04-balloons');

// left hand touches -> reward
const before = await ev(`({ pops: MG.App.game.pops || 0, acts: MG.Metrics.live.activations })`);
await ev(pd(2, pp.x, pp.y));
await sleep(300);
const afterTouch = await ev(`({ pops: MG.App.game.pops || 0, acts: MG.Metrics.live.activations, touches: MG.Metrics.live.touches, mode: MG.App.mode })`);
console.log('after touch:', JSON.stringify(before), JSON.stringify(afterTouch));
check('play-side contact gives a reward', afterTouch.acts > before.acts, afterTouch);
await shot('05-balloons-popped');
await ev(pu(2, pp.x, pp.y));

// the popped balloon is replaced inside the play area, not below the screen
const respawn = await ev(`(() => {
  const g = MG.App.game;
  const p = MG.App.zone.play;
  const inView = g.list.filter(function (b) { return b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h; }).length;
  return { count: g.list.length, inView: inView, target: g.targetCount };
})()`);
check('a popped balloon is replaced inside the play area', respawn.count === respawn.target && respawn.inView === respawn.count, respawn);
await sleep(600);
const growState = await ev(`(() => { const l = MG.App.game.list; return { grown: l.filter(function (b) { return b.grow > 0.8; }).length, count: l.length }; })()`);
check('replacement balloons grow in', growState.grown >= growState.count - 1, growState);



// right pointer must not count as left activation even when it drifts across
await ev(`window.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,pointerType:'touch',clientX:${pp.x},clientY:${pp.y},bubbles:true,cancelable:true}))`);
await sleep(100);
const drift = await ev(`({ role: MG.App.touch.pointers.get(1).role, acts: MG.Metrics.live.activations })`);
check('switch pointer keeps its role when it drifts', drift.role === 'hold', drift);

// release the switch -> gentle pause
await ev(pu(1, hp.x, hp.y));
await sleep(2000);
const rest = await ev(`({ mode: MG.App.mode, light: MG.App.light })`);
check('releasing pauses gently', rest.mode === 'resting', rest);
await shot('06-resting');

// resume
await ev(pd(3, hp.x, hp.y));
await sleep(400);
check('re-holding resumes play', (await ev(`MG.App.mode`)) === 'playing');
await ev(pu(3, hp.x, hp.y));

// ---------------------------------------------------------------- other games
for (const id of ['garden', 'stars', 'painting']) {
  await ev(`MG.Settings.set('game', '${id}')`);
  await sleep(250);
  await ev(pd(10, hp.x, hp.y));
  await sleep(350);
  const t1 = await ev(`(() => { const g = MG.App.game; return { id: g.id, mode: MG.App.mode, count: (g.flowers && g.flowers.length) || (g.stars && g.stars.length) || (g.flames && g.flames.length) || (g.bubbles && g.bubbles.length) || 0 }; })()`);
  // give the game a few contacts inside the play area
  for (let i = 0; i < 3; i++) {
    const x = Math.round(zones.play.x + zones.play.w * (0.35 + i * 0.12));
    const y = Math.round(zones.play.y + zones.play.h * (0.45 + i * 0.05));
    await ev(pd(20 + i, x, y));
    await sleep(160);
    await ev(pu(20 + i, x, y));
    await sleep(120);
  }
  const t2 = await ev(`(() => { const g = MG.App.game; return { id: g.id, flowers: g.flowers ? g.flowers.length : null, total: g.total || 0, painted: g.stamps || 0, acts: MG.Metrics.live.activations }; })()`);
  console.log(id, JSON.stringify(t1), JSON.stringify(t2));
  const grew = (t2.flowers !== null && t2.flowers > 0) || (t2.total > 0) || (t2.id === 'painting' && t2.painted > 0);
  check(id + ' responds to play-side contacts', grew, t2);

  await shot('07-' + id);
  await ev(pu(10, hp.x, hp.y));
  await sleep(200);
}

// ----------------------------------------------------------------- magic car
await ev(`MG.Settings.set('game', 'car')`);
await sleep(1800);
await ev(pd(80, hp.x, hp.y));
await sleep(500);
const carInfo = await ev(`(() => {
  const g = MG.App.game;
  var info = window.MG.Car3DInfo || {};
  return {
    id: g.id, is3D: !!g.is3D, holdStyle: g.holdStyle, model: g.model, color: g.color,
    throttle: +g.throttle.toFixed(2), speed: Math.round(g.speed), mode: MG.App.mode,
    loaded: Object.keys(info.models || {}).filter(function (k) { return !!info.models[k]; }),
    failed: info.failed || {}
  };
})()`);
console.log('magic car:', JSON.stringify(carInfo));
check('magic car runs the 3D scene', carInfo.id === 'car' && carInfo.is3D === true, carInfo);
check('magic car loads its 3D models', carInfo.loaded.length >= 4, carInfo);
check('magic car puts a gas pedal on the hold side', carInfo.holdStyle === 'pedal', carInfo);
check('the held button drives the car', carInfo.throttle > 0.4 && carInfo.speed > 0, carInfo);

// left-hand steering: the play contact maps across the road
const steerY = Math.round(zones.play.y + zones.play.h * 0.62);
await ev(pd(81, Math.round(zones.play.x + 10), steerY));
await sleep(600);
const steerLeft = await ev(`MG.App.game.carU`);
await ev(`window.dispatchEvent(new PointerEvent('pointermove',{pointerId:81,pointerType:'touch',clientX:${Math.round(zones.play.x + zones.play.w - 10)},clientY:${steerY},bubbles:true,cancelable:true}))`);
await sleep(700);
const steerRight = await ev(`MG.App.game.carU`);
console.log('steering:', steerLeft, steerRight);
check('steering follows the play-side hand', steerLeft < 0.35 && steerRight > 0.65, { steerLeft, steerRight });

// traffic in the 3D lanes for the screenshot
await ev(`(() => {
  const g = MG.App.game;
  g.clearObstacles();
  g.makeObstacle('van', 0, -24);
  g.makeObstacle('sedan', 1, -38);
  g.makeObstacle('suv', 2, -54);
  return 1;
})()`);
await sleep(200);
await shot('07b-car');
await ev(pu(81, Math.round(zones.play.x + zones.play.w - 10), steerY));

// letting go of the pedal only coasts the car: no dimming, no resting
await ev(pu(80, hp.x, hp.y));
await sleep(2200);
const carCoast = await ev(`(() => {
  const g = MG.App.game;
  return {
    mode: MG.App.mode, light: +MG.App.light.toFixed(2), dark: +MG.App.dark.toFixed(2),
    speed: Math.round(g.speed), base: Math.round(g.speedBase), model: g.model, color: g.color
  };
})()`);
console.log('coast:', JSON.stringify(carCoast));
check('letting go of the pedal keeps the play side lit and playing', carCoast.mode === 'playing' && carCoast.light > 0.95 && carCoast.dark < 0.05, carCoast);
check('letting go of the pedal brings the car to a stop', carCoast.speed < carCoast.base * 0.25, carCoast);
check('the car is the red VW up', carCoast.model === 'vw-up' && carCoast.color === 'red', carCoast);

// re-press for the crash tests
await ev(pd(80, hp.x, hp.y));
await sleep(500);

// crashing is the reward: it bursts the obstacle and lights a sky star
const carBump = await ev(`(() => {
  const g = MG.App.game;
  g.clearObstacles();
  g.carU = 0.5; g.carGroup.position.x = 0;
  g.starsLit = 0; g.skyGlow = 0; g.cycle = 0;
  g.starFly = null; g.bump = 0;
  const o = g.makeObstacle('van', 1, 0);
  for (let i = 0; i < 8; i++) g.update(1 / 60);
  return {
    hit: o.hit, bump: +g.bump.toFixed(2), stars: g.starsLit, mode: MG.App.mode,
    fly: g.starFly ? { t: +g.starFly.t.toFixed(2) } : null,
    cheer: +g.cheer.toFixed(2), dog: +g.dogJoy.toFixed(2), friends: g.friends.length
  };
})()`);
check('crashing bursts the obstacle and lights a star', carBump.hit === true && carBump.bump > 0 && carBump.stars > 0 && carBump.mode === 'playing', carBump);
check('a crash sends a star flying to the sky', carBump.fly !== null, carBump);
check('the crash wakes the dog and friends', carBump.cheer > 0 && carBump.dog > 0 && carBump.friends >= 3, carBump);

// a fresh crash for the screenshot, so the burst is caught mid-air
await ev(`(() => {
  const g = MG.App.game;
  g.clearObstacles();
  const o = g.makeObstacle('suv', 1, 1);
  g.smash(o);
  return 1;
})()`);
await sleep(90);
await shot('07c-car-crash');

// a touch away from traffic honks and flashes instead of failing
const carHonk = await ev(`(() => {
  const g = MG.App.game;
  g.clearObstacles(); g.honk = 0;
  const ok = g.activate(g.play.x + g.play.w * 0.5, g.play.y + g.play.h * 0.5);
  return { ok, honk: +g.honk.toFixed(2) };
})()`);
check('a touch away from traffic honks the car', carHonk.ok === true && carHonk.honk > 0, carHonk);

// six crashes complete the sky picture, then it fades and renews
const sky = await ev(`(() => {
  const g = MG.App.game;
  g.starsLit = 5; g.skyGlow = 0; g.cycle = 0;
  g.lightStar();
  return { stars: g.starsLit, glow: +g.skyGlow.toFixed(1) };
})()`);
check('six crashes complete the sky picture', sky.stars === 6 && sky.glow > 0, sky);
await shot('07d-car-sky');
const skyAfter = await ev(`(() => {
  const g = MG.App.game;
  g.skyGlow = 0.01;
  g.update(0.05);
  return { stars: g.starsLit, cycle: g.cycle };
})()`);
check('the sky picture fades and the drive renews', skyAfter.stars === 0 && skyAfter.cycle === 1, skyAfter);
await ev(pu(80, hp.x, hp.y));

// ------------------------------------------------------------- picture pairs
await ev(`(() => { MG.Settings.set('game','photos'); MG.Settings.set('targetSize','large'); MG.App.toReady(); return 1; })()`);
await sleep(500);
await ev(pd(60, 40, 40));
await sleep(150);
await ev(pu(60, 40, 40));
await sleep(900);
const photoInfo = await ev(`(() => { const g = MG.App.game; return { id: g.id, full: g.fullScreen, pairs: g.pairs.length, mode: MG.App.mode, holdReq: MG.App.holdRequiredNow() }; })()`);
console.log('picture pairs:', JSON.stringify(photoInfo));
check('picture pairs uses the whole screen without the hold button', photoInfo.id === 'photos' && photoInfo.full === true && photoInfo.holdReq === false && photoInfo.pairs > 0, photoInfo);

const uniquePairs = await ev(`(() => { const g = MG.App.game; const ids = g.pairs.map(p => p.pic.id); return { ids: ids, unique: new Set(ids).size === ids.length }; })()`);
check('picture pairs shows each picture only once', uniquePairs.unique, uniquePairs);

const beforeCapture = await ev(`MG.App.game.captured`);
if (photoInfo.pairs >= 2) {
  const two = await ev(`(() => { const g = MG.App.game; function c(k){ return { x: Math.round(k.x), y: Math.round(k.y) }; } return { a: c(g.pairs[0].left), b: c(g.pairs[1].right) }; })()`);
  await ev(pd(70, two.a.x, two.a.y));
  await ev(pd(71, two.b.x, two.b.y));
  await sleep(700);
  const mis = await ev(`MG.App.game.captured`);
  check('holding two different pictures does not capture', mis === beforeCapture, { mis: mis, before: beforeCapture });
  await ev(pu(70, two.a.x, two.a.y));
  await ev(pu(71, two.b.x, two.b.y));
  await sleep(250);
}

const match = await ev(`(() => { const g = MG.App.game; return { left: { x: Math.round(g.pairs[0].left.x), y: Math.round(g.pairs[0].left.y) }, right: { x: Math.round(g.pairs[0].right.x), y: Math.round(g.pairs[0].right.y) } }; })()`);
await ev(pd(72, match.left.x, match.left.y));
await ev(pd(73, match.right.x, match.right.y));
await sleep(800);
const cap = await ev(`MG.App.game.captured`);
check('holding the same picture on both halves captures it', cap === beforeCapture + 1, { cap: cap, before: beforeCapture });
await ev(pu(72, match.left.x, match.left.y));
await ev(pu(73, match.right.x, match.right.y));
await sleep(400);
await sleep(900);
const uniqueAfter = await ev(`(() => { const g = MG.App.game; const ids = g.pairs.map(p => p.pic.id); return { ids: ids, unique: new Set(ids).size === ids.length }; })()`);
check('picture pairs stays unique after a capture replaces the picture', uniqueAfter.unique, uniqueAfter);

// album pages: fill to one short of capacity, then one more starts a page turn
const album = await ev(`(() => {
  const g = MG.App.game;
  g.album = []; g.pending = []; g.turning = false; g.turnT = 0;
  for (let i = 0; i < g.albumCap - 1; i++) g.addToAlbum(g.pictures[i % g.pictures.length]);
  const before = { turning: g.turning, size: g.album.length };
  g.addToAlbum(g.pictures[0]);
  return { before, turning: g.turning, size: g.album.length };
})()`);
check('album fills before a page turn', album.before.turning === false && album.before.size === 5 && album.turning === true, album);
await sleep(1200);
const pageTurn = await ev(`(() => ({ size: MG.App.game.album.length, pages: MG.App.game.pages, turning: MG.App.game.turning }))()`);
check('album turns to a fresh page', pageTurn.pages === 1 && pageTurn.turning === false, pageTurn);
await ev(`(() => { const g = MG.App.game; for (let i = 0; i < 3; i++) g.addToAlbum(g.pictures[i % g.pictures.length]); return g.album.length; })()`);
await sleep(250);

await shot('08-photos');
await ev(`MG.App.toReady()`);
await sleep(200);

// -------------------------------------------------------- renewing loops
// Hold-free play so scene time advances at full speed during these checks.
await ev(`(() => { MG.Settings.set('holdRequired', false); MG.App.startSession(); return MG.App.mode; })()`);
await sleep(300);

await ev(`MG.Settings.set('game', 'balloons')`);
await sleep(250);
const salute = await ev(`(() => {
  const g = MG.App.game;
  for (let i = 0; i < 12; i++) { const b = g.list[0]; if (!b) break; g.pop(b, b.x, b.y); }
  return { since: g.sinceSalute, salute: g.salute, pops: g.pops };
})()`);
check('balloons salute the sky every dozen pops', salute.since === 0 && salute.salute > 0, salute);
await shot('08-cycle-balloons');

await ev(`MG.Settings.set('game', 'garden')`);
await sleep(300);
const gardenCycle = await ev(`(() => {
  const g = MG.App.game;
  g.flowers = [];
  g.slots.forEach(s => { s.used = false; });
  g.renewIn = 0; g.seeding = false; g.cycle = 0;
  g.slots.forEach(s => { const q = g.slotPos(s); g.activate(q.x, q.y); });
  const planted = g.flowers.length;
  g.renewIn = 0.05;
  return { planted, slots: g.slots.length };
})()`);
await sleep(3600);
const gardenAfter = await ev(`(() => {
  const g = MG.App.game;
  return { flowers: g.flowers.length, free: g.slots.filter(s => !s.used).length, cycle: g.cycle };
})()`);
check('garden renews instead of running out',
  gardenCycle.planted === gardenCycle.slots && gardenAfter.free > 0 && gardenAfter.cycle >= 1,
  { ...gardenCycle, ...gardenAfter });
await shot('08-cycle-garden');

await ev(`MG.Settings.set('game', 'stars')`);
await sleep(300);
const starCycle = await ev(`(() => {
  const g = MG.App.game;
  const needed = 6;
  let guard = 0;
  while (g.skyProgress < needed && guard++ < 24) {
    let s = g.stars[0];
    if (!s) { s = g.makeStar(); if (!s) break; g.stars.push(s); }
    g.activate(s.x, s.y);
  }
  return { progress: g.skyProgress, reset: g.skyResetAt, cycle: g.cycle };
})()`);
check('stars complete a constellation', starCycle.progress === 6 && starCycle.reset > 0, starCycle);
await sleep(300);
await shot('08-cycle-stars');
await sleep(2300);
const starAfter = await ev(`(() => ({ cycle: MG.App.game.cycle, progress: MG.App.game.skyProgress }))()`);
check('a new constellation starts after completion', starAfter.cycle === 1 && starAfter.progress === 0, starAfter);

await ev(`MG.Settings.set('holdRequired', true)`);
await sleep(200);

// ------------------------------------------------------------------ parent gate
await ev(`MG.Settings.set('game', 'balloons')`);
await sleep(200);
const padPt = await ev(`(() => ({ x: MG.App.pad.x, y: MG.App.pad.y }))()`);
await ev(pd(30, padPt.x, padPt.y));
await sleep(90);
await ev(pu(30, padPt.x, padPt.y));
await sleep(300);
const gate = await ev(`(() => ({
  mode: MG.App.mode,
  gate: MG.ParentGate.isOpen(),
  open: MG.ParentUI.isOpen()
}))()`);
console.log('gate:', JSON.stringify(gate));
check('parent settings are protected by a maths check', gate.gate === true && gate.open === false, gate);
await shot('08-parent-gate');

await ev(`(() => { document.querySelector('[data-gate-digit="1"]').click(); document.querySelector('[data-gate="enter"]').click(); })()`);
const wrong = await ev(`(() => ({ gate: MG.ParentGate.isOpen(), error: document.getElementById('gate-error').textContent }))()`);
check('a wrong answer keeps the check open', wrong.gate === true && wrong.error.length > 0, wrong);

const solved = await ev(`(() => {
  const q = document.getElementById('gate-question').textContent;
  const m = q.match(/(\\d+)\\s*\\+\\s*(\\d+)/);
  const sum = m ? Number(m[1]) + Number(m[2]) : 0;
  document.querySelector('[data-gate="clear"]').click();
  String(sum).split('').forEach(function (d) {
    document.querySelector('[data-gate-digit="' + d + '"]').click();
  });
  document.querySelector('[data-gate="enter"]').click();
  return { q: q, sum: sum, gate: MG.ParentGate.isOpen(), open: MG.ParentUI.isOpen() };
})()`);
check('the maths check opens the dashboard', solved.gate === false && solved.open === true, solved);
await shot('08-parent-play');

// dashboard tabs render
for (const tab of ['play', 'pictures', 'access', 'calibrate', 'touch', 'data', 'help']) {
  await ev(`document.querySelector('[data-tab="${tab}"]').click()`);
  await sleep(220);
  const len = await ev(`document.getElementById('parent-body').innerHTML.length`);
  check('dashboard tab renders: ' + tab, len > 200, len);
  if (tab === 'access' || tab === 'data' || tab === 'touch') await shot('09-tab-' + tab);
}

// settings changes take effect
await ev(`document.querySelector('[data-tab="access"]').click()`);
await sleep(250);
await ev(`(() => { const b = document.querySelector('[data-set="swapSides"]'); if (!b) throw new Error('missing swap control'); b.click(); })()`);
await sleep(250);
check('swap sides applies', (await ev(`MG.Settings.data.swapSides`)) === true);
check('zones swap', (await ev(`MG.App.zone.swapped`)) === true);
await shot('10-access-swapped');
await ev(`(() => { MG.Settings.set('swapSides', false); })()`);

// touch test lab exists
await ev(`document.querySelector('[data-tab="touch"]').click()`);
await sleep(300);
check('touch lab canvas active', await ev(`!!document.getElementById('lab-canvas') && !!MG.ParentUI`));

// close back to play
await ev(`document.querySelector('[data-action="close"]').click()`);
await sleep(400);
const closeMode = await ev(`({ mode: MG.App.mode, open: MG.ParentUI.isOpen(), game: MG.App.gameId, hold: MG.App.holdCount })`); console.log('close state:', JSON.stringify(closeMode)); check('closing dashboard returns to play', closeMode.mode === 'ready' && closeMode.open === false, closeMode);
await shot('11-back-to-play');

// ------------------------------------------------------------- scene tray
check('scene tray is present', await ev(`!!document.getElementById('scene-tray')`));
check('the scene tray lists magic car', await ev(`!!document.querySelector('#scene-tray [data-game="car"]')`));
const traySpace = await ev(`({ bottom: MG.App.zone.bottom, tray: MG.Tray.inset() })`);
check('tray reserves space below the scene', traySpace.bottom >= 40, traySpace);
check('tray has no settings button', await ev(`!document.querySelector('#scene-tray [data-tray="menu"]')`));

const traySwitch = await ev(`(() => {
  const b = document.querySelector('#scene-tray [data-game="garden"]');
  if (!b) return { ok: false };
  b.click();
  return { game: MG.Settings.data.game, id: MG.App.gameId, on: b.classList.contains('on') };
})()`);
check('tray switches games instantly', traySwitch.game === 'garden' && traySwitch.id === 'garden' && traySwitch.on === true, traySwitch);
await sleep(300);
await shot('11-tray-garden');

// ---------------------------------------------------------------- stars reach & sizes
await ev(`(() => { MG.Settings.set('game','stars'); MG.Settings.set('starReach', 1); MG.Settings.set('targetSize','xlarge'); MG.Settings.set('holdRequired', false); })()`);
await sleep(500);
const starsInfo = await ev(`(() => { const g = MG.App.game; return { id: g.id, stars: g.stars.length, R: Math.round(g.R), cx: Math.round(g.cx), mode: MG.App.mode, light: MG.App.light }; })()`);
console.log('stars:', JSON.stringify(starsInfo));
check('stars game builds large targets', starsInfo.stars >= 1 && starsInfo.R > 40, starsInfo);
await shot('12-stars');
await ev(`(() => { MG.Settings.set('targetSize','medium'); MG.Settings.set('starReach', 5); })()`);
await sleep(400);
const starsFar = await ev(`Math.round(MG.App.game.cx - MG.App.game.stars[0].x)`);
console.log('reach shift:', starsFar);
await shot('13-stars-far');

// ---------------------------------------------------------------- linger + errors
await sleep(1200);
collect();
const realErrors = errors.filter((e) => !/favicon/i.test(e));
check('no page errors', realErrors.length === 0, realErrors);
console.log('\nERRORS:', realErrors.length ? realErrors.join('\n') : 'none');
console.log('FAILURES:', failures);
ws.close();
process.exit(failures ? 1 : 0);
