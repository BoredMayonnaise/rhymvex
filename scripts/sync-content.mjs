#!/usr/bin/env node
/**
 * Syncs canonical source files into the web app and verifies nothing has drifted.
 *
 *   content/services.json   (canonical)  ->  web/content/services.json
 *   content/locales.json    (canonical)  ->  web/content/locales.json
 *   content/currencies.json (canonical)  ->  web/content/currencies.json
 *   content/messages/*.json (canonical)  ->  web/content/messages/*.json
 *   brand/tokens/tokens.json (canonical) ->  brand/tokens/tokens.css
 *                                          web/app/tokens.css
 *
 * The web copies are generated because Turbopack cannot import from outside the
 * app root. tokens.json / services.json stay the only hand-edited sources.
 *
 * Usage:
 *   node scripts/sync-content.mjs          # write generated files
 *   node scripts/sync-content.mjs --check  # exit 1 if anything is stale
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => relative(root, join(root, p));

const TOKENS_JSON = "brand/tokens/tokens.json";
const SERVICES_JSON = "content/services.json";
const LOCALES_JSON = "content/locales.json";
const CURRENCIES_JSON = "content/currencies.json";
const MESSAGES_DIR = "content/messages";
const MESSAGES_TARGET_DIR = "web/content/messages";

const TOKEN_CSS_TARGETS = ["brand/tokens/tokens.css", "web/app/tokens.css"];
const SERVICES_TARGET = "web/content/services.json";
const LOCALES_TARGET = "web/content/locales.json";
const CURRENCIES_TARGET = "web/content/currencies.json";

const GLOBALS_CSS = "web/app/globals.css";

const BANNER =
  "/* GENERATED FILE — do not edit. Source: brand/tokens/tokens.json. Run: node scripts/sync-content.mjs */";

function renderTokenCss(tokens) {
  const colors = Object.entries(tokens.color)
    .map(([name, { value }]) => `  --rhymvex-${name}:  ${value};`)
    .join("\n");

  return `${BANNER}

:root {
${colors}

  --font-primary: ${tokens.font.primary.value};
  --font-display: ${tokens.font.display.value};
}
`;
}

/** Tailwind @theme aliases expected in web/app/globals.css. */
function expectedThemeLines(tokens) {
  return [
    ...Object.keys(tokens.color).map(
      (name) => `--color-rhymvex-${name}: var(--rhymvex-${name});`,
    ),
    `--font-rhymvex-body: var(--font-primary);`,
    `--font-rhymvex-display: var(--font-display);`,
  ];
}

async function readOrNull(path) {
  return readFile(join(root, path), "utf8").catch(() => null);
}

async function main() {
  const check = process.argv.includes("--check");
  const tokens = JSON.parse(await readOrNull(TOKENS_JSON));
  const servicesRaw = await readOrNull(SERVICES_JSON);
  const localesRaw = await readOrNull(LOCALES_JSON);
  const currenciesRaw = await readOrNull(CURRENCIES_JSON);

  // Every catalogue mirrors 1:1. Walk the canonical directory rather than
  // listing filenames in the script, so adding a language is one new file in
  // content/messages/ and nothing else.
  const messageFiles = (await readdir(join(root, MESSAGES_DIR)).catch(() => []))
    .filter((f) => f.endsWith(".json"))
    .sort();
  const messagePairs = await Promise.all(
    messageFiles.map(async (f) => ({
      path: `${MESSAGES_TARGET_DIR}/${f}`,
      expected: await readOrNull(`${MESSAGES_DIR}/${f}`),
    })),
  );

  /** @type {{path: string, expected: string}[]} */
  const targets = [
    ...TOKEN_CSS_TARGETS.map((path) => ({
      path,
      expected: renderTokenCss(tokens),
    })),
    { path: SERVICES_TARGET, expected: servicesRaw },
    { path: LOCALES_TARGET, expected: localesRaw },
    { path: CURRENCIES_TARGET, expected: currenciesRaw },
    ...messagePairs,
  ];

  const drift = [];

  for (const { path, expected } of targets) {
    const current = await readOrNull(path);
    if (check) {
      if (current === null) drift.push(`${path} is missing`);
      else if (current !== expected) drift.push(`${path} is stale`);
    } else {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), expected, "utf8");
      console.log(`wrote ${rel(path)}`);
    }
  }

  // The web app's @theme block must mirror the token names, or Tailwind
  // utilities (bg-rhymvex-black, font-rhymvex-display, ...) break silently.
  const globals = await readOrNull(GLOBALS_CSS);
  if (!globals) {
    drift.push(`${GLOBALS_CSS} is missing`);
  } else {
    for (const line of expectedThemeLines(tokens)) {
      if (!globals.includes(line)) drift.push(`${GLOBALS_CSS} missing @theme entry: ${line}`);
    }
  }

  if (check && drift.length) {
    console.error("Content drift detected:");
    for (const d of drift) console.error(`  - ${d}`);
    console.error("\nRun: node scripts/sync-content.mjs");
    process.exit(1);
  }

  if (check) console.log("Content in sync (tokens, services, locales, currencies, messages, web @theme).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
