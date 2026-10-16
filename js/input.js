"use strict";
// Space / Enter act as a tap unless a control has focus (pure; tests).
Hop.isTapKey = function (event) {
  if (event.code !== "Space" && event.code !== "Enter" && event.code !== "NumpadEnter") return false;
  const tag = event.target?.tagName;
  return !(tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || event.target?.isContentEditable);
};
Hop.bindInput = function (game, ui) {
  document.getElementById("stage").addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    if (game.state === Hop.STATES.FLYING) event.preventDefault();
    Hop.Audio?.unlock();
    try { Hop.Voice?.unlock(game.debug); } catch { /* Optional voice must never affect input. */ }
    game.act(); ui.update();
  });
  document.getElementById("se-toggle").addEventListener("click", () => {
    Hop.Audio.setMuted(!Hop.Audio.muted);
    try { Hop.Voice?.syncMute(); } catch { /* Optional voice must never affect the mute control. */ }
    if (!Hop.Audio.muted) Hop.Audio.unlock();
    ui.update();
  });
  // DEBUG menu: D key or the DEBUG button opens it; number keys (merchants Q W E R) or a click pick a kind;
  // Esc / D / the backdrop close it. Other keys stay ignored except Space / Enter (= tap, below).
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
    // Keyboard path (2026-10-17 cycle 22): Space / Enter = the same single tap as the stage pointerdown, so the
    // game is playable without a pointer. Focused buttons / links / fields keep their own Space / Enter; key
    // repeat is ignored (one press = one tap, like a pointer press).
    else if (Hop.isTapKey(event)) {
      event.preventDefault?.(); // Space would scroll the page
      Hop.Audio?.unlock();
      try { Hop.Voice?.unlock(game.debug); } catch { /* Optional voice must never affect input. */ }
      game.act(); ui.update();
    }
  });
};
