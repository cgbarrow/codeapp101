import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = join(import.meta.dirname, "..");

function codeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return codeFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const importsGenerated =
  /from\s+["'][^"']*\/generated(\/|["'])|import\(\s*["'][^"']*\/generated(\/|["'])/;

describe("architecture boundaries", () => {
  it("only src/data imports from src/generated", () => {
    const offenders = codeFiles(srcDir)
      .map((file) => relative(srcDir, file))
      .filter((file) => !file.startsWith("data/") && !file.startsWith("generated/"))
      .filter((file) => importsGenerated.test(readFileSync(join(srcDir, file), "utf8")));

    expect(offenders).toEqual([]);
  });
});
