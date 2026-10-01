#!/usr/bin/env node
/**
 * Catalogue completeness.
 *
 *   node scripts/check-i18n.mjs          # report, exit 0
 *   node scripts/check-i18n.mjs --strict # exit 1 if any catalogue is incomplete
 *
 * The English catalogue is the reference: a key missing from another language
 * resolves to English at runtime, which is safe but silently half-translated.
 * This makes that visible instead, so a locale cannot be declared finished
 * while a third of the page is quietly in English.
 *
 * It also checks the two things that break a translation quietly: a catalogue
 * carrying a key English does not define (a typo that will never be reached),
 * and a placeholder in a translation that English does not have, or is missing
 * one, which would print a literal {ref} to a visitor.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT = "en-IE";
const MESSAGES_DIR = "content/messages";

function flatten(node, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(node)) {
    if (key === "$comment") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else if (value && typeof value === "object") flatten(value, path, out);
  }
  return out;
}

const placeholders = (s) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

async function main() {
  const strict = process.argv.includes("--strict");
  const locales = JSON.parse(await readFile(join(root, "content/locales.json"), "utf8"));
  const files = (await readdir(join(root, MESSAGES_DIR))).filter((f) => f.endsWith(".json")).sort();

  const catalogues = {};
  for (const f of files) {
    catalogues[f.replace(/\.json$/, "")] = flatten(
      JSON.parse(await readFile(join(root, MESSAGES_DIR, f), "utf8")),
    );
  }

  const reference = catalogues[DEFAULT];
  if (!reference) {
    console.error(`No ${DEFAULT}.json reference catalogue found.`);
    process.exit(1);
  }
  const referenceKeys = Object.keys(reference);
  const referencePlaceholders = new Map(
    referenceKeys.map((k) => [k, placeholders(reference[k])]),
  );

  console.log(`${referenceKeys.length} keys in the ${DEFAULT} reference.\n`);
  let failures = 0;

  for (const code of locales.locales.map((l) => l.code)) {
    const catalogue = catalogues[code];
    if (!catalogue) {
      console.log(`  ${code.padEnd(7)} no catalogue`);
      if (strict) failures++;
      continue;
    }

    const missing = referenceKeys.filter((k) => !(k in catalogue));
    const extra = Object.keys(catalogue).filter((k) => !(k in reference));

    // Placeholder drift: a missing {ref} prints a literal token to a visitor,
    // and an invented one is always a mistake.
    const placeholderIssues = [];
    for (const key of Object.keys(catalogue)) {
      if (!referencePlaceholders.has(key)) continue;
      const want = referencePlaceholders.get(key);
      const got = placeholders(catalogue[key]);
      for (const p of want) if (!got.has(p)) placeholderIssues.push(`${key}: missing {${p}}`);
      for (const p of got) if (!want.has(p)) placeholderIssues.push(`${key}: unknown {${p}}`);
    }

    const total = referenceKeys.length;
    const done = total - missing.length;
    const pct = total === 0 ? 100 : Math.round((done / total) * 100);

    if (!missing.length && !extra.length && !placeholderIssues.length) {
      console.log(`  ${code.padEnd(7)} ${pct}%  complete`);
    } else {
      const alias = catalogues[code] === catalogues[DEFAULT] ? " (shares English)" : "";
      console.log(
        `  ${code.padEnd(7)} ${String(pct).padStart(3)}%  ${missing.length} missing, ` +
          `${extra.length} unknown, ${placeholderIssues.length} placeholder${alias}`,
      );
      for (const key of missing.slice(0, 6)) console.log(`      - missing  ${key}`);
      if (missing.length > 6) console.log(`      ... and ${missing.length - 6} more`);
      for (const key of extra) console.log(`      + unknown  ${key}`);
      for (const issue of placeholderIssues) console.log(`      ! ${issue}`);
      if (strict) failures++;
    }
  }

  if (strict && failures) {
    console.error(`\n${failures} catalogue(s) incomplete.`);
    process.exit(1);
  }
  console.log(
    strict ? "\nAll catalogues complete." : "\nNon-strict: incomplete locales fall back to English.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
