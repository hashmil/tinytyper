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
    <!-- top border: stars and dots -->
    <svg viewBox="0 0 1000 30" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:30px;opacity:0.1">
      <path d="M20,15 L22,9 L28,9 L23,13 L25,19 L20,16 L15,19 L17,13 L12,9 L18,9Z" fill="currentColor"/>
      <circle cx="80" cy="15" r="2" fill="currentColor"/>
      <circle cx="130" cy="10" r="1.5" fill="currentColor"/>
      <path d="M200,15 L202,9 L208,9 L203,13 L205,19 L200,16 L195,19 L197,13 L192,9 L198,9Z" fill="currentColor"/>
      <circle cx="270" cy="18" r="2" fill="currentColor"/>
      <circle cx="320" cy="8" r="1.5" fill="currentColor"/>
      <path d="M400,15 L402,9 L408,9 L403,13 L405,19 L400,16 L395,19 L397,13 L392,9 L398,9Z" fill="currentColor"/>
      <circle cx="470" cy="12" r="2" fill="currentColor"/>
      <path d="M550,15 L552,9 L558,9 L553,13 L555,19 L550,16 L545,19 L547,13 L542,9 L548,9Z" fill="currentColor"/>
      <circle cx="620" cy="17" r="1.5" fill="currentColor"/>
      <circle cx="680" cy="9" r="2" fill="currentColor"/>
      <path d="M750,15 L752,9 L758,9 L753,13 L755,19 L750,16 L745,19 L747,13 L742,9 L748,9Z" fill="currentColor"/>
      <circle cx="830" cy="14" r="1.5" fill="currentColor"/>
      <path d="M900,15 L902,9 L908,9 L903,13 L905,19 L900,16 L895,19 L897,13 L892,9 L898,9Z" fill="currentColor"/>
      <circle cx="960" cy="11" r="2" fill="currentColor"/>
    </svg>
    <!-- bottom border: stars and dots -->
    <svg viewBox="0 0 1000 30" preserveAspectRatio="none" style="position:absolute;bottom:60px;left:0;width:100%;height:30px;opacity:0.1">
      <path d="M50,15 L52,9 L58,9 L53,13 L55,19 L50,16 L45,19 L47,13 L42,9 L48,9Z" fill="currentColor"/>
      <circle cx="120" cy="12" r="2" fill="currentColor"/>
      <circle cx="180" cy="18" r="1.5" fill="currentColor"/>
      <path d="M260,15 L262,9 L268,9 L263,13 L265,19 L260,16 L255,19 L257,13 L252,9 L258,9Z" fill="currentColor"/>
      <circle cx="340" cy="10" r="2" fill="currentColor"/>
      <path d="M430,15 L432,9 L438,9 L433,13 L435,19 L430,16 L425,19 L427,13 L422,9 L428,9Z" fill="currentColor"/>
      <circle cx="510" cy="16" r="1.5" fill="currentColor"/>
      <path d="M600,15 L602,9 L608,9 L603,13 L605,19 L600,16 L595,19 L597,13 L592,9 L598,9Z" fill="currentColor"/>
      <circle cx="680" cy="13" r="2" fill="currentColor"/>
      <circle cx="740" cy="8" r="1.5" fill="currentColor"/>
      <path d="M820,15 L822,9 L828,9 L823,13 L825,19 L820,16 L815,19 L817,13 L812,9 L818,9Z" fill="currentColor"/>
      <circle cx="900" cy="15" r="2" fill="currentColor"/>
      <path d="M960,15 L962,9 L968,9 L963,13 L965,19 L960,16 L955,19 L957,13 L952,9 L958,9Z" fill="currentColor"/>
    </svg>
    <!-- left border: moons and stars -->
    <svg viewBox="0 0 30 800" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:30px;height:100%;opacity:0.1">
      <circle cx="15" cy="60" r="8" fill="currentColor"/><circle cx="12" cy="56" r="3" fill="currentColor" opacity="0.3"/>
      <path d="M15,160 L17,154 L23,154 L18,158 L20,164 L15,161 L10,164 L12,158 L7,154 L13,154Z" fill="currentColor"/>
      <circle cx="15" cy="260" r="2" fill="currentColor"/>
      <circle cx="15" cy="360" r="8" fill="currentColor"/><circle cx="12" cy="356" r="3" fill="currentColor" opacity="0.3"/>
      <path d="M15,460 L17,454 L23,454 L18,458 L20,464 L15,461 L10,464 L12,458 L7,454 L13,454Z" fill="currentColor"/>
      <circle cx="15" cy="560" r="2" fill="currentColor"/>
      <circle cx="15" cy="660" r="8" fill="currentColor"/><circle cx="12" cy="656" r="3" fill="currentColor" opacity="0.3"/>
      <path d="M15,750 L17,744 L23,744 L18,748 L20,754 L15,751 L10,754 L12,748 L7,744 L13,744Z" fill="currentColor"/>
    </svg>
    <!-- right border: moons and stars -->
    <svg viewBox="0 0 30 800" preserveAspectRatio="none" style="position:absolute;top:0;right:0;width:30px;height:100%;opacity:0.1">
      <path d="M15,80 L17,74 L23,74 L18,78 L20,84 L15,81 L10,84 L12,78 L7,74 L13,74Z" fill="currentColor"/>
      <circle cx="15" cy="180" r="8" fill="currentColor"/><circle cx="18" cy="176" r="3" fill="currentColor" opacity="0.3"/>
      <circle cx="15" cy="280" r="2" fill="currentColor"/>
      <path d="M15,380 L17,374 L23,374 L18,378 L20,384 L15,381 L10,384 L12,378 L7,374 L13,374Z" fill="currentColor"/>
      <circle cx="15" cy="480" r="8" fill="currentColor"/><circle cx="18" cy="476" r="3" fill="currentColor" opacity="0.3"/>
      <circle cx="15" cy="580" r="2" fill="currentColor"/>
      <path d="M15,680 L17,674 L23,674 L18,678 L20,684 L15,681 L10,684 L12,678 L7,674 L13,674Z" fill="currentColor"/>
      <circle cx="15" cy="760" r="8" fill="currentColor"/><circle cx="18" cy="756" r="3" fill="currentColor" opacity="0.3"/>
    </svg>
  `,
  princess: `
    <!-- top border: hearts and sparkles -->
    <svg viewBox="0 0 1000 28" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:28px;opacity:0.1">
      <path d="M30,18 C30,18 22,12 22,8 C22,5 25,4 28,6 C29,4 30,5 30,5 C30,5 31,4 32,6 C35,4 38,5 38,8 C38,12 30,18 30,18Z" fill="currentColor"/>
      <path d="M100,14 L101,10 L105,10 L102,12 L103,16 L100,14 L97,16 L98,12 L95,10 L99,10Z" fill="currentColor"/>
      <path d="M180,18 C180,18 172,12 172,8 C172,5 175,4 178,6 C179,4 180,5 180,5 C180,5 181,4 182,6 C185,4 188,5 188,8 C188,12 180,18 180,18Z" fill="currentColor"/>
      <path d="M260,14 L261,10 L265,10 L262,12 L263,16 L260,14 L257,16 L258,12 L255,10 L259,10Z" fill="currentColor"/>
      <path d="M340,18 C340,18 332,12 332,8 C332,5 335,4 338,6 C339,4 340,5 340,5 C340,5 341,4 342,6 C345,4 348,5 348,8 C348,12 340,18 340,18Z" fill="currentColor"/>
      <path d="M420,14 L421,10 L425,10 L422,12 L423,16 L420,14 L417,16 L418,12 L415,10 L419,10Z" fill="currentColor"/>
      <path d="M500,18 C500,18 492,12 492,8 C492,5 495,4 498,6 C499,4 500,5 500,5 C500,5 501,4 502,6 C505,4 508,5 508,8 C508,12 500,18 500,18Z" fill="currentColor"/>
      <path d="M580,14 L581,10 L585,10 L582,12 L583,16 L580,14 L577,16 L578,12 L575,10 L579,10Z" fill="currentColor"/>
      <path d="M660,18 C660,18 652,12 652,8 C652,5 655,4 658,6 C659,4 660,5 660,5 C660,5 661,4 662,6 C665,4 668,5 668,8 C668,12 660,18 660,18Z" fill="currentColor"/>
      <path d="M740,14 L741,10 L745,10 L742,12 L743,16 L740,14 L737,16 L738,12 L735,10 L739,10Z" fill="currentColor"/>
      <path d="M820,18 C820,18 812,12 812,8 C812,5 815,4 818,6 C819,4 820,5 820,5 C820,5 821,4 822,6 C825,4 828,5 828,8 C828,12 820,18 820,18Z" fill="currentColor"/>
      <path d="M900,14 L901,10 L905,10 L902,12 L903,16 L900,14 L897,16 L898,12 L895,10 L899,10Z" fill="currentColor"/>
      <path d="M970,18 C970,18 962,12 962,8 C962,5 965,4 968,6 C969,4 970,5 970,5 C970,5 971,4 972,6 C975,4 978,5 978,8 C978,12 970,18 970,18Z" fill="currentColor"/>
    </svg>
    <!-- bottom border -->
    <svg viewBox="0 0 1000 28" preserveAspectRatio="none" style="position:absolute;bottom:60px;left:0;width:100%;height:28px;opacity:0.1">
      <path d="M60,14 L61,10 L65,10 L62,12 L63,16 L60,14 L57,16 L58,12 L55,10 L59,10Z" fill="currentColor"/>
      <path d="M150,18 C150,18 142,12 142,8 C142,5 145,4 148,6 C149,4 150,5 150,5 C150,5 151,4 152,6 C155,4 158,5 158,8 C158,12 150,18 150,18Z" fill="currentColor"/>
      <path d="M240,14 L241,10 L245,10 L242,12 L243,16 L240,14 L237,16 L238,12 L235,10 L239,10Z" fill="currentColor"/>
      <path d="M330,18 C330,18 322,12 322,8 C322,5 325,4 328,6 C329,4 330,5 330,5 C330,5 331,4 332,6 C335,4 338,5 338,8 C338,12 330,18 330,18Z" fill="currentColor"/>
      <path d="M420,14 L421,10 L425,10 L422,12 L423,16 L420,14 L417,16 L418,12 L415,10 L419,10Z" fill="currentColor"/>
      <path d="M510,18 C510,18 502,12 502,8 C502,5 505,4 508,6 C509,4 510,5 510,5 C510,5 511,4 512,6 C515,4 518,5 518,8 C518,12 510,18 510,18Z" fill="currentColor"/>
      <path d="M600,14 L601,10 L605,10 L602,12 L603,16 L600,14 L597,16 L598,12 L595,10 L599,10Z" fill="currentColor"/>
      <path d="M690,18 C690,18 682,12 682,8 C682,5 685,4 688,6 C689,4 690,5 690,5 C690,5 691,4 692,6 C695,4 698,5 698,8 C698,12 690,18 690,18Z" fill="currentColor"/>
      <path d="M780,14 L781,10 L785,10 L782,12 L783,16 L780,14 L777,16 L778,12 L775,10 L779,10Z" fill="currentColor"/>
      <path d="M870,18 C870,18 862,12 862,8 C862,5 865,4 868,6 C869,4 870,5 870,5 C870,5 871,4 872,6 C875,4 878,5 878,8 C878,12 870,18 870,18Z" fill="currentColor"/>
      <path d="M950,14 L951,10 L955,10 L952,12 L953,16 L950,14 L947,16 L948,12 L945,10 L949,10Z" fill="currentColor"/>
    </svg>
    <!-- left border: hearts and sparkles -->
    <svg viewBox="0 0 28 800" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:28px;height:100%;opacity:0.1">
      <path d="M14,50 C14,50 6,44 6,40 C6,37 9,36 12,38 C13,36 14,37 14,37 C14,37 15,36 16,38 C19,36 22,37 22,40 C22,44 14,50 14,50Z" fill="currentColor"/>
      <path d="M14,130 L15,126 L19,126 L16,128 L17,132 L14,130 L11,132 L12,128 L9,126 L13,126Z" fill="currentColor"/>
      <path d="M14,210 C14,210 6,204 6,200 C6,197 9,196 12,198 C13,196 14,197 14,197 C14,197 15,196 16,198 C19,196 22,197 22,200 C22,204 14,210 14,210Z" fill="currentColor"/>
      <path d="M14,290 L15,286 L19,286 L16,288 L17,292 L14,290 L11,292 L12,288 L9,286 L13,286Z" fill="currentColor"/>
      <path d="M14,370 C14,370 6,364 6,360 C6,357 9,356 12,358 C13,356 14,357 14,357 C14,357 15,356 16,358 C19,356 22,357 22,360 C22,364 14,370 14,370Z" fill="currentColor"/>
      <path d="M14,450 L15,446 L19,446 L16,448 L17,452 L14,450 L11,452 L12,448 L9,446 L13,446Z" fill="currentColor"/>
      <path d="M14,530 C14,530 6,524 6,520 C6,517 9,516 12,518 C13,516 14,517 14,517 C14,517 15,516 16,518 C19,516 22,517 22,520 C22,524 14,530 14,530Z" fill="currentColor"/>
      <path d="M14,610 L15,606 L19,606 L16,608 L17,612 L14,610 L11,612 L12,608 L9,606 L13,606Z" fill="currentColor"/>
      <path d="M14,690 C14,690 6,684 6,680 C6,677 9,676 12,678 C13,676 14,677 14,677 C14,677 15,676 16,678 C19,676 22,677 22,680 C22,684 14,690 14,690Z" fill="currentColor"/>
      <path d="M14,760 L15,756 L19,756 L16,758 L17,762 L14,760 L11,762 L12,758 L9,756 L13,756Z" fill="currentColor"/>
    </svg>
    <!-- right border -->
    <svg viewBox="0 0 28 800" preserveAspectRatio="none" style="position:absolute;top:0;right:0;width:28px;height:100%;opacity:0.1">
      <path d="M14,80 L15,76 L19,76 L16,78 L17,82 L14,80 L11,82 L12,78 L9,76 L13,76Z" fill="currentColor"/>
      <path d="M14,160 C14,160 6,154 6,150 C6,147 9,146 12,148 C13,146 14,147 14,147 C14,147 15,146 16,148 C19,146 22,147 22,150 C22,154 14,160 14,160Z" fill="currentColor"/>
      <path d="M14,240 L15,236 L19,236 L16,238 L17,242 L14,240 L11,242 L12,238 L9,236 L13,236Z" fill="currentColor"/>
      <path d="M14,320 C14,320 6,314 6,310 C6,307 9,306 12,308 C13,306 14,307 14,307 C14,307 15,306 16,308 C19,306 22,307 22,310 C22,314 14,320 14,320Z" fill="currentColor"/>
      <path d="M14,400 L15,396 L19,396 L16,398 L17,402 L14,400 L11,402 L12,398 L9,396 L13,396Z" fill="currentColor"/>
      <path d="M14,480 C14,480 6,474 6,470 C6,467 9,466 12,468 C13,466 14,467 14,467 C14,467 15,466 16,468 C19,466 22,467 22,470 C22,474 14,480 14,480Z" fill="currentColor"/>
      <path d="M14,560 L15,556 L19,556 L16,558 L17,562 L14,560 L11,562 L12,558 L9,556 L13,556Z" fill="currentColor"/>
      <path d="M14,640 C14,640 6,634 6,630 C6,627 9,626 12,628 C13,626 14,627 14,627 C14,627 15,626 16,628 C19,626 22,627 22,630 C22,634 14,640 14,640Z" fill="currentColor"/>
      <path d="M14,720 L15,716 L19,716 L16,718 L17,722 L14,720 L11,722 L12,718 L9,716 L13,716Z" fill="currentColor"/>
    </svg>
  `,
  forest: `
    <!-- top border: leaves and flowers -->
    <svg viewBox="0 0 1000 30" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:30px;opacity:0.1">
      <path d="M20,20 Q25,5 40,10 Q30,15 20,20Z" fill="currentColor"/>
      <circle cx="60" cy="15" r="3" fill="currentColor"/><circle cx="60" cy="9" r="2.5" fill="currentColor"/><circle cx="54" cy="15" r="2.5" fill="currentColor"/><circle cx="66" cy="15" r="2.5" fill="currentColor"/><circle cx="60" cy="21" r="2.5" fill="currentColor"/>
      <path d="M120,20 Q125,5 140,10 Q130,15 120,20Z" fill="currentColor"/>
      <path d="M190,10 Q195,25 210,20 Q200,15 190,10Z" fill="currentColor"/>
      <circle cx="260" cy="15" r="3" fill="currentColor"/><circle cx="260" cy="9" r="2.5" fill="currentColor"/><circle cx="254" cy="15" r="2.5" fill="currentColor"/><circle cx="266" cy="15" r="2.5" fill="currentColor"/><circle cx="260" cy="21" r="2.5" fill="currentColor"/>
      <path d="M320,20 Q325,5 340,10 Q330,15 320,20Z" fill="currentColor"/>
      <path d="M400,10 Q405,25 420,20 Q410,15 400,10Z" fill="currentColor"/>
      <circle cx="470" cy="15" r="3" fill="currentColor"/><circle cx="470" cy="9" r="2.5" fill="currentColor"/><circle cx="464" cy="15" r="2.5" fill="currentColor"/><circle cx="476" cy="15" r="2.5" fill="currentColor"/><circle cx="470" cy="21" r="2.5" fill="currentColor"/>
      <path d="M530,20 Q535,5 550,10 Q540,15 530,20Z" fill="currentColor"/>
      <path d="M610,10 Q615,25 630,20 Q620,15 610,10Z" fill="currentColor"/>
      <circle cx="680" cy="15" r="3" fill="currentColor"/><circle cx="680" cy="9" r="2.5" fill="currentColor"/><circle cx="674" cy="15" r="2.5" fill="currentColor"/><circle cx="686" cy="15" r="2.5" fill="currentColor"/><circle cx="680" cy="21" r="2.5" fill="currentColor"/>
      <path d="M740,20 Q745,5 760,10 Q750,15 740,20Z" fill="currentColor"/>
      <path d="M820,10 Q825,25 840,20 Q830,15 820,10Z" fill="currentColor"/>
      <circle cx="900" cy="15" r="3" fill="currentColor"/><circle cx="900" cy="9" r="2.5" fill="currentColor"/><circle cx="894" cy="15" r="2.5" fill="currentColor"/><circle cx="906" cy="15" r="2.5" fill="currentColor"/><circle cx="900" cy="21" r="2.5" fill="currentColor"/>
      <path d="M960,20 Q965,5 980,10 Q970,15 960,20Z" fill="currentColor"/>
    </svg>
    <!-- bottom border -->
    <svg viewBox="0 0 1000 30" preserveAspectRatio="none" style="position:absolute;bottom:60px;left:0;width:100%;height:30px;opacity:0.1">
      <path d="M40,10 Q45,25 60,20 Q50,15 40,10Z" fill="currentColor"/>
      <circle cx="110" cy="15" r="3" fill="currentColor"/><circle cx="110" cy="9" r="2.5" fill="currentColor"/><circle cx="104" cy="15" r="2.5" fill="currentColor"/><circle cx="116" cy="15" r="2.5" fill="currentColor"/><circle cx="110" cy="21" r="2.5" fill="currentColor"/>
      <path d="M170,20 Q175,5 190,10 Q180,15 170,20Z" fill="currentColor"/>
      <path d="M250,10 Q255,25 270,20 Q260,15 250,10Z" fill="currentColor"/>
      <circle cx="330" cy="15" r="3" fill="currentColor"/><circle cx="330" cy="9" r="2.5" fill="currentColor"/><circle cx="324" cy="15" r="2.5" fill="currentColor"/><circle cx="336" cy="15" r="2.5" fill="currentColor"/><circle cx="330" cy="21" r="2.5" fill="currentColor"/>
      <path d="M400,20 Q405,5 420,10 Q410,15 400,20Z" fill="currentColor"/>
      <path d="M480,10 Q485,25 500,20 Q490,15 480,10Z" fill="currentColor"/>
      <circle cx="560" cy="15" r="3" fill="currentColor"/><circle cx="560" cy="9" r="2.5" fill="currentColor"/><circle cx="554" cy="15" r="2.5" fill="currentColor"/><circle cx="566" cy="15" r="2.5" fill="currentColor"/><circle cx="560" cy="21" r="2.5" fill="currentColor"/>
      <path d="M630,20 Q635,5 650,10 Q640,15 630,20Z" fill="currentColor"/>
      <path d="M720,10 Q725,25 740,20 Q730,15 720,10Z" fill="currentColor"/>
      <circle cx="800" cy="15" r="3" fill="currentColor"/><circle cx="800" cy="9" r="2.5" fill="currentColor"/><circle cx="794" cy="15" r="2.5" fill="currentColor"/><circle cx="806" cy="15" r="2.5" fill="currentColor"/><circle cx="800" cy="21" r="2.5" fill="currentColor"/>
      <path d="M870,20 Q875,5 890,10 Q880,15 870,20Z" fill="currentColor"/>
      <path d="M950,10 Q955,25 970,20 Q960,15 950,10Z" fill="currentColor"/>
    </svg>
    <!-- left border: leaves -->
    <svg viewBox="0 0 28 800" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:28px;height:100%;opacity:0.1">
      <path d="M20,50 Q5,55 10,70 Q15,60 20,50Z" fill="currentColor"/>
      <path d="M8,130 Q23,135 18,150 Q13,140 8,130Z" fill="currentColor"/>
      <circle cx="14" cy="200" r="3" fill="currentColor"/><circle cx="14" cy="194" r="2.5" fill="currentColor"/><circle cx="8" cy="200" r="2.5" fill="currentColor"/><circle cx="20" cy="200" r="2.5" fill="currentColor"/><circle cx="14" cy="206" r="2.5" fill="currentColor"/>
      <path d="M20,280 Q5,285 10,300 Q15,290 20,280Z" fill="currentColor"/>
      <path d="M8,360 Q23,365 18,380 Q13,370 8,360Z" fill="currentColor"/>
      <circle cx="14" cy="440" r="3" fill="currentColor"/><circle cx="14" cy="434" r="2.5" fill="currentColor"/><circle cx="8" cy="440" r="2.5" fill="currentColor"/><circle cx="20" cy="440" r="2.5" fill="currentColor"/><circle cx="14" cy="446" r="2.5" fill="currentColor"/>
      <path d="M20,520 Q5,525 10,540 Q15,530 20,520Z" fill="currentColor"/>
      <path d="M8,600 Q23,605 18,620 Q13,610 8,600Z" fill="currentColor"/>
      <circle cx="14" cy="680" r="3" fill="currentColor"/><circle cx="14" cy="674" r="2.5" fill="currentColor"/><circle cx="8" cy="680" r="2.5" fill="currentColor"/><circle cx="20" cy="680" r="2.5" fill="currentColor"/><circle cx="14" cy="686" r="2.5" fill="currentColor"/>
      <path d="M20,760 Q5,765 10,780 Q15,770 20,760Z" fill="currentColor"/>
    </svg>
    <!-- right border -->
    <svg viewBox="0 0 28 800" preserveAspectRatio="none" style="position:absolute;top:0;right:0;width:28px;height:100%;opacity:0.1">
      <path d="M8,80 Q23,85 18,100 Q13,90 8,80Z" fill="currentColor"/>
      <circle cx="14" cy="160" r="3" fill="currentColor"/><circle cx="14" cy="154" r="2.5" fill="currentColor"/><circle cx="8" cy="160" r="2.5" fill="currentColor"/><circle cx="20" cy="160" r="2.5" fill="currentColor"/><circle cx="14" cy="166" r="2.5" fill="currentColor"/>
      <path d="M20,240 Q5,245 10,260 Q15,250 20,240Z" fill="currentColor"/>
      <path d="M8,320 Q23,325 18,340 Q13,330 8,320Z" fill="currentColor"/>
      <circle cx="14" cy="400" r="3" fill="currentColor"/><circle cx="14" cy="394" r="2.5" fill="currentColor"/><circle cx="8" cy="400" r="2.5" fill="currentColor"/><circle cx="20" cy="400" r="2.5" fill="currentColor"/><circle cx="14" cy="406" r="2.5" fill="currentColor"/>
      <path d="M20,480 Q5,485 10,500 Q15,490 20,480Z" fill="currentColor"/>
      <path d="M8,560 Q23,565 18,580 Q13,570 8,560Z" fill="currentColor"/>
      <circle cx="14" cy="640" r="3" fill="currentColor"/><circle cx="14" cy="634" r="2.5" fill="currentColor"/><circle cx="8" cy="640" r="2.5" fill="currentColor"/><circle cx="20" cy="640" r="2.5" fill="currentColor"/><circle cx="14" cy="646" r="2.5" fill="currentColor"/>
      <path d="M20,720 Q5,725 10,740 Q15,730 20,720Z" fill="currentColor"/>
    </svg>
  `,
  ocean: `
    <!-- top border: waves -->
    <svg viewBox="0 0 1000 24" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:24px;opacity:0.1">
      <path d="M0,18 Q30,4 60,18 Q90,4 120,18 Q150,4 180,18 Q210,4 240,18 Q270,4 300,18 Q330,4 360,18 Q390,4 420,18 Q450,4 480,18 Q510,4 540,18 Q570,4 600,18 Q630,4 660,18 Q690,4 720,18 Q750,4 780,18 Q810,4 840,18 Q870,4 900,18 Q930,4 960,18 Q990,4 1000,12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>
    <!-- bottom border: waves -->
    <svg viewBox="0 0 1000 24" preserveAspectRatio="none" style="position:absolute;bottom:60px;left:0;width:100%;height:24px;opacity:0.1">
      <path d="M0,6 Q30,20 60,6 Q90,20 120,6 Q150,20 180,6 Q210,20 240,6 Q270,20 300,6 Q330,20 360,6 Q390,20 420,6 Q450,20 480,6 Q510,20 540,6 Q570,20 600,6 Q630,20 660,6 Q690,20 720,6 Q750,20 780,6 Q810,20 840,6 Q870,20 900,6 Q930,20 960,6 Q990,20 1000,12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>
    <!-- left border: bubbles and fish -->
    <svg viewBox="0 0 30 800" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:30px;height:100%;opacity:0.1">
      <circle cx="15" cy="50" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="100" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="13" cy="180" rx="8" ry="5" fill="currentColor"/><polygon points="22,180 28,174 28,186" fill="currentColor"/>
      <circle cx="15" cy="260" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="310" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="18" cy="360" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="13" cy="440" rx="8" ry="5" fill="currentColor"/><polygon points="22,440 28,434 28,446" fill="currentColor"/>
      <circle cx="15" cy="520" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="570" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="13" cy="650" rx="8" ry="5" fill="currentColor"/><polygon points="22,650 28,644 28,656" fill="currentColor"/>
      <circle cx="15" cy="730" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="18" cy="780" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
    <!-- right border: bubbles and fish -->
    <svg viewBox="0 0 30 800" preserveAspectRatio="none" style="position:absolute;top:0;right:0;width:30px;height:100%;opacity:0.1">
      <circle cx="15" cy="80" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="17" cy="150" rx="8" ry="5" fill="currentColor"/><polygon points="8,150 2,144 2,156" fill="currentColor"/>
      <circle cx="15" cy="230" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="280" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="17" cy="370" rx="8" ry="5" fill="currentColor"/><polygon points="8,370 2,364 2,376" fill="currentColor"/>
      <circle cx="15" cy="450" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="18" cy="500" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="10" cy="550" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="17" cy="630" rx="8" ry="5" fill="currentColor"/><polygon points="8,630 2,624 2,636" fill="currentColor"/>
      <circle cx="15" cy="710" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="18" cy="770" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,
  sunset: `
    <!-- top border: birds and sun rays -->
    <svg viewBox="0 0 1000 26" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:26px;opacity:0.1">
      <path d="M30,18 Q40,8 50,14 Q60,8 70,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="140" cy="14" r="4" fill="currentColor"/>
      <path d="M210,18 Q220,8 230,14 Q240,8 250,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="320" cy="14" r="4" fill="currentColor"/>
      <path d="M390,18 Q400,8 410,14 Q420,8 430,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="500" cy="14" r="4" fill="currentColor"/>
      <path d="M570,18 Q580,8 590,14 Q600,8 610,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="680" cy="14" r="4" fill="currentColor"/>
      <path d="M750,18 Q760,8 770,14 Q780,8 790,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="860" cy="14" r="4" fill="currentColor"/>
      <path d="M930,18 Q940,8 950,14 Q960,8 970,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
    <!-- bottom border -->
    <svg viewBox="0 0 1000 26" preserveAspectRatio="none" style="position:absolute;bottom:60px;left:0;width:100%;height:26px;opacity:0.1">
      <circle cx="50" cy="14" r="4" fill="currentColor"/>
      <path d="M120,18 Q130,8 140,14 Q150,8 160,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="230" cy="14" r="4" fill="currentColor"/>
      <path d="M300,18 Q310,8 320,14 Q330,8 340,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="410" cy="14" r="4" fill="currentColor"/>
      <path d="M480,18 Q490,8 500,14 Q510,8 520,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="590" cy="14" r="4" fill="currentColor"/>
      <path d="M660,18 Q670,8 680,14 Q690,8 700,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="770" cy="14" r="4" fill="currentColor"/>
      <path d="M840,18 Q850,8 860,14 Q870,8 880,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="950" cy="14" r="4" fill="currentColor"/>
    </svg>
    <!-- left border: suns and birds -->
    <svg viewBox="0 0 28 800" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:28px;height:100%;opacity:0.1">
      <circle cx="14" cy="60" r="6" fill="currentColor"/><line x1="14" y1="48" x2="14" y2="44" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="72" x2="14" y2="76" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="60" x2="6" y2="60" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="60" x2="26" y2="60" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M6,160 Q14,148 22,158" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="14" cy="260" r="6" fill="currentColor"/><line x1="14" y1="248" x2="14" y2="244" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="272" x2="14" y2="276" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="260" x2="6" y2="260" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="260" x2="26" y2="260" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M6,360 Q14,348 22,358" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="14" cy="460" r="6" fill="currentColor"/><line x1="14" y1="448" x2="14" y2="444" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="472" x2="14" y2="476" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="460" x2="6" y2="460" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="460" x2="26" y2="460" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M6,560 Q14,548 22,558" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="14" cy="660" r="6" fill="currentColor"/><line x1="14" y1="648" x2="14" y2="644" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="672" x2="14" y2="676" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="660" x2="6" y2="660" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="660" x2="26" y2="660" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M6,750 Q14,738 22,748" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <!-- right border -->
    <svg viewBox="0 0 28 800" preserveAspectRatio="none" style="position:absolute;top:0;right:0;width:28px;height:100%;opacity:0.1">
      <path d="M6,80 Q14,68 22,78" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="14" cy="180" r="6" fill="currentColor"/><line x1="14" y1="168" x2="14" y2="164" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="192" x2="14" y2="196" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="180" x2="6" y2="180" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="180" x2="26" y2="180" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M6,280 Q14,268 22,278" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="14" cy="380" r="6" fill="currentColor"/><line x1="14" y1="368" x2="14" y2="364" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="392" x2="14" y2="396" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="380" x2="6" y2="380" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="380" x2="26" y2="380" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M6,480 Q14,468 22,478" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="14" cy="580" r="6" fill="currentColor"/><line x1="14" y1="568" x2="14" y2="564" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="592" x2="14" y2="596" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="580" x2="6" y2="580" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="580" x2="26" y2="580" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M6,680 Q14,668 22,678" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="14" cy="760" r="6" fill="currentColor"/><line x1="14" y1="748" x2="14" y2="744" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="772" x2="14" y2="776" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="760" x2="6" y2="760" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="760" x2="26" y2="760" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
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
