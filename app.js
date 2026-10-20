const TOTAL = 15;
const PAGE_W = 1323;
const PAGE_H = 1819;

const stage = document.getElementById("stage");
const sizer = document.getElementById("sizer");
const book = document.getElementById("book");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const scrub = document.getElementById("scrub");
const pageLabel = document.getElementById("page-label");
const zoomBtn = document.getElementById("zoom-btn");
const viewer = document.getElementById("viewer");
const viewerStage = document.getElementById("viewer-stage");
const viewerImg = document.getElementById("viewer-img");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const zoomCloseBtn = document.getElementById("zoom-close");
const zoomLevel = document.getElementById("zoom-level");

function pageSrc(index) {
  const n = String(index + 1).padStart(2, "0");
  return `pages/page-${n}.webp`;
}

for (let i = 0; i < TOTAL; i += 1) {
  const page = document.createElement("div");
  page.className = "page";
  page.dataset.density = "soft";
  const img = document.createElement("img");
  img.src = pageSrc(i);
  img.alt = `Page ${i + 1} of ${TOTAL}`;
  img.draggable = false;
  img.decoding = "async";
  page.appendChild(img);
  book.appendChild(page);
}

let pageFlip;

function contentBox() {
  const cs = getComputedStyle(stage);
  return {
    availW: stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    availH: stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
  };
}

function layoutBook() {
  const { availW, availH } = contentBox();
  const ratio = PAGE_W / PAGE_H;
  const width = Math.min(availW, availH * ratio);
  sizer.style.width = `${Math.max(140, Math.floor(width))}px`;

  if (pageFlip && pageFlip.setting) {
    // Keep a single page: portrait mode kicks in when the book is narrower than twice minWidth.
    pageFlip.setting.minWidth = Math.ceil(width);
    pageFlip.setting.maxWidth = 2400;
    if (pageFlip.render) pageFlip.update();
  }
}

layoutBook();

pageFlip = new St.PageFlip(book, {
  width: PAGE_W,
  height: PAGE_H,
  size: "stretch",
  minWidth: 100,
  maxWidth: 2400,
  minHeight: 100,
  maxHeight: 2400,
  drawShadow: true,
  flippingTime: 600,
  usePortrait: true,
  startPage: 0,
  autoSize: true,
  maxShadowOpacity: 0.4,
  showCover: false,
  mobileScrollSupport: false,
  swipeDistance: 24,
  clickEventForward: false,
  useMouseEvents: true,
  disableFlipByClick: false,
});

const pageZoom = {
  scale: 1,
  panX: 0,
  panY: 0,
};

const finger = {
  pinching: false,
  startDist: 0,
  startScale: 1,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  moved: false,
  startTime: 0,
};

function applyPageZoom() {
  const { scale, panX, panY } = pageZoom;
  sizer.style.transform = scale === 1 ? "" : `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function clampPagePan() {
  if (pageZoom.scale <= 1) {
    pageZoom.scale = 1;
    pageZoom.panX = 0;
    pageZoom.panY = 0;
    return;
  }
  const maxX = ((pageZoom.scale - 1) * sizer.offsetWidth) / 2;
  const maxY = ((pageZoom.scale - 1) * sizer.offsetHeight) / 2;
  pageZoom.panX = Math.min(maxX, Math.max(-maxX, pageZoom.panX));
  pageZoom.panY = Math.min(maxY, Math.max(-maxY, pageZoom.panY));
}

function zoomPageAt(nextScale, clientX, clientY) {
  const rect = sizer.getBoundingClientRect();
  const cx = rect.left + rect.width / 2 - pageZoom.panX;
  const cy = rect.top + rect.height / 2 - pageZoom.panY;
  const scale = Math.min(4, Math.max(1, nextScale));
  const localX = cx + (clientX - cx - pageZoom.panX) / pageZoom.scale;
  const localY = cy + (clientY - cy - pageZoom.panY) / pageZoom.scale;
  pageZoom.scale = scale;
  pageZoom.panX = clientX - cx - (localX - cx) * scale;
  pageZoom.panY = clientY - cy - (localY - cy) * scale;
  clampPagePan();
  applyPageZoom();
}

function resetPageZoom() {
  if (pageZoom.scale === 1 && pageZoom.panX === 0 && pageZoom.panY === 0) return;
  pageZoom.scale = 1;
  pageZoom.panX = 0;
  pageZoom.panY = 0;
  finger.pinching = false;
  finger.startDist = 0;
  applyPageZoom();
}

function isPageZoomed() {
  return pageZoom.scale > 1.02;
}

function touchDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function touchMidpoint(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

function clearLibraryTouch() {
  if (pageFlip && pageFlip.ui) pageFlip.ui.touchPoint = null;
}

book.addEventListener("touchstart", (event) => {
  if (event.touches.length >= 2) {
    finger.pinching = true;
    finger.startDist = touchDistance(event.touches);
    finger.startScale = pageZoom.scale;
    clearLibraryTouch();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const touch = event.touches[0];
  finger.startX = touch.clientX;
  finger.startY = touch.clientY;
  finger.lastX = touch.clientX;
  finger.lastY = touch.clientY;
  finger.moved = false;
  finger.startTime = Date.now();

  if (isPageZoomed()) {
    event.preventDefault();
    event.stopPropagation();
  }
}, { capture: true, passive: false });

book.addEventListener("touchmove", (event) => {
  if (event.touches.length >= 2) {
    finger.pinching = true;
    clearLibraryTouch();
    const dist = touchDistance(event.touches);
    if (!finger.startDist) {
      finger.startDist = dist;
      finger.startScale = pageZoom.scale;
    }
    const mid = touchMidpoint(event.touches);
    zoomPageAt(finger.startScale * (dist / finger.startDist), mid.x, mid.y);
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const touch = event.touches[0];
  if (!touch) return;

  if (isPageZoomed()) {
    pageZoom.panX += touch.clientX - finger.lastX;
    pageZoom.panY += touch.clientY - finger.lastY;
    finger.lastX = touch.clientX;
    finger.lastY = touch.clientY;
    clampPagePan();
    applyPageZoom();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (Math.hypot(touch.clientX - finger.startX, touch.clientY - finger.startY) > 18) {
    finger.moved = true;
  }
}, { capture: true, passive: false });

book.addEventListener("touchend", (event) => {
  if (finger.pinching || finger.suppressTap || event.touches.length > 0) {
    clearLibraryTouch();
    if (finger.pinching && event.touches.length < 2) {
      finger.pinching = false;
      finger.startDist = 0;
      finger.suppressTap = true;
    }
    if (event.touches.length === 0) finger.suppressTap = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (isPageZoomed()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const elapsed = Date.now() - finger.startTime;
  if (finger.moved || elapsed > 600) return;

  const rect = book.getBoundingClientRect();
  const x = finger.startX - rect.left;
  if (x < rect.width / 2) pageFlip.flipPrev();
  else pageFlip.flipNext();
}, { capture: true, passive: false });

book.addEventListener("touchcancel", () => {
  finger.pinching = false;
  finger.startDist = 0;
  clearLibraryTouch();
}, { capture: true });

let lastTouchAt = 0;
book.addEventListener("touchstart", () => {
  lastTouchAt = Date.now();
}, { capture: true, passive: true });

function swallowGhostClick(event) {
  if (Date.now() - lastTouchAt < 700) {
    event.stopPropagation();
    event.preventDefault();
  }
}

book.addEventListener("mousedown", swallowGhostClick, true);
window.addEventListener("mouseup", swallowGhostClick, true);

function showPage(index) {
  const page = Math.min(TOTAL - 1, Math.max(0, index));
  resetPageZoom();
  pageLabel.textContent = `${page + 1} / ${TOTAL}`;
  scrub.value = String(page + 1);
  scrub.setAttribute("aria-valuenow", String(page + 1));
  scrub.setAttribute("aria-valuetext", `Page ${page + 1} of ${TOTAL}`);
  prevBtn.disabled = page === 0;
  nextBtn.disabled = page === TOTAL - 1;
}

pageFlip.on("init", () => {
  document.body.classList.remove("is-booting");
  showPage(pageFlip.getCurrentPageIndex());
});

pageFlip.on("flip", (event) => {
  showPage(event.data);
});

pageFlip.loadFromHTML(document.querySelectorAll(".page"));
layoutBook();
// A finger tap ends before the library starts a fold, so it never turns the page.
// Keep swipes working, and turn the page ourselves when the finger barely moves.
if (pageFlip.ui) pageFlip.ui.swipeTimeout = 4000;

prevBtn.addEventListener("click", () => pageFlip.flipPrev());
nextBtn.addEventListener("click", () => pageFlip.flipNext());

scrub.addEventListener("input", () => {
  const index = Number(scrub.value) - 1;
  pageFlip.turnToPage(index);
  showPage(index);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !viewer.hidden) {
    closeViewer();
    return;
  }
  if (!viewer.hidden) {
    if (event.key === "+" || event.key === "=") zoomBy(0.4);
    if (event.key === "-" || event.key === "_") zoomBy(-0.4);
    return;
  }
  if (event.key === "ArrowRight") pageFlip.flipNext();
  if (event.key === "ArrowLeft") pageFlip.flipPrev();
});

const zoom = {
  scale: 1,
  panX: 0,
  panY: 0,
  baseW: 0,
  baseH: 0,
  baseX: 0,
  baseY: 0,
  pointers: new Map(),
  lastTap: 0,
};

function layoutViewer() {
  const rect = viewerStage.getBoundingClientRect();
  const fitScale = Math.min(rect.width / PAGE_W, rect.height / PAGE_H);
  zoom.baseW = PAGE_W * fitScale;
  zoom.baseH = PAGE_H * fitScale;
  zoom.baseX = (rect.width - zoom.baseW) / 2;
  zoom.baseY = (rect.height - zoom.baseH) / 2;
  viewerImg.style.width = `${zoom.baseW}px`;
  viewerImg.style.height = `${zoom.baseH}px`;
  clampPan();
  applyZoom();
}

function applyZoom() {
  viewerImg.style.transform = `translate(${zoom.baseX + zoom.panX}px, ${zoom.baseY + zoom.panY}px) scale(${zoom.scale})`;
  zoomLevel.textContent = `${Math.round(zoom.scale * 100)}%`;
}

function clampPan() {
  const rect = viewerStage.getBoundingClientRect();
  const dispW = zoom.baseW * zoom.scale;
  const dispH = zoom.baseH * zoom.scale;

  if (dispW <= rect.width) {
    zoom.panX = (rect.width - dispW) / 2 - zoom.baseX;
  } else {
    const minX = rect.width - dispW - zoom.baseX;
    const maxX = -zoom.baseX;
    zoom.panX = Math.min(maxX, Math.max(minX, zoom.panX));
  }

  if (dispH <= rect.height) {
    zoom.panY = (rect.height - dispH) / 2 - zoom.baseY;
  } else {
    const minY = rect.height - dispH - zoom.baseY;
    const maxY = -zoom.baseY;
    zoom.panY = Math.min(maxY, Math.max(minY, zoom.panY));
  }
}

function zoomAt(nextScale, clientX, clientY) {
  const rect = viewerStage.getBoundingClientRect();
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;
  const scale = Math.min(4, Math.max(1, nextScale));
  const imageX = (cx - zoom.baseX - zoom.panX) / zoom.scale;
  const imageY = (cy - zoom.baseY - zoom.panY) / zoom.scale;
  zoom.scale = scale;
  zoom.panX = cx - zoom.baseX - imageX * scale;
  zoom.panY = cy - zoom.baseY - imageY * scale;
  clampPan();
  applyZoom();
}

function zoomBy(delta) {
  const rect = viewerStage.getBoundingClientRect();
  zoomAt(zoom.scale + delta, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function openViewer() {
  const index = pageFlip.getCurrentPageIndex();
  viewerImg.src = pageSrc(index);
  viewerImg.alt = `Page ${index + 1} of ${TOTAL}, zoomed`;
  zoom.scale = 1;
  zoom.panX = 0;
  zoom.panY = 0;
  viewer.hidden = false;
  layoutViewer();
  zoomCloseBtn.focus();
}

function closeViewer() {
  viewer.hidden = true;
  zoom.pointers.clear();
  zoomBtn.focus();
}

zoomBtn.addEventListener("click", openViewer);
zoomCloseBtn.addEventListener("click", closeViewer);
zoomInBtn.addEventListener("click", () => zoomBy(0.5));
zoomOutBtn.addEventListener("click", () => zoomBy(-0.5));

viewerStage.addEventListener("pointerdown", (event) => {
  viewerStage.setPointerCapture(event.pointerId);
  zoom.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (zoom.pointers.size === 1) {
    const now = Date.now();
    if (now - zoom.lastTap < 280) {
      const next = zoom.scale > 1.05 ? 1 : 2.5;
      zoomAt(next, event.clientX, event.clientY);
      zoom.lastTap = 0;
    } else {
      zoom.lastTap = now;
    }
  }
});

viewerStage.addEventListener("pointermove", (event) => {
  if (!zoom.pointers.has(event.pointerId)) return;
  const previous = zoom.pointers.get(event.pointerId);
  zoom.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (zoom.pointers.size === 2) {
    const pts = [...zoom.pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (!zoom.pinchDist) {
      zoom.pinchDist = dist;
      zoom.pinchScale = zoom.scale;
    }
    const midX = (pts[0].x + pts[1].x) / 2;
    const midY = (pts[0].y + pts[1].y) / 2;
    zoomAt(zoom.pinchScale * (dist / zoom.pinchDist), midX, midY);
    return;
  }

  if (zoom.pointers.size === 1 && zoom.scale > 1) {
    zoom.panX += event.clientX - previous.x;
    zoom.panY += event.clientY - previous.y;
    clampPan();
    applyZoom();
  }
});

function endPointer(event) {
  zoom.pointers.delete(event.pointerId);
  if (zoom.pointers.size < 2) {
    zoom.pinchDist = 0;
  }
}

viewerStage.addEventListener("pointerup", endPointer);
viewerStage.addEventListener("pointercancel", endPointer);

window.addEventListener("resize", () => {
  resetPageZoom();
  layoutBook();
  if (!viewer.hidden) layoutViewer();
});

setTimeout(() => document.body.classList.remove("is-booting"), 4000);
