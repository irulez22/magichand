import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.MG_CDP_PORT || 9222);
const SHOTS = path.join(os.tmpdir(), 'magichand-smoke');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = list.find((t) => t.type === 'page' && /MagicHand|index\.html/.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id) {
    const p = pending.get(msg.id);
    if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
  } else events.push(msg);
};
const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res, rej) => pending.set(i, { resolve: res, reject: rej }));
};
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + expr.slice(0, 120) + ' :: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail === undefined ? '' : ' :: ' + JSON.stringify(detail))); }
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOTS, `mg2-${name}.png`), Buffer.from(r.data, 'base64'));
}
const pd = (id, x, y) => `document.getElementById('scene').dispatchEvent(new PointerEvent('pointerdown',{pointerId:${id},pointerType:'touch',clientX:${x},clientY:${y},bubbles:true,cancelable:true}));`;
const pm = (id, x, y) => `window.dispatchEvent(new PointerEvent('pointermove',{pointerId:${id},pointerType:'touch',clientX:${x},clientY:${y},bubbles:true,cancelable:true}));`;
const pu = (id, x, y) => `window.dispatchEvent(new PointerEvent('pointerup',{pointerId:${id},pointerType:'touch',clientX:${x},clientY:${y},bubbles:true,cancelable:true}));`;
const pc = (id, x, y) => `window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:${id},pointerType:'touch',clientX:${x},clientY:${y},bubbles:true,cancelable:true}));`;

// reset to defaults, pretend calibration is done so it does not auto-open on reload
await ev(`(() => { MG.Settings.reset(); MG.Settings.data.calibrated = true; MG.Settings.data.targetSize = 'large'; MG.Settings.data.game='balloons'; MG.Settings.data.holdRequired = true; MG.Settings.save(true); MG.Settings.emit(); return 1; })()`);
await sleep(400);

const z = await ev(`(() => { const z = MG.App.zone; return { play: z.play, hold: z.hold, W: MG.App.W, H: MG.App.H }; })()`);
const holdPt = { x: Math.round(z.hold.x + z.hold.w / 2), y: Math.round(z.hold.y + z.hold.h / 2) };
const playPt = { x: Math.round(z.play.x + z.play.w / 2), y: Math.round(z.play.y + z.play.h / 2) };
const corner = { x: Math.round(z.play.x + 12), y: Math.round(z.play.y + z.play.h - 12) };

// ------------------------------------------------------------ real CDP touch
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: holdPt.x, y: holdPt.y, id: 1, radiusX: 20, radiusY: 20, force: 1 }] });
await sleep(400);
const realTouch = await ev(`(() => ({ pointers: MG.App.touch.pointers.size, hold: MG.App.holdCount, mode: MG.App.mode, light: MG.App.light }))()`);
console.log('real touch:', JSON.stringify(realTouch));
check('CDP touch drives the switch', realTouch.hold === 1 && realTouch.mode === 'playing', realTouch);

await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
  { x: holdPt.x, y: holdPt.y, id: 1, radiusX: 20, radiusY: 20, force: 1 },
  { x: playPt.x, y: playPt.y, id: 2, radiusX: 20, radiusY: 20, force: 1 }
] });
await sleep(450);
const realMulti = await ev(`(() => ({ pointers: MG.App.touch.pointers.size, hold: MG.App.holdCount, play: MG.App.playCount, acts: MG.Metrics.live.activations, max: MG.App.touch.maxSimultaneous }))()`);
console.log('real multi:', JSON.stringify(realMulti));
check('two real touch points at once', realMulti.pointers === 2 && realMulti.hold === 1 && realMulti.play === 1, realMulti);
check('second contact gave a reward', realMulti.acts >= 1, realMulti);
await shot('01-multitouch');

await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: holdPt.x, y: holdPt.y, id: 1, radiusX: 20, radiusY: 20, force: 1 }] });
await sleep(300);
const afterEnd = await ev(`(() => ({ pointers: MG.App.touch.pointers.size, play: MG.App.playCount, hold: MG.App.holdCount, mode: MG.App.mode }))()`);
console.log('after touchEnd:', JSON.stringify(afterEnd));
check('touchEnd releases only the named contact', afterEnd.pointers === 1 && afterEnd.hold === 0, afterEnd);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(100);
check('all real contacts released', (await ev(`MG.App.touch.pointers.size`)) === 0);

// ------------------------------------------------------------- pointercancel
await ev(pd(7, holdPt.x, holdPt.y));
await sleep(300);
await ev(pc(7, holdPt.x, holdPt.y));
await sleep(150);
check('pointercancel clears the contact', (await ev(`MG.App.touch.pointers.size`)) === 0);

// -------------------------------------------------------------- dwell mode
await ev(`(() => { MG.Settings.set('activation','dwell'); MG.Settings.set('dwellTime', 0.4); MG.Settings.set('game','stars'); })()`);
await sleep(300);
await ev(pd(11, holdPt.x, holdPt.y));
await sleep(350);
const beforeDwell = await ev(`MG.Metrics.live.activations`);
await ev(pd(12, playPt.x, playPt.y));
await sleep(260);
const midDwell = await ev(`(() => ({ acts: MG.Metrics.live.activations, dwell: MG.App.touch.pointers.get(12) ? MG.App.touch.pointers.get(12).dwell : null }))()`);
check('dwell does not fire early', midDwell.acts === beforeDwell, midDwell);
await sleep(400);
const afterDwell = await ev(`(() => ({ acts: MG.Metrics.live.activations, total: MG.App.game.total }))()`);
console.log('dwell:', beforeDwell, JSON.stringify(midDwell), JSON.stringify(afterDwell));
check('dwell fires after the set time', afterDwell.acts > beforeDwell, afterDwell);
await shot('02-dwell');
await ev(pu(12, playPt.x, playPt.y));

// --------------------------------------------------------- continuous mode
await ev(`(() => { MG.Settings.set('activation','continuous'); MG.Settings.set('reward','high'); MG.Settings.set('game','garden'); })()`);
await sleep(300);
await ev(pd(13, playPt.x + 20, playPt.y));
await sleep(1200);
const cont = await ev(`(() => ({ acts: MG.Metrics.live.activations, flowers: MG.App.game.flowers ? MG.App.game.flowers.length : -1, game: MG.App.game.id }))()`);
console.log('continuous:', JSON.stringify(cont));
check('continuous mode keeps rewarding', cont.flowers >= 2, cont);
await ev(pu(13, playPt.x + 20, playPt.y));
await ev(pu(11, holdPt.x, holdPt.y));
await ev(pu(12, playPt.x, playPt.y));
await sleep(200);

// ------------------------------------------------------------ anyTouch off
await ev(`(() => { MG.Settings.set('activation','new'); MG.Settings.set('anyTouch', false); MG.Settings.set('game','balloons'); })()`);
await sleep(300);
await ev(`(() => { const b = MG.App.game; b.list.forEach(function (x) { x.x = MG.App.zone.play.x + MG.App.zone.play.w * 0.7; x.baseX = x.x; }); })()`);
const beforeMiss = await ev(`MG.Metrics.live.activations`);
await ev(pd(14, corner.x, corner.y));
await sleep(220);
const miss = await ev(`MG.Metrics.live.activations`);
check('a touch away from every target gives no reward when anyTouch is off', miss === beforeMiss, { beforeMiss, miss });
await ev(pu(14, corner.x, corner.y));
await ev(`MG.Settings.set('anyTouch', true)`);

// --------------------------------------------------- session end celebration
await ev(`(() => { MG.Settings.set('sessionMinutes', 2); })()`);
await sleep(200);
await ev(pd(15, holdPt.x, holdPt.y));
await sleep(500);
const sessionsBefore = await ev(`MG.Metrics.data.totals.sessions`);
await ev(`(() => { MG.App.session.limitMs = MG.App.session.playMs + 700; })()`);
await sleep(1600);
const ended = await ev(`(() => ({ mode: MG.App.mode, sessions: MG.Metrics.data.totals.sessions, running: MG.App.session.running }))()`);
console.log('ended:', JSON.stringify(ended), 'sessionsBefore', sessionsBefore);
check('session limit ends play calmly', ended.mode === 'ended' && ended.running === false, ended);
check('session metrics recorded', ended.sessions === sessionsBefore + 1, ended);
await shot('03-ended');

// let it go back to ready (needs release + 3s)
await ev(pu(15, holdPt.x, holdPt.y));
await sleep(3800);
check('returns to a fresh ready screen', (await ev(`MG.App.mode`)) === 'ready');

// ------------------------------------------------------ switch-free play
await ev(`(() => { MG.Settings.set('holdRequired', false); MG.Settings.set('game','painting'); })()`);
await sleep(700);
check('switch-free mode stays awake', (await ev(`MG.App.light`)) > 0.8);
await ev(pd(16, playPt.x, playPt.y));
await sleep(200);
await ev(pm(16, playPt.x + 120, playPt.y + 30));
await sleep(200);
const painted = await ev(`(() => ({ stamps: MG.App.game.stamps, mode: MG.App.mode }))()`);
check('single-pointer painting works without the switch', painted.stamps > 1 && painted.mode === 'playing', painted);
for (let i = 0; i < 14; i++) {
  await ev(pm(16, playPt.x + 120 + i * 14, playPt.y + 30 + Math.sin(i) * 40));
  await sleep(25);
}
await ev(pu(16, playPt.x + 300, playPt.y + 30));
await shot('04-painting-trail');

// ------------------------------------------------------------------- goats
await ev(`(() => { MG.Settings.set('game','goats'); })()`);
await sleep(350);
const goatsIdle = await ev(`(() => ({ id: MG.App.gameId, phase: MG.App.game.phase, index: MG.App.game.goatIndex }))()`);
check('goats scene waits for the first goat', goatsIdle.id === 'goats' && goatsIdle.phase === 'idle' && goatsIdle.index === 0, goatsIdle);
await ev(`(() => {
  const g = MG.App.game;
  g.walkInTime = 0.08; g.answerTime = 0.08; g.passTime = 0.08;
  g.nextTime = 0.08; g.finaleTime = 0.08; g.duskTime = 0.12;
  g.activate(g.play.x + 20, g.play.y + 20);
})()`);
await sleep(260);
const goatsAsk = await ev(`(() => ({ phase: MG.App.game.phase, who: MG.App.game.line && MG.App.game.line.who }))()`);
check('goat reaches the troll question', goatsAsk.phase === 'challenge' && goatsAsk.who === 'troll', goatsAsk);
await shot('05-goats-question');
const goatsAnswer = await ev(`(() => {
  const g = MG.App.game;
  g.activate(200, 200);
  return { phase: g.phase, who: g.line && g.line.who };
})()`);
check('a contact lets the goat answer', goatsAnswer.phase === 'answer' && goatsAnswer.who === 'goat', goatsAnswer);
await shot('05-goats-answer');

await sleep(420);
for (let i = 0; i < 2; i++) {
  await ev(`(() => { const g = MG.App.game; g.activate(g.play.x + 20, g.play.y + 20); })()`);
  await sleep(320);
  await ev(`MG.App.game.activate(200, 200)`);
  await sleep(420);
}
const goatsAfter = await ev(`(() => ({ index: MG.App.game.goatIndex, done: MG.App.game.done.slice(), phase: MG.App.game.phase }))()`);
console.log('goats after three:', JSON.stringify(goatsAfter));
await sleep(1200);
const goatsCycle = await ev(`(() => ({ cycle: MG.App.game.cycle, index: MG.App.game.goatIndex, phase: MG.App.game.phase }))()`);
check('the herd renews after all three cross', goatsCycle.cycle >= 1 && goatsCycle.index === 0 && goatsCycle.phase === 'idle', goatsCycle);
await shot('05-goats');

// --------------------------------------------------------------- resize
await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 640, deviceScaleFactor: 1, mobile: false });
await sleep 	(400);
const resized = await ev(`(() => ({ W: MG.App.W, H: MG.App.H, play: MG.App.zone.play, correct: MG.App.canvas.width }))()`);
console.log('resized:', JSON.stringify(resized));
check('layout recalculates after resize', resized.W === 1024 && resized.correct === 1024, resized);
await shot('06-resized-1024');
await send('Emulation.clearDeviceMetricsOverride');
await sleep(300);

// ------------------------------------------------------------- persistence
const beforeReload = await ev(`(() => ({ acts: MG.Metrics.data.totals.activations, sessions: MG.Metrics.data.totals.sessions, calibrated: MG.Settings.data.calibrated, game: MG.Settings.data.game }))()`);
await send('Page.reload');
await sleep(1600);
const afterReload = await ev(`(() => ({ acts: MG.Metrics.data.totals.activations, sessions: MG.Metrics.data.totals.sessions, calibrated: MG.Settings.data.calibrated, game: MG.Settings.data.game, mode: MG.App.mode, calibOpen: MG.Calibration.isOpen() }))()`);
console.log('persistence:', JSON.stringify(beforeReload), JSON.stringify(afterReload));
check('settings persist across reload', afterReload.calibrated === true && afterReload.game === beforeReload.game, afterReload);
check('metrics persist across reload', afterReload.acts >= beforeReload.acts && afterReload.sessions >= beforeReload.sessions, afterReload);
check('no calibration popup on later launches', afterReload.calibOpen === false, afterReload);

// ------------------------------------------------------- parent dashboard numbers
const pad = await ev(`(() => ({ x: MG.App.pad.x, y: MG.App.pad.y }))()`);
await ev(pd(40, pad.x, pad.y));
await sleep(90);
await ev(pu(40, pad.x, pad.y));
await sleep(350);
check('settings stay behind the maths check', (await ev(`MG.ParentGate.isOpen()`)) === true);
await ev(`(() => {
  const q = document.getElementById('gate-question').textContent;
  const m = q.match(/(\\d+)\\s*\\+\\s*(\\d+)/);
  const sum = Number(m[1]) + Number(m[2]);
  String(sum).split('').forEach(function (d) {
    document.querySelector('[data-gate-digit="' + d + '"]').click();
  });
  document.querySelector('[data-gate="enter"]').click();
})()`);
await sleep(350);
check('dashboard reopens', (await ev(`MG.ParentUI.isOpen()`)) === true);
await ev(`document.querySelector('[data-tab="data"]').click()`);
await sleep(300);
const dataText = await ev(`document.getElementById('parent-body').innerText`);
check('progress tab shows recorded sessions', /Sessions/.test(dataText) && !/No sessions recorded yet/.test(dataText), dataText.slice(0, 200));
await shot('07-parent-data');
await ev(`document.querySelector('[data-action="close"]').click()`);
await sleep(300);

// ------------------------------------------------------------------- errors
const errors = [];
for (const e of events) {
  if (e.method === 'Runtime.exceptionThrown') {
    const d = e.params.exceptionDetails;
    const top = d.stackTrace && d.stackTrace.callFrames && d.stackTrace.callFrames[0];
    errors.push('EXCEPTION: ' + (d.exception?.description || d.text).split('\n')[0] +
      (top ? ' @ ' + (top.functionName || '?') + ':' + (top.lineNumber + 1) : ''));
  }
  if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') errors.push('LOG: ' + e.params.entry.text);
}
const real = errors.filter((x) => !/favicon/i.test(x));
check('no page errors', real.length === 0, real);
console.log('\nERRORS:', real.length ? real.join('\n') : 'none');
console.log('FAILURES:', failures);
ws.close();
process.exit(failures ? 1 : 0);

