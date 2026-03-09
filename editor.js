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

export function createEditor(container) {
  let fontIndex = 0;
  let color = COLORS[0];

  function scrollToBottom() {
    container.scrollTop = container.scrollHeight;
  }

  function addChar(ch) {
    const span = document.createElement("span");
    span.className = "char";
    span.textContent = ch;
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

  return {
    addChar,
    addNewline,
    deleteChar,
    clear,
    setFont,
    cycleFont,
    setColor,
    getFont,
    getFontIndex,
    getColor,
    FONTS,
    COLORS,
  };
}
