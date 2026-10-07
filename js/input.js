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
  // DEBUG menu: D key or the DEBUG button opens it; number keys (merchants Q W E R) or a click pick a kind;
  // Esc / D / the backdrop close it. Other keys stay ignored (the game itself is pointer only).
  document.getElementById("debug-toggle").addEventListener("click", () => ui.toggleDebugMenu());
  const menu = document.getElementById("debug-menu");
  menu.addEventListener("click", event => {
    const item = event.target?.closest?.("[data-debug-kind]");
    if (item) ui.selectDebugKind(item.dataset.debugKind);
    else if (event.target === menu || event.target?.closest?.("[data-debug-close]")) ui.closeDebugMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (ui.debugMenuOpen) {
      if (event.code === "Escape" || event.code === "KeyD") { event.preventDefault?.(); ui.closeDebugMenu(); return; }
      const kind = Hop.UI.debugKeyKind(event.code);
      if (kind) { event.preventDefault?.(); ui.selectDebugKind(kind); }
    } else if (event.code === "KeyD") ui.openDebugMenu();
  });
};
