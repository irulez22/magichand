/* Magic Hand Play - locally stored pictures for the Picture Pairs scene.
   Images are chosen from a folder by the parent, downscaled, and kept in
   IndexedDB on this PC. Nothing is uploaded. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;

  var DB_NAME = 'magichand.pictures';
  var STORE = 'pictures';
  var MAX_EDGE = 512;

  var dbPromise = null;
  var memory = [];          // fallback when IndexedDB is unavailable
  var seq = 0;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB error')); };
    });
    return dbPromise;
  }

  function getAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var out = [];
        var req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
        req.onsuccess = function () {
          var cur = req.result;
          if (cur) { out.push(cur.value); cur.continue(); }
          else resolve(out);
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function put(record) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
        tx.oncomplete = function () { resolve(record); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function clearAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function shrink(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var sw = img.naturalWidth || 512;
        var sh = img.naturalHeight || 512;
        var scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
        var w = Math.max(1, Math.round(sw * scale));
        var h = Math.max(1, Math.round(sh * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        var png = file.type === 'image/png';
        if (!png) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        try {
          canvas.toBlob(function (blob) { resolve(blob); }, png ? 'image/png' : 'image/jpeg', 0.86);
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function imageFromBlob(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  /* Built-in doodles so the game works before any photos are chosen. */
  function doodles() {
    function bg(ctx, w, h, c1, c2) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    return [
      {
        id: 'doodle-star', name: 'Star',
        draw: function (ctx, w, h) {
          bg(ctx, w, h, '#fff4c9', '#ffd98a');
          ctx.fillStyle = '#ffb547';
          U.starPath(ctx, w / 2, h / 2, w * 0.34, w * 0.15, 5, 0);
          ctx.fill();
          ctx.fillStyle = '#fff6d8';
          U.starPath(ctx, w / 2, h / 2, w * 0.2, w * 0.09, 5, 0);
          ctx.fill();
        }
      },
      {
        id: 'doodle-heart', name: 'Heart',
        draw: function (ctx, w, h) {
          bg(ctx, w, h, '#ffe3ee', '#ffb6cf');
          ctx.fillStyle = '#ef5f8a';
          ctx.beginPath();
          ctx.moveTo(w * 0.5, h * 0.78);
          ctx.bezierCurveTo(w * 0.1, h * 0.5, w * 0.18, h * 0.16, w * 0.5, h * 0.4);
          ctx.bezierCurveTo(w * 0.82, h * 0.16, w * 0.9, h * 0.5, w * 0.5, h * 0.78);
          ctx.fill();
        }
      },
      {
        id: 'doodle-flower', name: 'Flower',
        draw: function (ctx, w, h) {
          bg(ctx, w, h, '#e8f7e4', '#bfe8b6');
          for (var i = 0; i < 8; i++) {
            var a = (i / 8) * U.TAU;
            ctx.fillStyle = '#ff9ec4';
            ctx.beginPath();
            ctx.ellipse(w / 2 + Math.cos(a) * w * 0.18, h / 2 + Math.sin(a) * h * 0.18, w * 0.12, h * 0.18, a, 0, U.TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, w * 0.14, 0, U.TAU);
          ctx.fill();
        }
      },
      {
        id: 'doodle-fish', name: 'Fish',
        draw: function (ctx, w, h) {
          bg(ctx, w, h, '#dff4ff', '#a9def7');
          ctx.fillStyle = '#ff8a5c';
          ctx.beginPath();
          ctx.ellipse(w * 0.46, h * 0.5, w * 0.26, h * 0.17, 0, 0, U.TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(w * 0.7, h * 0.5);
          ctx.lineTo(w * 0.86, h * 0.36);
          ctx.lineTo(w * 0.86, h * 0.64);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(w * 0.36, h * 0.46, w * 0.04, 0, U.TAU);
          ctx.fill();
          ctx.fillStyle = '#3a3a48';
          ctx.beginPath();
          ctx.arc(w * 0.36, h * 0.46, w * 0.02, 0, U.TAU);
          ctx.fill();
        }
      },
      {
        id: 'doodle-rainbow', name: 'Rainbow',
        draw: function (ctx, w, h) {
          bg(ctx, w, h, '#f2f0ff', '#d9d4ff');
          var cols = ['#ff8f8f', '#ffc271', '#ffe98d', '#a6e3a2', '#8fd2ff', '#b79cff'];
          ctx.lineWidth = w * 0.06;
          for (var i = 0; i < cols.length; i++) {
            ctx.strokeStyle = cols[i];
            ctx.beginPath();
            ctx.arc(w / 2, h * 0.72, w * 0.38 - i * w * 0.06, Math.PI, U.TAU);
            ctx.stroke();
          }
        }
      },
      {
        id: 'doodle-balloon', name: 'Balloon',
        draw: function (ctx, w, h) {
          bg(ctx, w, h, '#e9f7ff', '#c7e9ff');
          ctx.fillStyle = '#ff7d9c';
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.44, w * 0.22, h * 0.26, 0, 0, U.TAU);
          ctx.fill();
          ctx.fillStyle = '#e0567a';
          ctx.beginPath();
          ctx.moveTo(w * 0.47, h * 0.68);
          ctx.lineTo(w * 0.53, h * 0.68);
          ctx.lineTo(w * 0.5, h * 0.73);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#9a8fb0';
          ctx.lineWidth = Math.max(2, w * 0.02);
          ctx.beginPath();
          ctx.moveTo(w * 0.5, h * 0.73);
          ctx.quadraticCurveTo(w * 0.56, h * 0.86, w * 0.5, h * 0.92);
          ctx.stroke();
        }
      }
    ];
  }

  var Pictures = {
    supported: !!window.indexedDB,
    placeholders: doodles,

    list: function () {
      return getAll().then(function (recs) {
        return recs.map(function (r) { return { id: r.id, name: r.name, added: r.added }; })
          .sort(function (a, b) { return (a.added || 0) - (b.added || 0); });
      }).catch(function () {
        return memory.map(function (r) { return { id: r.id, name: r.name, added: r.added }; });
      });
    },

    addFiles: function (files) {
      var images = Array.prototype.filter.call(files || [], function (f) {
        return f && /^image\//.test(f.type || '');
      }).slice(0, 60);

      var added = 0;
      var chain = Promise.resolve();
      images.forEach(function (file) {
        chain = chain.then(function () {
          return shrink(file).then(function (blob) {
            if (!blob) return;
            seq += 1;
            var rec = {
              id: 'p' + Date.now() + '-' + seq,
              name: file.name || ('picture ' + seq),
              blob: blob,
              added: Date.now() + seq
            };
            return put(rec).then(function () { added += 1; }).catch(function () {
              memory.push(rec);
              added += 1;
            });
          });
        });
      });
      return chain.then(function () { return added; });
    },

    clear: function () {
      memory = [];
      return clearAll().catch(function () { return null; });
    },

    /* Object URLs for dashboard thumbnails. Caller must revoke them. */
    thumbs: function () {
      function map(recs) {
        return recs.filter(function (r) { return !!r.blob; })
          .sort(function (a, b) { return (a.added || 0) - (b.added || 0); })
          .map(function (r) {
            return { id: r.id, name: r.name, url: URL.createObjectURL(r.blob) };
          });
      }
      return getAll().then(map).catch(function () { return map(memory); });
    },

    /* Returns [{id, name, img}] where img is a loaded HTMLImageElement. */
    load: function () {
      return getAll().then(function (recs) {
        return recs.sort(function (a, b) { return (a.added || 0) - (b.added || 0); });
      }).catch(function () {
        return memory.slice();
      }).then(function (recs) {
        return Promise.all(recs.map(function (r) {
          return imageFromBlob(r.blob).then(function (img) {
            return { id: r.id, name: r.name, img: img };
          }).catch(function () { return null; });
        })).then(function (list) {
          return list.filter(Boolean);
        });
      });
    }
  };

  MG.Pictures = Pictures;
})(window.MG);
