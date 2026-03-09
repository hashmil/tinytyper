import { createEditor } from "./editor.js";

// ── State ──────────────────────────────────────────────────────────────

const state = {
  started: false,
  isFullscreen: false,
};

// ── DOM ────────────────────────────────────────────────────────────────

const app = document.getElementById("app");
const page = document.getElementById("page");
const startOverlay = document.getElementById("start-overlay");
const startFullscreenBtn = document.getElementById("start-fullscreen");
const startWindowedBtn = document.getElementById("start-windowed");
const fullscreenToggle = document.getElementById("fullscreen-toggle");
const toolbar = document.getElementById("toolbar");
const fontBtn = document.getElementById("font-btn");
const colorDots = document.getElementById("color-dots");
const clearBtn = document.getElementById("clear-btn");
const mobileInput = document.getElementById("mobile-input");

const themeBtn = document.getElementById("theme-btn");
const themeDecor = document.getElementById("theme-decor");

// ── Editor ─────────────────────────────────────────────────────────────

const editor = createEditor(page);

// ── iOS detection ──────────────────────────────────────────────────────

const isIOS = /iPhone|iPod/.test(navigator.userAgent);

if (isIOS) {
  if (startFullscreenBtn) startFullscreenBtn.hidden = true;
  if (startWindowedBtn) {
    startWindowedBtn.classList.remove("action-secondary");
    startWindowedBtn.classList.add("action-primary");
    startWindowedBtn.textContent = "Start";
  }
}

// ── Fullscreen ─────────────────────────────────────────────────────────

function syncFullscreenState() {
  state.isFullscreen = Boolean(
    document.fullscreenElement || document.webkitFullscreenElement
  );
  fullscreenToggle.textContent = state.isFullscreen ? "\u00d7" : "Go Full Screen";
  fullscreenToggle.classList.toggle("is-close", state.isFullscreen);
}

async function enterFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    syncFullscreenState();
    return true;
  }
  try {
    if (app.requestFullscreen) {
      await app.requestFullscreen();
    } else if (app.webkitRequestFullscreen) {
      app.webkitRequestFullscreen();
    } else {
      return false;
    }
    syncFullscreenState();
    return true;
  } catch (_) {
    syncFullscreenState();
    return false;
  }
}

async function exitFullscreen() {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch (_) {}
  syncFullscreenState();
}

async function toggleFullscreen() {
  if (state.isFullscreen) {
    await exitFullscreen();
  } else {
    await enterFullscreen();
  }
}

// ── App lifecycle ──────────────────────────────────────────────────────

function startApp(preferFullscreen) {
  if (state.started) return;
  state.started = true;
  startOverlay.classList.add("is-hidden");
  toolbar.hidden = false;

  // Select default color dot
  const dots = colorDots.querySelectorAll(".dot");
  if (dots.length) dots[0].classList.add("is-selected");

  // Update font button text
  fontBtn.style.fontFamily = editor.getFont().css;

  if (!isIOS) {
    fullscreenToggle.hidden = false;
    syncFullscreenState();
    if (preferFullscreen) enterFullscreen();
  }

  focusMobileInput();
}

// ── Mobile keyboard support ────────────────────────────────────────────

const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

function focusMobileInput() {
  if (isMobile) {
    mobileInput.focus({ preventScroll: true });
  }
}

// On mobile, capture input via the hidden input element
mobileInput.addEventListener("input", (e) => {
  if (!state.started) return;
  const data = e.data;
  if (data) {
    for (const ch of data) {
      editor.addChar(ch);
    }
  }
  // Clear the input so next character works
  mobileInput.value = "";
});

mobileInput.addEventListener("beforeinput", (e) => {
  if (!state.started) return;
  if (e.inputType === "deleteContentBackward") {
    editor.deleteChar();
    e.preventDefault();
  } else if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") {
    editor.addNewline();
    e.preventDefault();
  }
});

// Tap on page re-focuses mobile input
page.addEventListener("click", () => {
  if (state.started) focusMobileInput();
});

// Keep mobile input focused
mobileInput.addEventListener("blur", () => {
  if (state.started && isMobile) {
    // Small delay to allow toolbar taps to register
    setTimeout(() => focusMobileInput(), 100);
  }
});

// ── Desktop keyboard ──────────────────────────────────────────────────

function handleKeyDown(e) {
  if (!state.started) return;
  if (e.key === "Escape") return;

  // Allow mobile input to handle its own events
  if (isMobile && document.activeElement === mobileInput) return;

  // Block browser shortcuts
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  // Ignore modifier-only keys
  if (
    e.key === "Shift" || e.key === "Control" || e.key === "Alt" ||
    e.key === "Meta" || e.key === "CapsLock" || e.key === "Dead" ||
    e.key === "Tab"
  ) {
    return;
  }

  if (e.key === "Backspace") {
    editor.deleteChar();
    return;
  }

  if (e.key === "Enter") {
    editor.addNewline();
    return;
  }

  // Single printable character
  if (e.key.length === 1) {
    editor.addChar(e.key);
  }
}

// ── Toolbar: font cycling ──────────────────────────────────────────────

fontBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const font = editor.cycleFont();
  fontBtn.style.fontFamily = font.css;
  fontBtn.textContent = "Aa";
  focusMobileInput();
});

// ── Toolbar: color selection ───────────────────────────────────────────

colorDots.addEventListener("click", (e) => {
  const dot = e.target.closest(".dot");
  if (!dot) return;
  e.stopPropagation();

  // Update selection ring
  colorDots.querySelectorAll(".dot").forEach((d) => d.classList.remove("is-selected"));
  dot.classList.add("is-selected");

  editor.setColor(dot.dataset.color);
  focusMobileInput();
});

// ── Toolbar: clear with double-tap confirm ─────────────────────────────

let clearTimer = null;

clearBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  if (clearBtn.classList.contains("is-confirming")) {
    // Second tap — clear
    editor.clear();
    clearBtn.classList.remove("is-confirming");
    clearTimeout(clearTimer);
    clearTimer = null;
  } else {
    // First tap — enter confirm state
    clearBtn.classList.add("is-confirming");
    clearTimer = setTimeout(() => {
      clearBtn.classList.remove("is-confirming");
      clearTimer = null;
    }, 1500);
  }

  focusMobileInput();
});

// ── Toolbar: theme cycling ──────────────────────────────────────────────

const THEMES = [
  { id: "paper", label: "Paper", icon: "sun" },
  { id: "space", label: "Space", icon: "star" },
  { id: "princess", label: "Princess", icon: "sparkle" },
  { id: "forest", label: "Forest", icon: "tree" },
  { id: "ocean", label: "Ocean", icon: "wave" },
  { id: "sunset", label: "Sunset", icon: "sunset" },
];

let themeIndex = 0;

// SVG decorations for each theme (subtle, low-opacity background art)
const THEME_DECOR_SVG = {
  paper: "",
  space: `
    <svg viewBox="0 0 200 200" style="width:120px;right:5%;top:8%;opacity:0.06">
      <circle cx="100" cy="100" r="40" fill="currentColor"/>
      <circle cx="100" cy="100" r="55" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 6"/>
      <circle cx="60" cy="45" r="6" fill="currentColor"/>
    </svg>
    <svg viewBox="0 0 100 100" style="width:60px;left:8%;top:15%;opacity:0.05">
      <polygon points="50,5 61,35 95,35 67,55 78,85 50,65 22,85 33,55 5,35 39,35" fill="currentColor"/>
    </svg>
    <svg viewBox="0 0 100 100" style="width:40px;right:15%;bottom:25%;opacity:0.05">
      <polygon points="50,5 61,35 95,35 67,55 78,85 50,65 22,85 33,55 5,35 39,35" fill="currentColor"/>
    </svg>
    <svg viewBox="0 0 200 60" style="width:140px;left:10%;bottom:18%;opacity:0.04">
      <ellipse cx="100" cy="50" rx="90" ry="8" fill="currentColor"/>
      <path d="M30,48 Q50,10 70,48" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="50" cy="20" r="8" fill="currentColor"/>
      <path d="M120,48 Q140,20 160,48" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,
  princess: `
    <svg viewBox="0 0 100 100" style="width:80px;right:6%;top:10%;opacity:0.07">
      <path d="M50,10 L55,40 L85,45 L55,50 L50,80 L45,50 L15,45 L45,40 Z" fill="currentColor"/>
    </svg>
    <svg viewBox="0 0 100 100" style="width:50px;left:8%;top:20%;opacity:0.05">
      <path d="M50,10 L55,40 L85,45 L55,50 L50,80 L45,50 L15,45 L45,40 Z" fill="currentColor"/>
    </svg>
    <svg viewBox="0 0 120 100" style="width:100px;left:15%;bottom:20%;opacity:0.05">
      <path d="M60,90 C60,90 10,70 20,40 C25,25 40,20 50,30 C55,20 60,15 60,15 C60,15 65,20 70,30 C80,20 95,25 100,40 C110,70 60,90 60,90Z" fill="currentColor"/>
    </svg>
    <svg viewBox="0 0 100 80" style="width:70px;right:12%;bottom:30%;opacity:0.04">
      <path d="M30,70 L20,25 L35,40 L50,10 L65,40 L80,25 L70,70 Z" fill="currentColor"/>
      <ellipse cx="50" cy="72" rx="25" ry="5" fill="currentColor"/>
    </svg>
  `,
  forest: `
    <svg viewBox="0 0 100 120" style="width:80px;left:5%;bottom:15%;opacity:0.06">
      <polygon points="50,10 80,50 65,50 90,80 70,80 95,110 5,110 30,80 10,80 35,50 20,50" fill="currentColor"/>
      <rect x="43" y="110" width="14" height="15" fill="currentColor"/>
    </svg>
    <svg viewBox="0 0 100 120" style="width:55px;right:8%;bottom:18%;opacity:0.05">
      <polygon points="50,15 75,50 62,50 82,80 68,80 88,110 12,110 32,80 18,80 38,50 25,50" fill="currentColor"/>
      <rect x="43" y="110" width="14" height="12" fill="currentColor"/>
    </svg>
    <svg viewBox="0 0 100 60" style="width:70px;right:15%;top:10%;opacity:0.05">
      <ellipse cx="35" cy="40" rx="30" ry="18" fill="currentColor"/>
      <ellipse cx="65" cy="35" rx="28" ry="20" fill="currentColor"/>
      <rect x="45" y="45" width="6" height="15" fill="currentColor"/>
    </svg>
    <svg viewBox="0 0 80 80" style="width:45px;left:12%;top:12%;opacity:0.04">
      <path d="M40,10 C45,15 60,20 55,35 C65,30 70,45 60,50 C70,55 65,70 50,65 C55,75 40,78 35,68 C25,75 15,65 25,55 C10,55 12,40 25,40 C15,30 25,18 35,25 C30,15 35,10 40,10Z" fill="currentColor"/>
    </svg>
  `,
  ocean: `
    <svg viewBox="0 0 200 40" style="width:180px;left:5%;bottom:16%;opacity:0.06">
      <path d="M0,20 Q25,5 50,20 Q75,35 100,20 Q125,5 150,20 Q175,35 200,20" fill="none" stroke="currentColor" stroke-width="3"/>
      <path d="M0,30 Q25,18 50,30 Q75,42 100,30 Q125,18 150,30 Q175,42 200,30" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>
    <svg viewBox="0 0 80 80" style="width:60px;right:8%;top:10%;opacity:0.05">
      <circle cx="40" cy="40" r="25" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M40,15 L40,40 L58,52" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="25" cy="60" r="8" fill="currentColor" opacity="0.5"/>
      <circle cx="55" cy="65" r="5" fill="currentColor" opacity="0.4"/>
    </svg>
    <svg viewBox="0 0 100 50" style="width:80px;left:10%;top:15%;opacity:0.04">
      <path d="M10,40 Q20,10 40,25 Q50,5 70,20 Q85,10 95,30" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <circle cx="30" cy="38" r="4" fill="currentColor"/>
      <circle cx="60" cy="35" r="3" fill="currentColor"/>
    </svg>
  `,
  sunset: `
    <svg viewBox="0 0 200 100" style="width:160px;left:2%;bottom:15%;opacity:0.06">
      <circle cx="100" cy="80" r="40" fill="currentColor"/>
      <line x1="100" y1="30" x2="100" y2="15" stroke="currentColor" stroke-width="2"/>
      <line x1="130" y1="40" x2="140" y2="28" stroke="currentColor" stroke-width="2"/>
      <line x1="70" y1="40" x2="60" y2="28" stroke="currentColor" stroke-width="2"/>
      <line x1="148" y1="65" x2="162" y2="60" stroke="currentColor" stroke-width="2"/>
      <line x1="52" y1="65" x2="38" y2="60" stroke="currentColor" stroke-width="2"/>
      <rect x="0" y="80" width="200" height="20" fill="currentColor" opacity="0.5"/>
    </svg>
    <svg viewBox="0 0 60 60" style="width:40px;right:10%;top:12%;opacity:0.04">
      <circle cx="30" cy="30" r="12" fill="currentColor"/>
      <circle cx="22" cy="22" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,
};

function applyTheme(theme) {
  if (theme.id === "paper") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme.id);
  }
  themeDecor.innerHTML = THEME_DECOR_SVG[theme.id] || "";
}

themeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  themeIndex = (themeIndex + 1) % THEMES.length;
  applyTheme(THEMES[themeIndex]);
  focusMobileInput();
});

// ── Event binding ──────────────────────────────────────────────────────

startFullscreenBtn.addEventListener("click", () => startApp(true));
startWindowedBtn.addEventListener("click", () => startApp(false));
fullscreenToggle.addEventListener("click", toggleFullscreen);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("fullscreenchange", syncFullscreenState);
window.addEventListener("webkitfullscreenchange", syncFullscreenState);

// ── Toddler-proofing ──────────────────────────────────────────────────

window.addEventListener("contextmenu", (e) => {
  if (state.started) e.preventDefault();
});

window.addEventListener("dragstart", (e) => {
  if (state.started) e.preventDefault();
});

window.addEventListener("drop", (e) => {
  if (state.started) e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  if (state.started && e.key !== "Escape") e.preventDefault();
});

window.addEventListener("beforeunload", (e) => {
  if (state.started && state.isFullscreen) {
    e.preventDefault();
  }
});

// Prevent pinch zoom on the page area
page.addEventListener("touchmove", (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// ── Boot ───────────────────────────────────────────────────────────────

syncFullscreenState();
