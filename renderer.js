// renderer.js - Mapa Interativo V2

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const openImageBtn = document.getElementById("openImage");
const openProjectBtn = document.getElementById("openProject");
const saveProjectBtn = document.getElementById("saveProject");
const newProjectBtn = document.getElementById("newProject");
const exportPNGBtn = document.getElementById("exportPNG");

const fileImage = document.getElementById("fileImage");
const fileProject = document.getElementById("fileProject");

const colorPicker = document.getElementById("color");
const sizePicker = document.getElementById("size");
const shapeSelect = document.getElementById("shape");
const fillTypeSelect = document.getElementById("fillType");
const borderColorPicker = document.getElementById("borderColor");
const borderWidthInput = document.getElementById("borderWidth");
const opacityPicker = document.getElementById("opacity");

const borderNoneCheckbox = document.getElementById("borderNone");
const shapeOptionButtons = document.querySelectorAll(".shape-option");

const presetBtns = [];
const presetSaveBtns = [];
const presetResetBtns = [];
const presetCanvases = [];
for (let i = 0; i < 4; i++) {
  presetBtns[i] = document.getElementById(`preset${i}Btn`);
  presetSaveBtns[i] = document.getElementById(`preset${i}Save`);
  presetResetBtns[i] = document.getElementById(`preset${i}Clear`);
  const c = document.getElementById(`preset${i}Canvas`);
  if (c) presetCanvases[i] = c;
}

const exitModal = document.getElementById("exitModal");
const exitSaveBtn = document.getElementById("exitSaveBtn");
const exitWithoutSaveBtn = document.getElementById("exitWithoutSaveBtn");
const exitCancelBtn = document.getElementById("exitCancelBtn");

let img = null;
let imageSrc = null;



function showCreateNewProjectToImportImageMessage(){
  alert("Este projeto já possui uma imagem. Crie um novo projeto para importar outra imagem.");
}

let baseScale = 1;
let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let isPointerDown = false;
let pointerId = null;
let pointerStart = null;
let isPanning = false;

let dragMode = null; // "pan" | "move-marker" | null
let draggedMarkerIndex = -1;
let dragMarkerOffset = { dx: 0, dy: 0 };

let markers = []; // {x,y,color,size,shape,fillType,borderColor,borderWidth,opacity}
let undoStack = [];

let currentProjectName = null;

let isDirty = false;

function updateWindowTitle() {
  const baseTitle = "Mapa Interativo";
  const projectLabel = currentProjectName ? String(currentProjectName).replace(/\.json$/i, "") : "Sem projeto";
  const dirtyMark = isDirty ? " *" : "";
  document.title = `${baseTitle} – ${projectLabel}${dirtyMark}`;
}

function setDirty(v) {
  const nv = !!v;
  if (isDirty === nv) return;
  isDirty = nv;
  updateWindowTitle();
}

function setProjectName(nameOrNull) {
  currentProjectName = nameOrNull || null;
  updateWindowTitle();
}

// inicial
updateWindowTitle();
let hotSlots = [null, null, null, null];

// Preset selecionado (apenas presets configurados podem ser selecionados)
let selectedPresetIndex = -1;

function updatePresetSelectionVisuals() {
  for (let i = 0; i < 4; i++) {
    const btn = presetBtns[i];
    if (!btn) continue;
    const slotEl = btn.closest(".preset-slot");
    if (!slotEl) continue;
    const hasData = !!hotSlots[i];
    slotEl.classList.toggle("empty", !hasData);
    slotEl.classList.toggle("selected", hasData && i === selectedPresetIndex);
  }
}

function setSelectedPreset(slot) {
  if (slot === null || slot === undefined) slot = -1;
  // Só permite seleção de presets que já têm dados configurados
  if (slot < 0 || slot > 3 || !hotSlots[slot]) {
    selectedPresetIndex = -1;
    updatePresetSelectionVisuals();
    return;
  }
  selectedPresetIndex = slot;
  updatePresetSelectionVisuals();
}


// Atualiza destaque dos botões de forma
function updateShapeButtons() {
  if (!shapeOptionButtons) return;
  shapeOptionButtons.forEach(btn => {
    if (btn.dataset.shapeOption === shapeSelect.value) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

if (shapeOptionButtons && shapeOptionButtons.forEach) {
  shapeOptionButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.shapeOption;
      if (!val) return;
      shapeSelect.value = val;
      updateShapeButtons();
    });
  });
  updateShapeButtons();
}


function updateBorderControls() {
  if (!borderNoneCheckbox) return;
  const disabled = borderNoneCheckbox.checked;
  if (borderWidthInput) borderWidthInput.disabled = disabled;
  if (borderColorPicker) borderColorPicker.disabled = disabled;
}

if (borderNoneCheckbox) {
  borderNoneCheckbox.addEventListener("change", () => {
    updateBorderControls();
  });
  updateBorderControls();
}
function setCanvasSizeToClient() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
}

function getDisplayScale() {
  return baseScale * zoom;
}

function clampZoom(z) {
  return Math.max(0.1, Math.min(20, z));
}

function clearCanvas() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function clientToImageCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  const scale = getDisplayScale();
  const imgX = (cssX - offsetX) / scale;
  const imgY = (cssY - offsetY) / scale;
  return { x: imgX, y: imgY };
}

function drawMarkerOnCtx(context, m) {
  const s = m.size || 10;
  const x = m.x;
  const y = m.y;

  const fillType = m.fillType || "solid";
  const fillColor = m.color || "#ff0000";
  const borderColor = m.borderColor || "#222222";
  const borderWidth = (m.borderWidth !== undefined && m.borderWidth !== null)
    ? m.borderWidth
    : Math.max(1, 2 / getDisplayScale());
  const opacity = (m.opacity !== undefined && m.opacity !== null) ? m.opacity : 1;

  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = fillColor;
  context.strokeStyle = borderColor;
  context.lineWidth = borderWidth;

  const drawStroke = () => {
    if (!m.noBorder && borderWidth > 0) {
      context.stroke();
    }
  };

  switch (m.shape) {
    case "circle":
      context.beginPath();
      context.arc(x, y, s, 0, Math.PI * 2);
      if (fillType === "solid") context.fill();
      drawStroke();
      break;
    case "square":
      context.beginPath();
      context.rect(x - s, y - s, s * 2, s * 2);
      if (fillType === "solid") context.fill();
      drawStroke();
      break;
    case "triangle":
      context.beginPath();
      context.moveTo(x, y - s);
      context.lineTo(x + s, y + s);
      context.lineTo(x - s, y + s);
      context.closePath();
      if (fillType === "solid") context.fill();
      drawStroke();
      break;
    case "cross":
    case "question":
    case "diamond":
    case "hexagon":
    case "star":
    case "pentagon":
    case "heptagon": {
      const glyphMap = {
        cross: "✚",
        question: "?",
        diamond: "◆",
        hexagon: "⬟",
        star: "★",
        pentagon: "⬘",
        heptagon: "⬣"
      };
      const glyph = glyphMap[m.shape] || "?";
      context.textAlign = "center";
      context.textBaseline = "middle";
      const fontSize = s * 2;
      context.font = `${fontSize}px system-ui, sans-serif`;
      if (fillType === "solid") {
        context.fillStyle = fillColor;
        context.fillText(glyph, x, y);
      }
      if (!m.noBorder && borderWidth > 0) {
        const prevWidth = context.lineWidth;
        context.lineWidth = borderWidth;
        context.strokeStyle = borderColor;
        context.strokeText(glyph, x, y);
        context.lineWidth = prevWidth;
      }
      break;
    }
    default:
      context.beginPath();
      context.arc(x, y, s, 0, Math.PI * 2);
      if (fillType === "solid") context.fill();
      drawStroke();
  }
  context.restore();
}

function draw() {
  setCanvasSizeToClient();
  clearCanvas();

  if (!img) {
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#9b9b9b";
    ctx.font = "30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Abra uma imagem (Ctrl+I) ou um projeto (Ctrl+O).", canvas.width / 2, canvas.height / 2);
    return;
  }

  const scale = getDisplayScale();
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  ctx.drawImage(img, 0, 0);

  for (const m of markers) {
    drawMarkerOnCtx(ctx, m);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- IMAGE LOADING ----------

function confirmBeforeImport(callback){
  if(markers && markers.length>0){
    if(confirm("Deseja salvar o projeto antes de importar nova imagem?")){
        saveProject(); 
    }
  }
  callback();
}
openImageBtn.addEventListener("click", () => {
  if (img) { showCreateNewProjectToImportImageMessage(); return; }
  fileImage.click();
});

fileImage.addEventListener("change", (ev) => {
  if (img) { showCreateNewProjectToImportImageMessage(); ev.target.value = ""; return; }
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    imageSrc = reader.result;
    img = new Image();
    img.onload = () => {
      setCanvasSizeToClient();
      baseScale = Math.min(canvas.clientWidth / img.width, canvas.clientHeight / img.height);
      zoom = 1;
      const dispW = img.width * baseScale;
      const dispH = img.height * baseScale;
      offsetX = (canvas.clientWidth - dispW) / 2;
      offsetY = (canvas.clientHeight - dispH) / 2;
      markers = [];
      undoStack = [];
      setProjectName(null);
      setDirty(true);
      draw();
    };
    img.src = imageSrc;
  };
  reader.readAsDataURL(f);
});

// ---------- POINTERS / PAN / MOVE MARKER / CREATE ----------
canvas.addEventListener("pointerdown", (ev) => {
  if (!img) return;
  canvas.setPointerCapture(ev.pointerId);
  isPointerDown = true;
  pointerId = ev.pointerId;
  pointerStart = { x: ev.clientX, y: ev.clientY };
  isPanning = false;
  dragMode = null;
  draggedMarkerIndex = -1;

  if (ev.button === 1) { // botão do meio
    const p = clientToImageCoords(ev.clientX, ev.clientY);
    const idx = markers.findIndex(m => Math.hypot(m.x - p.x, m.y - p.y) <= (m.size || 10) + 6);
    if (idx !== -1) {
      dragMode = "move-marker";
      draggedMarkerIndex = idx;
      dragMarkerOffset = { dx: markers[idx].x - p.x, dy: markers[idx].y - p.y };
      undoStack.push(JSON.parse(JSON.stringify(markers)));
    } else {
      dragMode = "pan";
    }
  } else if (ev.button === 0) { // esquerdo
    dragMode = "pan";
  } else {
    dragMode = null;
  }
});

canvas.addEventListener("pointermove", (ev) => {
  if (!isPointerDown || ev.pointerId !== pointerId) return;
  const dx = ev.clientX - pointerStart.x;
  const dy = ev.clientY - pointerStart.y;

  if (dragMode === "pan") {
    const dist = Math.hypot(dx, dy);
    if (!isPanning && dist > 3) {
      isPanning = true;
    }
  if (dragMode === "pan" && isPanning) {
    setDirty(true);
  }
    if (isPanning) {
      offsetX += dx;
      offsetY += dy;
      pointerStart.x = ev.clientX;
      pointerStart.y = ev.clientY;
      draw();
    }
  } else if (dragMode === "move-marker" && draggedMarkerIndex !== -1) {
    const p = clientToImageCoords(ev.clientX, ev.clientY);
    const m = markers[draggedMarkerIndex];
    m.x = p.x + dragMarkerOffset.dx;
    m.y = p.y + dragMarkerOffset.dy;
    if (m.x < 0) m.x = 0;
    if (m.y < 0) m.y = 0;
    if (m.x > img.width) m.x = img.width;
    if (m.y > img.height) m.y = img.height;
    draw();
  }
});

canvas.addEventListener("pointerup", (ev) => {
  if (!isPointerDown || ev.pointerId !== pointerId) return;
  canvas.releasePointerCapture(ev.pointerId);

  if (dragMode === "pan") {
    const dx = ev.clientX - pointerStart.x;
    const dy = ev.clientY - pointerStart.y;
    const dist = Math.hypot(dx, dy);
    if (!isPanning && ev.button === 0 && dist <= 3) {
      // clique -> criar marcador
      const p = clientToImageCoords(ev.clientX, ev.clientY);
      if (p.x >= 0 && p.y >= 0 && p.x <= img.width && p.y <= img.height) {
        undoStack.push(JSON.parse(JSON.stringify(markers)));
        markers.push({
          x: p.x,
          y: p.y,
          color: colorPicker.value,
          size: Math.max(2, Math.min(200, parseFloat(sizePicker.value) || 10)),
          shape: shapeSelect.value || "circle",
          fillType: fillTypeSelect.value || "solid",
          borderColor: borderColorPicker.value || "#222222",
          borderWidth: (borderNoneCheckbox && borderNoneCheckbox.checked) ? 0 : (parseFloat(borderWidthInput.value) || 2),
          opacity: parseFloat(opacityPicker.value) || 1,
          noBorder: borderNoneCheckbox ? borderNoneCheckbox.checked : false
        });
        draw();
        setDirty(true);
      }
    }
  }
  isPointerDown = false;
  pointerId = null;
  pointerStart = null;
  isPanning = false;
  dragMode = null;
  draggedMarkerIndex = -1;
});

canvas.addEventListener("pointercancel", () => {
  isPointerDown = false;
  pointerId = null;
  pointerStart = null;
  isPanning = false;
  dragMode = null;
  draggedMarkerIndex = -1;
});

// Remover marcador com botão direito
canvas.addEventListener("contextmenu", (ev) => {
  ev.preventDefault();
  if (!img) return;
  const p = clientToImageCoords(ev.clientX, ev.clientY);
  const idx = markers.findIndex(m => Math.hypot(m.x - p.x, m.y - p.y) <= (m.size || 10) + 6);
  if (idx !== -1) {
    undoStack.push(JSON.parse(JSON.stringify(markers)));
    markers.splice(idx, 1);
    draw();
    setDirty(true);
  }
});

// Zoom com scroll
canvas.addEventListener("wheel", (ev) => {
  if (!img) return;
  ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const cssX = ev.clientX - rect.left;
  const cssY = ev.clientY - rect.top;
  const before = clientToImageCoords(ev.clientX, ev.clientY);

  const factor = ev.deltaY < 0 ? 1.15 : 0.88;
  zoom = clampZoom(zoom * factor);

  const afterCanvasX = before.x * getDisplayScale() + offsetX;
  const afterCanvasY = before.y * getDisplayScale() + offsetY;

  offsetX += (cssX - afterCanvasX);
  offsetY += (cssY - afterCanvasY);
  setDirty(true);
  draw();
}, { passive: false });

// ---------- PROJECT SAVE / LOAD ----------
function buildProjectData() {
  return {
    imageSrc,
    markers,
    view: {
      zoom,
      offsetX,
      offsetY,
      canvasW: canvas.clientWidth,
      canvasH: canvas.clientHeight
    },
    presets: hotSlots
  };
}

function saveProject(forceSaveAs = false) {
  let fileName = currentProjectName;

  if (forceSaveAs || !fileName) {
    fileName = currentProjectName || "Novo Projeto.json";
  }

  const data = JSON.stringify(buildProjectData(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);

  setProjectName(fileName);
  setDirty(false);
}

function applyProjectData(data, fileNameFromDialog) {
  if (!data || !data.imageSrc) {
    alert("Arquivo de projeto inválido");
    return;
  }
  imageSrc = data.imageSrc;
  markers = Array.isArray(data.markers) ? data.markers : [];
  hotSlots = Array.isArray(data.presets) ? data.presets : [null, null, null, null];
  updateAllPresetVisuals();
  setSelectedPreset(-1);

  img = new Image();
  img.onload = () => {
    setCanvasSizeToClient();
    baseScale = Math.min(canvas.clientWidth / img.width, canvas.clientHeight / img.height);
    zoom = (data.view && data.view.zoom) || 1;
    if (data.view && data.view.offsetX !== undefined && data.view.offsetY !== undefined) {
      offsetX = data.view.offsetX;
      offsetY = data.view.offsetY;
    } else {
      const dispW = img.width * baseScale * zoom;
      const dispH = img.height * baseScale * zoom;
      offsetX = (canvas.clientWidth - dispW) / 2;
      offsetY = (canvas.clientHeight - dispH) / 2;
    }
    setProjectName(fileNameFromDialog || null);
    setDirty(false);
    undoStack = [];
    draw();
  };
  img.onerror = () => alert("Erro ao carregar imagem do projeto");
  img.src = imageSrc;
}

openProjectBtn.addEventListener("click", () => fileProject.click());

fileProject.addEventListener("change", (ev) => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      applyProjectData(data, f.name);
      fileProject.value = "";
    } catch (err) {
      alert("Erro ao ler projeto: " + err.message);
    }
  };
  reader.readAsText(f);
});

saveProjectBtn.addEventListener("click", () => saveProject(false));

// Export PNG em resolução original
exportPNGBtn.addEventListener("click", () => {
  if (!img) return alert("Abra uma imagem primeiro");
  const tmp = document.createElement("canvas");
  tmp.width = img.width;
  tmp.height = img.height;
  const tctx = tmp.getContext("2d");
  tctx.drawImage(img, 0, 0, img.width, img.height);
  for (const m of markers) {
    drawMarkerOnCtx(tctx, m);
  }
  const a = document.createElement("a");
  a.href = tmp.toDataURL("image/png");
  a.download = "mapa_com_marcadores.png";
  a.click();
});

// ---------- PRESETS ----------
function clearPresetCanvas(slot) {
  const canvasEl = presetCanvases[slot];
  if (!canvasEl) return;
  const cctx = canvasEl.getContext("2d");
  cctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  // ícone neutro: círculo branco sem preenchimento
  cctx.save();
  cctx.strokeStyle = "#ffffff";
  cctx.lineWidth = 2;
  const cx = canvasEl.width / 2;
  const cy = canvasEl.height / 2;
  const r = Math.min(canvasEl.width, canvasEl.height) / 3;
  cctx.beginPath();
  cctx.arc(cx, cy, r, 0, Math.PI * 2);
  cctx.stroke();
  cctx.restore();
}

function drawPresetPreview(slot, data) {
  const canvasEl = presetCanvases[slot];
  if (!canvasEl || !data) return;
  const cctx = canvasEl.getContext("2d");
  cctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  const cx = canvasEl.width / 2;
  const cy = canvasEl.height / 2;
  const s = Math.min(canvasEl.width, canvasEl.height) / 3;

  const fillType = data.fillType || "solid";
  const fillColor = data.color || "#ff0000";
  const borderColor = data.borderColor || "#222222";
  const borderWidth = (data.borderWidth !== undefined && data.borderWidth !== null)
    ? data.borderWidth
    : 2;
  const opacity = (data.opacity !== undefined && data.opacity !== null) ? data.opacity : 1;

  cctx.save();
  cctx.globalAlpha = opacity;
  cctx.fillStyle = fillColor;
  cctx.strokeStyle = borderColor;
  cctx.lineWidth = Math.max(1, borderWidth);

  const drawStroke = () => {
    if (!data.noBorder && borderWidth > 0) {
      cctx.stroke();
    }
  };

  switch (data.shape) {
    case "circle":
      cctx.beginPath();
      cctx.arc(cx, cy, s, 0, Math.PI * 2);
      if (fillType === "solid") cctx.fill();
      drawStroke();
      break;
    case "square":
      cctx.beginPath();
      cctx.rect(cx - s, cy - s, s * 2, s * 2);
      if (fillType === "solid") cctx.fill();
      drawStroke();
      break;
    case "triangle":
      cctx.beginPath();
      cctx.moveTo(cx, cy - s);
      cctx.lineTo(cx + s, cy + s);
      cctx.lineTo(cx - s, cy + s);
      cctx.closePath();
      if (fillType === "solid") cctx.fill();
      drawStroke();
      break;
    case "cross":
    case "question":
    case "diamond":
    case "hexagon":
    case "star":
    case "pentagon":
    case "heptagon": {
      const glyphMap = {
        cross: "✚",
        question: "?",
        diamond: "◆",
        hexagon: "⬟",
        star: "★",
        pentagon: "⬘",
        heptagon: "⬣"
      };
      const glyph = glyphMap[data.shape] || "?";
      cctx.textAlign = "center";
      cctx.textBaseline = "middle";
      const qFontSize = s * 2;
      cctx.font = `${qFontSize}px system-ui, sans-serif`;
      if (fillType === "solid") {
        cctx.fillStyle = fillColor;
        cctx.fillText(glyph, cx, cy);
      }
      if (!data.noBorder && borderWidth > 0) {
        const prevWidth = cctx.lineWidth;
        cctx.lineWidth = borderWidth;
        cctx.strokeStyle = borderColor;
        cctx.strokeText(glyph, cx, cy);
        cctx.lineWidth = prevWidth;
      }
      break;
    }
    default:
      cctx.beginPath();
      cctx.arc(cx, cy, s, 0, Math.PI * 2);
      if (fillType === "solid") cctx.fill();
      drawStroke();
  }
  cctx.restore();
}

function updatePresetVisual(slot) {
  const btn = presetBtns[slot];
  const data = hotSlots[slot];
  const canvasEl = presetCanvases[slot];
  if (!btn || !canvasEl) return;

  const cctx = canvasEl.getContext("2d");
  cctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  if (!data) {
    // preset vazio: ícone neutro e sem seleção
    btn.style.border = "1px solid #333333";
    btn.style.boxShadow = "none";
    clearPresetCanvas(slot);

    if (selectedPresetIndex === slot) {
      selectedPresetIndex = -1;
    }
    updatePresetSelectionVisuals();
    return;
  }

  // preset com dados: preview + borda indicativa (cor do preset)
  btn.style.border = `2px solid ${data.color || "#ffffff"}`;
  btn.style.boxShadow = "0 0 6px rgba(0,0,0,0.6)";
  drawPresetPreview(slot, data);

  updatePresetSelectionVisuals();
}

function updateAllPresetVisuals() {
  for (let i = 0; i < 4; i++) updatePresetVisual(i);
  updatePresetSelectionVisuals();
}

for (let i = 0; i < 4; i++) {
  if (presetSaveBtns[i]) {
    presetSaveBtns[i].addEventListener("click", (e) => {
      e.stopPropagation();
      hotSlots[i] = {
        color: colorPicker.value,
        size: Math.max(2, Math.min(200, parseFloat(sizePicker.value) || 10)),
        shape: shapeSelect.value || "circle",
        fillType: fillTypeSelect.value || "solid",
        borderColor: borderColorPicker.value || "#222222",
        borderWidth: (borderNoneCheckbox && borderNoneCheckbox.checked) ? 0 : (parseFloat(borderWidthInput.value) || 2),
        opacity: parseFloat(opacityPicker.value) || 1,
        noBorder: borderNoneCheckbox ? borderNoneCheckbox.checked : false
      };
      updatePresetVisual(i);
      setSelectedPreset(i);
    setDirty(true);
      });
  }
  if (presetBtns[i]) {
    presetBtns[i].addEventListener("click", () => {
      const data = hotSlots[i];
      if (!data) return;
      setSelectedPreset(i);
      colorPicker.value = data.color || "#ff0000";
      sizePicker.value = data.size || 10;
      shapeSelect.value = data.shape || "circle";
      fillTypeSelect.value = data.fillType || "solid";
      borderColorPicker.value = data.borderColor || "#222222";
      borderWidthInput.value = data.borderWidth !== undefined ? data.borderWidth : 2;
      opacityPicker.value = data.opacity !== undefined ? data.opacity : 1;
      if (borderNoneCheckbox) {
        borderNoneCheckbox.checked = !!data.noBorder || (data.borderWidth === 0);
        updateBorderControls();
      }
      updateShapeButtons();
    });
  }
  if (presetResetBtns[i]) {
    presetResetBtns[i].addEventListener("click", (e) => {
      e.stopPropagation();
      hotSlots[i] = null;
      updatePresetVisual(i);
      if (selectedPresetIndex === i) setSelectedPreset(-1);
    setDirty(true);
      });
  }
}
updateAllPresetVisuals();
setSelectedPreset(-1);

// ---------- SHORTCUTS ----------
window.addEventListener("keydown", (e) => {
  const active = document.activeElement;
  const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT");
  if (typing) return;

  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case "s":
        e.preventDefault();
        if (e.shiftKey) saveProject(true); else saveProject(false);
        break;
      case "o":
        e.preventDefault();
        fileProject.click();
        break;
      case "i":
        e.preventDefault();
        if (img) { showCreateNewProjectToImportImageMessage(); break; }
        fileImage.click();
        break;
      case "e":
        e.preventDefault();
        exportPNGBtn.click();
        break;
      case "z":
        e.preventDefault();
        if (undoStack.length) {
          markers = undoStack.pop();
          draw();
          setDirty(true);
        }
        break;
    }
  }
});

// ---------- RESIZE ----------
function onResize() {
  setCanvasSizeToClient();
  if (img) {
    const oldBase = baseScale;
    baseScale = Math.min(canvas.clientWidth / img.width, canvas.clientHeight / img.height);
    if (oldBase && oldBase !== baseScale) {
      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      const imageCenterX = (cx - offsetX) / (oldBase * zoom);
      const imageCenterY = (cy - offsetY) / (oldBase * zoom);
      offsetX = cx - imageCenterX * (baseScale * zoom);
      offsetY = cy - imageCenterY * (baseScale * zoom);
    }
  }
  draw();
}

window.addEventListener("resize", onResize);
setCanvasSizeToClient();
draw();

// ---------- DRAG & DROP ----------
window.addEventListener("dragover", (ev) => { ev.preventDefault(); });
window.addEventListener("drop", (ev) => {
  ev.preventDefault();
  const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
  if (!f) return;

  // Bloqueia importação de NOVA imagem se já existe imagem no projeto
  const isImageFile = (f.type && f.type.startsWith("image/")) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name || "");
  const isJsonFile = (f.type === "application/json") || (f.name && f.name.toLowerCase().endsWith(".json"));
  if (!isJsonFile && isImageFile && img) { showCreateNewProjectToImportImageMessage(); return; }
  if (f.type === "application/json" || f.name.toLowerCase().endsWith(".json")) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        applyProjectData(data, f.name);
      } catch (err) {
        alert("Erro ao ler JSON arrastado: " + err.message);
      }
    };
    reader.readAsText(f);
  } else if (/image\//.test(f.type) || /(png|jpe?g|webp|bmp|gif)$/i.test(f.name)) {
    const reader = new FileReader();
    reader.onload = () => {
      imageSrc = reader.result;
      img = new Image();
      img.onload = () => {
        setCanvasSizeToClient();
        baseScale = Math.min(canvas.clientWidth / img.width, canvas.clientHeight / img.height);
        zoom = 1;
        const dispW = img.width * baseScale;
        const dispH = img.height * baseScale;
        offsetX = (canvas.clientWidth - dispW) / 2;
        offsetY = (canvas.clientHeight - dispH) / 2;
        markers = [];
        undoStack = [];
        setProjectName(null);
      setDirty(true);
      draw();
      };
      img.src = imageSrc;
    };
    reader.readAsDataURL(f);
  } else {
    alert("Arquivo arrastado não suportado");
  }
});

// ---------- EXIT MODAL INTEGRAÇÃO ----------
let exitModalMode = "exit"; // "exit" | "newProject"

const exitModalTitleEl = exitModal ? exitModal.querySelector(".modal-title") : null;
const exitModalTextEl = exitModal ? exitModal.querySelector(".modal-text") : null;

function setExitModalUI(mode) {
  exitModalMode = mode;

  if (!exitModalTitleEl || !exitModalTextEl) return;

  if (mode === "newProject") {
    exitModalTitleEl.textContent = "Novo projeto";
    exitModalTextEl.textContent = "Deseja salvar o projeto atual antes de iniciar um novo projeto em branco?";

    if (exitSaveBtn) exitSaveBtn.textContent = "💾 Salvar e criar novo";
    if (exitWithoutSaveBtn) exitWithoutSaveBtn.textContent = "🗑️ Criar novo sem salvar";
    if (exitCancelBtn) exitCancelBtn.textContent = "Cancelar";
  } else {
    // modo padrão (fechar app)
    exitModalTitleEl.textContent = "Sair do aplicativo";
    exitModalTextEl.textContent = "Deseja salvar o projeto antes de sair?";

    if (exitSaveBtn) exitSaveBtn.textContent = "💾 Salvar e sair";
    if (exitWithoutSaveBtn) exitWithoutSaveBtn.textContent = "⏏️ Sair sem salvar";
    if (exitCancelBtn) exitCancelBtn.textContent = "Cancelar";
  }
}

function showExitModal(mode = "exit") {
  setExitModalUI(mode);
  exitModal.classList.remove("hidden");
}

function hideExitModal() {
  exitModal.classList.add("hidden");
}

function resetProjectFull() {
  img = null;
  imageSrc = null;

  baseScale = 1;
  zoom = 1;
  offsetX = 0;
  offsetY = 0;

  markers = [];
  undoStack = [];

  hotSlots = [null, null, null, null];
  setSelectedPreset(-1);
  updateAllPresetVisuals();

  setProjectName(null);
  setDirty(false);

  draw();
}

function hasAnythingToLose() {
  const hasMarkers = Array.isArray(markers) && markers.length > 0;
  const hasPresets = Array.isArray(hotSlots) && hotSlots.some(Boolean);
  return !!img || !!imageSrc || hasMarkers || hasPresets || !!currentProjectName;
}

if (newProjectBtn) {
  newProjectBtn.addEventListener("click", () => {
    // Só cria novo projeto após confirmação/salvamento do usuário
    if (hasAnythingToLose()) {
      showExitModal("newProject");
    } else {
      resetProjectFull();
    }
  });
}

if (exitSaveBtn) {
  exitSaveBtn.addEventListener("click", () => {
    if (exitModalMode === "newProject") {
      saveProject(false);
      hideExitModal();
      resetProjectFull();
      return;
    }

    // modo "exit"
    saveProject(false);
    hideExitModal();
    if (window.api && typeof window.api.sendCloseDecision === "function") {
      window.api.sendCloseDecision("exit");
    }
  });
}

if (exitWithoutSaveBtn) {
  exitWithoutSaveBtn.addEventListener("click", () => {
    if (exitModalMode === "newProject") {
      hideExitModal();
      resetProjectFull();
      return;
    }

    // modo "exit"
    hideExitModal();
    if (window.api && typeof window.api.sendCloseDecision === "function") {
      window.api.sendCloseDecision("exit");
    }
  });
}

if (exitCancelBtn) {
  exitCancelBtn.addEventListener("click", () => {
    hideExitModal();

    // Só manda cancelamento pro main quando o modal foi aberto por tentativa de fechar o app
    if (exitModalMode === "exit" && window.api && typeof window.api.sendCloseDecision === "function") {
      window.api.sendCloseDecision("cancel");
    }
  });
}

if (window.api && typeof window.api.onAppCloseRequest === "function") {
  window.api.onAppCloseRequest(() => {
    showExitModal("exit");
  });
}


// Flash visual para preset selecionado via teclado
function flashPresetSlot(index) {
  const btn = presetBtns[index];
  if (!btn) return;
  const slot = btn.closest(".preset-slot");
  if (!slot) return;
  slot.classList.remove("flash");
  void slot.offsetWidth;
  slot.classList.add("flash");
}

// ---------- NON_CTRL_SHORTCUTS ----------
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const el = document.activeElement;
  if (el && ["INPUT","TEXTAREA","SELECT"].includes(el.tagName)) return;

  // M -> Marcadores
  if (e.key && e.key.toLowerCase() === "m") {
    const menu = document.getElementById("markerMenu");
    if (menu) {
      e.preventDefault();
      menu.classList.toggle("hidden");
    }
    return;
  }

  // Presets 1-4
  if (["1","2","3","4"].includes(e.key)) {
    const idx = parseInt(e.key, 10) - 1;
    if (!hotSlots[idx]) return;

    e.preventDefault();
    setSelectedPreset(idx);
    flashPresetSlot(idx);

    const p = hotSlots[idx];
    if (!p) return;

    colorPicker.value = p.color;
    sizePicker.value = p.size;
    shapeSelect.value = p.shape;
    fillTypeSelect.value = p.fillType || "solid";
    borderColorPicker.value = p.borderColor || "#222222";
    borderWidthInput.value = p.borderWidth ?? 2;
    opacityPicker.value = p.opacity ?? 1;

    if (borderNoneCheckbox) {
      borderNoneCheckbox.checked = !!p.noBorder;
      updateBorderControls();
    }
    updateShapeButtons();
  }
});
