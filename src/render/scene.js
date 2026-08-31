const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050816);
const mazeFog = new THREE.Fog(0x070b18, 2.5, 29);
scene.fog = mazeFog;

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const PLAYER_HEIGHT = 1.7;
camera.position.set(0, PLAYER_HEIGHT, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  Math.min(window.devicePixelRatio || 1, window.GAME_CONFIG.render.maxPixelRatio),
);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = window.GAME_CONFIG.render.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function createSkyRandom(seed = 0x5a17c9e3) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const skyRadius = 460;
const skyGroup = new THREE.Group();
skyGroup.name = "staticSky";
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(skyRadius, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vSkyDirection;
      void main() {
        vSkyDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vSkyDirection;
      void main() {
        float height = clamp(vSkyDirection.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 lowColor = vec3(0.004, 0.007, 0.025);
        vec3 horizonColor = vec3(0.025, 0.040, 0.105);
        vec3 zenithColor = vec3(0.005, 0.008, 0.035);
        vec3 lowerSky = mix(lowColor, horizonColor, smoothstep(0.0, 0.5, height));
        vec3 upperSky = mix(horizonColor, zenithColor, smoothstep(0.5, 1.0, height));
        gl_FragColor = vec4(height < 0.5 ? lowerSky : upperSky, 1.0);
      }
    `,
  }),
);
sky.renderOrder = -1000;
sky.frustumCulled = false;

const starCount = 2200;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);
const skyRandom = createSkyRandom();
for (let index = 0; index < starCount; index += 1) {
  const y = skyRandom() * 2 - 1;
  const azimuth = skyRandom() * Math.PI * 2;
  const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
  const offset = index * 3;
  starPositions[offset] = Math.cos(azimuth) * horizontal * (skyRadius - 2);
  starPositions[offset + 1] = y * (skyRadius - 2);
  starPositions[offset + 2] = Math.sin(azimuth) * horizontal * (skyRadius - 2);

  const warmth = skyRandom();
  starColors[offset] = 0.72 + warmth * 0.28;
  starColors[offset + 1] = 0.78 + warmth * 0.2;
  starColors[offset + 2] = 0.9 + skyRandom() * 0.1;
  starSizes[index] = skyRandom() < 0.035
    ? 2.4 + skyRandom() * 1.8
    : 0.75 + skyRandom() * 1.25;
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
starGeometry.setAttribute("starSize", new THREE.BufferAttribute(starSizes, 1));
const stars = new THREE.Points(
  starGeometry,
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    vertexShader: `
      attribute float starSize;
      varying vec3 vStarColor;
      void main() {
        vStarColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = starSize;
      }
    `,
    fragmentShader: `
      varying vec3 vStarColor;
      void main() {
        float distanceToCenter = length(gl_PointCoord - vec2(0.5));
        float alpha = 1.0 - smoothstep(0.18, 0.5, distanceToCenter);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vStarColor, alpha);
      }
    `,
  }),
);
stars.renderOrder = -999;
stars.frustumCulled = false;

function createMoonTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const glow = context.createRadialGradient(128, 128, 52, 128, 128, 128);
  glow.addColorStop(0, "rgba(255, 248, 211, 0.34)");
  glow.addColorStop(0.42, "rgba(216, 226, 255, 0.10)");
  glow.addColorStop(1, "rgba(216, 226, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);
  context.beginPath();
  context.arc(128, 128, 66, 0, Math.PI * 2);
  context.fillStyle = "#fff4c7";
  context.shadowColor = "rgba(255, 244, 199, 0.8)";
  context.shadowBlur = 18;
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "rgba(166, 153, 125, 0.22)";
  for (const crater of [[101, 95, 11], [148, 86, 8], [157, 133, 14], [111, 151, 7], [133, 116, 5]]) {
    context.beginPath();
    context.arc(crater[0], crater[1], crater[2], 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const moon = new THREE.Sprite(new THREE.SpriteMaterial({
  map: createMoonTexture(),
  transparent: true,
  depthWrite: false,
  depthTest: false,
  fog: false,
}));
moon.name = "moon";
moon.position.set(42, 20, -3);
moon.scale.set(8, 8, 1);
moon.material.opacity = 0;
moon.renderOrder = -998;

skyGroup.add(sky);
skyGroup.add(stars);
skyGroup.add(moon);
scene.add(skyGroup);
scene.add(camera);

// Небо закреплено на направлении взгляда: оно не имеет параллакса при ходьбе,
// но остаётся неподвижным относительно мира при повороте камеры.
const skyAnchorPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
const SKY_ROTATION_SPEED = 0.0007;
function updateSkyAnchor(position) {
  if (skyAnchorPosition.distanceToSquared(position) < 1e-8) return;
  skyAnchorPosition.copy(position);
  skyGroup.position.copy(position);
}
function updateSkyRotation(dt = 0) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  skyGroup.rotation.y = (skyGroup.rotation.y + dt * SKY_ROTATION_SPEED) % (Math.PI * 2);
}
updateSkyAnchor(camera.position);

// свет — просто чтобы что-то было видно
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(10, 20, 10);
scene.add(dir);

// Мягкий холодный заполняющий свет открытых участков под луной.
// Он не создаёт видимого источника и включается только на клетках `,`.
const moonHemi = new THREE.HemisphereLight(0x91a9df, 0x101426, 0);
moonHemi.name = "moonlight";
scene.add(moonHemi);
let nightMode = true;

// keep day/night presets
const _dayLight = { hemi: 1.0, dir: 0.8 };
const _nightLight = { hemi: 0.06, dir: 0.04 };

renderer.shadowMap.enabled = window.GAME_CONFIG.render.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 🔥 ОГРАНИЧИВАЕМ КАЧЕСТВО ТЕНЕЙ ГЛОБАЛЬНО
renderer.shadowMap.type = THREE.PCFShadowMap; // вместо PCFSoftShadowMap (быстрее)

const ARENA_RADIUS = 36 * 8;
const textureAnisotropy = Math.min(
  renderer.capabilities.getMaxAnisotropy(),
  window.GAME_CONFIG.render.maxAnisotropy,
);
const floorTexture = window.textureSystem.createFloorTexture({
  anisotropy: textureAnisotropy,
});
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(ARENA_RADIUS, 64),
  new THREE.MeshStandardMaterial({
    color: 0x7b7b86,
    map: floorTexture,
    roughness: 0.92,
    side: THREE.DoubleSide,
  }),
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
const wallSpatialHash = new Map();
const WALL_HASH_CELL_SIZE = LEVEL_CELL_SIZE * 2;
const levelGroup = new THREE.Group();
scene.add(levelGroup);
const mazeBounds = {
  minX: -Infinity,
  maxX: Infinity,
  minZ: -Infinity,
  maxZ: Infinity,
  active: false,
};
const teleporters = [];
const billboards = [];
const imageBillboards = [];
const MAX_VISIBLE_IMAGE_BILLBOARDS = 5;
const IMAGE_BILLBOARD_DISTANCE = 72;
const upperFogLayers = [];
const openSkyCells = new Set();
const levelGrid = { originX: 0, originZ: 0, cellSize: LEVEL_CELL_SIZE, active: false };
let fogAmount = 0.58;
let teleportFog = 0;
let lastCameraFar = camera.far;
let lastFogNear = mazeFog.near;
let lastFogFar = mazeFog.far;
let lastUpperFogStrength = -1;
let lastMoonOpacity = -1;
let levelBuildGeneration = 0;

function isInsideMaze(x, z, margin = 0) {
  return mazeBounds.active && x >= mazeBounds.minX - margin && x <= mazeBounds.maxX + margin &&
    z >= mazeBounds.minZ - margin && z <= mazeBounds.maxZ + margin;
}

function getGridCellAt(x, z) {
  if (!levelGrid.active) return null;
  return {
    col: Math.round((x - levelGrid.originX) / levelGrid.cellSize),
    row: Math.round((z - levelGrid.originZ) / levelGrid.cellSize),
  };
}

function isOpenSkyAt(x, z) {
  const cell = getGridCellAt(x, z);
  return !!cell && openSkyCells.has(`${cell.row}:${cell.col}`);
}

function setTeleportFog(strength = 0) {
  teleportFog = THREE.MathUtils.clamp(strength, 0, 1);
}

function beginTeleportFogReveal() {
  teleportFog = 1;
  fogAmount = 1;
  scene.fog = mazeFog;
  mazeFog.near = 0.5;
  mazeFog.far = 4.5;
  if (camera.far !== 60) {
    camera.far = 60;
    camera.updateProjectionMatrix();
    lastCameraFar = camera.far;
  }
  for (const layer of upperFogLayers) {
    layer.visible = true;
    layer.material.opacity = layer.userData.baseOpacity;
  }
}

function updateMazeAtmosphere(x, z, dt = 1 / 60) {
  const outdoors = !isInsideMaze(x, z, 1.5) || isOpenSkyAt(x, z);
  const target = Math.max(outdoors ? 0 : 0.58, teleportFog);
  const smoothing = 1 - Math.exp(-Math.max(dt, 0.001) * (target > fogAmount ? 3.8 : 1.7));
  fogAmount = THREE.MathUtils.lerp(fogAmount, target, smoothing);

  const moonLightTarget = nightMode && isOpenSkyAt(x, z) ? 0.14 : 0;
  moonHemi.intensity = THREE.MathUtils.lerp(
    moonHemi.intensity,
    moonLightTarget,
    1 - Math.exp(-Math.max(dt, 0.001) * 2.8),
  );

  const skyVisible = !isInsideMaze(x, z, 1.5) || isOpenSkyAt(x, z);
  const moonVisibilityTarget = nightMode && skyVisible && fogAmount < 0.22 ? 1 : 0;
  const nextMoonOpacity = THREE.MathUtils.lerp(
    moon.material.opacity,
    moonVisibilityTarget,
    1 - Math.exp(-Math.max(dt, 0.001) * 4.5),
  );
  if (Math.abs(nextMoonOpacity - lastMoonOpacity) > 0.001) {
    moon.material.opacity = nextMoonOpacity;
    lastMoonOpacity = nextMoonOpacity;
  }

  if (fogAmount < 0.006) {
    scene.fog = null;
  } else {
    scene.fog = mazeFog;
    const clearFactor = 1 - fogAmount;
    const nextFogNear = 0.5 + clearFactor ** 4 * 40;
    const nextFogFar = 4.5 + clearFactor ** 4 * 845;
    if (Math.abs(nextFogNear - lastFogNear) > 0.05) {
      mazeFog.near = nextFogNear;
      lastFogNear = nextFogNear;
    }
    if (Math.abs(nextFogFar - lastFogFar) > 0.5) {
      mazeFog.far = nextFogFar;
      lastFogFar = nextFogFar;
    }
  }

  const desiredFar = fogAmount < 0.02 ? 900 : Math.max(60, mazeFog.far + 28);
  if (Math.abs(desiredFar - lastCameraFar) > 1) {
    camera.far = desiredFar;
    camera.updateProjectionMatrix();
    lastCameraFar = desiredFar;
  }

  const upperFogStrength = THREE.MathUtils.clamp(fogAmount / 0.58, 0, 1);
  if (Math.abs(upperFogStrength - lastUpperFogStrength) > 0.001) {
    for (const layer of upperFogLayers) {
      layer.visible = upperFogStrength > 0.01;
      layer.material.opacity = layer.userData.baseOpacity * upperFogStrength;
    }
    lastUpperFogStrength = upperFogStrength;
  }
}

function makeUpperFogTexture(seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(255,255,255,0.28)";
  context.fillRect(0, 0, 128, 128);
  let state = (seed + 1) * 2654435761;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = 0; index < 52; index += 1) {
    const x = random() * 128;
    const y = random() * 128;
    const radius = 10 + random() * 30;
    const alpha = 0.08 + random() * 0.22;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function clearUpperFog() {
  for (const layer of upperFogLayers) {
    levelGroup.remove(layer);
    layer.geometry.dispose();
    layer.material.map?.dispose();
    layer.material.dispose();
  }
  upperFogLayers.length = 0;
}

function buildUpperFog(wallHeight) {
  clearUpperFog();
  if (!mazeBounds.active) return;
  const width = mazeBounds.maxX - mazeBounds.minX;
  const depth = mazeBounds.maxZ - mazeBounds.minZ;
  const centerX = (mazeBounds.minX + mazeBounds.maxX) / 2;
  const centerZ = (mazeBounds.minZ + mazeBounds.maxZ) / 2;
  const layerSettings = [
    { height: wallHeight + 3, opacity: 0.18 },
    { height: wallHeight + 5.5, opacity: 0.28 },
    { height: wallHeight + 8, opacity: 0.4 },
  ];
  layerSettings.forEach((settings, index) => {
    const texture = makeUpperFogTexture(index + 17);
    texture.repeat.set(Math.max(1, width / 28), Math.max(1, depth / 28));
    texture.offset.set(index * 0.19, index * 0.31);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0a1020,
      map: texture,
      transparent: true,
      opacity: settings.opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const layer = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    layer.rotation.x = -Math.PI / 2;
    layer.position.set(centerX, settings.height, centerZ);
    layer.renderOrder = 20 + index;
    layer.userData.baseOpacity = settings.opacity;
    levelGroup.add(layer);
    upperFogLayers.push(layer);
  });
}

function makeBillboardCanvas(title, body, imageUrl = "", buildGeneration = levelBuildGeneration) {
  const layoutWidth = 768;
  const textWidth = 690;
  const lineHeight = 34;
  const bodyText = String(body || "").trim();
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  measureContext.font = "26px Arial";
  const bodyLines = [];
  for (const paragraph of bodyText ? bodyText.split(/\r?\n/) : [""]) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      const next = `${line} ${word}`.trim();
      if (line && measureContext.measureText(next).width > textWidth) {
        bodyLines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) bodyLines.push(line);
  }

  const bodyStart = imageUrl ? 625 : 135;
  const minimumHeight = imageUrl ? 640 : 380;
  const layoutHeight = Math.max(
    minimumHeight,
    bodyStart + Math.max(bodyLines.length, 1) * lineHeight + 28,
  );
  const canvas = document.createElement("canvas");
  // These billboards are viewed at a small world-space size. A 2x backing
  // canvas for every narrative entry creates hundreds of megabytes of CPU
  // canvas memory before WebGL uploads any texture. Keep text crisp while
  // avoiding oversized buffers that cause walking hitching and memory spikes.
  const canvasResolutionScale = imageUrl ? 1.25 : 1.5;
  canvas.width = layoutWidth * canvasResolutionScale;
  canvas.height = layoutHeight * canvasResolutionScale;
  const ctx = canvas.getContext("2d");
  ctx.scale(canvasResolutionScale, canvasResolutionScale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(8, 12, 27, .88)"; ctx.fillRect(0, 0, layoutWidth, layoutHeight);
  ctx.strokeStyle = "rgba(137, 185, 255, .85)"; ctx.lineWidth = 5; ctx.strokeRect(10, 10, layoutWidth - 20, layoutHeight - 20);
  const texture = new THREE.CanvasTexture(canvas);
  // Image billboards are large transparent UI-like surfaces. Generating a
  // complete mipmap chain on their first visible frame causes a noticeable
  // stall (especially when several billboards become visible together).
  // Keep the full-resolution canvas, but use a non-mipmapped filter so the
  // first GPU upload stays small and predictable.
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 1;
  const drawText = () => {
    ctx.fillStyle = "#f4f7ff"; ctx.font = "bold 42px Arial"; ctx.fillText(title, layoutWidth / 2, imageUrl ? 590 : 85);
    ctx.fillStyle = "#c9d7f5"; ctx.font = "26px Arial";
    bodyLines.forEach((line, index) => {
      ctx.fillText(line, layoutWidth / 2, bodyStart + index * lineHeight);
    });
    texture.needsUpdate = true;
  };
  if (imageUrl) {
    const image = new Image();
    image.onload = () => {
      // A level rebuild can dispose this texture before the image request
      // completes. Do not let a stale callback retain or update old GPU data.
      if (buildGeneration !== levelBuildGeneration) {
        texture.dispose();
        return;
      }
      const boxX = 38;
      const boxY = 35;
      const boxWidth = 692;
      const boxHeight = 500;
      const scale = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const drawX = boxX + (boxWidth - drawWidth) / 2;
      const drawY = boxY + (boxHeight - drawHeight) / 2;
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      drawText();
    };
    image.src = imageUrl;
  } else drawText();
  return texture;
}

function createBillboard({ x, y = 3.2, z, title, text, image }) {
  const texture = makeBillboardCanvas(title, text, image, levelBuildGeneration);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  const width = image ? 3.2 : 4.1;
  sprite.position.set(x, y, z);
  sprite.scale.set(width, width * (texture.image.height / texture.image.width), 1);
  sprite.userData.billboard = true;
  sprite.userData.hasImage = Boolean(image);
  levelGroup.add(sprite);
  billboards.push(sprite);
  if (image) imageBillboards.push(sprite);
  return sprite;
}

function addNarrativeContent(options = {}) {
  for (const entry of options.signs || []) createBillboard(entry);
  for (const entry of options.projects || []) createBillboard(entry);
}

let lastVisibilityCell = "";
let pendingImageBillboards = [];

function updateRenderVisibility(x, z) {
  // Admit at most one new large transparent texture per frame. The first
  // render of a CanvasTexture performs its GPU upload; revealing five new
  // billboards at once creates a visible hitch while walking between cells.
  if (pendingImageBillboards.length > 0) {
    pendingImageBillboards.shift().visible = true;
  }

  const visibilityCell = `${Math.floor(x / 8)}:${Math.floor(z / 8)}`;
  if (visibilityCell === lastVisibilityCell) return;
  lastVisibilityCell = visibilityCell;

  const lampDistanceSq = 48 ** 2;
  const nearby = [];
  for (const lamp of lamps) {
    const dx = lamp.mesh.position.x - x;
    const dz = lamp.mesh.position.z - z;
    const distanceSq = dx * dx + dz * dz;
    const visible = distanceSq <= lampDistanceSq;
    lamp.light.visible = visible;
    lamp.mesh.visible = visible;
    lamp.rope.visible = visible;
    lamp.shell.visible = visible;
    lamp.innerCone.visible = visible;
    lamp.glow.visible = visible;
    lamp.floorPool.visible = visible;
    if (visible) nearby.push({ lamp, distanceSq });
  }

  nearby.sort((a, b) => a.distanceSq - b.distanceSq);

  // Image billboards keep their original resolution, but only the closest
  // few participate in rendering. This removes the expensive transparent
  // overdraw from distant screenshots without reducing visible quality.
  const nearbyImages = [];
  for (const billboard of imageBillboards) {
    const dx = billboard.position.x - x;
    const dz = billboard.position.z - z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > IMAGE_BILLBOARD_DISTANCE ** 2) billboard.visible = false;
    if (distanceSq <= IMAGE_BILLBOARD_DISTANCE ** 2) {
      nearbyImages.push({ billboard, distanceSq });
    }
  }
  nearbyImages.sort((a, b) => a.distanceSq - b.distanceSq);
  const desiredImages = nearbyImages
    .slice(0, MAX_VISIBLE_IMAGE_BILLBOARDS)
    .map((entry) => entry.billboard);
  const desiredImageSet = new Set(desiredImages);
  for (const billboard of imageBillboards) {
    if (!desiredImageSet.has(billboard)) billboard.visible = false;
  }
  pendingImageBillboards = desiredImages.filter((billboard) => !billboard.visible);

  for (let index = 0; index < activeLampLights.length; index += 1) {
    const pooled = activeLampLights[index];
    const entry = nearby[index];
    if (!entry) {
      pooled.light.intensity = 0;
      continue;
    }
    const source = entry.lamp.light;
    pooled.light.position.copy(source.position);
    pooled.target.position.set(source.position.x, source.position.y - 4, source.position.z);
    pooled.light.color.copy(source.color);
    pooled.light.intensity = source.intensity;
    pooled.light.distance = source.distance;
    pooled.light.angle = source.angle;
    pooled.light.penumbra = source.penumbra;
    pooled.light.decay = source.decay;
    pooled.target.updateMatrixWorld();
  }
}
function isInsideArena(x, z, margin = 0) {
  // Return true only while the player's center is inside the arena radius.
  // Margin defaults to 0 so we only start falling after crossing the edge.
  return Math.hypot(x, z) <= ARENA_RADIUS - margin;
}

const sharedWallMaterial = new THREE.MeshStandardMaterial({
  color: 0xb07b4c,
  map: window.textureSystem.createWallTexture({
    anisotropy: textureAnisotropy,
  }),
  roughness: 0.82,
});
let lampCounter = 0;

function addWallToSpatialHash(bounds) {
  const minCellX = Math.floor(bounds.minX / WALL_HASH_CELL_SIZE);
  const maxCellX = Math.floor(bounds.maxX / WALL_HASH_CELL_SIZE);
  const minCellZ = Math.floor(bounds.minZ / WALL_HASH_CELL_SIZE);
  const maxCellZ = Math.floor(bounds.maxZ / WALL_HASH_CELL_SIZE);
  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      const key = `${cellX}:${cellZ}`;
      if (!wallSpatialHash.has(key)) wallSpatialHash.set(key, []);
      wallSpatialHash.get(key).push(bounds);
    }
  }
}

function getNearbyWalls(x, z, radius = 0) {
  const nearby = new Set();
  const minCellX = Math.floor((x - radius) / WALL_HASH_CELL_SIZE);
  const maxCellX = Math.floor((x + radius) / WALL_HASH_CELL_SIZE);
  const minCellZ = Math.floor((z - radius) / WALL_HASH_CELL_SIZE);
  const maxCellZ = Math.floor((z + radius) / WALL_HASH_CELL_SIZE);
  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (const wall of wallSpatialHash.get(`${cellX}:${cellZ}`) || []) nearby.add(wall);
    }
  }
  return nearby;
}

function segmentIntersectsWallBounds(x1, z1, x2, z2, wall) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  let tMin = 0;
  let tMax = 1;
  for (const [origin, delta, min, max] of [
    [x1, dx, wall.minX, wall.maxX],
    [z1, dz, wall.minZ, wall.maxZ],
  ]) {
    if (Math.abs(delta) < 1e-8) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const inverse = 1 / delta;
    let near = (min - origin) * inverse;
    let far = (max - origin) * inverse;
    if (near > far) [near, far] = [far, near];
    tMin = Math.max(tMin, near);
    tMax = Math.min(tMax, far);
    if (tMin > tMax) return false;
  }
  return tMax >= 0 && tMin <= 1;
}

function isWallBetween(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / (WALL_HASH_CELL_SIZE * 0.5)));
  const candidates = new Set();
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const cellX = Math.floor((x1 + dx * ratio) / WALL_HASH_CELL_SIZE);
    const cellZ = Math.floor((z1 + dz * ratio) / WALL_HASH_CELL_SIZE);
    for (const wall of wallSpatialHash.get(`${cellX}:${cellZ}`) || []) candidates.add(wall);
  }
  for (const wall of candidates) {
    if (segmentIntersectsWallBounds(x1, z1, x2, z2, wall)) return true;
  }
  return false;
}

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
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uvScale = Math.max(width, depth) / LEVEL_CELL_SIZE;
  for (let index = 0; index < geometry.attributes.uv.count; index += 1) {
    geometry.attributes.uv.setX(index, geometry.attributes.uv.getX(index) * uvScale);
  }
  const wall = new THREE.Mesh(geometry, sharedWallMaterial);
  wall.position.set(x, y + height / 2, z);
  wall.rotation.y = rotationY;
  wall.castShadow = true;
  wall.receiveShadow = true;
  wall.userData.isWall = true;
  levelGroup.add(wall);
  wallMeshes.push(wall);

  const quarterTurns = Math.round(rotationY / (Math.PI / 2));
  const rotatedQuarterTurn = Math.abs(quarterTurns) % 2 === 1;
  const boundsWidth = rotatedQuarterTurn ? depth : width;
  const boundsDepth = rotatedQuarterTurn ? width : depth;

  const wallBounds = {
    minX: x - boundsWidth / 2,
    maxX: x + boundsWidth / 2,
    minZ: z - boundsDepth / 2,
    maxZ: z + boundsDepth / 2,
    height,
  };
  worldWalls.push(wallBounds);
  addWallToSpatialHash(wallBounds);

  return wall;
}

function mergeWallMeshes() {
  if (wallMeshes.length < 2) return wallMeshes[0] ?? null;

  const transformed = [];
  let vertexCount = 0;
  for (const wall of wallMeshes) {
    wall.updateMatrix();
    const geometry = wall.geometry.index
      ? wall.geometry.toNonIndexed()
      : wall.geometry.clone();
    geometry.applyMatrix4(wall.matrix);
    transformed.push(geometry);
    vertexCount += geometry.attributes.position.count;
  }

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  let positionOffset = 0;
  let normalOffset = 0;
  let uvOffset = 0;
  for (const geometry of transformed) {
    positions.set(geometry.attributes.position.array, positionOffset);
    normals.set(geometry.attributes.normal.array, normalOffset);
    uvs.set(geometry.attributes.uv.array, uvOffset);
    positionOffset += geometry.attributes.position.array.length;
    normalOffset += geometry.attributes.normal.array.length;
    uvOffset += geometry.attributes.uv.array.length;
    geometry.dispose();
  }

  const mergedGeometry = new THREE.BufferGeometry();
  mergedGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  mergedGeometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  mergedGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  mergedGeometry.computeBoundingBox();
  mergedGeometry.computeBoundingSphere();

  for (const wall of wallMeshes) {
    levelGroup.remove(wall);
    wall.geometry.dispose();
  }
  wallMeshes.length = 0;

  const mergedWall = new THREE.Mesh(mergedGeometry, sharedWallMaterial);
  mergedWall.castShadow = true;
  mergedWall.receiveShadow = true;
  mergedWall.userData.isWall = true;
  mergedWall.userData.mergedWallCount = transformed.length;
  levelGroup.add(mergedWall);
  wallMeshes.push(mergedWall);
  return mergedWall;
}

// Lamps (spotlights) support
const lamps = [];
const ACTIVE_LAMP_LIGHT_COUNT = 4;
const activeLampLights = Array.from({ length: ACTIVE_LAMP_LIGHT_COUNT }, () => {
  const light = new THREE.SpotLight(0xfff4c2, 0, 12, Math.PI / 5, 0.4, 2);
  const target = new THREE.Object3D();
  light.castShadow = false;
  light.target = target;
  scene.add(light);
  scene.add(target);
  return { light, target };
});
window.activeLampLights = activeLampLights;

const lampFloorGlowCanvas = document.createElement("canvas");
lampFloorGlowCanvas.width = 128;
lampFloorGlowCanvas.height = 128;
const lampFloorGlowContext = lampFloorGlowCanvas.getContext("2d");
const lampFloorGlowGradient = lampFloorGlowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
lampFloorGlowGradient.addColorStop(0, "rgba(255,255,255,0.95)");
lampFloorGlowGradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
lampFloorGlowGradient.addColorStop(1, "rgba(255,255,255,0)");
lampFloorGlowContext.fillStyle = lampFloorGlowGradient;
lampFloorGlowContext.fillRect(0, 0, 128, 128);
const lampFloorGlowTexture = new THREE.CanvasTexture(lampFloorGlowCanvas);
lampFloorGlowTexture.minFilter = THREE.LinearFilter;
lampFloorGlowTexture.magFilter = THREE.LinearFilter;

function createLamp(x, y, z, opts = {}) {
  const color = opts.color ?? 0xfff4c2;
  const intensity = opts.intensity ?? 8;
  const distance = opts.distance ?? 18;
  const angle = opts.angle ?? Math.PI / 6;
  const penumbra = opts.penumbra ?? 0.4;

  // Dynamic lamp shadows force expensive shadow-map refreshes while walking.
  // Fixtures keep emissive geometry; a fixed light pool handles illumination.
  const castShadow = false;
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
  spot.castShadow = false;

  const target = new THREE.Object3D();
  target.position.set(x, y - 4, z);
  spot.target = target;

  // tiny bulb at the lamp point
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(color),
    emissiveIntensity: 8,
    roughness: 0.4,
    fog: false,
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), lampMat);
  const lampY = y - 0.15;
  lamp.position.set(x, lampY, z);
  lamp.castShadow = false;
  lamp.receiveShadow = false;

  // thin rope anchored to the top of the cone
  const ropeStart = new THREE.Vector3(x, lampY + 2, z);
  const ropeEnd = new THREE.Vector3(x, 100, z);
  const ropeLength = ropeEnd.y - ropeStart.y;
  const ropeGeometry = new THREE.CylinderGeometry(0.022, 0.022, ropeLength, 6);
  const ropeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ropeColor: { value: new THREE.Color(0xe8dcc1) },
      ropeOpacity: { value: 0.9 },
    },
    vertexShader: `
      varying vec2 vRopeUv;
      void main() {
        vRopeUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 ropeColor;
      uniform float ropeOpacity;
      varying vec2 vRopeUv;
      void main() {
        // Keep the section near the lamp readable, then let the upper
        // section dissolve into the denser ceiling haze. The rope geometry
        // remains full length; only its visibility is attenuated.
        float fade = 1.0 - smoothstep(0.14, 0.56, vRopeUv.y);
        float alpha = ropeOpacity * fade;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(ropeColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
  rope.position.set(x, (ropeStart.y + ropeEnd.y) / 2, z);
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
    fog: false,
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
    fog: false,
  });
  const innerCone = new THREE.Mesh(innerConeGeo, innerConeMat);
  innerCone.position.set(x, lampY - 0.05, z);

  // strong glow mesh
  const glowMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    fog: false,
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), glowMat);
  glow.position.set(x, lampY, z);
  glow.renderOrder = 999;

  const floorPoolMaterial = new THREE.MeshBasicMaterial({
    color,
    map: lampFloorGlowTexture,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const floorPool = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 32),
    floorPoolMaterial,
  );
  floorPool.rotation.x = -Math.PI / 2;
  floorPool.position.set(x, 0.025, z);
  floorPool.renderOrder = 2;

  levelGroup.add(lamp);
  levelGroup.add(rope);
  levelGroup.add(shell);
  levelGroup.add(innerCone);
  levelGroup.add(glow);
  levelGroup.add(floorPool);
  const lampObj = {
    light: spot,
    mesh: lamp,
    target,
    rope,
    shell,
    innerCone,
    cone: shell,
    glow,
    floorPool,
    castShadow,
  };
  lamps.push(lampObj);
  return lampObj;
}
// 🔥 ФУНКЦИЯ ДЛЯ СБРОСА СЧЕТЧИКА ПРИ ОЧИСТКЕ
function resetLampCounter() {
  lampCounter = 0;
}

function setNightMode(on = true) {
  nightMode = on;
  if (on) {
    scene.background = new THREE.Color(0x060712);
    hemi.intensity = _nightLight.hemi;
    dir.intensity = _nightLight.dir;
    for (const lp of lamps) {
      lp.light.intensity = lp.light.intensity ?? 2.4;
      if (lp.cone) lp.cone.visible = true;
      if (lp.glow) lp.glow.visible = true;
      if (lp.floorPool) lp.floorPool.visible = true;
    }
  } else {
    scene.background = new THREE.Color(0x87ceeb);
    hemi.intensity = _dayLight.hemi;
    dir.intensity = _dayLight.dir;
    moonHemi.intensity = 0;
    moon.material.opacity = 0;
    for (const lp of lamps) {
      lp.light.intensity = 0.0;
      if (lp.cone) lp.cone.visible = false;
      if (lp.glow) lp.glow.visible = false;
      if (lp.floorPool) lp.floorPool.visible = false;
    }
  }
  lastVisibilityCell = "";
  if (!on) {
    for (const pooled of activeLampLights) pooled.light.intensity = 0;
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
  const mapInfo = window.levelUtils.inspect(rows);
  if (!mapInfo.valid) {
    throw new Error(`Некорректная карта: ${mapInfo.errors.join(" ")}`);
  }
  rows = mapInfo.map;
  clearMaze();

  const cellSize = options.cellSize ?? 2;
  // Make walls a square base of `cellSize` and height = 3 * cellSize
  const wallHeight = options.wallHeight ?? cellSize * 3;
  const wallDepth = options.wallDepth ?? 0.45;
  const wallColor = options.wallColor ?? 0x8b5a2b;
  const rowCount = rows.length;
  const colCount = Math.max(...rows.map((row) => row.length));
  const occupiedCells = rows.flatMap((row, rowIndex) =>
    [...row].map((cell, colIndex) => ({ cell, rowIndex, colIndex })).filter(({ cell }) => cell !== "."),
  );
  const occupied = {
    minRow: Math.min(...occupiedCells.map(({ rowIndex }) => rowIndex)),
    maxRow: Math.max(...occupiedCells.map(({ rowIndex }) => rowIndex)),
    minCol: Math.min(...occupiedCells.map(({ colIndex }) => colIndex)),
    maxCol: Math.max(...occupiedCells.map(({ colIndex }) => colIndex)),
  };
  const originX = -((colCount - 1) * cellSize) / 2;
  const originZ = -((rowCount - 1) * cellSize) / 2;
  levelGrid.originX = originX;
  levelGrid.originZ = originZ;
  levelGrid.cellSize = cellSize;
  levelGrid.active = true;

  worldWalls.length = 0;

  let spawn = null;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = rows[rowIndex];

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cell = row[colIndex];
      const x = originX + colIndex * cellSize;
      const z = originZ + rowIndex * cellSize;

      if (cell === "#") {
        let runEnd = colIndex + 1;
        while (runEnd < row.length && row[runEnd] === "#") runEnd += 1;
        const runLength = runEnd - colIndex;
        const runCenterX = x + ((runLength - 1) * cellSize) / 2;
        createWall(runCenterX, 0, z, runLength * cellSize, wallHeight, cellSize, wallColor);
        colIndex = runEnd - 1;
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
      } else if (cell === "T") {
        teleporters.push({ x, z, radius: options.teleportRadius ?? cellSize * 0.7 });
      } else if (cell === ",") {
        openSkyCells.add(`${rowIndex}:${colIndex}`);
      }
    }
  }

  setMazeBounds(
    originX + (occupied.minCol - 1) * cellSize,
    originX + (occupied.maxCol + 1) * cellSize,
    originZ + (occupied.minRow - 1) * cellSize,
    originZ + (occupied.maxRow + 1) * cellSize,
  );

  buildUpperFog(wallHeight);
  mergeWallMeshes();
  addNarrativeContent(options.narrative);

  return spawn;
}
// Добавляем в clearMaze:
function clearMaze() {
  levelBuildGeneration += 1;
  window.dispatchEvent(new Event("mazelevelclear"));
  clearUpperFog();
  for (const mesh of wallMeshes) {
    levelGroup.remove(mesh);
    mesh.geometry.dispose();
  }

  wallMeshes.length = 0;
  worldWalls.length = 0;
  wallSpatialHash.clear();
  for (const billboard of billboards) {
    levelGroup.remove(billboard);
    billboard.material.map?.dispose();
    billboard.material.dispose();
  }
  billboards.length = 0;
  imageBillboards.length = 0;
  teleporters.length = 0;
  openSkyCells.clear();
  levelGrid.active = false;
  lastVisibilityCell = "";
  mazeBounds.active = false;

  // 🔥 ОЧИЩАЕМ ЛАМПЫ
  for (const lamp of lamps) {
    scene.remove(lamp.light);
    scene.remove(lamp.target);
    for (const object of [
      lamp.mesh,
      lamp.rope,
      lamp.shell,
      lamp.innerCone,
      lamp.glow,
      lamp.floorPool,
    ]) {
      levelGroup.remove(object);
      object.geometry.dispose();
      object.material.dispose();
    }
  }
  lamps.length = 0;
  lampCounter = 0;
  for (const pooled of activeLampLights) pooled.light.intensity = 0;
}

window.createWall = createWall;
window.scene = scene;
window.camera = camera;
window.updateSkyAnchor = updateSkyAnchor;
window.updateSkyRotation = updateSkyRotation;
window.skyGroup = skyGroup;
window.stars = stars;
window.moon = moon;
window.buildMazeFromAsciiMap = buildMazeFromAsciiMap;
window.clearMaze = clearMaze;
window.setMazeBounds = setMazeBounds;
window.worldWalls = worldWalls;
window.getNearbyWalls = getNearbyWalls;
window.isWallBetween = isWallBetween;
window.mazeBounds = mazeBounds;
window.wallMeshes = wallMeshes;
window.levelGroup = levelGroup;
window.LEVEL_CELL_SIZE = LEVEL_CELL_SIZE;
window.ARENA_RADIUS = ARENA_RADIUS;
window.isInsideArena = isInsideArena;
window.isInsideMaze = isInsideMaze;
window.isOpenSkyAt = isOpenSkyAt;
window.updateMazeAtmosphere = updateMazeAtmosphere;
window.setTeleportFog = setTeleportFog;
window.beginTeleportFogReveal = beginTeleportFogReveal;
window.updateRenderVisibility = updateRenderVisibility;
window.teleporters = teleporters;
window.imageBillboards = imageBillboards;
window.addNarrativeContent = addNarrativeContent;
