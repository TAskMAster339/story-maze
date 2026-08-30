// Small level registry shared by the game and future projects.
(function attachLevelRegistry(global) {
  const levels = new Map();
  let activeLevelId = null;

  function cloneMap(rows) {
    return global.levelUtils.normalize(rows).slice();
  }

  function registerLevel(id, rows, options = {}) {
    if (!id || typeof id !== "string") {
      throw new TypeError("Идентификатор уровня должен быть непустой строкой.");
    }

    const mapInfo = global.levelUtils.inspect(rows);
    if (!mapInfo.valid) {
      throw new Error(`Нельзя зарегистрировать уровень: ${mapInfo.errors.join(" ")}`);
    }

    levels.set(id, {
      id,
      name: options.name ?? id,
      map: cloneMap(mapInfo.map),
      buildOptions: { ...options.buildOptions },
    });
    return levels.get(id);
  }

  function loadLevel(id) {
    const level = levels.get(id);
    if (!level) throw new Error(`Уровень "${id}" не найден.`);

    global.levelMap = cloneMap(level.map);
    global.spawnPoint = null;
    const spawn = global.rebuildLevelFromMap(level.buildOptions);
    activeLevelId = id;
    return { ...level, spawn };
  }

  function listLevels() {
    return Array.from(levels.values(), ({ id, name }) => ({ id, name }));
  }

  function getActiveLevelId() {
    return activeLevelId;
  }

  registerLevel("main", global.levelMap, { name: "Основной лабиринт" });
  registerLevel("training", [
    "#########",
    "#S......#",
    "#..L....#",
    "#...###.#",
    "#.......#",
    "#########",
  ], { name: "Тренировочная комната" });
  activeLevelId = "main";

  global.levelRegistry = { registerLevel, loadLevel, listLevels, getActiveLevelId };
  global.registerLevel = registerLevel;
  global.loadLevel = loadLevel;
})(window);
