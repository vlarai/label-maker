import { jsPDF } from "jspdf";
import { loadIconBytes } from "./foodIcons.js";
import { parseBoldLines } from "./richText.js";

// Layout constants ported verbatim from the original vanilla/Vue implementation.
// These values are tuned to a specific physical card stock — do not change them
// without re-measuring a printed sheet.
const X = 7.5;
const Y = 33.5;
const CARD_CELL_HEIGHT = 38;
const CARD_WIDTH = 65;
const CARD_HEIGHT = 115;
const MAX_ICON_SIZE = 11;
const MAX_TEXT_WIDTH = 55;
const TEXT_OPTS = { align: "center", maxWidth: MAX_TEXT_WIDTH };

// Measures a word's width under the given weight. Bold glyphs are wider
// than regular ones at the same font size, so this must be measured with
// the matching weight active, not assumed equal.
function wordWidth(doc, word, bold) {
  doc.setFont(undefined, bold ? "bold" : "normal");
  return doc.getTextDimensions(word).w;
}

// Breaks a single word wider than `maxWidth` (e.g. a long German compound
// noun) into hyphenated pieces that each fit, since the greedy packer below
// can only break *between* words otherwise. Binary-searches the longest
// prefix (plus trailing "-") that still fits on each pass; falls back to a
// single character when even that doesn't fit, so it always makes progress.
function splitLongWord(doc, word, bold, maxWidth) {
  const pieces = [];
  let remaining = word;
  while (remaining.length > 1 && wordWidth(doc, remaining, bold) > maxWidth) {
    let lo = 1;
    let hi = remaining.length - 1;
    let fit = 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (wordWidth(doc, remaining.slice(0, mid) + "-", bold) <= maxWidth) {
        fit = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    pieces.push(remaining.slice(0, fit) + "-");
    remaining = remaining.slice(fit);
  }
  pieces.push(remaining);
  return pieces;
}

// Wraps `text` (which may contain **bold** spans and explicit \n breaks)
// into visual lines no wider than MAX_TEXT_WIDTH, mixing bold/regular words
// on the same line as needed — a standard greedy line-break. A single word
// wider than MAX_TEXT_WIDTH on its own (long compound words are common in
// German) is hyphen-split via splitLongWord so it can't overflow past the
// card edge. Each \n starts a fresh line unconditionally (so e.g. a dish
// name can be kept visually separate from its description); an empty line
// contributes one blank visual line. Returns an array of
// { words: [{ word, bold, width }], width } per visual line.
function layoutParagraph(doc, text, spaceWidth) {
  const lines = [];

  for (const runs of parseBoldLines(text)) {
    const tokens = runs.flatMap((run) =>
      run.text
        .split(/\s+/)
        .filter(Boolean)
        .flatMap((word) => {
          if (wordWidth(doc, word, run.bold) <= MAX_TEXT_WIDTH) {
            return [{ word, bold: run.bold }];
          }
          return splitLongWord(doc, word, run.bold, MAX_TEXT_WIDTH).map(
            (piece) => ({ word: piece, bold: run.bold }),
          );
        }),
    );

    let current = [];
    let currentWidth = 0;
    for (const token of tokens) {
      const w = wordWidth(doc, token.word, token.bold);
      if (current.length && currentWidth + spaceWidth + w > MAX_TEXT_WIDTH) {
        lines.push({ words: current, width: currentWidth });
        current = [];
        currentWidth = 0;
      }
      currentWidth += current.length ? spaceWidth + w : w;
      current.push({ word: token.word, bold: token.bold, width: w });
    }
    lines.push({ words: current, width: currentWidth });
  }

  return lines;
}

// Lays out and draws `text` as a centered paragraph around `rowCenterY`,
// mixing bold/regular words inline. Replaces the old fixed bold-heading +
// regular-subtitle two-block layout now that both live in one field.
function drawParagraph(doc, x, rowCenterY, text, lineHeightMm) {
  doc.setFontSize(14);
  const spaceWidth = wordWidth(doc, " ", false);
  const lines = layoutParagraph(doc, text, spaceWidth);
  const startY = rowCenterY + lineHeightMm / 2 - (lines.length * lineHeightMm) / 2;

  lines.forEach((line, i) => {
    const y = startY + i * lineHeightMm;
    let wx = x - line.width / 2;
    for (const word of line.words) {
      doc.setFont(undefined, word.bold ? "bold" : "normal");
      doc.text(word.word, wx, y);
      wx += word.width + spaceWidth;
    }
  });
  doc.setFont(undefined, "normal");
}

// Draws one label card with its top-left corner at (originX, originY).
// Everything below is positioned relative to that origin, so placing a
// card on the sheet is just picking where its origin lands. `iconBytes`
// is a Map of lowercase diet/allergen name -> Uint8Array PNG bytes,
// pre-fetched by generateLabelsPdf before drawing starts.
function drawCard(doc, card, originX, originY, diets, allergens, iconBytes) {
  const cx = originX + CARD_WIDTH / 2;

  doc.rect(originX, originY, CARD_WIDTH, CARD_HEIGHT);
  doc.line(
    originX + 10,
    originY + CARD_CELL_HEIGHT,
    originX + 10 + 45,
    originY + CARD_CELL_HEIGHT,
  );
  doc.setFontSize(14);
  const lineHeightMm = (doc.getLineHeight() * 25.4) / 72;

  drawParagraph(
    doc,
    cx,
    originY + CARD_CELL_HEIGHT / 2,
    card.germanText,
    lineHeightMm,
  );
  drawParagraph(
    doc,
    cx,
    originY + CARD_CELL_HEIGHT / 2 + CARD_CELL_HEIGHT,
    card.englishText,
    lineHeightMm,
  );

  // ---- bottom row (icons) ----
  const dietCount = card.diets.length;
  const allergenCount = card.allergens.length;
  doc.setFontSize(6);
  const iconBaseY = originY + CARD_CELL_HEIGHT + 33;

  // diet icons
  for (let j = 0; j < dietCount; j++) {
    if (card.diets[j]) {
      doc.addImage(
        iconBytes.get(diets[card.diets[j]].toLowerCase()),
        "png",
        cx - (dietCount * MAX_ICON_SIZE) / 2 + MAX_ICON_SIZE * j,
        iconBaseY + 5,
        MAX_ICON_SIZE,
        MAX_ICON_SIZE,
      );
    }
  }

  // allergen icons + labels: positions computed once, then drawn in two
  // passes (all icons, then all labels) to match the original draw order.
  const allergenMargin = dietCount ? 18 : 5;
  const maxIcons = 5;
  const iconSize = MAX_ICON_SIZE;
  const rows = Math.ceil(allergenCount / maxIcons);
  const allergenSlots = [];
  let idx = 0;
  for (let row = 0; row < rows; row++) {
    const icons = row === 0 ? allergenCount - (rows - 1) * maxIcons : maxIcons;
    for (let j = 0; j < icons; j++) {
      if (card.allergens[idx]) {
        allergenSlots.push({
          key: card.allergens[idx],
          x: cx - (icons * iconSize) / 2 + iconSize * j,
          y: iconBaseY + allergenMargin + iconSize * row,
        });
        idx++;
      }
    }
  }

  for (const slot of allergenSlots) {
    doc.addImage(
      iconBytes.get(allergens[slot.key].toLowerCase()),
      "png",
      slot.x,
      slot.y,
      iconSize,
      iconSize,
    );
  }
  for (const slot of allergenSlots) {
    doc.text(allergens[slot.key], slot.x + iconSize / 2, slot.y + iconSize, TEXT_OPTS);
  }
}

export async function generateLabelsPdf(cards, diets, allergens) {
  // Prefetch every icon these cards actually use (deduped) before drawing
  // starts, so the drawing loop itself stays synchronous.
  const neededKeys = new Set();
  for (const card of cards) {
    for (const d of card.diets) if (diets[d]) neededKeys.add(diets[d].toLowerCase());
    for (const a of card.allergens)
      if (allergens[a]) neededKeys.add(allergens[a].toLowerCase());
  }
  const iconBytes = new Map();
  await Promise.all(
    [...neededKeys].map(async (key) => iconBytes.set(key, await loadIconBytes(key))),
  );

  const doc = new jsPDF({ compress: true });
  const d = new Date();

  let xMultiplier = 0;
  let yMultiplier = 0;

  for (let i = 0; i < cards.length; i++) {
    drawCard(
      doc,
      cards[i],
      X + CARD_WIDTH * xMultiplier,
      Y + CARD_HEIGHT * yMultiplier,
      diets,
      allergens,
      iconBytes,
    );

    xMultiplier++;
    if (xMultiplier >= 3 && yMultiplier === 1 && i < cards.length - 1) {
      doc.addPage();
      xMultiplier = 0;
      yMultiplier = 0;
    }
    if (xMultiplier >= 3) {
      yMultiplier = 1;
      xMultiplier = 0;
    }
    doc.text("Copyright © 2025 RVJK", 10, doc.internal.pageSize.height - 10);
  }

  doc.save(
    `LM_${d.getDay()}${d.getMonth()}${d.getFullYear()}_${d.getHours()}${d.getMinutes()}.pdf`,
  );
}
