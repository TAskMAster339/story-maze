// Loads optional development tools without coupling production builds to them.
(function bootRuntime(global) {
  const scripts = global.GAME_CONFIG.debug
    ? ["src/ui/debug.js", "src/ui/editor.js", "src/player/player.js"]
    : ["src/player/player.js"];

  function loadNext(index) {
    if (index >= scripts.length) return;
    const script = document.createElement("script");
    script.src = scripts[index];
    script.onload = () => loadNext(index + 1);
    script.onerror = () => {
      throw new Error(`Не удалось загрузить runtime-модуль: ${scripts[index]}`);
    };
    document.head.appendChild(script);
  }

  loadNext(0);
})(window);
