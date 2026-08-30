/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import { evaluateConstructionRules } from "./lib/constructionRules";

describe("federal construction rulepack", () => {
  test("separates verified source evidence from unverified checks", () => {
    const checks = evaluateConstructionRules({
      sources: [
        {
          title: "Construction solicitation",
          excerpt:
            "100% small business set-aside. Offer guarantee required. Performance and payment bonds required. Site visit scheduled. Liquidated damages apply.",
          url: "https://agency.example.invalid/notice",
          kind: "notice",
        },
      ],
      requirements: [
        {
          text: "Offer guarantee is required",
          sourceQuote: "Offer guarantee: Required",
          category: "bonding",
        },
      ],
    });

    expect(checks.find((check) => check.ruleKey === "offer_guarantee")?.status).toBe(
      "verified",
    );
    expect(checks.find((check) => check.ruleKey === "complete_package")?.status).toBe(
      "unverified",
    );
    expect(checks.find((check) => check.ruleKey === "sf1442_submission")?.status).toBe(
      "unverified",
    );
  });

  test("requires an explicit human override to resolve absent source proof", () => {
    const [check] = evaluateConstructionRules({
      sources: [],
      requirements: [],
      overrides: [
        {
          ruleKey: "complete_package",
          status: "resolved",
          ownerLabel: "Preconstruction lead",
          note: "Package checksum recorded in the bid room.",
        },
      ],
    });

    expect(check).toMatchObject({
      ruleKey: "complete_package",
      status: "resolved",
      sourceVerified: false,
      ownerLabel: "Preconstruction lead",
    });
  });
});
