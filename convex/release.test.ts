import { describe, expect, it } from "vitest";
import { deriveReleaseState } from "./lib/releaseGate";

const readyInput = {
  hasBaseline: true,
  requirements: [],
  constructionChecks: [],
  impacts: [],
  changes: [],
};

describe("bid release gate", () => {
  it("blocks a bid without a versioned package baseline", () => {
    const result = deriveReleaseState({ ...readyInput, hasBaseline: false });
    expect(result.state).toBe("blocked");
    expect(result.blockers[0]?.kind).toBe("package");
  });

  it("blocks unresolved amendment impacts", () => {
    const result = deriveReleaseState({
      ...readyInput,
      impacts: [
        {
          _id: "impact",
          title: "Reprice concrete",
          detail: "Section 03 30 00 changed",
          status: "waiting" as const,
          blocksRelease: true,
        },
      ],
    });
    expect(result.blockers.map((item) => item.title)).toContain(
      "Reprice concrete",
    );
  });

  it("is ready only after every material item is cleared", () => {
    const result = deriveReleaseState({
      ...readyInput,
      impacts: [
        {
          _id: "impact",
          title: "Reprice concrete",
          detail: "Section 03 30 00 changed",
          status: "cleared" as const,
          blocksRelease: true,
        },
      ],
    });
    expect(result).toEqual({ state: "ready", blockers: [] });
  });
});
