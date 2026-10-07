import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const solutionDir = join(import.meta.dirname, "..", "..", "solution");
const read = (name: string) => readFileSync(join(solutionDir, "src", name), "utf8");

/** The `<attribute>` block for one column, so assertions cannot match a neighbouring column. */
function attribute(xml: string, physicalName: string): string {
  const match = new RegExp(`<attribute PhysicalName="${physicalName}">[\\s\\S]*?</attribute>`).exec(xml);
  if (!match) throw new Error(`no attribute ${physicalName}`);
  return match[0];
}

describe("generated Dataverse solution", () => {
  it("is version 1.1.0.0 and ships only that zip", () => {
    expect(read("solution.xml")).toContain("<Version>1.1.0.0</Version>");
    expect(existsSync(join(solutionDir, "CodeApp101_1_1_0_0.zip"))).toBe(true);
    expect(existsSync(join(solutionDir, "CodeApp101_1_0_0_0.zip"))).toBe(false);
  });

  it("adds cb_reminderemailsentat to cb_todotask as a nullable date and time", () => {
    const xml = read("customizations.xml");
    const column = attribute(xml, "cb_ReminderEmailSentAt");
    expect(column).toContain("<Type>datetime</Type>");
    expect(column).toContain("<Format>datetime</Format>");
    expect(column).toContain("<Behavior>1</Behavior>");
    expect(column).toContain("<RequiredLevel>none</RequiredLevel>");
    expect(column).toContain("<IntroducedVersion>1.1.0.0</IntroducedVersion>");
    expect(column).toContain('displayname description="Reminder email sent at"');

    const task = /<Entity>\s*<Name [^>]*>cb_TodoTask<\/Name>[\s\S]*?<\/Entity>/.exec(xml)?.[0] ?? "";
    expect(task).toContain('PhysicalName="cb_ReminderEmailSentAt"');
    expect(xml.match(/cb_ReminderEmailSentAt"/g)).toHaveLength(1);
  });

  it("leaves the existing columns at their original introduced version", () => {
    const column = attribute(read("customizations.xml"), "cb_ReminderAt");
    expect(column).toContain("<IntroducedVersion>1.0.0.0</IntroducedVersion>");
  });
});
