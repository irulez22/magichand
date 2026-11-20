/* Magic Hand Play - screen layout for the play side and the hold-button side. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;

  var Zones = {};

  /* Returns the two zones in CSS pixels. The play zone is where the game lives;
     the hold zone is the big round button. `swapped` mirrors the layout so the play
     side can be moved to the other half of the screen. `bottom` reserves space for
     the scene tray so no game is ever hidden beneath it. */
  Zones.compute = function (settings, W, H, bottom) {
    var pad = Math.round(Math.min(W, H) * 0.012);
    if (pad < 6) pad = 6;
    bottom = Math.max(0, bottom || 0);
    var H2 = Math.max(160, H - bottom);

    var zw = U.clamp(settings.zone.width, 0.3, 0.92) * W;
    var zh = U.clamp(settings.zone.height, 0.3, 1) * H2;
    var minHold = Math.max(W * 0.12, Math.min(170, W * 0.22));
    var maxPlay = Math.max(W * 0.3, W - minHold - pad * 2);

    zw = U.clamp(zw, Math.min(W * 0.3, maxPlay), maxPlay);
    zh = Math.max(40, Math.min(zh, H2 - pad * 2));

    var ox = U.clamp(settings.zone.offsetX, 0, 0.5) * W;

    var playX = settings.swapSides
      ? W - ox - zw
      : ox;
    playX = U.clamp(playX, pad, Math.max(pad, W - zw - minHold));

    var oy = U.clamp(settings.zone.offsetY, 0, 0.5) * H2;
    var playY = U.clamp(oy, pad, H2 - zh - pad);

    var play = { x: playX, y: playY, w: zw, h: zh };
    var hold;

    if (!settings.swapSides) {
      hold = { x: play.x + play.w, y: pad, w: W - (play.x + play.w) - pad, h: H2 - pad * 2 };
      if (hold.w < 1) hold.w = 1;
    } else {
      hold = { x: pad, y: pad, w: play.x - pad, h: H2 - pad * 2 };
      if (hold.w < 1) hold.w = 1;
    }

    var splitX = settings.swapSides ? play.x : play.x + play.w;

    return {
      play: play,
      hold: hold,
      pad: pad,
      bottom: bottom,
      swapped: !!settings.swapSides,
      splitX: splitX,
      W: W,
      H: H
    };
  };

  /* Point at the play/hold border, used as the origin of the "lamp" light. */
  Zones.lightSource = function (zone) {
    var h = zone.hold;
    return {
      x: zone.swapped ? h.x + h.w * 0.92 : h.x + h.w * 0.08,
      y: h.y + h.h * 0.5
    };
  };

  /* Corner reserved for the parent gate. Kept outside both play logic paths. */
  Zones.padCenter = function (W, H) {
    var r = Math.max(26, Math.min(W, H) * 0.032);
    return { x: W - r - Math.round(W * 0.012), y: r + Math.round(W * 0.012), r: r };
  };

  MG.Zones = Zones;
})(window.MG);
