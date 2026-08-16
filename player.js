let yaw = -89.55;
let pitch = 0;

const moveState = {
  forward: false,
  back: false,
  left: false,
  right: false,
};

const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const glareOverlay = document.createElement("div");
glareOverlay.id = "glareOverlay";
document.body.appendChild(glareOverlay);
const fallState = {
  active: false,
  velocity: 0,
};

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
  if (document.pointerLockElement !== renderer.domElement) return;

  const sensitivity = 0.0022;
  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
});

document.addEventListener("keydown", (e) => {
  if (window.editorActive) return;

  switch (e.code) {
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
  yaw = -89.55;
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
  for (const wall of worldWalls) {
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

function updateMovement(dt) {
  // Do not block movement while falling: allow movement and look during fall.

  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  const baseSpeed = 6;
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

  const nextX = camera.position.x + dx;
  const nextZ = camera.position.z + dz;

  if (!collidesAt(nextX, camera.position.z)) {
    camera.position.x = nextX;
  }
  if (!collidesAt(camera.position.x, nextZ)) {
    camera.position.z = nextZ;
  }

  if (
    typeof window.isInsideArena === "function" &&
    !window.isInsideArena(camera.position.x, camera.position.z)
  ) {
    startFall();
    updateFall(dt);
    return;
  }

  emitDebugInfo(dx, dz, baseSpeed, false);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (
    document.pointerLockElement === renderer.domElement &&
    !window.editorActive
  ) {
    updateMovement(dt);
  } else {
    emitDebugInfo(0, 0, 3.6, fallState.active);
  }

  // glare effect: when looking directly at the brightest lamp core, fade overlay in
  // ВАШ СУЩЕСТВУЮЩИЙ КОД (оставляем как есть)
  let glareStrength = 0;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  // ДОБАВЛЯЕМ ЭТОТ БЛОК В ЦИКЛ for (const lamp of window.lamps || [])
  for (const lamp of window.lamps || []) {
    const lightPos = lamp.mesh ? lamp.mesh.position : lamp.light.position;
    const delta = new THREE.Vector3(
      lightPos.x - camera.position.x,
      lightPos.y - camera.position.y,
      lightPos.z - camera.position.z,
    );
    const distance = delta.length();
    if (distance > 100) continue;

    const dirToLamp = delta.normalize();
    const dot = forward.dot(dirToLamp);

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

  // 🔥 УВЕЛИЧИВАЕМ МАКСИМАЛЬНУЮ ПРОЗРАЧНОСТЬ (теперь до 3.0)
  glareOverlay.style.opacity = String(Math.min(1.0, glareStrength));
  // Always update fall after movement so player can still move/look while descending.
  if (fallState.active) {
    updateFall(dt);
  }

  renderer.render(scene, camera);
}

animate();
refreshStartOverlay();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
