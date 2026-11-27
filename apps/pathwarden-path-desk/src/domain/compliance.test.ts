import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../..", import.meta.url));
const skipDirs = new Set([
  "node_modules",
  "dist",
  ".vite",
  "test-results",
  "playwright-report",
  "blob-report",
]);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx|json|html|css|md|toml)$/.test(entry) && entry !== "bun.lock") {
      found.push(path);
    }
  }
  return found;
}

const forbidden = [
  /ldap:\/\//i,
  /ldaps:\/\//i,
  /Invoke-BloodHound/i,
  /SharpHound\.exe/i,
  /System\.DirectoryServices/,
  /secretsdump/i,
  /\bkinit\b/,
  /\bnmap\b/i,
  /BEGIN PRIVATE KEY/,
  /AKIA[0-9A-Z]{16}/,
  /sk-[A-Za-z0-9]{16,}/,
  /(api[_-]?key|client[_-]?secret|password)\s*[:=]\s*["'][^"']{6,}["']/i,
];

describe("default app stays offline", () => {
  test("ships no API keys, collector, or network-scan entry point", () => {
    const files = sourceFiles(appRoot);
    expect(files.length).toBeGreaterThan(5);
    const hits: string[] = [];
    for (const file of files) {
      if (file.endsWith("compliance.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        if (pattern.test(text)) hits.push(`${file} matched ${pattern}`);
      }
      if (/collect\.(ps1|py|sh)$/.test(file)) hits.push(file);
    }
    expect(hits).toEqual([]);

    const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.scripts).sort()).toEqual(
      ["build", "dev", "lint", "preview", "screenshot", "test"].sort(),
    );
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of Object.keys(deps)) {
      expect(name.toLowerCase()).not.toMatch(/ldap|kerberos|bloodhound|sharp-hound|nmap/);
    }
  });
});
