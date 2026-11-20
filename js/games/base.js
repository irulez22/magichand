/* Magic Hand Play - shared game base. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;

  function BaseGame(app) {
    this.app = app;
    this.t = 0;
    this.id = 'base';
    this.title = 'Play';
    this.play = (app && app.zone) ? app.zone.play : { x: 0, y: 0, w: 1, h: 1 };
    this.inset = this.play;
    this.setZone(this.play);
  }

  BaseGame.prototype = {
    constructor: BaseGame,

    get settings() { return this.app.settings; },
    get calm() { return this.settings.visual === 'calm'; },

    get motion() {
      var a = this.settings.animation;
      return a === 'stationary' ? 0 : (a === 'slow' ? 0.34 : 1);
    },

    get sizeFactor() {
      return { xlarge: 1.42, large: 1, medium: 0.72 }[this.settings.targetSize] || 1;
    },

    get rewardFactor() {
      return { low: 0.8, medium: 1, high: 1.4 }[this.settings.reward] || 1;
    },

    get scale() { return Math.min(this.play.w, this.play.h); },

    setZone: function (play) {
      this.play = play;
      this.inset = {
        x: play.x + play.w * 0.018,
        y: play.y + play.h * 0.018,
        w: play.w * 0.964,
        h: play.h * 0.964
      };
      this.layout();
    },

    layout: function () {},
    enter: function () {},
    exit: function () {},
    update: function (dt) { this.t += dt; },
    draw: function () {},
    activate: function () { return false; },
    onResize: function () {},

    playsPointerAt: function (x, y, radius) {
      var list = this.app.playPointers();
      for (var i = 0; i < list.length; i++) {
        if (U.dist(list[i].x, list[i].y, x, y) < radius) return list[i];
      }
      return null;
    }
  };

  MG.BaseGame = BaseGame;
})(window.MG);
