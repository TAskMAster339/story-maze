# Maze Web Game

## Structure

```text
.
├── index.html                 # Entry point and dependency order
├── README.md                  # This guide
├── src/
│   ├── core/
│   │   ├── game-config.js     # Runtime settings and quality limits
│   │   ├── level-utils.js     # Map normalization and validation
│   │   └── runtime-loader.js  # Optional development modules loader
│   ├── render/
│   │   ├── scene.js           # Three.js scene, world rendering, collisions
│   │   └── texture-system.js  # Procedural texture factory and cache
│   ├── world/
│   │   ├── maze-level2.js     # Current level data and level bootstrap
│   │   └── level-registry.js  # Register/load/list levels
│   ├── player/
│   │   └── player.js          # Camera, controls and movement
│   ├── ui/
│   │   ├── debug.js           # Development HUD and level selector
│   │   ├── editor.js          # In-browser map editor
│   │   └── style.css          # Global and development UI styles
│   └── levels/
│       └── legacy/
│           └── maze-level.js  # Old map kept for reference only
└── ...                        # Static images and experiments
```

## Startup order

`index.html` loads modules in dependency order:

1. Three.js CDN;
2. `core/game-config.js`;
3. `render/texture-system.js` and `core/level-utils.js`;
4. `render/scene.js`;
5. `world/maze-level2.js`;
6. `world/level-registry.js`;
7. `core/runtime-loader.js`;
8. development UI/editor (only when `GAME_CONFIG.debug` is `true`);
9. player controls.

## Where to make changes

- New shared runtime behavior: `src/core/`.
- Lighting, meshes, walls and collisions: `src/render/scene.js`.
- New procedural materials: `src/render/texture-system.js`.
- New maps: register them in `src/world/level-registry.js` or a separate module in `src/world/`.
- Movement and camera: `src/player/player.js`.
- Developer-only tools: `src/ui/`.
- Quality/performance defaults and camera look limits: `src/core/game-config.js`.

## Production mode

Set `debug: false` in `src/core/game-config.js`. The loader then skips the debug HUD and editor and loads only player controls.

## Adding a level

Use the public registry API:

```js
registerLevel("my-level", ["####", "#S.#", "####"], {
  cellSize: 2.2,
});
loadLevel("my-level");
```

Maps are normalized and validated before they are registered or built.
