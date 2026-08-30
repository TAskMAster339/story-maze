const SPAWN_YAW = THREE.MathUtils.degToRad(-89.55);
let yaw = SPAWN_YAW;
let pitch = 0;

const moveState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  run: false,
};
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const glareOverlay = document.createElement("div");
glareOverlay.id = "glareOverlay";
document.body.appendChild(glareOverlay);
const teleportFadeOverlay = document.createElement("div");
teleportFadeOverlay.id = "teleportFadeOverlay";
document.body.appendChild(teleportFadeOverlay);
const fallState = {
  active: false,
  velocity: 0,
};
let teleportCooldown = 0;
const teleportTransition = {
  phase: "idle",
  elapsed: 0,
};
const TELEPORT_DARKEN_SECONDS = 0.45;
const TELEPORT_HOLD_SECONDS = 0.12;
const TELEPORT_REVEAL_SECONDS = 1.6;

function smoothStep(progress) {
  const value = THREE.MathUtils.clamp(progress, 0, 1);
  return value * value * (3 - 2 * value);
}

function moveToTeleportSpawn() {
  const spawn = getSpawnPoint();
  const leftOffset = 1.35;
  const leftX = -Math.sin(SPAWN_YAW + Math.PI / 2);
  const leftZ = -Math.cos(SPAWN_YAW + Math.PI / 2);
  camera.position.set(
    spawn.x + leftX * leftOffset,
    spawn.y,
    spawn.z + leftZ * leftOffset,
  );
  yaw = SPAWN_YAW;
  pitch = 0;
  camera.rotation.set(0, yaw, 0);
  teleportCooldown = 1.5;
  window.beginTeleportFogReveal?.();
  window.updateRenderVisibility?.(camera.position.x, camera.position.z);
}

function startTeleportTransition() {
  if (teleportTransition.phase !== "idle") return;
  teleportTransition.phase = "darken";
  teleportTransition.elapsed = 0;
  teleportFadeOverlay.style.opacity = "0";
  glareOverlay.style.opacity = "0";
  window.setTeleportFog?.(1);
}

function updateTeleportTransition(dt) {
  if (teleportTransition.phase === "idle") return false;
  teleportTransition.elapsed += dt;
  glareOverlay.style.opacity = "0";

  if (teleportTransition.phase === "darken") {
    const progress = teleportTransition.elapsed / TELEPORT_DARKEN_SECONDS;
    teleportFadeOverlay.style.opacity = String(smoothStep(progress));
    window.setTeleportFog?.(1);
    if (progress >= 1) {
      teleportFadeOverlay.style.opacity = "1";
      moveToTeleportSpawn();
      teleportTransition.phase = "hold";
      teleportTransition.elapsed = 0;
    }
    return true;
  }

  if (teleportTransition.phase === "hold") {
    teleportFadeOverlay.style.opacity = "1";
    window.setTeleportFog?.(1);
    if (teleportTransition.elapsed >= TELEPORT_HOLD_SECONDS) {
      teleportTransition.phase = "reveal";
      teleportTransition.elapsed = 0;
    }
    return true;
  }

  const progress = THREE.MathUtils.clamp(
    teleportTransition.elapsed / TELEPORT_REVEAL_SECONDS,
    0,
    1,
  );
  const reveal = smoothStep(progress);
  teleportFadeOverlay.style.opacity = String(1 - reveal);
  window.setTeleportFog?.(THREE.MathUtils.lerp(1, 0.58, reveal));
  if (progress >= 1) {
    window.setTeleportFog?.(0);
    teleportFadeOverlay.style.opacity = "0";
    teleportTransition.phase = "idle";
    teleportTransition.elapsed = 0;
  }
  return true;
}

function checkSeamlessTeleport(dt) {
  teleportCooldown = Math.max(0, teleportCooldown - dt);
  if (teleportTransition.phase !== "idle") return;
  if (!Array.isArray(window.teleporters) || window.teleporters.length === 0) return;

  let nearest = null;
  let nearestDistance = Infinity;
  for (const point of window.teleporters) {
    const distance = Math.hypot(camera.position.x - point.x, camera.position.z - point.z);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  const approachDistance = 8;
  const approachProgress = THREE.MathUtils.clamp(
    (approachDistance - nearestDistance) / (approachDistance - nearest.radius),
    0,
    1,
  );
  const fogStrength = approachProgress > 0
    ? 0.58 + (1 - 0.58) * approachProgress ** 2
    : 0;
  window.setTeleportFog?.(fogStrength);
  if (teleportCooldown > 0 || nearestDistance >= nearest.radius) return;

  startTeleportTransition();
}

function refreshStartOverlay() {
  overlay.style.display =
    window.editorActive || document.pointerLockElement === renderer.domElement
      ? "none"
      : "flex";
}

window.refreshStartOverlay = refreshStartOverlay;

startBtn.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener("pointerlockchange", refreshStartOverlay);

document.addEventListener("mousemove", (e) => {
  if (window.editorActive) return;
  if (teleportTransition.phase !== "idle") return;
  if (document.pointerLockElement !== renderer.domElement) return;

  const { lookSensitivity, maxMouseDelta } = window.GAME_CONFIG.player;
  const clampDelta = (value) =>
    Math.max(-maxMouseDelta, Math.min(maxMouseDelta, value));
  yaw -= clampDelta(e.movementX) * lookSensitivity;
  pitch -= clampDelta(e.movementY) * lookSensitivity;
  pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
});

document.addEventListener("keydown", (e) => {
  if (window.editorActive) return;

  switch (e.code) {
    case "ShiftLeft":
    case "ShiftRight":
      moveState.run = true;
      break;
    case "KeyW":
    case "ArrowUp":
      moveState.forward = true;
      break;
    case "KeyS":
    case "ArrowDown":
      moveState.back = true;
      break;
    case "KeyA":
    case "ArrowLeft":
      moveState.left = true;
      break;
    case "KeyD":
    case "ArrowRight":
      moveState.right = true;
      break;
  }
});

document.addEventListener("keyup", (e) => {
  if (window.editorActive) return;

  switch (e.code) {
    case "ShiftLeft":
    case "ShiftRight":
      moveState.run = false;
      break;
    case "KeyW":
    case "ArrowUp":
      moveState.forward = false;
      break;
    case "KeyS":
    case "ArrowDown":
      moveState.back = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      moveState.left = false;
      break;
    case "KeyD":
    case "ArrowRight":
      moveState.right = false;
      break;
  }
});

function getSpawnPoint() {
  return window.spawnPoint || { x: 0, y: PLAYER_HEIGHT, z: 0 };
}

function respawnPlayer() {
  const spawn = getSpawnPoint();
  camera.position.set(spawn.x, spawn.y, spawn.z);
  yaw = SPAWN_YAW;
  pitch = 0;
  camera.rotation.set(0, 0, 0);
  fallState.active = false;
  fallState.velocity = 0;
}

function startFall() {
  if (fallState.active) return;
  fallState.active = true;
  fallState.velocity = 0;
}

function emitDebugInfo(dx, dz, baseSpeed, falling) {
  if (typeof window.setDebugInfo !== "function") {
    return;
  }

  window.setDebugInfo({
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    yawRad: yaw,
    yawDeg: (yaw * 180) / Math.PI,
    pitchRad: pitch,
    pitchDeg: (pitch * 180) / Math.PI,
    dx,
    dz,
    speed: baseSpeed,
    run: moveState.run,
    pointerLocked: document.pointerLockElement === renderer.domElement,
    falling,
  });
}

function updateFall(dt) {
  // Slower fall: lower acceleration so descent takes longer before respawn.
  const GRAVITY = 6; // reduced from 18
  fallState.velocity += GRAVITY * dt;
  camera.position.y -= fallState.velocity * dt;

  // Let player fall further before respawn so the fall appears longer.
  if (camera.position.y < -30) {
    respawnPlayer();
  }

  emitDebugInfo(0, 0, 3.6, true);
}

function collidesAt(x, z) {
  const candidates = typeof window.getNearbyWalls === "function"
    ? window.getNearbyWalls(x, z, PLAYER_RADIUS)
    : worldWalls;
  for (const wall of candidates) {
    if (
      x > wall.minX - PLAYER_RADIUS &&
      x < wall.maxX + PLAYER_RADIUS &&
      z > wall.minZ - PLAYER_RADIUS &&
      z < wall.maxZ + PLAYER_RADIUS
    ) {
      return true;
    }
  }

  return false;
}

const clock = new THREE.Clock();
const glareForward = new THREE.Vector3();
const glareDelta = new THREE.Vector3();

function updateMovement(dt) {
  // Do not block movement while falling: allow movement and look during fall.

  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  const baseSpeed = moveState.run
    ? window.GAME_CONFIG.player.runSpeed
    : window.GAME_CONFIG.player.walkSpeed;
  const speed = baseSpeed * dt;
  let dx = 0;
  let dz = 0;

  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.sin(yaw + Math.PI / 2);
  const rz = Math.cos(yaw + Math.PI / 2);

  if (moveState.forward) {
    dx -= fx * speed;
    dz -= fz * speed;
  }
  if (moveState.back) {
    dx += fx * speed;
    dz += fz * speed;
  }
  if (moveState.left) {
    dx -= rx * speed;
    dz -= rz * speed;
  }
  if (moveState.right) {
    dx += rx * speed;
    dz += rz * speed;
  }

  const movementLength = Math.hypot(dx, dz);
  if (movementLength > speed) {
    const scale = speed / movementLength;
    dx *= scale;
    dz *= scale;
  }

  const nextX = camera.position.x + dx;
  const nextZ = camera.position.z + dz;

  if (!collidesAt(nextX, camera.position.z)) {
    camera.position.x = nextX;
  }
  if (!collidesAt(camera.position.x, nextZ)) {
    camera.position.z = nextZ;
  }

  checkSeamlessTeleport(dt);
  if (typeof window.updateMazeAtmosphere === "function") {
    window.updateMazeAtmosphere(camera.position.x, camera.position.z, dt);
  }

  if (
    typeof window.isInsideArena === "function" &&
    !window.isInsideArena(camera.position.x, camera.position.z)
  ) {
    startFall();
    return;
  }

  emitDebugInfo(dx, dz, baseSpeed, false);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const teleporting = updateTeleportTransition(dt);

  if (
    document.pointerLockElement === renderer.domElement &&
    !window.editorActive
  ) {
    updateMovement(dt);
  } else {
    if (teleporting) {
      window.updateMazeAtmosphere?.(camera.position.x, camera.position.z, dt);
    }
    emitDebugInfo(0, 0, 3.6, fallState.active);
  }

  if (typeof window.updateRenderVisibility === "function") {
    window.updateRenderVisibility(camera.position.x, camera.position.z, dt);
  }

  // glare effect: when looking directly at the brightest lamp core, fade overlay in
  let glareStrength = 0;
  if (!teleporting) {
    camera.getWorldDirection(glareForward);

    for (const lamp of window.lamps || []) {
      if (lamp.mesh && !lamp.mesh.visible) continue;
      const lightPos = lamp.mesh ? lamp.mesh.position : lamp.light.position;
      glareDelta.set(
        lightPos.x - camera.position.x,
        lightPos.y - camera.position.y,
        lightPos.z - camera.position.z,
      );
      const distance = glareDelta.length();
      if (distance > 48 || distance < 1e-5) continue;

      glareDelta.multiplyScalar(1 / distance);
      const dot = glareForward.dot(glareDelta);

      const mightGlare = dot > 0.96 || (distance < 3.0 && dot > 0.3);
      if (!mightGlare) continue;

      if (window.isWallBetween?.(
        camera.position.x,
        camera.position.z,
        lightPos.x,
        lightPos.z,
      )) continue;

    // 🔥 ОСЛЕПЛЕНИЕ ВСЕГО ЭКРАНА ПРИ БЛИЗОСТИ
    // Настройки (подберите под свой вкус)
    const BLIND_DISTANCE = 3.0; // дистанция полного ослепления
    const BLIND_ANGLE = 0.3; // угол обзора (чем меньше, тем шире)

    // Если лампа близко и мы смотрим в её сторону
      if (distance < BLIND_DISTANCE && dot > BLIND_ANGLE) {
      // Сила ослепления: максимальная при distance=0
      const distanceFactor = Math.max(0, 1 - distance / BLIND_DISTANCE);
      // Насколько точно смотрим на лампу (от 0 до 1)
      const lookFactor = Math.max(0, (dot - BLIND_ANGLE) / (1 - BLIND_ANGLE));

      // ОСЛЕПЛЕНИЕ - сила может быть > 1 для полного белого экрана
      const blindStrength = distanceFactor * 3.0 * lookFactor;

      // Добавляем к основному блику
        glareStrength = Math.max(glareStrength, blindStrength);
      }

    // СУЩЕСТВУЮЩИЙ БЛИК (оставляем)
      if (dot > 0.96) {
        glareStrength = Math.max(
          glareStrength,
          (dot - 0.96) * 40 + (1 - distance / 12) * 0.9,
        );
      }
    }
  }

  // 🔥 УВЕЛИЧИВАЕМ МАКСИМАЛЬНУЮ ПРОЗРАЧНОСТЬ (теперь до 3.0)
  glareOverlay.style.opacity = String(Math.min(1.0, glareStrength));
  // Always update fall after movement so player can still move/look while descending.
  if (fallState.active && !teleporting) {
    updateFall(dt);
  }

  renderer.render(scene, camera);
}

animate();
refreshStartOverlay();
window.teleportTransition = teleportTransition;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
