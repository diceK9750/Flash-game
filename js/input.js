"use strict";
Hop.bindInput = function (game, ui) {
  const activate = () => { game.act(); ui.update(); };
  // Click is the single activation path for mouse, touch and native buttons.
  // Do not also bind touchstart/pointerdown: that would advance two states.
  document.getElementById("stage").addEventListener("click", event => {
    if (event.target.closest("button")) return;
    if (game.state !== Hop.STATES.RESULT) activate();
  });
  ui.action.addEventListener("click", activate);
  ui.overlayAction.addEventListener("click", activate);
  ui.downAction.addEventListener("click", event => {
    event.stopPropagation();
    game.aerial("DOWN"); ui.update();
  });
  document.addEventListener("keydown", event => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    if (event.code === "Space" && game.state === Hop.STATES.FLYING) {
      event.preventDefault(); // Overrides native Space activation even on UP buttons.
      if (!event.repeat) { game.aerial("DOWN"); ui.update(); }
      return;
    }
    if (event.target.closest("button")) return; // keep native keyboard activation
    event.preventDefault();
    if (!event.repeat) activate();
  });
  document.addEventListener("keyup", event => {
    if (event.code === "Space" && game.state === Hop.STATES.FLYING) event.preventDefault();
  });
};
