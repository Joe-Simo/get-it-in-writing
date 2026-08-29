export type ClaimStatus = "supported" | "disputed" | "unresolved";

export type EvidenceNode = {
  id: string;
  label: string;
  detail: string;
  kind: "claim" | "source";
  status: ClaimStatus;
  confidence: number;
  x: number;
  y: number;
  url?: string;
};

export type EvidenceEdge = {
  id: string;
  source: string;
  target: string;
  support: "supports" | "challenges" | "context";
};
