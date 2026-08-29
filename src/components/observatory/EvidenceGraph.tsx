import { useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Orbit } from "lucide-react";
import type { EvidenceEdge, EvidenceNode } from "@/lib/graph-types";
import { cn } from "@/lib/utils";
import FIELD_SHADER from "@/shaders/field.wgsl?raw";
import NODE_SHADER from "@/shaders/nodes.wgsl?raw";
import SIM_SHADER from "@/shaders/simulation.wgsl?raw";

type EvidenceGraphProps = {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  selectedId: string | null;
  onSelect: (node: EvidenceNode) => void;
  staticMode?: boolean;
};

export function EvidenceGraph({ nodes, edges, selectedId, onSelect, staticMode = false }: EvidenceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gpuState, setGpuState] = useState<"loading" | "active" | "fallback">("loading");
  const selectedIndex = Math.max(0, nodes.findIndex((node) => node.id === selectedId));
  const nodeIndex = useMemo(() => new Map(nodes.map((node, index) => [node.id, index])), [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    let disposed = false;
    let teardown: (() => void) | undefined;
    void (async () => {
      try {
        const { compute, draw, effect, frameLoop, init, storage, surface } = await import("vgpu");
        if (disposed) return;
        const gpu = await init({ powerPreference: "high-performance" });
        if (disposed) {
          gpu.dispose();
          return;
        }
        const count = Math.min(nodes.length, 64);
        const clippedEdges = edges.slice(0, 64);
        const positionsData = new Float32Array(count * 4);
        const metadataData = new Float32Array(count * 4);
        nodes.slice(0, count).forEach((node, index) => {
          positionsData.set([node.x, node.y, 0, 0], index * 4);
          const status = node.status === "supported" ? 0 : node.status === "disputed" ? 1 : 2;
          metadataData.set([node.x, node.y, status, node.kind === "source" ? 1 : 0], index * 4);
        });
        const edgeData = new Uint32Array(Math.max(1, clippedEdges.length) * 4);
        clippedEdges.forEach((edge, index) => {
          edgeData.set([nodeIndex.get(edge.source) ?? 0, nodeIndex.get(edge.target) ?? 0, 0, 0], index * 4);
        });
        const positions = storage(gpu, positionsData.byteLength, "read-write");
        const metadata = storage(gpu, metadataData.byteLength, "read");
        const edgeBuffer = storage(gpu, edgeData.byteLength, "read");
        positions.write(positionsData);
        metadata.write(metadataData);
        edgeBuffer.write(edgeData);
        const target = surface(gpu, canvas, {
          dpr: [1, window.innerWidth < 720 ? 1.5 : 2],
          clearColor: [0.032, 0.042, 0.037, 1],
        });
        const field = effect(gpu, FIELD_SHADER, {
          label: "signal-field",
          set: {
            params: { time: 0, edgeCount: clippedEdges.length, nodeCount: count, selected: selectedIndex },
            positions,
            edgeData: edgeBuffer,
          },
        });
        const nodeDraw = draw(gpu, {
          label: "evidence-nodes",
          shader: NODE_SHADER,
          instances: count,
          vertices: 6,
          blend: "additive",
          set: {
            params: { time: 0, nodeCount: count, motion: staticMode ? 0 : 1, selected: selectedIndex },
            positions,
            metadata,
          },
        });
        const simulation = compute(gpu, SIM_SHADER, {
          label: "evidence-layout",
          set: {
            params: { time: 0, nodeCount: count, motion: staticMode ? 0 : 1, selected: selectedIndex },
            positions,
            metadata,
          },
        });
        const renderSignature = { colors: [navigator.gpu.getPreferredCanvasFormat()] };
        await Promise.all([field.compile(renderSignature), nodeDraw.compile(renderSignature)]);
        const start = performance.now();
        const loop = frameLoop(gpu, (frame) => {
          const time = (performance.now() - start) / 1000;
          const params = { time, nodeCount: count, motion: staticMode ? 0 : 1, selected: selectedIndex };
          if (!staticMode) {
            simulation.set({ params });
            simulation.dispatch(Math.ceil(count / 64));
          }
          field.set({ params: { ...params, edgeCount: clippedEdges.length } });
          nodeDraw.set({ params });
          frame.pass({ target, clear: [0.032, 0.042, 0.037, 1] }, (pass) => {
            pass.draw(field);
            pass.draw(nodeDraw);
          });
        }, staticMode ? { fps: 1 } : { fps: 60 });
        setGpuState("active");
        teardown = () => {
          loop.stop();
          gpu.dispose();
        };
      } catch (error) {
        if (import.meta.env.DEV) console.warn("Signal Garden switched to the static evidence field.", error);
        if (!disposed) setGpuState("fallback");
      }
    })();
    return () => {
      disposed = true;
      teardown?.();
    };
  }, [edges, nodeIndex, nodes, selectedIndex, staticMode]);

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-[1.4rem] border border-white/20 bg-[#080b09]">
      <canvas ref={canvasRef} aria-hidden="true" className={cn("absolute inset-0 h-full w-full", gpuState === "fallback" && "opacity-0")} />
      {gpuState === "fallback" && <StaticField nodes={nodes} edges={edges} />}
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur-md">
        {gpuState === "active" ? <Orbit className="size-3.5 text-[#c7ff4a]" /> : <Cpu className="size-3.5" />}
        {gpuState === "active" ? "WebGPU live field" : gpuState === "fallback" ? "Accessible static field" : "Warming instrument"}
      </div>
      <div className="absolute inset-0 z-10">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            aria-label={`${node.kind}: ${node.label}. ${node.detail}`}
            aria-pressed={selectedId === node.id}
            onClick={() => onSelect(node)}
            className={cn(
              "absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent bg-transparent outline-none transition focus-visible:border-[#c7ff4a] focus-visible:ring-4 focus-visible:ring-[#c7ff4a]/25",
              selectedId === node.id && "border-[#c7ff4a]/80",
            )}
            style={{ left: `${(node.x + 1) * 50}%`, top: `${(1 - (node.y + 1) / 2) * 100}%` }}
          >
            <span className="sr-only">Inspect {node.label}</span>
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-[240px] text-xs leading-relaxed text-white/48">
        Position shows topic proximity. Filaments show evidence relationships. Select any signal to inspect its source.
      </div>
    </div>
  );
}

function StaticField({ nodes, edges }: Pick<EvidenceGraphProps, "nodes" | "edges">) {
  const index = new Map(nodes.map((node) => [node.id, node]));
  return (
    <svg aria-hidden="true" viewBox="-1 -1 2 2" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <rect x="-1" y="-1" width="2" height="2" fill="#080b09" />
      {edges.map((edge) => {
        const source = index.get(edge.source);
        const target = index.get(edge.target);
        if (!source || !target) return null;
        return <line key={edge.id} x1={source.x} y1={-source.y} x2={target.x} y2={-target.y} stroke="#8db956" strokeOpacity=".35" strokeWidth=".004" />;
      })}
      {nodes.map((node) => (
        <circle key={node.id} cx={node.x} cy={-node.y} r={node.kind === "source" ? ".035" : ".025"} fill={node.status === "supported" ? "#c7ff4a" : node.status === "disputed" ? "#ff6b57" : "#8faaff"} />
      ))}
    </svg>
  );
}
