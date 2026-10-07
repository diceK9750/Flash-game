"use strict";
(() => {
  const game = new Hop.Game();
  const ui = new Hop.UI(game, document.getElementById("canvas"));
  Hop.bindInput(game, ui);
  // ?debug=<kind> opens straight into that DEBUG check (?debug=boost, ?debug=merchant-a, ?debug=all ...).
  const debugKind = Hop.Game.debugKindFromSearch(window.location?.search);
  if (debugKind) game.setDebugKind(debugKind);
  let previousTime = null;
  // On return from another tab, resume without integrating time spent hidden.
  document.addEventListener("visibilitychange", () => { previousTime = null; });
  function frame(time) {
    const deltaTime = previousTime === null ? 0 : (time - previousTime) / 1000;
    previousTime = time;
    game.update(ui.debugMenuOpen ? 0 : deltaTime); // the DEBUG menu pauses game time while open
    ui.update(); ui.draw();
    requestAnimationFrame(frame);
  }
  ui.update(); ui.draw();
  requestAnimationFrame(frame);
})();
