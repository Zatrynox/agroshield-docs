#!/usr/bin/env node
/**
 * Checks relative links and images in the documentation repository.
 *
 * External URLs are not fetched: they depend on third-party availability.
 * Anchors are checked only for existence of the target file, not for heading
 * slugs, because GitHub's slug algorithm is not part of this repository.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const failures = [];
let checked = 0;

function walk(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (extname(entry.name) === '.md') inspect(absolute);
  }
}

function inspect(file) {
  const content = readFileSync(file, 'utf8');
  const pattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const raw = match[1];
    if (!raw || /^(https?:|mailto:|tel:|data:)/i.test(raw)) continue;
    if (raw.startsWith('#')) continue;
    const withoutFragment = raw.split('#')[0].split('?')[0];
    if (!withoutFragment) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(withoutFragment);
    } catch {
      decoded = withoutFragment;
    }
    const target = resolve(dirname(file), decoded);
    const relativeTarget = relative(root, target);
    if (relativeTarget.startsWith('..') || relativeTarget.startsWith(`..${sep}`)) {
      failures.push(`${relative(root, file)} -> ${raw} (outside the repository)`);
      continue;
    }
    checked += 1;
    if (!existsSync(target)) {
      failures.push(`${relative(root, file)} -> ${raw} (missing)`);
    }
  }
}

walk(root);

if (failures.length > 0) {
  console.error(`\n${failures.length} broken link(s) out of ${checked} checked:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`All ${checked} relative links and images resolve.`);
