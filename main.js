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
    <!-- rocket -->
    <svg viewBox="0 0 80 120" style="width:90px;right:4%;top:6%;opacity:0.07">
      <path d="M40,5 C40,5 55,25 55,60 L65,80 L55,75 L55,90 L45,82 L40,95 L35,82 L25,90 L25,75 L15,80 L25,60 C25,25 40,5 40,5Z" fill="currentColor"/>
      <circle cx="40" cy="45" r="8" fill="currentColor" opacity="0.3"/>
    </svg>
    <!-- moon with craters -->
    <svg viewBox="0 0 100 100" style="width:80px;left:5%;top:12%;opacity:0.06">
      <circle cx="50" cy="50" r="38" fill="currentColor"/>
      <circle cx="38" cy="35" r="8" fill="currentColor" opacity="0.3"/>
      <circle cx="60" cy="55" r="6" fill="currentColor" opacity="0.3"/>
      <circle cx="45" cy="65" r="4" fill="currentColor" opacity="0.3"/>
    </svg>
    <!-- saturn -->
    <svg viewBox="0 0 120 80" style="width:100px;left:6%;bottom:22%;opacity:0.05">
      <circle cx="60" cy="40" r="20" fill="currentColor"/>
      <ellipse cx="60" cy="40" rx="50" ry="10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    </svg>
    <!-- small star -->
    <svg viewBox="0 0 50 50" style="width:35px;right:10%;bottom:30%;opacity:0.06">
      <path d="M25,2 L30,18 L47,18 L33,28 L38,45 L25,35 L12,45 L17,28 L3,18 L20,18Z" fill="currentColor"/>
    </svg>
  `,
  princess: `
    <!-- tiara/crown -->
    <svg viewBox="0 0 120 80" style="width:100px;right:4%;top:8%;opacity:0.07">
      <path d="M15,65 L25,20 L40,45 L60,8 L80,45 L95,20 L105,65Z" fill="currentColor"/>
      <circle cx="60" cy="18" r="5" fill="currentColor" opacity="0.4"/>
      <circle cx="25" cy="28" r="4" fill="currentColor" opacity="0.4"/>
      <circle cx="95" cy="28" r="4" fill="currentColor" opacity="0.4"/>
      <rect x="10" y="62" width="100" height="10" rx="3" fill="currentColor"/>
    </svg>
    <!-- magic wand with star -->
    <svg viewBox="0 0 80 120" style="width:60px;left:6%;top:18%;opacity:0.06">
      <line x1="20" y1="110" x2="55" y2="30" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <path d="M55,5 L58,18 L70,20 L60,27 L63,40 L55,32 L47,40 L50,27 L40,20 L52,18Z" fill="currentColor"/>
    </svg>
    <!-- heart -->
    <svg viewBox="0 0 100 90" style="width:80px;left:8%;bottom:20%;opacity:0.05">
      <path d="M50,85 C50,85 5,55 5,30 C5,12 20,5 35,15 C42,5 50,8 50,8 C50,8 58,5 65,15 C80,5 95,12 95,30 C95,55 50,85 50,85Z" fill="currentColor"/>
    </svg>
    <!-- small sparkle -->
    <svg viewBox="0 0 50 50" style="width:40px;right:8%;bottom:28%;opacity:0.05">
      <path d="M25,0 L28,20 L48,25 L28,30 L25,50 L22,30 L2,25 L22,20Z" fill="currentColor"/>
    </svg>
  `,
  forest: `
    <!-- big pine tree -->
    <svg viewBox="0 0 80 120" style="width:80px;left:4%;bottom:14%;opacity:0.07">
      <polygon points="40,5 70,45 58,45 78,75 62,75 85,110 -5,110 18,75 2,75 22,45 10,45" fill="currentColor"/>
      <rect x="33" y="105" width="14" height="18" fill="currentColor"/>
    </svg>
    <!-- mushroom -->
    <svg viewBox="0 0 80 80" style="width:60px;right:5%;bottom:16%;opacity:0.06">
      <ellipse cx="40" cy="35" rx="35" ry="25" fill="currentColor"/>
      <rect x="30" y="35" width="20" height="30" rx="4" fill="currentColor" opacity="0.7"/>
      <circle cx="28" cy="28" r="5" fill="currentColor" opacity="0.3"/>
      <circle cx="48" cy="22" r="4" fill="currentColor" opacity="0.3"/>
      <circle cx="38" cy="18" r="3" fill="currentColor" opacity="0.3"/>
    </svg>
    <!-- butterfly -->
    <svg viewBox="0 0 80 60" style="width:65px;right:8%;top:10%;opacity:0.05">
      <ellipse cx="25" cy="20" rx="18" ry="15" fill="currentColor"/>
      <ellipse cx="55" cy="20" rx="18" ry="15" fill="currentColor"/>
      <ellipse cx="25" cy="42" rx="12" ry="10" fill="currentColor"/>
      <ellipse cx="55" cy="42" rx="12" ry="10" fill="currentColor"/>
      <rect x="38" y="10" width="4" height="40" rx="2" fill="currentColor"/>
    </svg>
    <!-- small flower -->
    <svg viewBox="0 0 60 60" style="width:45px;left:8%;top:10%;opacity:0.05">
      <circle cx="30" cy="30" r="8" fill="currentColor" opacity="0.5"/>
      <circle cx="30" cy="14" r="9" fill="currentColor"/>
      <circle cx="30" cy="46" r="9" fill="currentColor"/>
      <circle cx="14" cy="30" r="9" fill="currentColor"/>
      <circle cx="46" cy="30" r="9" fill="currentColor"/>
    </svg>
  `,
  ocean: `
    <!-- fish -->
    <svg viewBox="0 0 100 60" style="width:90px;right:5%;top:10%;opacity:0.06">
      <ellipse cx="45" cy="30" rx="32" ry="20" fill="currentColor"/>
      <polygon points="78,30 100,10 100,50" fill="currentColor"/>
      <circle cx="30" cy="25" r="5" fill="currentColor" opacity="0.3"/>
    </svg>
    <!-- starfish -->
    <svg viewBox="0 0 80 80" style="width:65px;left:5%;bottom:18%;opacity:0.06">
      <path d="M40,5 L46,28 L70,18 L52,35 L72,52 L48,45 L40,70 L32,45 L8,52 L28,35 L10,18 L34,28Z" fill="currentColor"/>
      <circle cx="40" cy="36" r="6" fill="currentColor" opacity="0.3"/>
    </svg>
    <!-- octopus -->
    <svg viewBox="0 0 100 100" style="width:80px;left:6%;top:12%;opacity:0.05">
      <ellipse cx="50" cy="35" rx="30" ry="25" fill="currentColor"/>
      <circle cx="38" cy="30" r="5" fill="currentColor" opacity="0.3"/>
      <circle cx="62" cy="30" r="5" fill="currentColor" opacity="0.3"/>
      <path d="M25,50 Q15,70 10,85" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M33,55 Q28,75 25,90" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M42,58 Q40,78 38,92" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M58,58 Q60,78 62,92" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M67,55 Q72,75 75,90" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M75,50 Q85,70 90,85" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/>
    </svg>
    <!-- bubbles -->
    <svg viewBox="0 0 50 80" style="width:35px;right:10%;bottom:25%;opacity:0.05">
      <circle cx="25" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <circle cx="15" cy="45" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="32" cy="60" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="73" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,
  sunset: `
    <!-- sun half-setting on horizon -->
    <svg viewBox="0 0 120 70" style="width:120px;left:4%;bottom:14%;opacity:0.07">
      <path d="M60,60 A35,35 0 0,1 25,60" fill="none"/>
      <circle cx="60" cy="60" r="28" fill="currentColor"/>
      <rect x="0" y="58" width="120" height="15" fill="currentColor" opacity="0.4"/>
      <line x1="60" y1="22" x2="60" y2="8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <line x1="85" y1="32" x2="96" y2="22" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <line x1="35" y1="32" x2="24" y2="22" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <line x1="98" y1="52" x2="112" y2="48" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <line x1="22" y1="52" x2="8" y2="48" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>
    <!-- palm tree -->
    <svg viewBox="0 0 80 120" style="width:75px;right:4%;bottom:14%;opacity:0.06">
      <path d="M42,120 Q44,70 40,40" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M40,42 Q10,30 2,15" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M40,42 Q60,15 78,10" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M40,38 Q20,10 5,5" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M40,38 Q65,25 75,30" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M40,40 Q50,20 45,5" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
    </svg>
    <!-- bird silhouette -->
    <svg viewBox="0 0 60 30" style="width:50px;left:10%;top:10%;opacity:0.05">
      <path d="M0,20 Q15,5 30,15 Q45,5 60,20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>
    <!-- another bird -->
    <svg viewBox="0 0 40 20" style="width:30px;left:18%;top:18%;opacity:0.04">
      <path d="M0,14 Q10,3 20,10 Q30,3 40,14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
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
