// ── Editor engine ──────────────────────────────────────────────────────
// Creates individual <span> elements for each typed character.
// No contentEditable — just a simple typewriter model.

const FONTS = [
  { name: "Fredoka", css: '"Fredoka", sans-serif' },
  { name: "Gaegu", css: '"Gaegu", cursive' },
  { name: "Bubblegum Sans", css: '"Bubblegum Sans", cursive' },
  { name: "Patrick Hand", css: '"Patrick Hand", cursive' },
];

const COLORS = [
  "#2C3E50", "#D94F7A", "#2B7CB5", "#E8A317",
  "#2D8F5E", "#7B4FBF", "#E06230", "#5C4033",
];

const COLORS_DARK = [
  "#E0E8F5", "#FF7EB3", "#64B5F6", "#FFD54F",
  "#81C784", "#B39DDB", "#FF8A65", "#BCAAA4",
];

// Letters, digits, space, and basic punctuation toddlers might use
const KEEP_CHARS = /^[a-zA-Z0-9 .,!?]$/;

const EMOJI_POOL = [
  "😀","😂","🥰","😎","🤩","😜","🤗","😇","🥳","😺",
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
  "🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦆","🦅",
  "🦋","🐛","🐌","🐞","🐝","🐙","🐠","🐟","🐬","🐳",
  "🐊","🦕","🦖","🐘","🦒","🦓","🦏","🐪","🐿️","🦔",
  "🌸","🌺","🌻","🌹","🌷","🌼","🍀","🌈","⭐","🌙",
  "☀️","⛅","❄️","🔥","💧","🌊","🍎","🍊","🍋","🍌",
  "🍉","🍇","🍓","🫐","🍒","🍑","🥝","🍍","🥭","🥑",
  "🧁","🍩","🍪","🎂","🍦","🍫","🍬","🍭","🧇","🥞",
  "⚽","🏀","🎾","🏈","🎯","🪁","🛹","🚀","✈️","🚂",
  "🚗","🚌","🚒","🚑","🏎️","🚁","⛵","🎠","🎡","🎢",
  "🎨","🎸","🥁","🎹","🎺","🪗","🎭","🧸","🪀","🎪",
  "👑","💎","🦄","🧜","🧚","🤖","👻","👽","🎃","🌍",
  "❤️","🧡","💛","💚","💙","💜","🩷","🤎","🖤","🩵",
  "🏠","🏰","⛺","🗼","🌋","🏔️","🎈","🎁","🎀","🪅",
];

function randomEmoji() {
  return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
}

export function createEditor(container) {
  let fontIndex = 0;
  let color = COLORS[0];

  function scrollToBottom() {
    container.scrollTop = container.scrollHeight;
  }

  function addChar(ch) {
    // Swap special characters for random emojis
    const display = KEEP_CHARS.test(ch) ? ch : randomEmoji();

    const span = document.createElement("span");
    span.className = "char";
    span.textContent = display;
    span.style.fontFamily = FONTS[fontIndex].css;
    span.style.color = color;
    container.appendChild(span);
    scrollToBottom();
  }

  function addNewline() {
    container.appendChild(document.createElement("br"));
    scrollToBottom();
  }

  function deleteChar() {
    const last = container.lastChild;
    if (last) container.removeChild(last);
  }

  function clear() {
    container.innerHTML = "";
  }

  function setFont(index) {
    fontIndex = index % FONTS.length;
    return FONTS[fontIndex];
  }

  function cycleFont() {
    fontIndex = (fontIndex + 1) % FONTS.length;
    return FONTS[fontIndex];
  }

  function setColor(hex) {
    color = hex;
  }

  function getFont() {
    return FONTS[fontIndex];
  }

  function getFontIndex() {
    return fontIndex;
  }

  function getColor() {
    return color;
  }

  let activeColors = COLORS;

  function setDarkMode(isDark) {
    activeColors = isDark ? COLORS_DARK : COLORS;
    // Update current color to corresponding position in new palette
    const oldPalette = isDark ? COLORS : COLORS_DARK;
    const idx = oldPalette.indexOf(color);
    if (idx !== -1) {
      color = activeColors[idx];
    } else {
      color = activeColors[0];
    }
  }

  function getActiveColors() {
    return activeColors;
  }

  return {
    addChar,
    addNewline,
    deleteChar,
    clear,
    setFont,
    cycleFont,
    setColor,
    setDarkMode,
    getFont,
    getFontIndex,
    getColor,
    getActiveColors,
    FONTS,
    COLORS,
    COLORS_DARK,
  };
}
