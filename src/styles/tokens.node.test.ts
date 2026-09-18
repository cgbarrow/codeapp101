import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = join(import.meta.dirname, "..");
const tokensFile = join(import.meta.dirname, "tokens.css");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : sourceFiles(path);
    return /\.(css|tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Path below src, with forward slashes on every platform so the names below match on Windows. */
const relativeToSrc = (file: string) => relative(srcDir, file).split(sep).join("/");

const rawColour = /#[0-9a-f]{3,8}\b|\boklch\(|\brgba?\(|\bhsla?\(/i;
const rawFontFamily = /font-family:(?!\s*var\()/i;

describe("design tokens", () => {
  it("scans the stylesheets it is meant to police", () => {
    const scanned = sourceFiles(srcDir).map(relativeToSrc);

    expect(scanned).toEqual(
      expect.arrayContaining([
        "styles/tokens.css",
        "styles/base.css",
        "components/AppShell/AppShell.module.css",
      ]),
    );
  });

  it("keeps colour values and font-family names in tokens.css only", () => {
    const offenders = sourceFiles(srcDir)
      .filter((file) => file !== tokensFile)
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return rawColour.test(text) || rawFontFamily.test(text);
      })
      .map(relativeToSrc);

    expect(offenders).toEqual([]);
  });

  it("defines the colour, type, space, radius and motion token groups", () => {
    const tokens = readFileSync(tokensFile, "utf8");

    for (const group of [
      "--color-",
      "--font-",
      "--text-",
      "--space-",
      "--radius-",
      "--ease-",
      "--dur-",
    ]) {
      expect(tokens).toContain(group);
    }
  });
});
