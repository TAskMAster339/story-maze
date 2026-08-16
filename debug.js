const debugOverlay = document.createElement("div");
debugOverlay.id = "debugOverlay";
debugOverlay.innerHTML = `
  <div class="debug-title">DEBUG</div>
  <div class="debug-gizmo-wrap">
    <canvas class="debug-gizmo"></canvas>
  </div>
  <div class="debug-body">loading...</div>
`;
document.body.appendChild(debugOverlay);

const debugBody = debugOverlay.querySelector(".debug-body");
const gizmoCanvas = debugOverlay.querySelector(".debug-gizmo");

const gizmoRenderer = new THREE.WebGLRenderer({
  canvas: gizmoCanvas,
  alpha: true,
  antialias: true,
});
gizmoRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const gizmoScene = new THREE.Scene();
const gizmoCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
gizmoCamera.position.set(0, 0, 4.2);
gizmoCamera.lookAt(0, 0, 0);

const gizmoRoot = new THREE.Group();
gizmoScene.add(gizmoRoot);

function createAxisArrow(color, axis) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color });
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.9, 12),
    material,
  );
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 12), material);

  if (axis === "x") {
    shaft.rotation.z = -Math.PI / 2;
    shaft.position.x = 0.45;
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.98;
  } else if (axis === "y") {
    shaft.position.y = 0.45;
    head.position.y = 0.98;
  } else {
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.45;
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.98;
  }

  group.add(shaft, head);
  return group;
}

gizmoRoot.add(createAxisArrow(0xff5b5b, "x"));
gizmoRoot.add(createAxisArrow(0x63ff88, "y"));
gizmoRoot.add(createAxisArrow(0x5db2ff, "z"));

const gizmoLight = new THREE.AmbientLight(0xffffff, 1.2);
gizmoScene.add(gizmoLight);

function resizeGizmo() {
  const size = debugOverlay
    .querySelector(".debug-gizmo-wrap")
    .getBoundingClientRect();
  gizmoRenderer.setSize(size.width, size.height, false);
  gizmoCamera.aspect = size.width / size.height;
  gizmoCamera.updateProjectionMatrix();
}

resizeGizmo();

window.addEventListener("resize", resizeGizmo);

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function getMoveAxis(dx, dz) {
  const deadZone = 0.01;
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);

  if (absX < deadZone && absZ < deadZone) {
    return "Стою";
  }

  if (absX > absZ * 1.2) {
    return dx > 0 ? "X+" : "X-";
  }

  if (absZ > absX * 1.2) {
    return dz > 0 ? "Z+" : "Z-";
  }

  const xPart = dx > 0 ? "X+" : "X-";
  const zPart = dz > 0 ? "Z+" : "Z-";
  return `${xPart} / ${zPart}`;
}

function updateGizmo() {
  gizmoRoot.quaternion.copy(camera.quaternion).invert();
  gizmoRenderer.render(gizmoScene, gizmoCamera);
}

function setDebugInfo(state) {
  if (!state) {
    return;
  }

  const lines = [
    "DEBUG",
    `pos: ${formatNumber(state.x)}, ${formatNumber(state.y)}, ${formatNumber(state.z)}`,
    `yaw: ${formatNumber(state.yawRad)} rad (${formatNumber(state.yawDeg)}°)`,
    `pitch: ${formatNumber(state.pitchRad)} rad (${formatNumber(state.pitchDeg)}°)`,
    `move: ${getMoveAxis(state.dx, state.dz)}`,
    `speed: ${formatNumber(state.speed)} u/s`,
    `delta: dx=${formatNumber(state.dx)}, dz=${formatNumber(state.dz)}`,
    `run: ${state.run ? "yes" : "no"}`,
    `fall: ${state.falling ? "yes" : "no"}`,
    `lock: ${state.pointerLocked ? "on" : "off"}`,
  ];

  debugBody.textContent = lines.join("\n");

  updateGizmo();
}

window.setDebugInfo = setDebugInfo;

// Lamp debug controls
const lampControls = document.createElement("div");
lampControls.className = "debug-lamps";
lampControls.innerHTML = `
  <div style="margin-top:8px; font-weight:700; display:flex; gap:8px; align-items:center;">
    <div>Lamps</div>
    <button class="toggle-daynight" title="Toggle Day/Night">Day/Night</button>
  </div>
  <div class="debug-lamp-list" style="margin-top:6px; display:flex; gap:8px; align-items:center;">
    <button class="lamp-prev">◀</button>
    <span class="lamp-info">0</span>
    <button class="lamp-next">▶</button>
  </div>
  <div class="debug-lamp-controls" style="margin-top:6px; display:flex; gap:8px; align-items:center;">
    <label style="font-size:11px;">Intensity <input class="lamp-intensity" type="range" min="0" max="10" step="0.1" value="2"></label>
    <label style="font-size:11px;">Angle <input class="lamp-angle" type="range" min="0.1" max="1.5" step="0.01" value="0.52"></label>
  </div>
  <div style="margin-top:6px; display:flex; gap:8px; align-items:center;">
    <label style="font-size:11px;">Helper <input class="lamp-helper" type="checkbox"></label>
    <label style="font-size:11px;">Volumetric <input class="lamp-volumetric" type="checkbox" checked></label>
    <label style="font-size:11px;">Glow <input class="lamp-glow" type="checkbox" checked></label>
  </div>
`;
debugOverlay.appendChild(lampControls);

const lampInfo = lampControls.querySelector(".lamp-info");
const lampPrev = lampControls.querySelector(".lamp-prev");
const lampNext = lampControls.querySelector(".lamp-next");
const lampIntensity = lampControls.querySelector(".lamp-intensity");
const lampAngle = lampControls.querySelector(".lamp-angle");
const lampHelperToggle = lampControls.querySelector(".lamp-helper");
const lampVolumetricToggle = lampControls.querySelector(".lamp-volumetric");
const lampGlowToggle = lampControls.querySelector(".lamp-glow");
const daynightBtn = lampControls.querySelector(".toggle-daynight");

let selectedLampIndex = 0;
let currentHelper = null;

function refreshLampInfo() {
  const list = window.lamps || [];
  lampInfo.textContent = `${selectedLampIndex + 1}/${list.length}`;
  const cur = list[selectedLampIndex];
  if (cur) {
    lampIntensity.value = cur.light.intensity.toFixed(2);
    lampAngle.value = cur.light.angle.toFixed(2);
  }
}

function showHelperForSelected() {
  if (currentHelper) {
    scene.remove(currentHelper);
    currentHelper = null;
  }
  if (!lampHelperToggle.checked) return;
  const list = window.lamps || [];
  const cur = list[selectedLampIndex];
  if (!cur) return;
  const helper = new THREE.SpotLightHelper(cur.light);
  scene.add(helper);
  currentHelper = helper;
}

lampPrev.addEventListener("click", () => {
  const list = window.lamps || [];
  if (!list.length) return;
  selectedLampIndex = (selectedLampIndex - 1 + list.length) % list.length;
  refreshLampInfo();
  showHelperForSelected();
});

lampVolumetricToggle.addEventListener("change", () => {
  const list = window.lamps || [];
  const cur = list[selectedLampIndex];
  if (!cur) return;
  if (cur.cone) cur.cone.visible = lampVolumetricToggle.checked;
});

lampGlowToggle.addEventListener("change", () => {
  const list = window.lamps || [];
  const cur = list[selectedLampIndex];
  if (!cur) return;
  if (cur.glow) cur.glow.visible = lampGlowToggle.checked;
});

daynightBtn.addEventListener("click", () => {
  if (typeof window.setNightMode === "function") {
    // toggle based on current background color heuristics
    const isNight = scene.background && scene.background.r < 0.1;
    window.setNightMode(!isNight);
  }
});
lampNext.addEventListener("click", () => {
  const list = window.lamps || [];
  if (!list.length) return;
  selectedLampIndex = (selectedLampIndex + 1) % list.length;
  refreshLampInfo();
  showHelperForSelected();
});

lampIntensity.addEventListener("input", () => {
  const list = window.lamps || [];
  const cur = list[selectedLampIndex];
  if (!cur) return;
  cur.light.intensity = Number(lampIntensity.value);
});

lampAngle.addEventListener("input", () => {
  const list = window.lamps || [];
  const cur = list[selectedLampIndex];
  if (!cur) return;
  cur.light.angle = Number(lampAngle.value);
  if (currentHelper) currentHelper.update();
});

lampHelperToggle.addEventListener("change", () => {
  showHelperForSelected();
});

// update lamp info periodically when debug is open
setInterval(() => {
  if (!document.body.contains(debugOverlay)) return;
  if ((window.lamps || []).length === 0) {
    lampInfo.textContent = "0/0";
  } else {
    const max = window.lamps.length;
    if (selectedLampIndex >= max) selectedLampIndex = Math.max(0, max - 1);
    refreshLampInfo();
  }
}, 500);
