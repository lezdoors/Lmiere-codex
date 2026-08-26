import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the landing page ships a complete styled first frame without JavaScript", async () => {
  const [html, main] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(html, /ART DIRECTION CONTRACT/);
  assert.match(html, /<link rel="stylesheet" href="\/src\/styles\.css"/);
  assert.match(html, /<main class="landing-screen static-landing-fallback">/);
  assert.match(html, /A machine for making images and motion/);
  assert.match(html, /href="\/studio"/);
  assert.doesNotMatch(main, /import\s+["']\.\/styles\.css["']/);
});

test("showpiece motion uses one chapter transition and exits for reduced motion", async () => {
  const [motion, manifest] = await Promise.all([
    readFile(new URL("../src/motion.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
  ]);

  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /transitionLandingChapter/);
  assert.match(motion, /clipPath: "inset\(49\.6% 0 49\.6% 0\)"/);
  assert.equal(manifest.dependencies.lenis, undefined);
  assert.equal(manifest.dependencies["locomotive-scroll"], undefined);
});

test("the field index exposes six in-screen chapters without hash navigation", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);

  for (const id of ["apparatus", "outcomes", "mechanism", "transmission", "ownership", "studio-entry"]) {
    assert.match(app, new RegExp(`id:\\s*"${id}"`));
    assert.match(app, new RegExp(`id="${id}"`));
  }

  assert.match(app, /onClick=\{\(\) => selectChapter\(chapter\.id\)\}/);
  assert.doesNotMatch(app, /href={`#\$\{chapter\.id\}`}/);
  assert.doesNotMatch(app, /scrollIntoView|IntersectionObserver/);
  assert.match(styles, /\.field-index\s*{/);
  assert.match(styles, /\.field-chapter\.is-active\s*{/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.field-index/);
});
