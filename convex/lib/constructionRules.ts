export type ConstructionRuleStatus =
  | "verified"
  | "unverified"
  | "resolved"
  | "not_applicable";

export type ConstructionRuleCategory =
  | "package"
  | "submission"
  | "eligibility"
  | "bonding"
  | "labor"
  | "site_visit"
  | "schedule"
  | "safety"
  | "commercial";

export type ConstructionRuleInput = {
  sources: Array<{
    title: string;
    excerpt: string;
    url: string;
    kind?: "notice" | "attachment" | "amendment" | "reference";
  }>;
  requirements: Array<{
    text: string;
    sourceQuote: string;
    category:
      | "submission"
      | "bonding"
      | "insurance"
      | "eligibility"
      | "labor"
      | "safety"
      | "schedule"
      | "technical"
      | "pricing"
      | "other";
  }>;
  overrides?: Array<{
    ruleKey: string;
    status: "resolved" | "not_applicable";
    ownerLabel?: string;
    note?: string;
  }>;
};

type RuleDefinition = {
  key: string;
  label: string;
  category: ConstructionRuleCategory;
  severity: "blocking" | "high" | "standard";
  explanation: string;
  matches: (input: ConstructionRuleInput, searchable: string) => boolean;
};

const requirementCategory = (
  input: ConstructionRuleInput,
  category: ConstructionRuleInput["requirements"][number]["category"],
) => input.requirements.some((requirement) => requirement.category === category);

const rules: RuleDefinition[] = [
  {
    key: "complete_package",
    label: "Complete solicitation package",
    category: "package",
    severity: "blocking",
    explanation:
      "The notice, referenced bid package, and public attachments must be present before readiness can be defended.",
    matches: (input) =>
      input.sources.some(
        (source) =>
          source.kind === "attachment" || source.kind === "amendment",
      ),
  },
  {
    key: "offer_deadline",
    label: "Offer deadline and delivery method",
    category: "submission",
    severity: "blocking",
    explanation:
      "Verify the exact due time, time zone, delivery channel, copies, and late-offer rule.",
    matches: (input, searchable) =>
      requirementCategory(input, "submission") &&
      /offers? due|proposal due|bid opening|deadline|late (offer|proposal|bid)/i.test(
        searchable,
      ),
  },
  {
    key: "sf1442_submission",
    label: "SF 1442 and required-with-bid forms",
    category: "submission",
    severity: "blocking",
    explanation:
      "Construction offers commonly rely on SF 1442 and package-specific representations or schedules; verify only against the actual package.",
    matches: (_input, searchable) =>
      /sf\s*1442|standard form\s*1442|required with (the )?(bid|offer|proposal)/i.test(
        searchable,
      ),
  },
  {
    key: "eligibility_naics",
    label: "Set-aside and NAICS eligibility",
    category: "eligibility",
    severity: "blocking",
    explanation:
      "Confirm the bidder satisfies the stated set-aside, NAICS, size, registration, and responsibility conditions.",
    matches: (input, searchable) =>
      requirementCategory(input, "eligibility") ||
      /set[- ]aside|naics|small business|sam registration/i.test(searchable),
  },
  {
    key: "offer_guarantee",
    label: "Offer guarantee or bid bond",
    category: "bonding",
    severity: "blocking",
    explanation:
      "Verify the guarantee form, amount or percentage, surety requirements, and whether it must accompany the offer.",
    matches: (input, searchable) =>
      requirementCategory(input, "bonding") &&
      /offer guarantee|bid bond|bid guarantee|sf\s*24/i.test(searchable),
  },
  {
    key: "performance_payment_bonds",
    label: "Performance and payment bonds",
    category: "bonding",
    severity: "high",
    explanation:
      "Confirm post-award bond amounts, surety terms, and the delivery window before counting capacity as available.",
    matches: (_input, searchable) =>
      /performance (and|&) payment bonds?|payment bond|performance bond/i.test(
        searchable,
      ),
  },
  {
    key: "wage_determination",
    label: "Wage determination and labor clauses",
    category: "labor",
    severity: "high",
    explanation:
      "Verify the incorporated wage decision, labor standards, payroll obligations, and amendment status.",
    matches: (input, searchable) =>
      requirementCategory(input, "labor") ||
      /wage determination|davis[- ]bacon|certified payroll|labor standards/i.test(
        searchable,
      ),
  },
  {
    key: "site_visit",
    label: "Site visit and access deadline",
    category: "site_visit",
    severity: "high",
    explanation:
      "Confirm whether attendance or advance attendee submission is mandatory and resolve any conflicting dates.",
    matches: (_input, searchable) =>
      /site visit|pre[- ]bid (conference|meeting)|list of attendees|visitor control/i.test(
        searchable,
      ),
  },
  {
    key: "amendment_acknowledgment",
    label: "Amendment acknowledgment",
    category: "package",
    severity: "blocking",
    explanation:
      "Monitor the notice through submission and verify every issued amendment is included and acknowledged.",
    matches: (input, searchable) =>
      input.sources.some((source) => source.kind === "amendment") ||
      /amendment|sf\s*30|acknowledge/i.test(searchable),
  },
  {
    key: "period_of_performance",
    label: "Period of performance and phasing",
    category: "schedule",
    severity: "high",
    explanation:
      "Verify notice-to-proceed timing, completion duration, phasing, outages, and owner constraints.",
    matches: (input, searchable) =>
      requirementCategory(input, "schedule") ||
      /period of performance|notice to proceed|calendar days|phasing|outage/i.test(
        searchable,
      ),
  },
  {
    key: "liquidated_damages",
    label: "Liquidated damages and schedule exposure",
    category: "commercial",
    severity: "high",
    explanation:
      "Capture the daily exposure and test it against the proposed schedule before pricing.",
    matches: (_input, searchable) => /liquidated damages/i.test(searchable),
  },
  {
    key: "safety_security_access",
    label: "Safety, security, and site access",
    category: "safety",
    severity: "high",
    explanation:
      "Verify site-specific safety plans, badging, escorts, security restrictions, and access lead times.",
    matches: (input, searchable) =>
      requirementCategory(input, "safety") ||
      /safety|security|badging|escort|site access|visitor control/i.test(
        searchable,
      ),
  },
  {
    key: "insurance_permits",
    label: "Insurance, permits, and licenses",
    category: "commercial",
    severity: "standard",
    explanation:
      "Verify project-specific coverage limits, permits, trade licensing, and responsibility ownership.",
    matches: (input, searchable) =>
      requirementCategory(input, "insurance") ||
      /insurance|permit|license|licence/i.test(searchable),
  },
];

export function evaluateConstructionRules(input: ConstructionRuleInput) {
  const searchable = [
    ...input.sources.flatMap((source) => [source.title, source.excerpt]),
    ...input.requirements.flatMap((requirement) => [
      requirement.text,
      requirement.sourceQuote,
    ]),
  ].join("\n");
  const overrides = new Map(
    (input.overrides ?? []).map((override) => [override.ruleKey, override]),
  );

  return rules.map((rule) => {
    const override = overrides.get(rule.key);
    const sourceVerified = rule.matches(input, searchable);
    return {
      ruleKey: rule.key,
      label: rule.label,
      category: rule.category,
      severity: rule.severity,
      explanation: rule.explanation,
      status: override?.status ?? (sourceVerified ? "verified" : "unverified"),
      sourceVerified,
      ownerLabel: override?.ownerLabel,
      note: override?.note,
    } as const;
  });
}
