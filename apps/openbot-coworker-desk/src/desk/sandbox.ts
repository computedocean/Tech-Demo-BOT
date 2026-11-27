import type { FileWrite, Sandbox } from "./types.ts";

export const SANDBOX_FILES = {
  "notes.md":
    "Meeting notes\n\n- Review the coworker desk\n- Keep writes inside the sandbox\n",
  "CHANGELOG.md": "# Changelog\n\n## Unreleased\n",
  "readme.md":
    "# Sandbox\n\nThis folder is the only place the coworker may write.\n",
} as const;

export const PATH_SCOPE =
  "In-memory sandbox only: notes.md, CHANGELOG.md, and readme.md. Relative names and sandbox:// targets stay inside. Absolute paths, parent paths (..), home paths (~), and network URLs are refused.";

export function initialSandbox(): Sandbox {
  return { files: { ...SANDBOX_FILES } };
}

export function isInsideSandbox(target: string): boolean {
  let path = target.trim();
  if (path.startsWith("sandbox://")) path = path.slice("sandbox://".length);
  path = path.replace(/\/+$/, "");
  if (path === "" || path === "sandbox") return true;
  if (
    path.startsWith("/") ||
    path.startsWith("~") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes("://")
  ) {
    return false;
  }
  const parts = path.split("/");
  return parts.every((part) => part !== ".." && part !== "." && /^[A-Za-z0-9._-]+$/.test(part));
}

export function applyWrite(sandbox: Sandbox, write: FileWrite): Sandbox {
  if (!isInsideSandbox(write.path)) {
    throw new Error("Refusing a write outside the sandbox.");
  }
  return {
    files: {
      ...sandbox.files,
      [write.path]: write.content,
    },
  };
}

export function changedPaths(current: Sandbox, baseline: Sandbox = initialSandbox()): string[] {
  const paths = new Set([
    ...Object.keys(baseline.files),
    ...Object.keys(current.files),
  ]);
  return [...paths].filter((path) => current.files[path] !== baseline.files[path]).sort();
}
