#!/usr/bin/env node
/**
 * Preflight: verify that the TanStack package graph has a single, consistent
 * version of every internal `*-core` shared package. Mismatches between
 * router-core / start-client-core / start-server-core cause "Missing export"
 * build failures and "SPA mode" hydration crashes that are hard to diagnose
 * from the resulting stack trace, so fail fast here with an actionable hint.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Packages whose major+minor must agree across the whole install.
// These are the shared cores that other @tanstack/* packages import
// named exports from.
const SHARED = [
  "@tanstack/router-core",
  "@tanstack/start-client-core",
  "@tanstack/start-server-core",
  "@tanstack/react-router",
  "@tanstack/react-start",
];

function readVersion(pkg) {
  const p = resolve(root, "node_modules", pkg, "package.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

function minor(v) {
  const m = /^(\d+)\.(\d+)\./.exec(v);
  return m ? `${m[1]}.${m[2]}` : v;
}

const installed = SHARED.map((name) => ({ name, version: readVersion(name) }))
  .filter((p) => p.version);

if (installed.length === 0) {
  console.error(
    "[tanstack-preflight] No @tanstack/* packages found in node_modules. Run `bun install`.",
  );
  process.exit(1);
}

const buckets = new Map();
for (const { name, version } of installed) {
  const key = minor(version);
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push({ name, version });
}

if (buckets.size > 1) {
  console.error("\n[tanstack-preflight] TanStack package versions are out of sync.\n");
  for (const [key, group] of buckets) {
    console.error(`  ${key}.x:`);
    for (const { name, version } of group) {
      console.error(`    - ${name}@${version}`);
    }
  }
  console.error(
    "\nAll listed packages must share the same major.minor or the build will fail with",
  );
  console.error(
    '"Missing export" errors (e.g. getScriptPreloadAttrs) and SSR hydration will break',
  );
  console.error('with "Expected to find a match below the root match in SPA mode".\n');
  console.error("Fix: pin compatible versions in package.json, e.g.");
  console.error(
    '  bun add @tanstack/react-router@latest @tanstack/react-start@latest @tanstack/router-plugin@latest\n',
  );
  process.exit(1);
}

console.log(
  `[tanstack-preflight] OK — ${installed.length} TanStack packages aligned on ${[...buckets.keys()][0]}.x`,
);
