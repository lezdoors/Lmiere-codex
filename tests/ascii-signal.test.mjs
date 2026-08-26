import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const signal = await readFile(new URL("../src/AsciiSignal.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("Phosphor remains one bounded artifact inside the transmission chapter", async () => {
  const records = app.indexOf("landing-records-section");
  const phosphor = app.indexOf("field-record-phosphor");
  const method = app.indexOf("landing-method-section");

  assert.ok(records >= 0);
  assert.ok(records > method);
  assert.ok(phosphor > records);
  assert.doesNotMatch(app, /landing-signal-section/);
  assert.match(app, /field-record-phosphor[\s\S]*?lmiere-specimen-awake\.webp/);
  assert.match(app, /Phosphor bloom/);
  await access(new URL("../public/assets/lmiere-specimen-awake.webp", import.meta.url));
});

test("the ASCII canvas pauses offscreen and respects reduced motion", () => {
  assert.match(signal, /IntersectionObserver/);
  assert.match(signal, /ResizeObserver/);
  assert.match(signal, /prefers-reduced-motion: reduce/);
  assert.match(signal, /requestAnimationFrame/);
  assert.match(signal, /FRAME_INTERVAL = 1000 \/ 24/);
  assert.match(signal, /rgba\(2, 10, 7, 0\.9\)/);
  assert.match(signal, /blur\(3px\)/);
  assert.match(signal, /createRadialGradient/);
});

test("the logo star has an idle glint and a reduced-motion fallback", () => {
  assert.match(app, /className="brand-star-cluster"/);
  assert.match(styles, /@keyframes brand-star-awaken/);
  assert.match(styles, /@keyframes brand-star-hover-glint/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.brand-star-cluster[\s\S]*?animation:\s*none;/,
  );
});
