/* Magic Hand Play - gentle synthesised sounds (WebAudio). No audio files needed. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';

  var A = {};
  MG.Audio = A;

  A.ctx = null;
  A.master = null;
  A.level = 'normal';
  A._noise = null;
  A._last = {};
  A.unsupported = false;

  var SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

  function noteFreq(step, octave) {
    var semi = SCALE[Math.abs(step) % SCALE.length] + 12 * (octave || 0);
    return 261.63 * Math.pow(2, semi / 12);
  }

  A.noteFreq = noteFreq;

  A.init = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') { A.ctx.resume().catch(function () {}); }
      return A.ctx;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) { A.unsupported = true; return null; }
    try { A.ctx = new Ctor(); }
    catch (e) { A.unsupported = true; return null; }

    var comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.connect(A.ctx.destination);

    A.master = A.ctx.createGain();
    A.master.gain.value = 0;

    /* A small, warm room: dry signal plus a short, softly decaying tail.
       The impulse is generated here, so there is still no audio file. */
    var dry = A.ctx.createGain();
    dry.gain.value = 1;
    A.master.connect(dry);
    dry.connect(comp);

    try {
      var wet = A.ctx.createGain();
      wet.gain.value = 0.16;
      var verb = A.ctx.createConvolver();
      verb.buffer = makeImpulse(1.9, 2.6);
      A.master.connect(verb);
      verb.connect(wet);
      wet.connect(comp);
    } catch (e) { /* optional polish only */ }

    // One second of noise, reused for pops and brush sounds.
    var len = Math.floor(A.ctx.sampleRate * 0.6);
    A._noise = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    var ch = A._noise.getChannelData(0);
    for (var i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;

    A.applyLevel(true);
    return A.ctx;
  };

  /* Soft stereo room impulse: early reflections plus a smooth tail. */
  function makeImpulse(seconds, decay) {
    var rate = A.ctx.sampleRate;
    var n = Math.floor(rate * seconds);
    var buf = A.ctx.createBuffer(2, n, rate);
    for (var c = 0; c < 2; c++) {
      var data = buf.getChannelData(c);
      for (var i = 0; i < n; i++) {
        var t = i / n;
        var env = Math.pow(1 - t, decay) * (1 - Math.exp(-i / (rate * 0.006)));
        data[i] = (Math.random() * 2 - 1) * env * 0.5;
      }
      /* a couple of gentle early reflections */
      [0.011, 0.019, 0.031].forEach(function (s, k) {
        var idx = Math.floor(s * rate) + c * 13;
        if (idx < n) data[idx] += (k % 2 ? -1 : 1) * (0.35 - k * 0.08);
      });
    }
    return buf;
  }

  A.setLevel = function (level) {
    A.level = level === 'off' || level === 'quiet' ? level : 'normal';
    A.applyLevel();
  };

  A.applyLevel = function (fade) {
    if (!A.ctx || !A.master) return;
    var target = A.level === 'off' ? 0 : (A.level === 'quiet' ? 0.16 : 0.42);
    var now = A.ctx.currentTime;
    try {
      A.master.gain.cancelScheduledValues(now);
      A.master.gain.setTargetAtTime(target, now, fade ? 0.5 : 0.06);
    } catch (e) { A.master.gain.value = target; }
  };

  A.resume = function () {
    if (!A.ctx) A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume().catch(function () {});
  };

  function tone(o) {
    var ctx = A.ctx;
    if (!ctx || A.level === 'off') return;
    var t = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.25;
    var peak = Math.max(0.0002, o.gain === undefined ? 0.18 : o.gain);
    var atk = o.attack || 0.012;

    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.freq), t);
    if (o.glide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glide), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    var out = g;
    if (o.pan !== undefined && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      out = p;
    }
    out.connect(A.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(o) {
    var ctx = A.ctx;
    if (!ctx || !A._noise || A.level === 'off') return;
    var t = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.2;
    var src = ctx.createBufferSource();
    src.buffer = A._noise;
    var filt = ctx.createBiquadFilter();
    filt.type = o.filter || 'bandpass';
    filt.Q.value = o.q || 0.9;
    var f0 = Math.max(40, o.freq || 900);
    filt.frequency.setValueAtTime(f0, t);
    if (o.glide) filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.glide), t + dur);

    var g = ctx.createGain();
    var peak = Math.max(0.0002, o.gain === undefined ? 0.08 : o.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(A.master);
    src.start(t);
    src.stop(t + dur + 0.04);
  }

  var SOUNDS = {
    pop: function (i) {
      var base = noteFreq(i % 6, 1);
      tone({ freq: 620 + Math.random() * 120, glide: 190, dur: 0.16, gain: 0.2, type: 'sine' });
      noise({ freq: 1800, glide: 500, dur: 0.13, gain: 0.075, q: 1.2 });
      tone({ freq: base, dur: 0.4, gain: 0.045, type: 'triangle', delay: 0.03 });
    },
    chime: function (i) {
      var f = noteFreq(i, 1);
      tone({ freq: f, dur: 1.4, gain: 0.085 });
      tone({ freq: f * 2.01, dur: 0.9, gain: 0.03, delay: 0.015 });
      tone({ freq: f * 3.0, dur: 0.55, gain: 0.014, delay: 0.03 });
      tone({ freq: f * 0.5, dur: 1.8, gain: 0.024, type: 'triangle', delay: 0.01, attack: 0.05 });
    },
    bloom: function (i) {
      var f = noteFreq(i, 0);
      tone({ freq: f, dur: 0.5, gain: 0.1, type: 'triangle', attack: 0.02 });
      tone({ freq: f * 1.5, dur: 0.55, gain: 0.055, type: 'sine', delay: 0.09 });
      tone({ freq: f * 2, dur: 0.6, gain: 0.03, type: 'sine', delay: 0.18 });
    },
    star: function (i) {
      var f = noteFreq(i, 1);
      tone({ freq: f, dur: 1.7, gain: 0.075 });
      tone({ freq: f * 2.0, dur: 1.15, gain: 0.028, delay: 0.02 });
      tone({ freq: f * 0.5, dur: 2.2, gain: 0.022, type: 'triangle', attack: 0.06 });
      noise({ freq: 5200, dur: 0.25, gain: 0.016, q: 2 });
    },
    paint: function () {
      noise({ freq: 420, glide: 1500, dur: 0.3, gain: 0.045, q: 0.7 });
      tone({ freq: 240 + Math.random() * 80, glide: 330, dur: 0.28, gain: 0.028, type: 'sine' });
    },
    nom: function () {
      tone({ freq: 280, glide: 150, dur: 0.16, gain: 0.13, type: 'sine' });
      noise({ freq: 620, dur: 0.12, gain: 0.04, q: 1.1 });
      tone({ freq: noteFreq(4, 0), dur: 0.5, gain: 0.05, type: 'triangle', delay: 0.05 });
    },
    bubble: function (i) {
      tone({ freq: 420, glide: 1150, dur: 0.16, gain: 0.07, type: 'sine' });
      tone({ freq: noteFreq(i % 6, 1), dur: 0.65, gain: 0.05, type: 'sine', delay: 0.03 });
      noise({ freq: 2200, glide: 900, dur: 0.22, gain: 0.028, q: 1.6 });
    },
    spray: function () {
      noise({ freq: 1500, glide: 420, dur: 0.5, gain: 0.055, q: 0.6 });
      tone({ freq: 520, glide: 300, dur: 0.3, gain: 0.03, type: 'sine' });
    },
    toot: function (i) {
      var f = 300 + (i % 3) * 45;
      tone({ freq: f, glide: f * 1.32, dur: 0.26, gain: 0.055, type: 'triangle' });
      tone({ freq: f * 2, dur: 0.16, gain: 0.02, type: 'sine', delay: 0.02 });
    },
    vroom: function () {
      noise({ freq: 240, glide: 95, dur: 0.42, gain: 0.045, q: 0.7, filter: 'lowpass' });
      tone({ freq: 84, glide: 118, dur: 0.48, gain: 0.05, type: 'triangle', attack: 0.04 });
      tone({ freq: 126, glide: 176, dur: 0.36, gain: 0.018, type: 'sine', delay: 0.02 });
    },
    crash: function (i) {
      var f = 86 + (i % 4) * 16;
      noise({ freq: 900, glide: 180, dur: 0.24, gain: 0.055, q: 0.8, filter: 'lowpass' });
      tone({ freq: f, glide: f * 0.7, dur: 0.34, gain: 0.055, type: 'triangle', attack: 0.01 });
      tone({ freq: 230 + (i % 4) * 35, dur: 0.18, gain: 0.025, type: 'sine', delay: 0.03 });
    },
    sparkle: function () {
      for (var i = 0; i < 4; i++) {
        tone({ freq: noteFreq(i + 4, 1), dur: 0.22, gain: 0.028, delay: i * 0.045, type: 'sine' });
      }
    },
    switchOn: function () {
      tone({ freq: 392, dur: 0.16, gain: 0.07, type: 'triangle' });
      tone({ freq: 587, dur: 0.45, gain: 0.06, type: 'triangle', delay: 0.1 });
      tone({ freq: 784, dur: 0.6, gain: 0.035, type: 'sine', delay: 0.18 });
      noise({ freq: 900, glide: 2400, dur: 0.4, gain: 0.012, q: 0.8 });
    },
    switchOff: function () {
      tone({ freq: 330, glide: 240, dur: 0.4, gain: 0.035, type: 'sine' });
      noise({ freq: 1400, glide: 500, dur: 0.25, gain: 0.01, q: 0.8 });
    },
    start: function () {
      tone({ freq: noteFreq(2, 0), dur: 0.5, gain: 0.07, type: 'triangle' });
      tone({ freq: noteFreq(4, 0), dur: 0.6, gain: 0.06, type: 'triangle', delay: 0.14 });
      tone({ freq: noteFreq(6, 0), dur: 0.8, gain: 0.05, type: 'triangle', delay: 0.28 });
    },
    end: function () {
      var steps = [0, 2, 4, 7];
      for (var i = 0; i < steps.length; i++) {
        tone({ freq: noteFreq(steps[i], 0), dur: 2.6, gain: 0.05, type: 'sine', delay: i * 0.07, attack: 0.08 });
      }
      tone({ freq: noteFreq(0, 1), dur: 2.0, gain: 0.02, delay: 0.2 });
    },
    tap: function () {
      tone({ freq: 520, glide: 700, dur: 0.08, gain: 0.04, type: 'sine' });
    },
    trip: function (i) {
      var f = 148 + (i % 3) * 26;
      noise({ freq: 460, glide: 210, dur: 0.09, gain: 0.045, q: 1.4 });
      tone({ freq: f, glide: f * 0.72, dur: 0.13, gain: 0.055, type: 'triangle' });
    },
    bleat: function (i) {
      var f = 360 + (i % 3) * 46;
      tone({ freq: f, glide: f * 0.8, dur: 0.34, gain: 0.045, type: 'triangle', attack: 0.03 });
      tone({ freq: f * 2.02, dur: 0.18, gain: 0.01, type: 'sine', delay: 0.03 });
    },
    troll: function () {
      tone({ freq: 98, glide: 84, dur: 1.2, gain: 0.055, type: 'triangle', attack: 0.1 });
      tone({ freq: 147, dur: 0.95, gain: 0.018, type: 'sine', delay: 0.12 });
      noise({ freq: 190, dur: 0.55, gain: 0.018, q: 0.8 });
    }
  };

  A.play = function (name, index) {
    if (!A.ctx || A.level === 'off') return;
    var fn = SOUNDS[name];
    if (!fn) return;
    var now = A.ctx.currentTime;
    var minGap = name === 'paint' ? 0.18 : 0.05;
    if (A._last[name] && now - A._last[name] < minGap) return;
    A._last[name] = now;
    try { fn(index || 0); } catch (e) { /* audio must never break the game */ }
  };

  /* A single pitched note for the piano scene. Timbre names are deliberately
     small and synthesised: no samples. */
  A.note = function (midi, timbre, gain, pan, voice) {
    if (!A.ctx) A.init();
    if (!A.ctx || A.level === 'off') return;
    var f = 440 * Math.pow(2, (midi - 69) / 12);
    var g = Math.max(0.01, Math.min(0.2, gain === undefined ? 0.1 : gain));
    var t = timbre || 'piano';
    try {
      if (t === 'drum') {
        var d = Math.abs(midi) % 5;
        if (d === 0) {
          tone({ freq: 110, glide: 46, dur: 0.3, gain: g * 1.2, type: 'sine' });
        } else if (d === 1) {
          noise({ freq: 1900, dur: 0.12, gain: g * 0.8, q: 1 });
          tone({ freq: 190, dur: 0.1, gain: g * 0.3, type: 'triangle' });
        } else if (d === 2) {
          noise({ freq: 5200, dur: 0.06, gain: g * 0.4, q: 2 });
        } else if (d === 3) {
          tone({ freq: 220, glide: 128, dur: 0.22, gain: g * 0.8, type: 'sine' });
        } else {
          noise({ freq: 1200, dur: 0.16, gain: g * 0.5, q: 1 });
        }
      } else if (t === 'animal') {
        var v = voice || 'cat';
        if (v === 'dog' || v === 'bear') {
          tone({ freq: v === 'bear' ? 120 : 190, glide: v === 'bear' ? 78 : 110, dur: 0.24, gain: g * 0.9, type: 'triangle' });
          noise({ freq: 360, dur: 0.12, gain: g * 0.2, q: 1.2 });
        } else if (v === 'bird' || v === 'mouse') {
          tone({ freq: v === 'mouse' ? 1500 : 1250, glide: v === 'mouse' ? 1950 : 1750, dur: 0.1, gain: g * 0.6, type: 'sine' });
          tone({ freq: v === 'mouse' ? 1700 : 1500, dur: 0.08, gain: g * 0.3, type: 'sine', delay: 0.09 });
        } else if (v === 'frog') {
          tone({ freq: 150, glide: 92, dur: 0.18, gain: g * 0.8, type: 'triangle' });
          noise({ freq: 520, dur: 0.1, gain: g * 0.15, q: 1.4 });
        } else if (v === 'owl') {
          tone({ freq: 320, glide: 250, dur: 0.4, gain: g * 0.5, type: 'sine', attack: 0.04 });
          tone({ freq: 300, glide: 240, dur: 0.4, gain: g * 0.25, type: 'sine', delay: 0.18 });
        } else if (v === 'duck' || v === 'sheep') {
          tone({ freq: v === 'sheep' ? 420 : 300, glide: v === 'sheep' ? 340 : 220, dur: 0.28, gain: g * 0.7, type: 'triangle' });
        } else if (v === 'fish') {
          tone({ freq: 420, glide: 900, dur: 0.14, gain: g * 0.5, type: 'sine' });
        } else if (v === 'rabbit') {
          tone({ freq: 900, glide: 1220, dur: 0.11, gain: g * 0.4, type: 'sine' });
        } else {
          tone({ freq: 540, glide: 760, dur: 0.24, gain: g * 0.6, type: 'sine' });
          tone({ freq: 780, dur: 0.14, gain: g * 0.2, type: 'sine', delay: 0.06 });
        }
      } else if (t === 'xylophone') {
        tone({ freq: f, dur: 0.5, gain: g * 0.9, type: 'triangle', pan: pan });
        tone({ freq: f * 3.01, dur: 0.28, gain: g * 0.3, type: 'sine', pan: pan });
        noise({ freq: f * 4, dur: 0.08, gain: g * 0.12, q: 2 });
      } else if (t === 'flute') {
        tone({ freq: f, dur: 0.9, gain: g * 0.7, type: 'sine', attack: 0.05, pan: pan });
        tone({ freq: f * 2, dur: 0.5, gain: g * 0.14, type: 'sine', pan: pan });
        noise({ freq: 1100, dur: 0.18, gain: g * 0.025, q: 0.7 });
      } else if (t === 'musicbox') {
        tone({ freq: f * 2, dur: 1.2, gain: g * 0.45, type: 'sine', pan: pan });
        tone({ freq: f * 4.01, dur: 0.7, gain: g * 0.14, type: 'sine', pan: pan });
        tone({ freq: f, dur: 1.4, gain: g * 0.18, type: 'triangle', pan: pan });
      } else {
        tone({ freq: f, dur: 1.1, gain: g, type: 'sine', pan: pan });
        tone({ freq: f * 2.005, dur: 0.55, gain: g * 0.2, type: 'triangle', pan: pan });
        tone({ freq: f * 3.01, dur: 0.28, gain: g * 0.06, type: 'sine', pan: pan });
      }
    } catch (e) { /* audio must never break the scene */ }
  };

  /* Call from a real pointer/key gesture to unlock audio on Safari/iOS style browsers. */
  A.unlock = function () {
    A.init();
    A.resume();
  };
})(window.MG);
