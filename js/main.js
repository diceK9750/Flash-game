"use strict";
(() => {
  const game = new Hop.Game();
  const ui = new Hop.UI(game, document.getElementById("canvas"));
  Hop.bindInput(game, ui);
  let previousTime = null;
  // On return from another tab, resume without integrating time spent hidden.
  document.addEventListener("visibilitychange", () => { previousTime = null; });
  function frame(time) {
    const deltaTime = previousTime === null ? 0 : (time - previousTime) / 1000;
    previousTime = time;
    game.update(deltaTime);
    ui.update(); ui.draw();
    requestAnimationFrame(frame);
  }
  ui.update(); ui.draw();
  requestAnimationFrame(frame);
})();
