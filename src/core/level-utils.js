// Shared map contract for the runtime, editor and future level loaders.
(function attachLevelUtils(global) {
  const SYMBOLS = new Set(["#", ".", ",", "L", "S", "T"]);

  function normalize(rows) {
    const source = Array.isArray(rows) ? rows : [];
    const safeRows = source.map((row) => String(row ?? ""));
    const width = Math.max(safeRows.reduce((max, row) => Math.max(max, row.length), 0), 1);

    return (safeRows.length ? safeRows : ["."]).map((row) =>
      row
        .replaceAll("|", "#")
        .split("")
        .map((cell) => (SYMBOLS.has(cell) ? cell : "."))
        .concat(Array(width).fill("."))
        .slice(0, width)
        .join(""),
    );
  }

  function inspect(rows) {
    const map = normalize(rows);
    const stats = { width: map[0].length, height: map.length, walls: 0, lamps: 0, spawns: 0, openSky: 0 };
    for (const row of map) {
      for (const cell of row) {
        if (cell === "#") stats.walls += 1;
        if (cell === "L") stats.lamps += 1;
        if (cell === "S") stats.spawns += 1;
        if (cell === ",") stats.openSky += 1;
      }
    }
    return {
      map,
      stats,
      valid: stats.spawns <= 1,
      errors: stats.spawns > 1 ? ["Карта может содержать только один спавн (S)."] : [],
    };
  }

  global.levelUtils = { SYMBOLS, normalize, inspect };
})(window);
