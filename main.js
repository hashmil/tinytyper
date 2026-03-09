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
  { id: "paper", label: "Paper", icon: "sun", dark: false },
  { id: "space", label: "Space", icon: "star", dark: true },
  { id: "princess", label: "Princess", icon: "sparkle", dark: false },
  { id: "forest", label: "Forest", icon: "tree", dark: false },
  { id: "ocean", label: "Ocean", icon: "wave", dark: false },
  { id: "sunset", label: "Sunset", icon: "sunset", dark: false },
];

let themeIndex = 0;

function rebuildColorDots(colors) {
  const selectedIdx = [...colorDots.querySelectorAll(".dot")].findIndex(d => d.classList.contains("is-selected"));
  colorDots.innerHTML = "";
  colors.forEach((hex, i) => {
    const dot = document.createElement("button");
    dot.className = "dot";
    dot.dataset.color = hex;
    dot.style.background = hex;
    if (i === Math.max(selectedIdx, 0)) dot.classList.add("is-selected");
    colorDots.appendChild(dot);
  });
}

function applyTheme(theme) {
  if (theme.id === "paper") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme.id);
  }
  themeDecor.innerHTML = "";

  // Swap color palette for dark themes
  const isDark = theme.dark;
  editor.setDarkMode(isDark);
  rebuildColorDots(editor.getActiveColors());
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
