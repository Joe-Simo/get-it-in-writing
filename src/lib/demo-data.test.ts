import { describe, expect, it } from "vitest";
import { demoEdges, demoNodes } from "./demo-data";

describe("evidence preview", () => {
  it("keeps every relationship attached to visible evidence", () => {
    const nodeIds = new Set(demoNodes.map((node) => node.id));
    for (const edge of demoEdges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });

  it("keeps interactive nodes inside the normalized graph field", () => {
    for (const node of demoNodes) {
      expect(node.x).toBeGreaterThanOrEqual(-1);
      expect(node.x).toBeLessThanOrEqual(1);
      expect(node.y).toBeGreaterThanOrEqual(-1);
      expect(node.y).toBeLessThanOrEqual(1);
      expect(node.confidence).toBeGreaterThanOrEqual(0);
      expect(node.confidence).toBeLessThanOrEqual(1);
      if (node.kind === "source") expect(node.url).toMatch(/^https:\/\//);
    }
  });
});
