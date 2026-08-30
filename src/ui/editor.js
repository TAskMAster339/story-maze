window.editorActive = false;

const editorOverlay = document.createElement("div");
editorOverlay.id = "editorOverlay";
editorOverlay.innerHTML = `
  <div class="editor-panel">
    <div class="editor-header">
      <div>
        <div class="editor-title">Maze Editor</div>
        <div class="editor-subtitle">Tab - toggle editor, 1/0/S - brush</div>
      </div>
      <button class="editor-close" type="button">Close</button>
    </div>
    <div class="editor-toolbar"></div>
    <div class="editor-grid-wrap">
      <div class="editor-grid"></div>
    </div>
    <textarea class="editor-export" readonly></textarea>
    <div class="editor-footer">
      <button class="editor-copy" type="button">Copy map</button>
      <span class="editor-hint">Click and drag to paint cells.</span>
    </div>
  </div>
`;

document.body.appendChild(editorOverlay);

const editorPanel = editorOverlay.querySelector(".editor-panel");
const editorToolbar = editorOverlay.querySelector(".editor-toolbar");
const editorGrid = editorOverlay.querySelector(".editor-grid");
const editorExport = editorOverlay.querySelector(".editor-export");
const editorCloseBtn = editorOverlay.querySelector(".editor-close");
const editorCopyBtn = editorOverlay.querySelector(".editor-copy");

const brushButtons = [];
const brushOrder = ["#", "L", ".", ",", "S"];
const brushLabels = {
  "#": "Wall",
  L: "Lamp",
  ".": "Erase",
  ",": "Open sky",
  S: "Spawn",
};

let activeBrush = "#";
let painting = false;
let editorCells = [];
let editorWidth = 0;
let editorHeight = 0;

function getNormalizedLevelMap() {
  const sourceMap = window.levelMap || [];
  return window.levelUtils.normalize(sourceMap).map((row) => row.split(""));
}

function updateExportText() {
  editorExport.value = editorCells.map((row) => row.join("")).join("\n");
}

function rebuildWorldFromEditor() {
  const cameraPosition = camera.position.clone();
  window.levelMap = editorCells.map((row) => row.join(""));
  if (typeof window.rebuildLevelFromMap === "function") {
    window.rebuildLevelFromMap();
  }
  camera.position.copy(cameraPosition);
  updateExportText();
  renderEditorGrid();
}

function paintCell(rowIndex, colIndex, brush = activeBrush) {
  if (
    rowIndex < 0 ||
    rowIndex >= editorHeight ||
    colIndex < 0 ||
    colIndex >= editorWidth
  ) {
    return;
  }

  if (brush === "S") {
    for (let row = 0; row < editorHeight; row += 1) {
      for (let col = 0; col < editorWidth; col += 1) {
        if (editorCells[row][col] === "S") {
          editorCells[row][col] = ".";
        }
      }
    }
  }

  editorCells[rowIndex][colIndex] = brush;

  if (brush === "L" && typeof window.createLamp === "function") {
    const cellSize = window.LEVEL_CELL_SIZE || 2;
    const originX = -((editorWidth - 1) * cellSize) / 2;
    const originZ = -((editorHeight - 1) * cellSize) / 2;
    const x = originX + colIndex * cellSize;
    const z = originZ + rowIndex * cellSize;
    const y = cellSize * 3 + 1;
    window.createLamp(x, y, z, { intensity: 2.4, distance: 18 });
  }

  rebuildWorldFromEditor();
}

function setBrush(brush) {
  activeBrush = brush;
  for (const button of brushButtons) {
    button.classList.toggle("is-active", button.dataset.brush === brush);
  }
}

function renderEditorToolbar() {
  editorToolbar.innerHTML = "";
  brushButtons.length = 0;

  for (const brush of brushOrder) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "editor-brush";
    button.dataset.brush = brush;
    button.textContent = `${brushLabels[brush]} (${brush})`;
    button.addEventListener("click", () => setBrush(brush));
    editorToolbar.appendChild(button);
    brushButtons.push(button);
  }

  setBrush(activeBrush);
}

function renderEditorGrid() {
  editorGrid.innerHTML = "";
  editorGrid.style.gridTemplateColumns = `repeat(${editorWidth}, 1fr)`;

  for (let rowIndex = 0; rowIndex < editorHeight; rowIndex += 1) {
    for (let colIndex = 0; colIndex < editorWidth; colIndex += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "editor-cell";
      cell.dataset.row = String(rowIndex);
      cell.dataset.col = String(colIndex);
      cell.textContent =
        editorCells[rowIndex][colIndex] === "."
          ? ""
          : editorCells[rowIndex][colIndex];
      cell.classList.toggle(
        "cell-wall",
        editorCells[rowIndex][colIndex] === "#",
      );
      cell.classList.toggle(
        "cell-lamp",
        editorCells[rowIndex][colIndex] === "L",
      );
      cell.classList.toggle(
        "cell-spawn",
        editorCells[rowIndex][colIndex] === "S",
      );

      cell.addEventListener("mousedown", () => {
        painting = true;
        paintCell(rowIndex, colIndex);
      });

      cell.addEventListener("mouseenter", () => {
        if (painting) {
          paintCell(rowIndex, colIndex);
        }
      });

      editorGrid.appendChild(cell);
    }
  }

  updateExportText();
}

function loadEditorState() {
  editorCells = getNormalizedLevelMap();
  editorHeight = editorCells.length;
  editorWidth = editorCells[0]?.length ?? 0;
  renderEditorGrid();
}

function setEditorVisible(visible) {
  window.editorActive = visible;
  editorOverlay.classList.toggle("is-open", visible);

  if (!visible) {
    painting = false;
  }

  if (typeof window.refreshStartOverlay === "function") {
    window.refreshStartOverlay();
  }
}

function toggleEditor() {
  const nextState = !window.editorActive;
  setEditorVisible(nextState);

  if (nextState && document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
}

editorOverlay.addEventListener("mousedown", (e) => {
  if (e.target.closest(".editor-cell")) {
    e.preventDefault();
  }
});

document.addEventListener("mouseup", () => {
  painting = false;
});

document.addEventListener("keydown", (e) => {
  const isTextField =
    e.target instanceof HTMLElement &&
    (e.target.tagName === "TEXTAREA" ||
      e.target.tagName === "INPUT" ||
      e.target.isContentEditable);

  if (e.code === "Tab" && !isTextField) {
    e.preventDefault();
    toggleEditor();
    return;
  }

  if (!window.editorActive) {
    return;
  }

  if (e.code === "Escape") {
    setEditorVisible(false);
    return;
  }

  if (e.code === "Digit1") {
    setBrush("#");
  } else if (e.code === "Digit3") {
    setBrush("L");
  } else if (e.code === "Digit0") {
    setBrush(".");
  } else if (e.code === "KeyS") {
    setBrush("S");
  }
});

editorCloseBtn.addEventListener("click", () => setEditorVisible(false));
editorCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editorExport.value);
    editorCopyBtn.textContent = "Copied";
    window.setTimeout(() => {
      editorCopyBtn.textContent = "Copy map";
    }, 900);
  } catch {
    editorCopyBtn.textContent = "Copy failed";
    window.setTimeout(() => {
      editorCopyBtn.textContent = "Copy map";
    }, 900);
  }
});

editorExport.addEventListener("input", () => {
  const lines = editorExport.value
    .split(/\r?\n/)
    .map((line) => line.replace(/[^#LST.,]/g, ".").replace(/\|/g, "#"));

  if (!lines.length) {
    return;
  }

  const width = Math.max(...lines.map((line) => line.length));
  editorCells = lines.map((line) => line.padEnd(width, ".").split(""));
  editorHeight = editorCells.length;
  editorWidth = width;
  rebuildWorldFromEditor();
});

editorExport.readOnly = false;
loadEditorState();
setEditorVisible(false);
window.toggleMazeEditor = toggleEditor;
