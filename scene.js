const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const PLAYER_HEIGHT = 1.7;
camera.position.set(0, PLAYER_HEIGHT, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// свет — просто чтобы что-то было видно
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(10, 20, 10);
scene.add(dir);

// keep day/night presets
const _dayLight = { hemi: 1.0, dir: 0.8 };
const _nightLight = { hemi: 0.06, dir: 0.04 };

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 🔥 ОГРАНИЧИВАЕМ КАЧЕСТВО ТЕНЕЙ ГЛОБАЛЬНО
renderer.shadowMap.type = THREE.PCFShadowMap; // вместо PCFSoftShadowMap (быстрее)

const ARENA_RADIUS = 36 * 8;
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(ARENA_RADIUS, 96),
  new THREE.MeshStandardMaterial({ color: 0x3a3a3a, side: THREE.DoubleSide }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
floor.receiveShadow = true;

const arenaEdge = new THREE.Mesh(
  new THREE.RingGeometry(ARENA_RADIUS - 0.14, ARENA_RADIUS, 96),
  new THREE.MeshBasicMaterial({
    color: 0xa9c3ff,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
  }),
);
arenaEdge.rotation.x = -Math.PI / 2;
arenaEdge.position.y = 0.02;
scene.add(arenaEdge);

const PLAYER_RADIUS = 0.35;
const LEVEL_CELL_SIZE = 2.2;
const worldWalls = [];
const wallMeshes = [];
const levelGroup = new THREE.Group();
scene.add(levelGroup);
const mazeBounds = {
  minX: -Infinity,
  maxX: Infinity,
  minZ: -Infinity,
  maxZ: Infinity,
  active: false,
};

function isInsideArena(x, z, margin = 0) {
  // Return true only while the player's center is inside the arena radius.
  // Margin defaults to 0 so we only start falling after crossing the edge.
  return Math.hypot(x, z) <= ARENA_RADIUS - margin;
}

const sharedWallMaterial = new THREE.MeshStandardMaterial({
  color: 0x8b5a2b,
});

function createWall(
  x,
  y,
  z,
  width,
  height,
  depth,
  color = 0x8b5a2b,
  rotationY = 0,
) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    sharedWallMaterial,
  );
  wall.position.set(x, y + height / 2, z);
  wall.rotation.y = rotationY;
  wall.castShadow = true;
  wall.receiveShadow = true;
  wall.userData.isWall = true;
  scene.add(wall);
  levelGroup.add(wall);
  wallMeshes.push(wall);

  const quarterTurns = Math.round(rotationY / (Math.PI / 2));
  const rotatedQuarterTurn = Math.abs(quarterTurns) % 2 === 1;
  const boundsWidth = rotatedQuarterTurn ? depth : width;
  const boundsDepth = rotatedQuarterTurn ? width : depth;

  worldWalls.push({
    minX: x - boundsWidth / 2,
    maxX: x + boundsWidth / 2,
    minZ: z - boundsDepth / 2,
    maxZ: z + boundsDepth / 2,
    height,
  });

  return wall;
}

// Lamps (spotlights) support
const lamps = [];

function createLamp(x, y, z, opts = {}) {
  const color = opts.color ?? 0xfff4c2;
  const intensity = opts.intensity ?? 8;
  const distance = opts.distance ?? 18;
  const angle = opts.angle ?? Math.PI / 6;
  const penumbra = opts.penumbra ?? 0.4;

  // 🔥 КОНТРОЛЬ ТЕНЕЙ: только первые 2 лампы
  const castShadow = opts.castShadow ?? lampCounter < 2;
  lampCounter++;

  const spot = new THREE.SpotLight(
    color,
    intensity,
    distance,
    angle,
    penumbra,
    2,
  );
  spot.position.set(x, y, z);
  spot.castShadow = castShadow;

  if (castShadow) {
    spot.shadow.mapSize.width = 512;
    spot.shadow.mapSize.height = 512;
    spot.shadow.camera.near = 0.1;
    spot.shadow.camera.far = distance + 10;
    spot.shadow.bias = -0.002;
  }

  const target = new THREE.Object3D();
  target.position.set(x, y - 4, z);
  scene.add(target);
  spot.target = target;

  // tiny bulb at the lamp point
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(color),
    emissiveIntensity: 8,
    roughness: 0.4,
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), lampMat);
  const lampY = y - 0.15;
  lamp.position.set(x, lampY, z);
  lamp.castShadow = false;
  lamp.receiveShadow = false;

  // thin rope anchored to the top of the cone
  const ropeStart = new THREE.Vector3(x, lampY + 2, z);
  const ropeEnd = new THREE.Vector3(x, 100, z);
  const ropeGeometry = new THREE.BufferGeometry().setFromPoints([
    ropeStart,
    ropeEnd,
  ]);
  const ropeMaterial = new THREE.LineBasicMaterial({
    color: 0xe8dcc1,
    transparent: true,
    opacity: 0.9,
  });
  const rope = new THREE.Line(ropeGeometry, ropeMaterial);
  rope.renderOrder = 10;

  // outer shell: dark and matte, so the light stays inside the shade
  const coneHeight = 2.2;
  const coneRadius = 0.9;
  const coneGeo = new THREE.CylinderGeometry(
    0,
    coneRadius,
    coneHeight,
    24,
    1,
    true,
  );
  coneGeo.translate(0, coneHeight / 2, 0);
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0x1d1d1d,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const shell = new THREE.Mesh(coneGeo, shellMat);
  shell.position.set(x, lampY, z);
  shell.visible = true;

  // bright internal cone: a smaller luminous cone seen from inside the shade
  const innerConeGeo = new THREE.CylinderGeometry(
    0,
    coneRadius * 0.7,
    coneHeight * 0.78,
    20,
    1,
    true,
  );
  innerConeGeo.translate(0, (coneHeight * 0.78) / 2, 0);
  const innerConeMat = new THREE.MeshBasicMaterial({
    color: 0xfff4c2,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const innerCone = new THREE.Mesh(innerConeGeo, innerConeMat);
  innerCone.position.set(x, lampY - 0.05, z);

  // strong glow mesh
  const glowMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), glowMat);
  glow.position.set(x, lampY, z);
  glow.renderOrder = 999;

  levelGroup.add(lamp);
  levelGroup.add(rope);
  levelGroup.add(shell);
  levelGroup.add(innerCone);
  levelGroup.add(glow);
  scene.add(spot);

  const lampObj = {
    light: spot,
    mesh: lamp,
    target,
    rope,
    shell,
    innerCone,
    cone: shell,
    glow,
    castShadow, // ← запоминаем настройку
  };
  lamps.push(lampObj);
  return lampObj;
}
// 🔥 ФУНКЦИЯ ДЛЯ СБРОСА СЧЕТЧИКА ПРИ ОЧИСТКЕ
function resetLampCounter() {
  lampCounter = 0;
}

function setNightMode(on = true) {
  if (on) {
    scene.background = new THREE.Color(0x060712);
    hemi.intensity = _nightLight.hemi;
    dir.intensity = _nightLight.dir;
    for (const lp of lamps) {
      lp.light.intensity = lp.light.intensity ?? 2.4;
      if (lp.cone) lp.cone.visible = true;
      if (lp.glow) lp.glow.visible = true;
    }
  } else {
    scene.background = new THREE.Color(0x87ceeb);
    hemi.intensity = _dayLight.hemi;
    dir.intensity = _dayLight.dir;
    for (const lp of lamps) {
      lp.light.intensity = 0.0;
      if (lp.cone) lp.cone.visible = false;
      if (lp.glow) lp.glow.visible = false;
    }
  }
}

window.createLamp = createLamp;
window.setNightMode = setNightMode;
window.lamps = lamps;

function setMazeBounds(minX, maxX, minZ, maxZ) {
  mazeBounds.minX = minX;
  mazeBounds.maxX = maxX;
  mazeBounds.minZ = minZ;
  mazeBounds.maxZ = maxZ;
  mazeBounds.active = true;
}

function buildMazeFromAsciiMap(rows, options = {}) {
  clearMaze();

  const cellSize = options.cellSize ?? 2;
  // Make walls a square base of `cellSize` and height = 3 * cellSize
  const wallHeight = options.wallHeight ?? cellSize * 3;
  const wallDepth = options.wallDepth ?? 0.45;
  const wallColor = options.wallColor ?? 0x8b5a2b;
  const rowCount = rows.length;
  const colCount = Math.max(...rows.map((row) => row.length));
  const originX = -((colCount - 1) * cellSize) / 2;
  const originZ = -((rowCount - 1) * cellSize) / 2;

  worldWalls.length = 0;

  let spawn = null;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = rows[rowIndex];

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cell = row[colIndex];
      const x = originX + colIndex * cellSize;
      const z = originZ + rowIndex * cellSize;

      if (cell === "#" || cell === "|") {
        createWall(x, 0, z, cellSize, wallHeight, cellSize, wallColor);
      } else if (cell === "L") {
        // place lamp at cell: above walls
        const lampY = wallHeight + 0.6;
        createLamp(x, lampY, z, {
          intensity: 8,
          distance: 12,
          angle: Math.PI / 5,
        });
      } else if (cell === "S") {
        spawn = { x, y: PLAYER_HEIGHT, z };
      }
    }
  }

  setMazeBounds(
    originX - cellSize / 2,
    originX + (colCount - 1) * cellSize + cellSize / 2,
    originZ - cellSize / 2,
    originZ + (rowCount - 1) * cellSize + cellSize / 2,
  );

  return spawn;
}
// Добавляем в clearMaze:
function clearMaze() {
  for (const mesh of wallMeshes) {
    levelGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  wallMeshes.length = 0;
  worldWalls.length = 0;
  mazeBounds.active = false;

  // 🔥 ОЧИЩАЕМ ЛАМПЫ
  for (const lamp of lamps) {
    scene.remove(lamp.light);
    // удаляем другие объекты...
  }
  lamps.length = 0;
  lampCounter = 0; // ← сбрасываем счетчик
}

window.createWall = createWall;
window.buildMazeFromAsciiMap = buildMazeFromAsciiMap;
window.clearMaze = clearMaze;
window.setMazeBounds = setMazeBounds;
window.worldWalls = worldWalls;
window.mazeBounds = mazeBounds;
window.wallMeshes = wallMeshes;
window.levelGroup = levelGroup;
window.LEVEL_CELL_SIZE = LEVEL_CELL_SIZE;
window.ARENA_RADIUS = ARENA_RADIUS;
window.isInsideArena = isInsideArena;
