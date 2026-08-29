import { useState } from "react";
import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, LoaderCircle } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { EvidenceGraph } from "@/components/observatory/EvidenceGraph";
import { Badge } from "@/components/ui/badge";
import { demoEdges, demoNodes, demoQuestion } from "@/lib/demo-data";
import type { EvidenceEdge, EvidenceNode } from "@/lib/graph-types";

export default function PublicGardenPage() {
  const { slug = "" } = useParams();
  const isPreview = slug === "preview";
  const garden = useQuery(api.gardens.getPublic, isPreview ? "skip" : { slug });

  if (isPreview) {
    return <GardenView question={demoQuestion} nodes={demoNodes} edges={demoEdges} preview />;
  }
  if (garden === undefined) return <GardenLoader />;
  if (garden === null) return <UnavailableGarden />;

  const sourceNodes: EvidenceNode[] = garden.sources.map((source, index) => ({
    id: source._id,
    label: source.title,
    detail: source.excerpt,
    kind: "source",
    status: "supported",
    confidence: 0.98,
    url: source.url,
    x: Math.cos(index * 2.4) * 0.72,
    y: Math.sin(index * 2.4) * 0.72,
  }));
  const claimNodes: EvidenceNode[] = garden.claims.map((claim) => ({
    id: claim._id,
    label: claim.summary,
    detail: claim.text,
    kind: "claim",
    status: claim.status,
    confidence: claim.confidence,
    x: claim.positionX,
    y: claim.positionY,
  }));
  const edges: EvidenceEdge[] = garden.links.map((link) => ({
    id: link._id,
    source: link.sourceId,
    target: link.claimId,
    support: link.support,
  }));

  return <GardenView question={garden.question} nodes={[...sourceNodes, ...claimNodes]} edges={edges} />;
}

function GardenView({
  question,
  nodes,
  edges,
  preview = false,
}: {
  question: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  preview?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null);
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];

  return (
    <main className="min-h-screen bg-[#0a0d0b] p-4 text-[#f2eee5] md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-white/55 hover:text-white">
            <ArrowLeft className="size-4" /> Signal Garden
          </Link>
          <Badge variant="outline" className="border-white/25 bg-transparent text-white">
            {preview ? "Verified docs preview" : "Public read-only garden"}
          </Badge>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-[.7fr_1.3fr]">
          <section>
            <p className="eyebrow text-[#c7ff4a]">Published research garden</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[.92] tracking-[-.055em] md:text-7xl">{question}</h1>
            <p className="mt-6 max-w-xl text-white/55">
              This view contains public claims and sources only. Team identities, email metadata, private notes, and webhook records are excluded server-side.
            </p>
            {selected && (
              <article className="mt-12 border-t border-white/20 pt-6">
                <p className="eyebrow text-white/60">Selected signal</p>
                <h2 className="mt-3 text-2xl font-semibold">{selected.label}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{selected.detail}</p>
                {selected.url && (
                  <a href={selected.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-[#c7ff4a]">
                    Inspect source <ExternalLink className="size-3.5" />
                  </a>
                )}
              </article>
            )}
          </section>
          <div className="min-h-[680px]">
            <EvidenceGraph nodes={nodes} edges={edges} selectedId={selected?.id ?? null} onSelect={(node) => setSelectedId(node.id)} />
          </div>
        </div>
      </div>
    </main>
  );
}

function GardenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0d0b] text-white">
      <LoaderCircle className="animate-spin" />
      <span className="sr-only">Loading garden</span>
    </div>
  );
}

function UnavailableGarden() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f2eee5] p-6">
      <div className="text-center">
        <p className="eyebrow">Garden unavailable</p>
        <h1 className="mt-4 font-editorial text-5xl">This research view is private or revoked.</h1>
        <Link to="/" className="mt-8 inline-flex items-center gap-2 text-sm underline">
          <ArrowLeft className="size-4" /> Return home
        </Link>
      </div>
    </div>
  );
}
