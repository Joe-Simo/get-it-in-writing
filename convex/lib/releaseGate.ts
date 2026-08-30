export type ReleaseBlocker = {
  key: string;
  kind: "package" | "requirement" | "construction" | "change";
  title: string;
  detail: string;
  ownerLabel?: string;
};

export function deriveReleaseState({
  hasBaseline,
  requirements,
  constructionChecks,
  impacts,
  changes,
}: {
  hasBaseline: boolean;
  requirements: Array<{
    _id: string;
    text: string;
    status: "open" | "satisfied" | "missing" | "not_applicable";
    criticality: "disqualifier" | "high" | "standard";
    requiredWithBid: boolean;
    ownerLabel?: string;
  }>;
  constructionChecks: Array<{
    ruleKey: string;
    label: string;
    explanation: string;
    severity: "blocking" | "high" | "standard";
    status: "verified" | "unverified" | "resolved" | "not_applicable";
    ownerLabel?: string;
  }>;
  impacts: Array<{
    _id: string;
    title: string;
    detail: string;
    status: "open" | "waiting" | "cleared" | "not_applicable";
    blocksRelease: boolean;
    ownerLabel?: string;
  }>;
  changes: Array<{
    _id: string;
    summary: string;
    status: "detected" | "reviewed";
  }>;
}) {
  const blockers: ReleaseBlocker[] = [];
  if (!hasBaseline) {
    blockers.push({
      key: "package-baseline",
      kind: "package",
      title: "Capture the current bid package",
      detail:
        "Release stays locked until the solicitation has a versioned baseline that future amendments can be compared against.",
    });
  }
  for (const requirement of requirements) {
    const unresolved =
      requirement.status !== "satisfied" &&
      requirement.status !== "not_applicable";
    if (
      unresolved &&
      (requirement.criticality === "disqualifier" ||
        requirement.requiredWithBid)
    ) {
      blockers.push({
        key: `requirement-${requirement._id}`,
        kind: "requirement",
        title: requirement.text,
        detail: requirement.requiredWithBid
          ? "Required with the bid and not cleared."
          : "Potential disqualifier and not cleared.",
        ownerLabel: requirement.ownerLabel,
      });
    }
  }
  for (const check of constructionChecks) {
    if (check.severity === "blocking" && check.status === "unverified") {
      blockers.push({
        key: `construction-${check.ruleKey}`,
        kind: "construction",
        title: check.label,
        detail: check.explanation,
        ownerLabel: check.ownerLabel,
      });
    }
  }
  for (const impact of impacts) {
    if (
      impact.blocksRelease &&
      (impact.status === "open" || impact.status === "waiting")
    ) {
      blockers.push({
        key: `impact-${impact._id}`,
        kind: "change",
        title: impact.title,
        detail: impact.detail,
        ownerLabel: impact.ownerLabel,
      });
    }
  }
  for (const change of changes) {
    if (change.status === "detected") {
      blockers.push({
        key: `change-${change._id}`,
        kind: "change",
        title: "Review the detected package change",
        detail: change.summary,
      });
    }
  }
  return {
    state: blockers.length === 0 ? ("ready" as const) : ("blocked" as const),
    blockers,
  };
}
