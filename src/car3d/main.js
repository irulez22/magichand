/* Magic Hand Play - Magic Car, 3D scene.
 *
 * The app shell is Canvas 2D. This game renders a real WebGL scene into an
 * offscreen canvas and blits it into the play window, so the lamp, cards,
 * tray and parenting rules stay exactly as they are.
 *
 * Built by `npm run build:car3d` into js/car3d.bundle.js (classic IIFE).
 * Models are CC0 Kenney Car Kit assets, embedded by the build (data URLs).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import hatchUrl from '../../assets/models/hatchback-sports.glb';
import vanUrl from '../../assets/models/van.glb';
import sedanUrl from '../../assets/models/sedan.glb';
import suvUrl from '../../assets/models/suv.glb';

(function (MG) {
  'use strict';

  if (!MG || !MG.Games) return;

  /* Do not replace the 2D scene on a machine without WebGL. */
  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) {
      return false;
    }
  }
  if (!hasWebGL()) return;

  var U = MG.U;
  var THREE_VERSION = THREE.REVISION;
  var LANES = [-3, 0, 3];
  var SPAWN_Z = -150;
  var SKY_PATTERNS = [
    [[-13, 58], [-9, 64], [-4.5, 61], [-6, 53], [-11.5, 50], [-15, 54]],
    [[7, 62], [11, 68], [16, 64], [14, 56], [9, 55], [5, 59]],
    [[-2, 70], [2, 71], [5.5, 65], [2, 69], [0, 61], [-4.5, 65]]
  ];

  var loader = new GLTFLoader();
  var models = { player: null, van: null, sedan: null, suv: null };
  var failed = {};

  function prepareModel(gltf, player) {
    var root = gltf.scene;
    root.scale.set(1.3, 1.4, 1.2);
    root.rotation.y = Math.PI;
    root.traverse(function (o) {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          if (player && o.material.map) {
            var phys = new THREE.MeshPhysicalMaterial({
              map: o.material.map,
              roughness: 0.34, metalness: 0.32,
              clearcoat: 0.9, clearcoatRoughness: 0.18,
              envMapIntensity: 1.2,
              side: o.material.side,
              transparent: o.material.transparent,
              alphaTest: o.material.alphaTest
            });
            o.material = phys;
          } else {
            o.material.roughness = player ? 0.34 : 0.5;
            o.material.metalness = player ? 0.42 : 0.22;
            o.material.envMapIntensity = player ? 1.1 : 0.55;
          }
        }
      }
    });
    if (player) recolorPlayer(root);
    root.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(root);
    root.position.y -= box.min.y;
    return root;
  }

  /* The hatchback's atlas is green; shift the saturated green paint to red
     while leaving glass, tyres and lights alone. */
  function recolorPlayer(root) {
    var done = new Set();
    root.traverse(function (o) {
      if (!o.isMesh || !o.material || !o.material.map || done.has(o.material)) return;
      done.add(o.material);
      var tex = o.material.map;
      var img = tex.image;
      if (!img || !img.width) return;
      try {
        var c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        var g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        var data = g.getImageData(0, 0, c.width, c.height);
        var px = data.data;
        for (var i = 0; i < px.length; i += 4) {
          var r = px[i] / 255, gr = px[i + 1] / 255, b = px[i + 2] / 255;
          var max = Math.max(r, gr, b), min = Math.min(r, gr, b);
          var l = (max + min) / 2;
          if (max === min) continue;
          var d = max - min;
          var s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          if (s < 0.2) continue;
          var h;
          if (max === r) h = ((gr - b) / d + (gr < b ? 6 : 0)) * 60;
          else if (max === gr) h = ((b - r) / d + 2) * 60;
          else h = ((r - gr) / d + 4) * 60;
          if (h < 70 || h > 195) continue;
          /* green -> red, keeping shade and lift */
          var nr, ng, nb;
          var hh = 356;
          var ss = Math.min(1, s * 1.12);
          var ll = l;
          var cc = (1 - Math.abs(2 * ll - 1)) * ss;
          var xx = cc * (1 - Math.abs(((hh / 60) % 2) - 1));
          var mm = ll - cc / 2;
          if (hh < 60) { nr = cc; ng = xx; nb = 0; }
          else if (hh < 120) { nr = xx; ng = cc; nb = 0; }
          else if (hh < 180) { nr = 0; ng = cc; nb = xx; }
          else if (hh < 240) { nr = 0; ng = xx; nb = cc; }
          else if (hh < 300) { nr = xx; ng = 0; nb = cc; }
          else { nr = cc; ng = 0; nb = xx; }
          px[i] = Math.round((nr + mm) * 255);
          px[i + 1] = Math.round((ng + mm) * 255);
          px[i + 2] = Math.round((nb + mm) * 255);
        }
        g.putImageData(data, 0, 0);
        var nt = new THREE.CanvasTexture(c);
        nt.flipY = tex.flipY;
        nt.colorSpace = tex.colorSpace;
        nt.wrapS = tex.wrapS;
        nt.wrapT = tex.wrapT;
        nt.repeat.copy(tex.repeat);
        nt.offset.copy(tex.offset);
        nt.center.copy(tex.center);
        nt.rotation = tex.rotation;
        nt.matrixAutoUpdate = tex.matrixAutoUpdate;
        nt.matrix.copy(tex.matrix);
        nt.anisotropy = 4;
        o.material.map = nt;
        o.material.needsUpdate = true;
      } catch (e) {
        /* keep the original paint if the atlas cannot be read */
      }
    });
  }

  function loadModel(key, url, player) {
    loader.load(url, function (gltf) {
      models[key] = prepareModel(gltf, player);
      if (key === 'player') {
        var host = activePlayerHost;
        if (host && host.attachPlayer) host.attachPlayer(models.player);
      }
    }, undefined, function (err) {
      failed[key] = String(err && err.message || err || 'load failed');
      if (window.console && console.warn) console.warn('car3d: could not load ' + key);
    });
  }
  loadModel('player', hatchUrl, true);
  loadModel('van', vanUrl, false);
  loadModel('sedan', sedanUrl, false);
  loadModel('suv', suvUrl, false);

  var activePlayerHost = null;

  /* -------------------------------------------------------------- textures */

  function canvasTexture(w, h, draw, repeatX, repeatY) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX || 1, repeatY || 1);
    t.anisotropy = 8;
    return t;
  }

  function roadTexture() {
    return canvasTexture(256, 1024, function (g, w, h) {
      g.fillStyle = '#14171e';
      g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var a = Math.random() * 0.16;
        g.fillStyle = (i % 3 ? 'rgba(255,245,225,' : 'rgba(0,0,0,') + a.toFixed(3) + ')';
        g.fillRect(Math.random() * w, Math.random() * h, Math.random() < 0.8 ? 1 : 2, 1);
      }
      /* wet-ish sheen down the middle */
      var sheen = g.createLinearGradient(0, 0, w, 0);
      sheen.addColorStop(0, 'rgba(150,180,220,0)');
      sheen.addColorStop(0.5, 'rgba(150,180,220,0.035)');
      sheen.addColorStop(1, 'rgba(150,180,220,0)');
      g.fillStyle = sheen;
      g.fillRect(0, 0, w, h);
      /* edge lines */
      g.fillStyle = 'rgba(220,204,172,0.55)';
      g.fillRect(7, 0, 3, h);
      g.fillRect(w - 10, 0, 3, h);
      /* dashed lane boundaries */
      g.fillStyle = 'rgba(232,225,205,0.55)';
      for (var y = 0; y < h; y += 300) {
        g.fillRect(w / 3 - 2, y, 4, 180);
        g.fillRect((w * 2) / 3 - 2, y, 4, 180);
      }
    }, 1, 44);
  }

  function grassTexture() {
    return canvasTexture(256, 256, function (g, w, h) {
      g.fillStyle = '#07100b';
      g.fillRect(0, 0, w, h);
      for (var i = 0; i < 1800; i++) {
        var a = 0.04 + Math.random() * 0.13;
        g.strokeStyle = (i % 4 ? 'rgba(10,26,16,' : 'rgba(74,116,82,') + a.toFixed(3) + ')';
        g.lineWidth = 1;
        var x = Math.random() * w;
        var y = Math.random() * h;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 5);
        g.stroke();
      }
    }, 55, 55);
  }

  function glowTexture(inner, outer) {
    return canvasTexture(128, 128, function (g) {
      var rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, inner);
      rg.addColorStop(0.4, outer);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 128, 128);
    }, 1, 1);
  }

  function friendTexture(kind) {
    return canvasTexture(128, 160, function (g, w, h) {
      var body = '#c2652f', belly = '#f4e3cd', face = body, limb = '#7a3a18';
      if (kind === 'rabbit') { body = '#ded2c2'; belly = '#fbf6ee'; face = body; limb = body; }
      else if (kind === 'owl') { body = '#7a8a9c'; belly = '#cfd8e0'; face = body; limb = body; }
      else if (kind === 'sheep') { body = '#ece6da'; belly = '#fbf8f0'; face = '#4a4038'; limb = body; }
      var cx = w * 0.5;
      g.fillStyle = body;
      g.beginPath();
      g.ellipse(cx, h * 0.68, w * 0.25, h * 0.24, 0, 0, Math.PI * 2);
      g.fill();
      /* head */
      g.fillStyle = face;
      g.beginPath();
      g.arc(cx, h * 0.42, w * 0.25, 0, Math.PI * 2);
      g.fill();
      /* ears */
      if (kind === 'rabbit') {
        g.fillStyle = body;
        g.beginPath();
        g.ellipse(cx - w * 0.12, h * 0.18, w * 0.08, h * 0.16, -0.18, 0, Math.PI * 2);
        g.ellipse(cx + w * 0.12, h * 0.18, w * 0.08, h * 0.16, 0.18, 0, Math.PI * 2);
        g.fill();
      } else if (kind === 'fox') {
        g.fillStyle = body;
        g.beginPath();
        g.moveTo(cx - w * 0.24, h * 0.36);
        g.lineTo(cx - w * 0.3, h * 0.12);
        g.lineTo(cx - w * 0.08, h * 0.28);
        g.closePath();
        g.moveTo(cx + w * 0.24, h * 0.36);
        g.lineTo(cx + w * 0.3, h * 0.12);
        g.lineTo(cx + w * 0.08, h * 0.28);
        g.closePath();
        g.fill();
      } else if (kind === 'owl') {
        g.fillStyle = body;
        g.beginPath();
        g.moveTo(cx - w * 0.24, h * 0.34);
        g.lineTo(cx - w * 0.3, h * 0.14);
        g.lineTo(cx - w * 0.1, h * 0.26);
        g.closePath();
        g.moveTo(cx + w * 0.24, h * 0.34);
        g.lineTo(cx + w * 0.3, h * 0.14);
        g.lineTo(cx + w * 0.1, h * 0.26);
        g.closePath();
        g.fill();
      } else if (kind === 'sheep') {
        g.fillStyle = '#f4f0e8';
        for (var s = 0; s < 5; s++) {
          var a = -Math.PI * 0.85 + (s / 4) * Math.PI * 0.7;
          g.beginPath();
          g.arc(cx + Math.cos(a) * w * 0.22, h * 0.42 + Math.sin(a) * w * 0.22, w * 0.1, 0, Math.PI * 2);
          g.fill();
        }
      }
      /* muzzle, eyes, nose */
      g.fillStyle = belly;
      g.beginPath();
      g.ellipse(cx, h * 0.49, w * 0.14, h * 0.09, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = kind === 'sheep' ? '#f8f4ea' : '#241a14';
      g.beginPath();
      g.arc(cx - w * 0.1, h * 0.39, w * 0.045, 0, Math.PI * 2);
      g.arc(cx + w * 0.1, h * 0.39, w * 0.045, 0, Math.PI * 2);
      g.fill();
      if (kind === 'sheep') {
        g.fillStyle = '#241a14';
        g.beginPath();
        g.arc(cx - w * 0.1, h * 0.39, w * 0.02, 0, Math.PI * 2);
        g.arc(cx + w * 0.1, h * 0.39, w * 0.02, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#241a14';
      g.beginPath();
      g.arc(cx, h * 0.49, w * 0.035, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#241a14';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, h * 0.52, w * 0.06, 0.15, Math.PI - 0.15);
      g.stroke();
      /* waving arm */
      g.strokeStyle = limb;
      g.lineWidth = w * 0.08;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx + w * 0.22, h * 0.66);
      g.lineTo(cx + w * 0.38, h * 0.48);
      g.stroke();
    }, 1, 1);
  }

  function vwBadgeTexture() {
    return canvasTexture(256, 256, function (g, w, h) {
      var cx = w / 2, cy = h / 2, r = w * 0.4;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fillStyle = '#cfd3d9';
      g.fill();
      g.beginPath();
      g.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      g.fillStyle = '#16243c';
      g.fill();
      g.strokeStyle = '#eef1f5';
      g.lineWidth = w * 0.055;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(cx - r * 0.48, cy - r * 0.42);
      g.lineTo(cx, cy - r * 0.01);
      g.lineTo(cx + r * 0.48, cy - r * 0.42);
      g.stroke();
      g.beginPath();
      g.moveTo(cx - r * 0.55, cy + r * 0.06);
      g.lineTo(cx - r * 0.28, cy + r * 0.48);
      g.lineTo(cx, cy + r * 0.12);
      g.lineTo(cx + r * 0.28, cy + r * 0.48);
      g.lineTo(cx + r * 0.55, cy + r * 0.06);
      g.stroke();
    }, 1, 1);
  }

  function upBadgeTexture() {
    return canvasTexture(256, 96, function (g, w, h) {
      g.fillStyle = 'rgba(238,240,244,0.95)';
      g.font = 'italic 700 62px "Segoe UI", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('up!', w / 2, h / 2 + 2);
    }, 1, 1);
  }

  function dogTexture() {    return canvasTexture(128, 128, function (g, w, h) {
      g.fillStyle = '#7d4f2c';
      g.beginPath();
      g.ellipse(w * 0.2, h * 0.48, w * 0.13, h * 0.22, -0.3, 0, Math.PI * 2);
      g.ellipse(w * 0.8, h * 0.48, w * 0.13, h * 0.22, 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d9a86f';
      g.beginPath();
      g.arc(w * 0.5, h * 0.5, w * 0.34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f4e2c4';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.64, w * 0.2, h * 0.15, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2a1a12';
      g.beginPath();
      g.arc(w * 0.38, h * 0.44, w * 0.035, 0, Math.PI * 2);
      g.arc(w * 0.62, h * 0.44, w * 0.035, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.56, w * 0.06, h * 0.045, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8868f';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.72, w * 0.05, h * 0.07, 0, 0, Math.PI * 2);
      g.fill();
    }, 1, 1);
  }

  function blobTexture() {
    return canvasTexture(128, 128, function (g) {
      var rg = g.createRadialGradient(64, 64, 0, 64, 64, 62);
      rg.addColorStop(0, 'rgba(0,0,0,0.7)');
      rg.addColorStop(0.55, 'rgba(0,0,0,0.35)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 128, 128);
    }, 1, 1);
  }

  function streakTexture() {    return canvasTexture(64, 256, function (g, w, h) {
      var grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(255,70,55,0.55)');
      grd.addColorStop(0.5, 'rgba(255,45,35,0.18)');
      grd.addColorStop(1, 'rgba(255,45,35,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-in';
      var edge = g.createLinearGradient(0, 0, w, 0);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(0.5, 'rgba(0,0,0,1)');
      edge.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = edge;
      g.fillRect(0, 0, w, h);
    }, 1, 1);
  }

  function moonTexture() {    return canvasTexture(256, 256, function (g) {
      var halo = g.createRadialGradient(128, 128, 34, 128, 128, 126);
      halo.addColorStop(0, 'rgba(255,242,208,0.55)');
      halo.addColorStop(0.35, 'rgba(255,228,170,0.16)');
      halo.addColorStop(1, 'rgba(255,228,170,0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, 256, 256);
      var disc = g.createRadialGradient(116, 114, 4, 128, 128, 44);
      disc.addColorStop(0, '#fffdf2');
      disc.addColorStop(0.62, '#f4ecd4');
      disc.addColorStop(1, '#d8cfb4');
      g.fillStyle = disc;
      g.beginPath();
      g.arc(128, 128, 42, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(176,168,146,0.32)';
      g.beginPath();
      g.arc(112, 116, 7, 0, Math.PI * 2);
      g.arc(142, 134, 5, 0, Math.PI * 2);
      g.arc(126, 146, 3.5, 0, Math.PI * 2);
      g.fill();
    }, 1, 1);
  }

  function milkyWayTexture() {
    return canvasTexture(512, 256, function (g, w, h) {
      var band = g.createLinearGradient(0, h * 0.2, 0, h * 0.8);
      band.addColorStop(0, 'rgba(120,150,220,0)');
      band.addColorStop(0.42, 'rgba(150,175,235,0.10)');
      band.addColorStop(0.5, 'rgba(196,190,235,0.16)');
      band.addColorStop(0.58, 'rgba(150,175,235,0.10)');
      band.addColorStop(1, 'rgba(120,150,220,0)');
      g.fillStyle = band;
      g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        var y = h * 0.5 + (Math.random() - 0.5) * (Math.random() * h * 0.5);
        var a = 0.05 + Math.random() * 0.25;
        g.fillStyle = (i % 5 ? 'rgba(210,220,250,' : 'rgba(255,240,210,') + a.toFixed(3) + ')';
        g.fillRect(Math.random() * w, y, Math.random() < 0.8 ? 1 : 2, 1);
      }
      /* fade the left and right edges so the band has no box */
      g.globalCompositeOperation = 'destination-in';
      var edge = g.createLinearGradient(0, 0, w, 0);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(0.18, 'rgba(0,0,0,1)');
      edge.addColorStop(0.82, 'rgba(0,0,0,1)');
      edge.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = edge;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }, 1, 1);
  }

  function mountainTexture() {
    return canvasTexture(1024, 256, function (g, w, h) {
      function ridge(base, color, amp, seed) {
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(0, h);
        var x = 0;
        while (x <= w) {
          var peak = h * base - Math.abs(Math.sin((x + seed) * 0.013)) * h * amp - Math.random() * h * amp * 0.4;
          g.lineTo(x, peak);
          x += 18 + Math.random() * 34;
        }
        g.lineTo(w, h);
        g.closePath();
        g.fill();
      }
      ridge(0.62, '#0d1a26', 0.18, 20);
      ridge(0.74, '#091420', 0.14, 160);
      ridge(0.86, '#060e18', 0.1, 320);
    }, 1, 1);
  }

  /* ------------------------------------------------------------------ game */
  function Car3D(app) {
    this.app = app;
    this.calm3d = !!(app && app.settings && app.settings.visual === 'calm');
    this.holdStyle = 'pedal';
    this.keepLit = true;
    this.is3D = true;
    this.model = 'vw-up';
    this.color = 'red';
    this.carU = 0.5;
    this.throttle = 0;
    this.speed = 0;
    this.speedBase = 26;
    this.dist = 0;
    this.starsLit = 0;
    this.skyGlow = 0;
    this.cycle = 0;
    this.cycleT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.honk = 0;
    this.bump = 0;
    this.engine = 0;
    this.obstacles = [];
    this.spawnIn = 30;
    this.glowT = 0;
    this.friends = [{ kind: 'fox' }, { kind: 'owl' }, { kind: 'sheep' }];
    this.dogJoy = 0;
    this.cheer = 0;
    this.starFly = null;
    this.completedPat = 0;
    this.completed = false;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) {
      renderer = null;
    }
    if (!renderer) return;
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = !this.calm3d;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02030a);
    this.scene.fog = new THREE.FogExp2(0x04070d, 0.016);
    this.camera = new THREE.PerspectiveCamera(58, 1.6, 0.1, 520);
    this.camera.position.set(0, 2.8, 8);
    this.camera.lookAt(0, 1.05, -10);

    this.carGroup = new THREE.Group();
    this.carGroup.position.set(0, 0, 0);
    this.scene.add(this.carGroup);
    this.playerHolder = new THREE.Group();
    this.carGroup.add(this.playerHolder);

    try {
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.45, 0.88);
      this.composer.addPass(this.bloom);
      if (this.calm3d) this.bloom.enabled = false;
    } catch (e) {
      this.composer = null;
    }

    this.buildStatic();
    activePlayerHost = this;
    if (models.player) this.attachPlayer(models.player);
    window.MG.Car3DInfo = { three: THREE_VERSION, models: models, failed: failed };

    MG.BaseGame.call(this, app);
    this.id = 'car';
    this.title = 'Magic Car';
  }

  Car3D.prototype = Object.create(MG.BaseGame.prototype);
  Car3D.prototype.constructor = Car3D;

  Car3D.prototype.attachPlayer = function (root) {
    while (this.playerHolder.children.length) this.playerHolder.remove(this.playerHolder.children[0]);
    this.playerHolder.add(root);
    this.playerModel = root;

    /* VW roundel and up! badge on the tailgate */
    var badge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshBasicMaterial({ map: vwBadgeTexture(), transparent: true, depthWrite: false })
    );
    badge.position.set(0, 0.62, -1.48);
    badge.rotation.y = Math.PI;
    root.add(badge);
    var upBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.14),
      new THREE.MeshBasicMaterial({ map: upBadgeTexture(), transparent: true, depthWrite: false })
    );
    upBadge.position.set(-0.36, 0.44, -1.48);
    upBadge.rotation.y = Math.PI;
    root.add(upBadge);

    /* darken the bright rear glass */
    var tint = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.44),
      new THREE.MeshBasicMaterial({ color: 0x0a1522, transparent: true, opacity: 0.55, depthWrite: false })
    );
    tint.position.set(0, 0.86, -1.47);
    tint.rotation.y = Math.PI;
    root.add(tint);

    this.wheels = [];
    root.traverse(function (o) {
      if (o.name && o.name.indexOf('wheel') === 0) this.wheels.push(o);
    }.bind(this));
  };

  Car3D.prototype.buildStatic = function () {
    var self = this;
    var scene = this.scene;

    /* environment for car paint reflections */
    try {
      var pmrem = new THREE.PMREMGenerator(this.renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.32;
    } catch (e) { /* optional */ }

    var hemi = new THREE.HemisphereLight(0x8fa8d8, 0x0a120c, 0.22);
    scene.add(hemi);

    var moon = new THREE.DirectionalLight(0x9fb8e8, 1.35);
    moon.position.set(25, 45, 25);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -35;
    moon.shadow.camera.right = 35;
    moon.shadow.camera.top = 35;
    moon.shadow.camera.bottom = -35;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 140;
    moon.shadow.bias = -0.0004;
    scene.add(moon);
    scene.add(moon.target);
    moon.target.position.set(0, 0, -5);
    this.moonLight = moon;

    /* sky dome */
    var skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x01020a) },
        bottom: { value: new THREE.Color(0x0d1828) },
        warm: { value: new THREE.Color(0x3a2018) }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 top; uniform vec3 bottom; uniform vec3 warm;',
        'void main(){',
        '  float h = clamp(vDir.y, -0.2, 1.0);',
        '  vec3 c = mix(bottom, top, smoothstep(-0.02, 0.72, h));',
        '  float horizon = exp(-abs(h) * 14.0);',
        '  c += warm * horizon * 0.55;',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'
      ].join('\n')
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(410, 32, 16), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);
    this.sky = sky;

    /* stars */
    var starGeo = new THREE.BufferGeometry();
    var starPos = [];
    for (var i = 0; i < (this.calm3d ? 450 : 900); i++) {
      var a = Math.random() * Math.PI * 2;
      var e = Math.acos(Math.random() * 0.95);
      var r = 360;
      starPos.push(Math.cos(a) * Math.sin(e) * r, Math.cos(e) * r, Math.sin(a) * Math.sin(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    var starMat = new THREE.PointsMaterial({
      color: 0xdce8ff, size: 2.0, sizeAttenuation: false,
      transparent: true, opacity: 0.9, depthWrite: false, fog: false
    });
    var stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
    this.stars = stars;

    /* moon sprite */
    var moonTex = moonTexture();
    var moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex, transparent: true, depthWrite: false, fog: false
    }));
    moonSprite.position.set(20, 42, -120);
    moonSprite.scale.set(12, 12, 1);
    scene.add(moonSprite);

    /* a soft galactic band */
    var mw = new THREE.Sprite(new THREE.SpriteMaterial({
      map: milkyWayTexture(), transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    }));
    mw.position.set(-40, 92, -330);
    mw.scale.set(430, 130, 1);
    mw.material.rotation = 0.22;
    scene.add(mw);

    /* distant hills */
    var hillMat = new THREE.MeshStandardMaterial({ color: 0x0b1716, roughness: 1, metalness: 0 });
    for (var h = 0; h < 7; h++) {
      var hill = new THREE.Mesh(new THREE.ConeGeometry(45 + Math.random() * 30, 16 + Math.random() * 12, 7), hillMat);
      hill.position.set(-160 + h * 55, -2, -230 - Math.random() * 40);
      hill.scale.y = 1;
      scene.add(hill);
    }

    /* distant mountain silhouette */
    var mtn = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 120),
      new THREE.MeshBasicMaterial({ map: mountainTexture(), transparent: true, depthWrite: false, fog: false })
    );
    mtn.position.set(0, 30, -300);
    scene.add(mtn);

    /* ground */
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.03, -120);
    ground.receiveShadow = true;
    scene.add(ground);

    /* road */
    var road = new THREE.Mesh(
      new THREE.PlaneGeometry(9.4, 320),
      new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.42, metalness: 0.18, envMapIntensity: 0.7 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.005, -140);
    road.receiveShadow = true;
    scene.add(road);
    this.road = road;

    /* soft shoulders */
    var shoulderMat = new THREE.MeshStandardMaterial({ color: 0x3b3a30, roughness: 1 });
    for (var s = -1; s <= 1; s += 2) {
      var sh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 320), shoulderMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(s * 5.8, 0.002, -140);
      sh.receiveShadow = true;
      scene.add(sh);
    }

    /* roadside trees and lamps */
    this.scenery = [];
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x2b2117, roughness: 1 });
    var leafMat = new THREE.MeshStandardMaterial({ color: 0x123222, roughness: 1 });
    for (var t = 0; t < 44; t++) {
      var side = t % 2 ? 1 : -1;
      var grp = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6), trunkMat);
      trunk.position.y = 0.7;
      trunk.castShadow = true;
      grp.add(trunk);
      for (var c = 0; c < 3; c++) {
        var cone = new THREE.Mesh(new THREE.ConeGeometry(1.25 - c * 0.28, 2.2, 7), leafMat);
        cone.position.y = 1.6 + c * 1.25;
        cone.castShadow = true;
        grp.add(cone);
      }
      grp.position.set(side * (8.2 + Math.random() * 10), 0, -((t / 44) * 300) - Math.random() * 4);
      grp.scale.setScalar(0.75 + Math.random() * 0.7);
      scene.add(grp);
      this.scenery.push({ obj: grp, kind: 'tree' });
    }
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x30363c, roughness: 0.6, metalness: 0.5 });
    var lampMat = new THREE.MeshStandardMaterial({ color: 0xffdda0, emissive: 0xffc46a, emissiveIntensity: 2.5, roughness: 0.5 });
    var lampGlow = glowTexture('rgba(255,236,185,0.95)', 'rgba(255,190,90,0.35)');
    var lampPoolTex = glowTexture('rgba(255,225,170,0.4)', 'rgba(255,190,110,0.1)');
    for (var l = 0; l < 8; l++) {
      var lg = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 6), poleMat);
      pole.position.y = 2.7;
      lg.add(pole);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.24), lampMat);
      head.position.set(0.28, 5.4, 0);
      lg.add(head);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.position.set(0.3, 5.35, 0);
      sp.scale.set(3.2, 3.2, 1);
      lg.add(sp);
      var lp = new THREE.Mesh(
        new THREE.PlaneGeometry(13, 13),
        new THREE.MeshBasicMaterial({ map: lampPoolTex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      lp.rotation.x = -Math.PI / 2;
      lp.position.set(0.3, 0.02, 0);
      lg.add(lp);
      if (!this.calm3d && l % 2 === 0) {
        var warm = new THREE.PointLight(0xffce8a, 10, 20, 2);
        warm.position.set(0.3, 5.2, 0);
        lg.add(warm);
      }
      lg.position.set((l % 2 ? 1 : -1) * 6.6, 0, -18 - l * 34);
      scene.add(lg);
      this.scenery.push({ obj: lg, kind: 'lamp' });
    }

    /* metal guardrail, a continuous edge that sells the speed */
    var railMat = new THREE.MeshStandardMaterial({ color: 0x737a80, metalness: 0.85, roughness: 0.34 });
    for (var rs = -1; rs <= 1; rs += 2) {
      for (var ri = 0; ri < 16; ri++) {
        var rg = new THREE.Group();
        var rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 22), railMat);
        rail.position.y = 0.62;
        rail.castShadow = true;
        rg.add(rail);
        for (var rp = 0; rp < 2; rp++) {
          var post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.14), railMat);
          post.position.set(0, 0.36, rp ? 8 : -8);
          post.castShadow = true;
          rg.add(post);
        }
        if (ri % 2 === 0) {
          var refl = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.12, 0.04),
            new THREE.MeshBasicMaterial({ color: 0xffdca0 })
          );
          refl.position.set(-rs * 0.08, 0.7, 0);
          rg.add(refl);
        }
        rg.position.set(rs * 6.35, 0, -18 - ri * 24);
        scene.add(rg);
        this.scenery.push({ obj: rg, kind: 'rail' });
      }
    }

    /* player placeholder until the GLB arrives */
    var placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 1.25, 3.7),
      new THREE.MeshStandardMaterial({ color: 0xd01a12, roughness: 0.35, metalness: 0.4 })
    );
    placeholder.position.y = 0.625;
    placeholder.castShadow = true;
    placeholder.receiveShadow = true;
    this.playerHolder.add(placeholder);

    /* the dog riding in the back window */
    this.dog = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dogTexture(), transparent: true, depthWrite: false, fog: false
    }));
    this.dog.position.set(0, 0.95, 2.0);
    this.dog.scale.set(0.38, 0.38, 1);
    this.carGroup.add(this.dog);

    /* verge friends, billboards that move with the road */
    this.friendFlavours = ['fox', 'owl', 'rabbit', 'sheep'];
    this.friends = [];
    for (var fi = 0; fi < 8; fi++) {
      var flavour = this.friendFlavours[fi % 4];
      var fs = new THREE.Sprite(new THREE.SpriteMaterial({
        map: friendTexture(flavour), transparent: true, depthWrite: false, fog: false
      }));
      fs.position.set((fi % 2 ? 1 : -1) * (8.4 + Math.random() * 1.6), 1.0, -24 - fi * 36);
      fs.scale.set(1.7, 2.1, 1);
      fs.material.opacity = 0.92;
      scene.add(fs);
      this.friends.push({ sprite: fs, kind: flavour, ph: Math.random() * Math.PI * 2 });
      this.scenery.push({ obj: fs, kind: 'friend', ph: Math.random() * Math.PI * 2 });
    }

    /* headlight spots and glows */
    this.headlights = [];
    for (var hl = -1; hl <= 1; hl += 2) {
      var spot = new THREE.SpotLight(0xffe2b0, 45, 90, 0.34, 0.7, 0);
      spot.position.set(hl * 0.55, 0.75, -1.5);
      spot.target.position.set(hl * 0.4, 0.2, -45);
      this.carGroup.add(spot);
      this.carGroup.add(spot.target);
      this.headlights.push(spot);
    }

    /* taillight glows, facing the camera */
    this.taillights = [];
    for (var tl = -1; tl <= 1; tl += 2) {
      var ts = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,70,50,0.95)', 'rgba(255,30,20,0.35)'),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
      }));
      ts.position.set(tl * 0.62, 0.85, 2.02);
      ts.scale.set(0.42, 0.62, 1);
      this.carGroup.add(ts);
      this.taillights.push(ts);
    }

    /* wet-road streaks under the tail lights */
    var reflTex = streakTexture();
    for (var rr = -1; rr <= 1; rr += 2) {
      var refl = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 8),
        new THREE.MeshBasicMaterial({
          map: reflTex, transparent: true, opacity: 0.35,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      refl.rotation.x = -Math.PI / 2;
      refl.position.set(rr * 0.62, 0.02, 4.2);
      this.carGroup.add(refl);
    }

    /* warm pool the headlights throw down the road */
    var poolTex = glowTexture('rgba(255,236,190,0.55)', 'rgba(255,222,160,0.1)');
    var pool = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 36),
      new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.03, -16);
    this.carGroup.add(pool);
    this.lightPool = pool;

    /* sky picture */
    this.sparkTex = glowTexture('rgba(255,242,208,1)', 'rgba(255,180,80,0.35)');
    this.blobTex = blobTexture();
    var carShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 4.6),
      new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, opacity: 0.6, depthWrite: false })
    );
    carShadow.rotation.x = -Math.PI / 2;
    carShadow.position.y = 0.012;
    this.carGroup.add(carShadow);
    this.buildSkyPicture();
  };

  Car3D.prototype.buildSkyPicture = function () {
    var group = new THREE.Group();
    group.position.set(0, 0, -210);
    this.scene.add(group);
    this.skyGroup = group;
    this.skyStars = [];
    var starTex = glowTexture('rgba(255,245,210,1)', 'rgba(255,200,120,0.4)');
    for (var i = 0; i < 6; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: starTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.18, fog: false
      }));
      sp.position.set(0, 0, 0);
      sp.scale.set(2.2, 2.2, 1);
      group.add(sp);
      this.skyStars.push(sp);
    }
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(36), 3));
    this.skyLine = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: 0x8fb8ff, transparent: true, opacity: 0.18, depthWrite: false, fog: false
    }));
    group.add(this.skyLine);
    this.updateSkyPattern();
  };

  Car3D.prototype.updateSkyPattern = function () {
    if (!this.skyStars || !this.skyStars.length) return;
    var pts = SKY_PATTERNS[this.cycle % SKY_PATTERNS.length];
    var line = [];
    for (var i = 0; i < pts.length; i++) {
      this.skyStars[i].position.set(pts[i][0], pts[i][1], 0);
      var b = pts[(i + 1) % pts.length];
      line.push(pts[i][0], pts[i][1], 0, b[0], b[1], 0);
    }
    var attr = this.skyLine.geometry.attributes.position;
    for (var j = 0; j < line.length; j++) attr.array[j] = line[j];
    attr.needsUpdate = true;
  };

  /* ------------------------------------------------------------- geometry */

  Car3D.prototype.layout = function () {
    if (!this.renderer) return;
    var p = this.inset;
    if (!p || p.w < 2 || p.h < 2) return;
    this.renderer.setSize(p.w, p.h, false);
    this.camera.aspect = p.w / p.h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(p.w, p.h);
    this.viewW = p.w;
    this.viewH = p.h;
  };

  Car3D.prototype.enter = function () {
    this.carU = 0.5;
    this.throttle = 0;
    this.speed = 0;
    this.dist = 0;
    this.starsLit = 0;
    this.skyGlow = 0;
    this.cycle = 0;
    this.cycleT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.honk = 0;
    this.bump = 0;
    this.spawnIn = 30;
    this.clearObstacles();
    this.resetSkyPicture();
    if (this.carGroup) {
      this.carGroup.position.set(0, 0, 0);
      this.carGroup.rotation.set(0, 0, 0);
    }
  };

  Car3D.prototype.clearObstacles = function () {
    for (var i = 0; i < this.obstacles.length; i++) {
      if (this.obstacles[i].group) this.scene.remove(this.obstacles[i].group);
    }
    this.obstacles.length = 0;
  };

  Car3D.prototype.resetSkyPicture = function () {
    this.updateSkyPattern();
    for (var i = 0; i < this.skyStars.length; i++) {
      this.skyStars[i].material.opacity = 0.18;
      this.skyStars[i].scale.set(1.6, 1.6, 1);
    }
    this.skyLine.material.opacity = 0.1;
  };

  /* ---------------------------------------------------------------- input */

  Car3D.prototype.gasLevel = function () {
    var app = this.app;
    if (!app || !app.holdRequiredNow()) return 1;
    return app.holdCount > 0 ? 1 : 0;
  };

  Car3D.prototype.steerPointer = function () {
    var list = this.app.playPointers ? this.app.playPointers() : [];
    return list.length ? list[0] : null;
  };

  /* --------------------------------------------------------------- update */

  Car3D.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);
    if (!this.renderer) return;
    var app = this.app;
    var playing = app.mode === 'playing';

    var gas = playing ? (app.holdRequiredNow() ? (app.holdCount > 0 ? 1 : 0) : 1) : 0;
    this.throttle = U.approach(this.throttle, gas, 4.2, dt);
    if (this.throttle > 0.45 && this.engine < 0.2) MG.Audio.play('vroom');
    this.engine = this.throttle;

    var ptr = this.steerPointer();
    if (ptr && this.viewW) {
      var u = U.clamp(U.invLerp(this.inset.x, this.inset.x + this.inset.w, ptr.x), 0.04, 0.96);
      this.carU = U.approach(this.carU, u, 3.2, dt);
    }

    var want = this.speedBase * this.throttle;
    if (!playing) want = 0;
    this.speed = U.approach(this.speed, want, 3.2, dt);
    var step = this.speed * dt;
    this.dist += step;

    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.cheer > 0) this.cheer = Math.max(0, this.cheer - dt);
    if (this.dogJoy > 0) this.dogJoy = Math.max(0, this.dogJoy - dt);
    if (this.honk > 0) this.honk = Math.max(0, this.honk - dt);
    if (this.bump > 0) this.bump = Math.max(0, this.bump - dt);
    if (this.skyGlow > 0) {
      this.skyGlow -= dt;
      if (this.skyGlow <= 0) {
        this.skyGlow = 0;
        this.starsLit = 0;
        this.resetSkyPicture();
        this.cycle += 1;
      }
    }

    /* car placement */
    var carX = (this.carU - 0.5) * 8.2;
    var prevX = this.carGroup.position.x;
    this.carGroup.position.x = U.approach(prevX, carX, 4.5, dt);
    var lean = U.clamp((this.carGroup.position.x - prevX) / Math.max(dt, 0.001) * 0.006, -0.08, 0.08);
    this.carGroup.rotation.z = U.approach(this.carGroup.rotation.z, -lean, 6, dt);
    this.carGroup.position.y = Math.sin(this.t * 9) * Math.min(0.03, this.speed / this.speedBase * 0.03);

    if (this.wheels) {
      for (var w = 0; w < this.wheels.length; w++) {
        this.wheels[w].rotation.x -= step * 3.2;
      }
    }
    if (this.dog) {
      var dogBob = Math.sin(this.t * 8) * (0.01 + this.speed / this.speedBase * 0.02);
      var joy = U.clamp(this.dogJoy, 0, 1);
      this.dog.position.y = 0.98 + dogBob + joy * Math.abs(Math.sin(this.t * 17)) * 0.06;
      this.dog.scale.set(0.38 + joy * 0.04, 0.38 + joy * 0.04, 1);
    }

    /* camera chase */
    var camX = this.carGroup.position.x * 0.55;
    var shake = this.bump > 0 ? this.bump : 0;
    this.camera.position.x = U.approach(this.camera.position.x, camX + Math.sin(this.t * 61) * shake * 0.35, 6, dt);
    this.camera.position.y = U.approach(this.camera.position.y, 2.85 + Math.sin(this.t * 7) * 0.025, 5, dt);
    this.camera.position.z = 8;
    this.camera.lookAt(this.carGroup.position.x * 0.35, 1.0, -10);

    /* scenery treadmill */
    for (var s = 0; s < this.scenery.length; s++) {
      var item = this.scenery[s];
      item.obj.position.z += step;
      if (item.obj.position.z > 22) {
        item.obj.position.z -= item.kind === 'rail' ? 384 : 320;
        if (item.kind === 'tree') {
          item.obj.position.x = (Math.random() < 0.5 ? -1 : 1) * (8.2 + Math.random() * 10);
        }
      }
      if (item.kind === 'friend') {
        item.obj.position.y = 1.0 + Math.sin(this.t * 1.5 + item.ph) * 0.04 +
          (this.cheer > 0 ? Math.abs(Math.sin(this.t * 9 + item.ph)) * 0.3 : 0);
      }
    }
    if (this.road && this.road.material.map) {
      this.road.material.map.offset.y -= step / 7.3;
    }

    /* traffic */
    if (playing && this.throttle > 0.1) {
      this.spawnIn -= step;
      if (this.spawnIn <= 0) {
        this.spawnTraffic();
        this.spawnIn = this.calm3d ? U.rand(42, 60) : U.rand(26, 42);
      }
    }
    this.updateTraffic(dt, step);

    /* taillight / headlight response */
    var brake = U.clamp(1 - this.throttle, 0, 1);
    for (var t = 0; t < this.taillights.length; t++) {
      this.taillights[t].material.opacity = 0.45 + brake * 0.35;
      this.taillights[t].scale.set(0.4 + brake * 0.2, 0.62 + brake * 0.25, 1);
    }
    this.lightPool.material.opacity = 0.14 + this.throttle * 0.12;
    for (var h = 0; h < this.headlights.length; h++) {
      this.headlights[h].intensity = 45 + this.throttle * 25 + (this.honk > 0 ? 40 * (this.honk / 0.8) : 0);
    }

    /* sky picture pulse */
    if (this.skyGlow > 0) {
      var pulse = 0.7 + 0.3 * Math.sin(this.t * 3.2);
      for (var i = 0; i < this.skyStars.length; i++) {
        this.skyStars[i].material.opacity = pulse;
        this.skyStars[i].scale.set(2.6 * pulse, 2.6 * pulse, 1);
      }
      this.skyLine.material.opacity = 0.45 * pulse;
    }

    /* star flight */
    if (this.starFly) {
      this.starFly.t += dt * 1.4;
      var f = this.starFly;
      if (f.t >= 1) {
        this.scene.remove(f.mesh);
        if (f.mesh.material) f.mesh.material.dispose();
        this.starFly = null;
      } else {
        var k = U.easeInOutSine(f.t);
        f.mesh.position.lerpVectors(f.from, f.to, k);
        f.mesh.position.y += Math.sin(k * Math.PI) * 8;
        f.mesh.material.opacity = 1 - Math.max(0, (k - 0.75) / 0.25);
      }
    }

    this.updateBursts(dt);
  };

  Car3D.prototype.spawnTraffic = function () {
    var kinds = ['van', 'sedan', 'suv'];
    var kind = U.pick(kinds);
    var lane = U.randInt(0, 2);
    this.makeObstacle(kind, lane, SPAWN_Z - U.rand(0, 12));
  };

  Car3D.prototype.makeObstacle = function (kind, laneN, z) {
    var raw = laneN === undefined ? 0 : laneN;
    var lane = Math.round(raw);
    if (raw > 0 && raw < 2 && raw !== Math.round(raw)) lane = Math.round(raw * 2);
    lane = U.clamp(lane, 0, 2);
    var group = new THREE.Group();
    var model = models[kind] ? models[kind].clone(true) : null;
    if (model) {
      group.add(model);
    } else {
      var box = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.3, 2.8),
        new THREE.MeshStandardMaterial({ color: kind === 'van' ? 0x2c5f8a : 0x7a2e2a, roughness: 0.5, metalness: 0.3 })
      );
      box.position.y = 0.65;
      box.castShadow = true;
      group.add(box);
    }
    /* rear lamps so traffic reads at night */
    for (var l = -1; l <= 1; l += 2) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,80,60,0.95)', 'rgba(255,40,30,0.3)'),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      sp.position.set(l * 0.55, 0.7, 1.8);
      sp.scale.set(0.55, 0.8, 1);
      group.add(sp);
    }
    group.position.set(LANES[lane], 0, z);
    var tShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 3.4),
      new THREE.MeshBasicMaterial({ map: this.blobTex || blobTexture(), transparent: true, opacity: 0.55, depthWrite: false })
    );
    tShadow.rotation.x = -Math.PI / 2;
    tShadow.position.y = 0.011;
    group.add(tShadow);
    this.scene.add(group);
    var o = {
      kind: kind, lane: lane, x: LANES[lane], z: z,
      group: group, hit: false, laneN: lane / 2
    };
    this.obstacles.push(o);
    return o;
  };

  Car3D.prototype.updateTraffic = function (dt, step) {
    for (var i = this.obstacles.length - 1; i >= 0; i--) {
      var o = this.obstacles[i];
      if (!o.hit) o.z += step;
      o.group.position.z = o.z;
      if (o.hit) {
        o.age = (o.age || 0) + dt;
        o.group.rotation.z += dt * 2.2;
        o.group.position.y -= dt * 1.5;
        if (o.age > 0.8) {
          this.scene.remove(o.group);
          this.obstacles.splice(i, 1);
        }
        continue;
      }
      if (Math.abs(o.z) < 2.6 && Math.abs(o.x - this.carGroup.position.x) < 1.55) {
        this.smash(o);
        continue;
      }
      if (o.z > 24) {
        this.scene.remove(o.group);
        this.obstacles.splice(i, 1);
      }
    }
  };

  /* --------------------------------------------------------------- crashing */

  Car3D.prototype.smash = function (o) {
    if (o.hit) return;
    o.hit = true;
    o.age = 0;
    this.bump = 0.6;
    this.combo = this.comboT > 0 ? Math.min(4, this.combo + 1) : 1;
    this.comboT = 1.8;
    this.cheer = 1.2;
    this.dogJoy = 1.4;
    MG.Audio.play('crash', this.combo - 1);
    this.burst(o.x, 0.9, o.z);
    this.lightStar(o.x, o.z);
  };

  Car3D.prototype.lightStar = function (x, z) {
    if (this.skyGlow > 0) return;
    var idx = this.starsLit;
    this.starsLit = Math.min(6, this.starsLit + 1);
    if (this.skyStars[idx]) {
      this.skyStars[idx].material.opacity = 1;
      this.skyStars[idx].scale.set(2.4, 2.4, 1);
    }
    var from = new THREE.Vector3(x || 0, 1, Math.min(-2, z || -4));
    var to = new THREE.Vector3();
    if (this.skyStars[idx]) {
      this.skyStars[idx].getWorldPosition(to);
    } else {
      to.set(0, 60, -210);
    }
    var mesh = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,246,210,1)', 'rgba(255,210,130,0.5)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    }));
    mesh.position.copy(from);
    mesh.scale.set(2.2, 2.2, 1);
    this.scene.add(mesh);
    this.starFly = { from: from, to: to, mesh: mesh, t: 0 };

    if (this.starsLit >= 6) {
      this.skyGlow = 2.8;
      this.cycleT = this.t;
      MG.Audio.play('sparkle');
      this.skyLine.material.opacity = 0.5;
      for (var i = 0; i < this.skyStars.length; i++) {
        this.skyStars[i].material.opacity = 1;
      }
    } else {
      MG.Audio.play('chime', this.starsLit + 1);
    }
  };

  Car3D.prototype.bursts = [];

  Car3D.prototype.burst = function (x, y, z) {
    var n = 48;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 3);
    var vel = [];
    for (var i = 0; i < n; i++) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      vel.push(new THREE.Vector3(U.rand(-7, 7), U.rand(2, 9), U.rand(-7, 7)));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xffcf7a, size: 0.4, map: this.sparkTex, alphaTest: 0.02,
      transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.bursts.push({ pts: pts, vel: vel, age: 0 });
  };

  Car3D.prototype.updateBursts = function (dt) {
    for (var i = this.bursts.length - 1; i >= 0; i--) {
      var b = this.bursts[i];
      b.age += dt;
      var arr = b.pts.geometry.attributes.position.array;
      for (var p = 0; p < b.vel.length; p++) {
        var v = b.vel[p];
        v.y -= 14 * dt;
        arr[p * 3] += v.x * dt;
        arr[p * 3 + 1] += v.y * dt;
        arr[p * 3 + 2] += v.z * dt;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 1 - b.age / 1.1);
      if (b.age > 1.1) {
        this.scene.remove(b.pts);
        b.pts.geometry.dispose();
        b.pts.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  };

  /* Tapping traffic smashes it; anything else is a friendly honk. */
  Car3D.prototype.activate = function (x, y) {
    if (!this.viewW) return true;
    var best = null;
    var bd = 62;
    var v = new THREE.Vector3();
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (o.hit) continue;
      v.copy(o.group.position).add(new THREE.Vector3(0, 0.7, 0)).project(this.camera);
      var sx = this.inset.x + (v.x * 0.5 + 0.5) * this.inset.w;
      var sy = this.inset.y + (-v.y * 0.5 + 0.5) * this.inset.h;
      var d = U.dist(x, y, sx, sy);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) {
      this.smash(best);
      return true;
    }
    this.honk = 0.8;
    MG.Audio.play('toot', 1);
    MG.Audio.play('toot', 2);
    return true;
  };

  /* ----------------------------------------------------------------- draw */

  Car3D.prototype.draw = function (ctx) {
    if (!this.renderer) return;
    if (this.composer && !this.calm3d) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    var p = this.inset;
    ctx.save();
    ctx.drawImage(this.renderer.domElement, p.x, p.y, p.w, p.h);
    ctx.restore();
  };

  Car3D.prototype.onResize = function () {
    this.layout();
  };

  MG.Games.car3d = Car3D;
  MG.Games.car = Car3D;
  window.MG.Car3DInfo = { three: THREE_VERSION };
})(window.MG);
