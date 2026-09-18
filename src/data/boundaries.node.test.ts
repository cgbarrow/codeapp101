import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = join(import.meta.dirname, "..");

function codeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return codeFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Path below src, with forward slashes on every platform so the prefixes below match on Windows. */
const relativeToSrc = (file: string) => relative(srcDir, file).split(sep).join("/");

const importsGenerated =
  /from\s+["'][^"']*\/generated(\/|["'])|import\(\s*["'][^"']*\/generated(\/|["'])/;

describe("architecture boundaries", () => {
  it("only src/data imports from src/generated", () => {
    const offenders = codeFiles(srcDir)
      .filter((file) => {
        const path = relativeToSrc(file);
        return !path.startsWith("data/") && !path.startsWith("generated/");
      })
      .filter((file) => importsGenerated.test(readFileSync(file, "utf8")))
      .map(relativeToSrc);

    expect(offenders).toEqual([]);
  });
});
