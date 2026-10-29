import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorthALook } from "./DashboardView";

describe("WorthALook", () => {
  it("renders nothing when there is nothing to flag", () => {
    expect(renderToStaticMarkup(<WorthALook items={[]} />)).toBe("");
  });

  it("shows how many things are worth a look, details closed", () => {
    const one = renderToStaticMarkup(<WorthALook items={["Unusually busy at 1–2 pm"]} />);
    expect(one).toContain("1 thing worth a look");
    expect(one).not.toContain("Unusually busy");
    expect(renderToStaticMarkup(<WorthALook items={["a", "b"]} />)).toContain("2 things worth a look");
  });
});
