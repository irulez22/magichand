/* Magic Hand Play - game registry. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';

  MG.createGame = function (app, id) {
    var Ctor = MG.Games[id] || MG.Games.balloons;
    return new Ctor(app);
  };

  /* Order matters: the bottom scene tray builds itself from this object. */
  MG.GameTitles = {
    balloons: 'Magic Balloons',
    garden: 'Magic Garden',
    stars: 'Reach for the Stars',
    painting: 'Magic Painting',
    photos: 'Picture Pairs',
    goats: 'Three Goats'
  };
})(window.MG);
