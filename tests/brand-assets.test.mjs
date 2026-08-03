import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("brand masters are outlined vectors with no font dependency", async () => {
  for (const name of ["cobalt", "signal", "electric", "night", "white"]) {
    const source = await readFile(new URL(`public/brand/lmiere-mark-${name}.svg`, root), "utf8");
    assert.match(source, /viewBox="0 0 51 51"/);
    assert.match(source, /<path/);
    assert.doesNotMatch(source, /<text/);
  }
});

test("browser and install identity assets are present", async () => {
  for (const path of [
    "public/brand/favicon.ico",
    "public/brand/lmiere-app-icon-180.png",
    "public/brand/lmiere-app-icon-192.png",
    "public/brand/lmiere-app-icon-512.png",
    "public/brand/lmiere-social-card.png",
    "public/site.webmanifest",
    "public/robots.txt",
    "public/sitemap.xml",
  ]) {
    await access(new URL(path, root));
  }
});

test("optimized editorial media stays available without replacing its masters", async () => {
  for (const name of ["field-machine", "result-cabin", "specimen-awake", "specimen-idle"]) {
    await access(new URL(`public/assets/lmiere-${name}.png`, root));
    await access(new URL(`public/assets/lmiere-${name}.webp`, root));
  }
});
