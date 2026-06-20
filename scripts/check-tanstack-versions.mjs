#!/usr/bin/env node
/**
 * Preflight: verify that every installed @tanstack/* package's declared
 * dependency ranges on other @tanstack/* packages are actually satisfied by
 * what's resolved in node_modules.
 *
 * Mismatches here are the root cause of two confusing failure modes:
 *   - Build: "Missing export" (e.g. getScriptPreloadAttrs is not exported
 *     by @tanstack/router-core) when one package was compiled against a
 *     newer core than the one actually installed.
 *   - Runtime: "Invariant failed: Expected to find a match below the root
 *     match in SPA mode." during SSR hydration.
 *
 * Fail fast here with the exact offending edge so the fix is obvious.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tanstackDir = resolve(root, "node_modules", "@tanstack");

if (!existsSync(tanstackDir)) {
  console.error("[tanstack-preflight] node_modules/@tanstack not found. Run `bun install`.");
  process.exit(1);
}

function readPkg(name) {
  const p = resolve(tanstackDir, name, "package.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** Minimal semver-range check covering the operators npm/bun emit in deps. */
function satisfies(version, range) {
  if (!range || range === "*" || range === "latest") return true;
  // Strip whitespace and handle simple OR / AND combinations conservatively.
  const parts = range.split("||").map((s) => s.trim());
  return parts.some((p) => p.split(" ").every((c) => matchComparator(version, c.trim())));
}

function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function matchComparator(version, comp) {
  const v = parse(version);
  if (!v || !comp) return false;
  const m = /^(\^|~|>=|<=|>|<|=)?\s*(\d+\.\d+\.\d+)/.exec(comp);
  if (!m) return true; // pre-release / tag — skip
  const op = m[1] ?? "=";
  const t = parse(m[2]);
  if (!t) return true;
  if (op === "=") return cmp(v, t) === 0;
  if (op === ">") return cmp(v, t) > 0;
  if (op === "<") return cmp(v, t) < 0;
  if (op === ">=") return cmp(v, t) >= 0;
  if (op === "<=") return cmp(v, t) <= 0;
  if (op === "~") return v[0] === t[0] && v[1] === t[1] && v[2] >= t[2];
  if (op === "^") {
    if (t[0] > 0) return v[0] === t[0] && cmp(v, t) >= 0;
    if (t[1] > 0) return v[0] === 0 && v[1] === t[1] && v[2] >= t[2];
    return cmp(v, t) === 0;
  }
  return false;
}

const installed = new Map();
for (const name of readdirSync(tanstackDir)) {
  const pkg = readPkg(name);
  if (pkg?.version) installed.set(`@tanstack/${name}`, pkg);
}

const problems = [];
for (const [name, pkg] of installed) {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
  for (const [dep, range] of Object.entries(deps)) {
    if (!dep.startsWith("@tanstack/")) continue;
    const got = installed.get(dep);
    if (!got) continue; // optional/peer not installed
    if (!satisfies(got.version, range)) {
      problems.push({ from: `${name}@${pkg.version}`, dep, want: range, got: got.version });
    }
  }
}

if (problems.length > 0) {
  console.error("\n[tanstack-preflight] TanStack package versions are incompatible:\n");
  for (const p of problems) {
    console.error(`  ${p.from}`);
    console.error(`    requires ${p.dep} ${p.want}`);
    console.error(`    installed: ${p.got}\n`);
  }
  console.error(
    "This causes 'Missing export' build errors and 'Expected to find a match below the root",
  );
  console.error("match in SPA mode' SSR hydration crashes.\n");
  console.error("Fix: realign the TanStack packages, e.g.");
  console.error(
    "  bun add @tanstack/react-router@latest @tanstack/react-start@latest @tanstack/router-plugin@latest\n",
  );
  process.exit(1);
}

console.log(`[tanstack-preflight] OK — ${installed.size} @tanstack/* packages, all deps satisfied.`);
