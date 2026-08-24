#!/usr/bin/env node
// Applies a diagram-edits.json (exported from diagram-editor.html) onto
// project9.html: box positions are rewritten in place by id, wire paths are
// rewritten by an exact match on their original `d` attribute (unique per
// wire, since no two static wires share identical geometry -- see
// md/diagram-design-principles.md).
//
// Usage: node tools/apply-diagram-edits.js path/to/diagram-edits.json
//   (run from the darrenliusite2 repo root, or pass --file to point at a
//   different project9.html)

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const jsonPath = args.find((a) => !a.startsWith("--"));
const fileFlagIdx = args.indexOf("--file");
const htmlPath = fileFlagIdx !== -1 ? args[fileFlagIdx + 1] : path.join(__dirname, "..", "project9.html");

if (!jsonPath) {
  console.error("Usage: node tools/apply-diagram-edits.js path/to/diagram-edits.json [--file path/to/project9.html]");
  process.exit(1);
}

const edits = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
let html = fs.readFileSync(htmlPath, "utf8");

let boxesApplied = 0, boxesMissed = 0;
for (const [id, pos] of Object.entries(edits.boxes || {})) {
  const idRe = new RegExp(`(<[^>]*\\bid="${id}"[^>]*>)`);
  const m = html.match(idRe);
  if (!m) {
    console.warn(`  ! box "${id}" not found -- skipped`);
    boxesMissed++;
    continue;
  }
  const oldTag = m[1];
  // Pipeline register bars have no inline `top` (it's fixed by CSS), so the
  // editor only exports `left` for them -- only touch `top` when present.
  let newTag = oldTag.replace(/left:-?\d+(?:\.\d+)?px/, `left:${pos.left}px`);
  if ("top" in pos) newTag = newTag.replace(/top:-?\d+(?:\.\d+)?px/, `top:${pos.top}px`);
  if (newTag === oldTag) {
    console.warn(`  ! box "${id}" tag has no left/top to update -- skipped`);
    boxesMissed++;
    continue;
  }
  html = html.replace(oldTag, newTag);
  boxesApplied++;
}

let wiresApplied = 0, wiresMissed = 0;
for (const w of edits.wires || []) {
  const oldAttr = `d="${w.original}"`;
  const newAttr = `d="${w.updated}"`;
  if (!html.includes(oldAttr)) {
    console.warn(`  ! wire not found (original path may have already been edited): ${w.original}`);
    wiresMissed++;
    continue;
  }
  html = html.replace(oldAttr, newAttr);
  wiresApplied++;
}

// New wires (created in-editor via Alt+drag branching) don't exist in the
// file yet -- insert a brand new <path> right after the parent wire it
// branched from, matching that parent's *current* geometry (wire edits
// above are applied first, so by now the parent's `d` in `html` already
// reflects any move it got in this same session). Inherits the parent's
// class/data-stage/data-role exactly, so it picks up the same per-cycle
// coloring in pipeline-viz.js with no further wiring.
let newWiresApplied = 0, newWiresMissed = 0;
for (const nw of edits.newWires || []) {
  const afterAttr = `d="${nw.after}"`;
  const afterIdx = html.indexOf(afterAttr);
  if (afterIdx === -1) {
    console.warn(`  ! new-wire parent not found (original path may have moved since export): ${nw.after}`);
    newWiresMissed++;
    continue;
  }
  const tagEnd = html.indexOf("/>", afterIdx);
  if (tagEnd === -1) {
    console.warn(`  ! could not find end of parent <path> tag for new wire -- skipped`);
    newWiresMissed++;
    continue;
  }
  const insertPos = tagEnd + 2;
  const attrs = [`class="${nw.cls}"`];
  if (nw.dataStage) attrs.push(`data-stage="${nw.dataStage}"`);
  if (nw.dataRole) attrs.push(`data-role="${nw.dataRole}"`);
  attrs.push(`d="${nw.d}"`);
  const newTag = `\n                      <path ${attrs.join(" ")} />`;
  html = html.slice(0, insertPos) + newTag + html.slice(insertPos);
  newWiresApplied++;
}

fs.writeFileSync(htmlPath, html);

console.log(`Applied ${boxesApplied} box edit(s)${boxesMissed ? `, ${boxesMissed} skipped` : ""}.`);
console.log(`Applied ${wiresApplied} wire edit(s)${wiresMissed ? `, ${wiresMissed} skipped` : ""}.`);
console.log(`Applied ${newWiresApplied} new wire(s)${newWiresMissed ? `, ${newWiresMissed} skipped` : ""}.`);
console.log(`Wrote ${htmlPath}`);
