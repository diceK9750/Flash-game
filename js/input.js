"use strict";
Hop.bindInput = function (game, ui) {
  document.getElementById("stage").addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    if (game.state === Hop.STATES.FLYING) event.preventDefault();
    Hop.Audio?.unlock();
    game.act(); ui.update();
  });
  document.getElementById("se-toggle").addEventListener("click", () => {
    Hop.Audio.setMuted(!Hop.Audio.muted);
    if (!Hop.Audio.muted) Hop.Audio.unlock();
    ui.update();
  });
  document.addEventListener("keydown", event => {
    if (event.code === "KeyD" && !event.repeat) { game.toggleDebug(); ui.update(); }
  });
};
