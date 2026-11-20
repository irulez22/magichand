/* Magic Hand Play - Pointer Events multi-touch source.
   Every contact is tracked by pointerId in a Map so a hand resting on the
   button never blocks a hand playing on the other side. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;

  MG.createTouchSource = function (el, opts) {
    opts = opts || {};

    var src = {
      el: el,
      pointers: new Map(),
      enabled: true,
      maxSimultaneous: 0,
      totalDowns: 0,
      lastDown: null,
      _rect: null
    };

    function zoneOf(x, y) {
      if (opts.zoneOf) {
        try { return opts.zoneOf(x, y); } catch (e) { return 'outside'; }
      }
      return 'any';
    }

    function measure() {
      try { src._rect = el.getBoundingClientRect(); } catch (e) { src._rect = { left: 0, top: 0 }; }
      return src._rect;
    }

    function toLocal(e) {
      var r = src._rect || measure();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function normId(e) { return e.pointerId === undefined ? 1 : e.pointerId; }

    function onDown(e) {
      if (!src.enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (opts.ignore && opts.ignore(e)) return;
      if (e.cancelable) e.preventDefault();

      var p = toLocal(e);
      if (opts.bounds && !U.inRect(p.x, p.y, opts.bounds())) return;

      var id = normId(e);
      var now = U.now();
      var rec = {
        id: id,
        x: p.x,
        y: p.y,
        sx: p.x,
        sy: p.y,
        lx: p.x,
        ly: p.y,
        downAt: now,
        lastSeen: now,
        type: e.pointerType || 'touch',
        width: e.width || 0,
        height: e.height || 0,
        pressure: e.pressure === undefined ? 0.5 : e.pressure,
        role: zoneOf(p.x, p.y),
        travel: 0,
        sweep: 0,
        dwell: 0,
        armed: true,
        dwellX: p.x,
        dwellY: p.y,
        pulseT: 0,
        stampT: 0,
        used: false
      };

      src.pointers.set(id, rec);
      src.totalDowns += 1;
      src.lastDown = rec;
      if (src.pointers.size > src.maxSimultaneous) src.maxSimultaneous = src.pointers.size;

      if (opts.onDown) opts.onDown(rec, src);
      if (opts.onChange) opts.onChange(src);
    }

    function onMove(e) {
      if (!src.enabled) return;
      var id = normId(e);
      var rec = src.pointers.get(id);
      if (!rec) return;
      if (e.cancelable) e.preventDefault();

      var p = toLocal(e);
      var dx = p.x - rec.x;
      var dy = p.y - rec.y;
      var step = Math.sqrt(dx * dx + dy * dy);

      rec.lx = rec.x;
      rec.ly = rec.y;
      rec.x = p.x;
      rec.y = p.y;
      rec.lastSeen = U.now();
      rec.travel += step;
      rec.pressure = e.pressure === undefined ? rec.pressure : e.pressure;

      if (opts.onMove) opts.onMove(rec, dx, dy, step, src);
      if (opts.onChange) opts.onChange(src);
    }

    function finish(e, cancelled) {
      var id = normId(e);
      var rec = src.pointers.get(id);
      if (!rec) return;
      if (cancelled) {
        src.pointers.delete(id);
        if (opts.onCancel) opts.onCancel(rec, src);
      } else {
        var p = toLocal(e);
        rec.x = p.x;
        rec.y = p.y;
        rec.duration = U.now() - rec.downAt;
        src.pointers.delete(id);
        if (opts.onUp) opts.onUp(rec, src);
      }
      if (opts.onChange) opts.onChange(src);
    }

    function onUp(e) { finish(e, false); }
    function onCancel(e) { finish(e, true); }

    function clearAll() {
      var list = Array.from(src.pointers.values());
      src.pointers.clear();
      list.forEach(function (rec) { if (opts.onCancel) opts.onCancel(rec, src); });
      if (opts.onChange) opts.onChange(src);
    }

    function blockNative(e) {
      if (e.cancelable) e.preventDefault();
    }

    el.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onCancel, { passive: false });
    el.addEventListener('contextmenu', blockNative);
    el.addEventListener('dragstart', blockNative);
    el.addEventListener('touchstart', blockNative, { passive: false });
    el.addEventListener('touchmove', blockNative, { passive: false });
    window.addEventListener('blur', clearAll);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearAll();
    });

    src.measure = measure;
    src.clear = clearAll;
    src.enable = function () { src.enabled = true; measure(); };
    src.disable = function () { src.enabled = false; clearAll(); };
    src.count = function (role) {
      var n = 0;
      src.pointers.forEach(function (p) { if (!role || p.role === role) n += 1; });
      return n;
    };
    src.first = function (role) {
      var found = null;
      src.pointers.forEach(function (p) { if (!found && (!role || p.role === role)) found = p; });
      return found;
    };
    src.destroy = function () {
      clearAll();
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('contextmenu', blockNative);
      el.removeEventListener('dragstart', blockNative);
      el.removeEventListener('touchstart', blockNative);
      el.removeEventListener('touchmove', blockNative);
      window.removeEventListener('blur', clearAll);
      src.enabled = false;
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return src;
  };
})(window.MG);
