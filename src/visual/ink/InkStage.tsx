import { useEffect, useRef, useState, type RefObject } from "react";
import { PromiseSeal } from "@/components/PromiseSeal";
import {
  FLOW_SIZE,
  WASH_SIZE,
  blotShader,
  confineShader,
  curlShader,
  divergeShader,
  flowShader,
  projectShader,
  relaxShader,
  washShader,
} from "./shaders";

const FLOW_CELLS = FLOW_SIZE[0] * FLOW_SIZE[1];
const WASH_CELLS = WASH_SIZE[0] * WASH_SIZE[1];
const FLOW_GROUPS = [Math.ceil(FLOW_SIZE[0] / 8), Math.ceil(FLOW_SIZE[1] / 8)] as const;
const WASH_GROUPS = [Math.ceil(WASH_SIZE[0] / 8), Math.ceil(WASH_SIZE[1] / 8)] as const;

type InkStageProps = {
  hostRef: RefObject<HTMLElement | null>;
  emitterRef: RefObject<HTMLElement | null>;
};

type Pointer = {
  from: [number, number];
  to: [number, number];
  velocity: [number, number];
  lastTime: number;
  decay: number;
};

export function InkStage({ hostRef, emitterRef }: InkStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"loading" | "ready" | "fallback">("loading");
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    let disposed = false;
    let dispose: (() => void) | undefined;

    const pointer: Pointer = {
      from: [0.5, 0.5],
      to: [0.5, 0.5],
      velocity: [0, 0],
      lastTime: 0,
      decay: 0,
    };

    const pointAt = (event: PointerEvent): [number, number] => {
      const rect = host.getBoundingClientRect();
      return [
        Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
        Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / Math.max(1, rect.height))),
      ];
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      const next = pointAt(event);
      if (pointer.lastTime === 0) {
        pointer.from = pointer.to = next;
        pointer.lastTime = event.timeStamp;
        return;
      }
      const dt = Math.max(0.004, Math.min(0.05, (event.timeStamp - pointer.lastTime) / 1000));
      pointer.from = pointer.to;
      pointer.to = next;
      pointer.velocity = [
        Math.max(-2, Math.min(2, (pointer.to[0] - pointer.from[0]) / dt)),
        Math.max(-2, Math.min(2, (pointer.to[1] - pointer.from[1]) / dt)),
      ];
      pointer.lastTime = event.timeStamp;
      pointer.decay = 10;
    };
    const onPointerLeave = () => {
      pointer.lastTime = 0;
      pointer.decay = 0;
    };

    let visible = true;
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    observer.observe(host);

    void (async () => {
      const vgpu = await import("vgpu");
      if (disposed || !navigator.gpu) {
        setMode("fallback");
        return;
      }
      try {
        const gpu = await vgpu.init();
        if (disposed) {
          gpu.dispose();
          return;
        }
        const stage = vgpu.surface(gpu, canvas, {
          dpr: [1, 1.5],
          alphaMode: "premultiplied",
          clearColor: [0, 0, 0, 0],
          label: "ink-stage",
        });
        const flow = vgpu.pingPongStorage(gpu, FLOW_CELLS * 8);
        const wash = vgpu.pingPongStorage(gpu, WASH_CELLS * 4);
        const pressure = vgpu.pingPongStorage(gpu, FLOW_CELLS * 4);
        const divergence = vgpu.storage(gpu, FLOW_CELLS * 4, "read-write");
        const curl = vgpu.storage(gpu, FLOW_CELLS * 4, "read-write");
        const mask = vgpu.storage(gpu, WASH_CELLS * 4, "read-write");

        const passes = {
          flow: vgpu.compute(gpu, flowShader),
          curl: vgpu.compute(gpu, curlShader),
          confine: vgpu.compute(gpu, confineShader),
          diverge: vgpu.compute(gpu, divergeShader),
          relax: vgpu.compute(gpu, relaxShader),
          project: vgpu.compute(gpu, projectShader),
          wash: vgpu.compute(gpu, washShader),
        };
        const blot = vgpu.effect(gpu, blotShader, { label: "ink-blot" });
        await blot.compile({ colors: [stage.format] });
        if (disposed) {
          gpu.dispose();
          return;
        }
        blot.set({ config: { output_size: stage.size, grain_step: 0 } });

        const rasterizeMask = () => {
          const emitter = emitterRef.current;
          if (!emitter) return;
          const hostRect = host.getBoundingClientRect();
          const emitterRect = emitter.getBoundingClientRect();
          if (hostRect.width < 10 || hostRect.height < 10) return;
          const scratch = document.createElement("canvas");
          scratch.width = WASH_SIZE[0];
          scratch.height = WASH_SIZE[1];
          const brush = scratch.getContext("2d", { willReadFrequently: true });
          if (!brush) return;
          const style = getComputedStyle(emitter);
          brush.setTransform(
            WASH_SIZE[0] / hostRect.width,
            0,
            0,
            WASH_SIZE[1] / hostRect.height,
            0,
            0,
          );
          brush.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          if ("letterSpacing" in brush) brush.letterSpacing = style.letterSpacing;
          brush.textBaseline = "top";
          brush.fillStyle = "#ffffff";
          brush.fillText(
            emitter.textContent ?? "",
            emitterRect.left - hostRect.left,
            emitterRect.top - hostRect.top,
          );
          const pixels = brush.getImageData(0, 0, WASH_SIZE[0], WASH_SIZE[1]).data;
          const weights = new Float32Array(WASH_CELLS);
          for (let y = 0; y < WASH_SIZE[1]; y += 1) {
            const sourceRow = y * WASH_SIZE[0];
            const flippedRow = (WASH_SIZE[1] - 1 - y) * WASH_SIZE[0];
            for (let x = 0; x < WASH_SIZE[0]; x += 1) {
              weights[flippedRow + x] = (pixels[(sourceRow + x) * 4 + 3] ?? 0) / 255;
            }
          }
          mask.write(weights);
        };
        rasterizeMask();
        void document.fonts.ready.then(() => {
          if (!disposed) rasterizeMask();
        });
        const unsubscribeResize = stage.onResize(() => {
          if (disposed) return;
          blot.set({ config: { output_size: stage.size, grain_step: 0 } });
          rasterizeMask();
        });

        host.addEventListener("pointermove", onPointerMove, { passive: true });
        host.addEventListener("pointerleave", onPointerLeave, { passive: true });

        let step = 0;
        const stepSimulation = () => {
          const active = pointer.decay > 0;
          const drive = {
            step,
            pointer_active: active ? 1 : 0,
            pointer_from: pointer.from,
            pointer_to: pointer.to,
            pointer_velocity: pointer.velocity,
            emit: Math.min(1, step / 90),
            breeze: 1,
          };
          passes.flow
            .set({ drive, src: flow.read, wash: wash.read, dst: flow.write })
            .dispatch(...FLOW_GROUPS);
          flow.swap();
          passes.curl.set({ velocity: flow.read, curl }).dispatch(...FLOW_GROUPS);
          passes.confine.set({ src: flow.read, curl, dst: flow.write }).dispatch(...FLOW_GROUPS);
          flow.swap();
          passes.diverge.set({ velocity: flow.read, divergence }).dispatch(...FLOW_GROUPS);
          for (let i = 0; i < 3; i += 1) {
            passes.relax
              .set({
                params: { decay: i === 0 ? 0.8 : 1 },
                src: pressure.read,
                divergence,
                dst: pressure.write,
              })
              .dispatch(...FLOW_GROUPS);
            pressure.swap();
          }
          passes.project
            .set({ src: flow.read, pressure: pressure.read, dst: flow.write })
            .dispatch(...FLOW_GROUPS);
          flow.swap();
          passes.wash
            .set({ drive, src: wash.read, velocity: flow.read, mask, dst: wash.write })
            .dispatch(...WASH_GROUPS);
          wash.swap();
          step += 1;
          pointer.from = pointer.to;
          if (pointer.decay > 0) {
            pointer.velocity = [pointer.velocity[0] * 0.5, pointer.velocity[1] * 0.5];
            pointer.decay -= 1;
          }
        };

        const loop = vgpu.frameLoop(
          gpu,
          (current) => {
            if (!visible) return;
            stepSimulation();
            blot.set({
              wash: wash.read,
              config: { output_size: stage.size, grain_step: step / 30 },
            });
            current.pass(stage, blot);
          },
          { fps: 30 },
        );

        const unsubscribeError = gpu.onError(() => {
          if (!disposed) {
            setMode("fallback");
            dispose?.();
          }
        });
        let resourcesDisposed = false;
        dispose = () => {
          if (resourcesDisposed) return;
          resourcesDisposed = true;
          loop.stop();
          unsubscribeResize();
          unsubscribeError();
          host.removeEventListener("pointermove", onPointerMove);
          host.removeEventListener("pointerleave", onPointerLeave);
          stage.dispose();
          gpu.dispose();
        };
        setMode("ready");
        void gpu.gpu.lost.then(() => {
          if (!disposed) {
            setMode("fallback");
            dispose?.();
          }
        });
      } catch {
        if (!disposed) setMode("fallback");
      }
    })();

    return () => {
      disposed = true;
      observer.disconnect();
      dispose?.();
    };
  }, [reducedMotion, hostRef, emitterRef]);

  if (reducedMotion) {
    return (
      <div aria-hidden="true" className="ink-stage" data-webgpu="static">
        <PromiseSeal className="hero-seal" intensity={0.86} />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="ink-stage" data-webgpu={mode}>
      {mode === "fallback" ? (
        <PromiseSeal className="hero-seal" intensity={0.86} />
      ) : (
        <canvas ref={canvasRef} />
      )}
    </div>
  );
}
