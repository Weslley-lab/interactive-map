@@ -21,56 +21,50 @@ const borderWidthInput = document.getElementById("borderWidth");
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
let hotSlots = [null, null, null, null];

// Preset selecionado (apenas presets configurados podem ser selecionados)
let selectedPresetIndex = -1;

function updatePresetSelectionVisuals() {
  for (let i = 0; i < 4; i++) {
@@ -260,87 +254,116 @@ function draw() {

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
function promptImageReplacement(onConfirm, onCancel) {
  if (!img) {
    onConfirm();
    return;
  }

  const shouldReplace = confirm("Uma imagem já está carregada. Deseja substituí-la? Todos os marcadores atuais serão removidos.");
  if (!shouldReplace) {
    if (onCancel) onCancel();
    return;
  }

  if (markers && markers.length > 0) {
    if (confirm("Deseja salvar o projeto antes de substituir a imagem?")) {
      saveProject();
    }
  }
  callback();

  onConfirm();
}

function resetStateForNewImage() {
  markers = [];
  undoStack = [];
  currentProjectName = null;
  selectedPresetIndex = -1;
  updatePresetSelectionVisuals();
}

function loadImageFromDataUrl(dataUrl) {
  imageSrc = dataUrl;
  const newImg = new Image();
  newImg.onload = () => {
    img = newImg;
    setCanvasSizeToClient();
    baseScale = Math.min(canvas.clientWidth / img.width, canvas.clientHeight / img.height);
    zoom = 1;
    const dispW = img.width * baseScale;
    const dispH = img.height * baseScale;
    offsetX = (canvas.clientWidth - dispW) / 2;
    offsetY = (canvas.clientHeight - dispH) / 2;
    resetStateForNewImage();
    draw();
  };
  newImg.src = imageSrc;
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
      currentProjectName = null;
      draw();

  promptImageReplacement(() => {
    const reader = new FileReader();
    reader.onload = () => {
      loadImageFromDataUrl(reader.result);
    };
    img.src = imageSrc;
  };
  reader.readAsDataURL(f);
    reader.readAsDataURL(f);
  }, () => {
    ev.target.value = "";
  });

  ev.target.value = "";
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
@@ -757,133 +780,117 @@ for (let i = 0; i < 4; i++) {
      if (selectedPresetIndex === i) setSelectedPreset(-1);
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
        currentProjectName = null;
        draw();
    promptImageReplacement(() => {
      const reader = new FileReader();
      reader.onload = () => {
        loadImageFromDataUrl(reader.result);
      };
      img.src = imageSrc;
    };
    reader.readAsDataURL(f);
      reader.readAsDataURL(f);
    });
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
