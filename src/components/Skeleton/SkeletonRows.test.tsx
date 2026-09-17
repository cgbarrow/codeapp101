import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkeletonRows } from "./SkeletonRows";

describe("SkeletonRows", () => {
  it("renders placeholder list items hidden from assistive technology", () => {
    render(
      <ul aria-label="Loading" aria-busy="true">
        <SkeletonRows count={3} />
      </ul>,
    );

    const rows = screen.getByRole("list", { hidden: true }).querySelectorAll("[data-skeleton]");
    expect(rows).toHaveLength(3);
    rows.forEach((row) => expect(row).toHaveAttribute("aria-hidden", "true"));
  });
});
