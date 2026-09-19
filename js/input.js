"use strict";
Hop.bindInput = function (game, ui) {
  document.getElementById("stage").addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    Hop.Audio?.unlock();
    game.act(); ui.update();
  });
  document.addEventListener("keydown", event => {
    if (event.code === "KeyD" && !event.repeat) { game.toggleDebug(); ui.update(); }
  });
};
