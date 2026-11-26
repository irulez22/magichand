/* Magic Hand Play - local settings and interaction metrics (never uploaded). */
window.MG = window.MG || {};
(function (MG) {
  'use strict';

  var U = MG.U;
  var KEY = 'magichand.settings.v1';

  var DEFAULTS = {
    version: 1,
    calibrated: false,
    game: 'balloons',
    targetSize: 'large',
    holdRequired: true,
    holdMetaphor: 'light',
    holdGrace: 1.2,
    activation: 'new',
    dwellTime: 0.9,
    reward: 'high',
    animation: 'slow',
    sound: 'normal',
    visual: 'standard',
    sessionMinutes: 0,
    anyTouch: true,
    starReach: 3,
    showHints: true,
    swapSides: false,
    zone: { width: 0.6, height: 0.86, offsetX: 0.02, offsetY: 0.07 },
    hardware: {
      maxSimultaneous: 0,
      palmTested: false,
      knuckleTested: false,
      rightTested: false,
      leftTested: false,
      bothTested: false,
      reachTested: false
    }
  };

  var CHOICES = {
    game: ['balloons', 'garden', 'stars', 'painting', 'photos', 'goats', 'car'],
    targetSize: ['xlarge', 'large', 'medium'],
    holdMetaphor: ['light', 'hand'],
    activation: ['new', 'continuous', 'dwell'],
    reward: ['low', 'medium', 'high'],
    animation: ['stationary', 'slow', 'normal'],
    sound: ['off', 'quiet', 'normal'],
    visual: ['calm', 'standard'],
    sessionMinutes: [0, 2, 5, 10]
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* Keep the same object identity forever, so anything that grabbed a
     reference to Settings.data (the app shell, a running game) keeps working. */
  function replaceData(next) {
    if (!Settings.data) { Settings.data = next; return; }
    Object.keys(Settings.data).forEach(function (k) { delete Settings.data[k]; });
    Object.keys(next).forEach(function (k) { Settings.data[k] = next[k]; });
  }

  function merge(base, incoming) {
    var out = clone(base);
    if (!incoming || typeof incoming !== 'object') return out;
    Object.keys(base).forEach(function (k) {
      var b = base[k];
      var i = incoming[k];
      if (i === undefined || i === null) return;
      if (b && typeof b === 'object' && !Array.isArray(b)) {
        out[k] = merge(b, i);
      } else if (typeof i === typeof b) {
        out[k] = i;
      }
    });
    return out;
  }

  function sanitize(s) {
    Object.keys(CHOICES).forEach(function (k) {
      if (CHOICES[k].indexOf(s[k]) === -1) s[k] = DEFAULTS[k];
    });
    s.dwellTime = U.clamp(Number(s.dwellTime) || DEFAULTS.dwellTime, 0.25, 3);
    s.holdGrace = U.clamp(Number(s.holdGrace) || 0, 0, 5);
    s.starReach = U.clamp(Math.round(Number(s.starReach) || 3), 1, 5);
    s.sessionMinutes = CHOICES.sessionMinutes.indexOf(s.sessionMinutes) === -1 ? 0 : s.sessionMinutes;
    s.zone = s.zone || clone(DEFAULTS.zone);
    s.zone.width = U.clamp(Number(s.zone.width) || 0.6, 0.34, 0.84);
    s.zone.height = U.clamp(Number(s.zone.height) || 0.86, 0.36, 0.96);
    s.zone.offsetX = U.clamp(Number(s.zone.offsetX) || 0, 0, 0.5);
    s.zone.offsetY = U.clamp(Number(s.zone.offsetY) || 0, 0, 0.5);
    s.hardware = s.hardware || clone(DEFAULTS.hardware);
    return s;
  }

  var Settings = {
    data: null,
    listeners: [],
    _saveTimer: null,

    load: function () {
      var stored = U.storage.get(KEY, null);
      replaceData(sanitize(merge(DEFAULTS, stored)));
      return Settings.data;
    },

    defaults: function () { return sanitize(clone(DEFAULTS)); },

    save: function (immediate) {
      if (Settings._saveTimer) { clearTimeout(Settings._saveTimer); Settings._saveTimer = null; }
      if (immediate) {
        U.storage.set(KEY, Settings.data);
        return;
      }
      Settings._saveTimer = setTimeout(function () {
        Settings._saveTimer = null;
        U.storage.set(KEY, Settings.data);
      }, 220);
    },

    set: function (path, value) {
      var parts = path.split('.');
      var obj = Settings.data;
      for (var i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]];
        if (!obj) return;
      }
      obj[parts[parts.length - 1]] = value;
      Settings.save();
      Settings.emit();
    },

    patch: function (obj) {
      Object.keys(obj).forEach(function (k) { Settings.data[k] = obj[k]; });
      Settings.save();
      Settings.emit();
    },

    subscribe: function (fn) { Settings.listeners.push(fn); },
    emit: function () {
      for (var i = 0; i < Settings.listeners.length; i++) {
        try { Settings.listeners[i](Settings.data); } catch (e) { /* keep UI alive */ }
      }
    },

    reset: function () {
      replaceData(sanitize(merge(DEFAULTS, null)));
      U.storage.set(KEY, Settings.data);
      Settings.emit();
      return Settings.data;
    }
  };

  MG.Settings = Settings;

  /* ------------------------------------------------------------------ */
  /* Interaction metrics. Plain activity counters, not medical measures. */
  /* ------------------------------------------------------------------ */

  var MKEY = 'magichand.metrics.v1';
  var COLS = 48;
  var ROWS = 27;

  var Metrics = {
    data: null,
    live: { playMs: 0, activations: 0, touches: 0, distancePx: 0, contactMs: 0, startedAt: 0 },
    _timer: null,

    fresh: function () {
      return {
        version: 1,
        totals: { activations: 0, touches: 0, playMs: 0, distancePx: 0, sessions: 0, longestContactMs: 0 },
        grid: { cols: COLS, rows: ROWS, counts: new Array(COLS * ROWS).fill(0) },
        sessions: []
      };
    },

    load: function () {
      var stored = U.storage.get(MKEY, null);
      Metrics.data = Metrics.fresh();
      if (!stored) return Metrics.data;
      if (stored.totals && typeof stored.totals === 'object') {
        Object.keys(Metrics.data.totals).forEach(function (k) {
          if (U.isNum(stored.totals[k])) Metrics.data.totals[k] = stored.totals[k];
        });
      }
      if (stored.grid && Array.isArray(stored.grid.counts) && stored.grid.counts.length === COLS * ROWS) {
        Metrics.data.grid.counts = stored.grid.counts.map(function (n) { return U.isNum(n) ? n : 0; });
      }
      if (Array.isArray(stored.sessions)) {
        Metrics.data.sessions = stored.sessions.slice(-40);
      }
      return Metrics.data;
    },

    save: function () {
      U.storage.set(MKEY, Metrics.data);
    },

    saveSoon: function () {
      if (Metrics._timer) return;
      Metrics._timer = setTimeout(function () {
        Metrics._timer = null;
        Metrics.save();
      }, 4000);
    },

    reset: function () {
      Metrics.data = Metrics.fresh();
      Metrics.live = { playMs: 0, activations: 0, touches: 0, distancePx: 0, contactMs: 0, startedAt: 0 };
      Metrics.save();
    },

    beginSession: function () {
      Metrics.live = { playMs: 0, activations: 0, touches: 0, distancePx: 0, contactMs: 0, startedAt: Date.now() };
    },

    endSession: function () {
      var live = Metrics.live;
      if (!live.startedAt) return;
      var t = Metrics.data.totals;
      t.activations += live.activations;
      t.touches += live.touches;
      t.playMs += Math.round(live.playMs);
      t.distancePx += Math.round(live.distancePx);
      t.sessions += 1;
      Metrics.data.sessions.push({
        at: live.startedAt,
        playMs: Math.round(live.playMs),
        activations: live.activations,
        touches: live.touches,
        distancePx: Math.round(live.distancePx),
        longestContactMs: Math.round(live.contactMs)
      });
      if (Metrics.data.sessions.length > 40) Metrics.data.sessions = Metrics.data.sessions.slice(-40);
      live.startedAt = 0;
      Metrics.save();
    },

    addTouch: function (x, y, w, h) {
      Metrics.live.touches += 1;
      var g = Metrics.data.grid;
      var cx = U.clamp(Math.floor((x / Math.max(1, w)) * g.cols), 0, g.cols - 1);
      var cy = U.clamp(Math.floor((y / Math.max(1, h)) * g.rows), 0, g.rows - 1);
      g.counts[cy * g.cols + cx] += 1;
      Metrics.saveSoon();
    },

    addActivation: function () {
      Metrics.live.activations += 1;
      Metrics.saveSoon();
    },

    addDistance: function (px) {
      if (px > 0) Metrics.live.distancePx += px;
    },

    addContact: function (ms) {
      if (ms > Metrics.live.contactMs) Metrics.live.contactMs = ms;
      if (ms > Metrics.data.totals.longestContactMs) Metrics.data.totals.longestContactMs = Math.round(ms);
    },

    addPlayTime: function (dtMs) {
      Metrics.live.playMs += dtMs;
    }
  };

  MG.Metrics = Metrics;
})(window.MG);
