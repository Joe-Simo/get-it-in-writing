import { useEffect, useRef, useState } from "react";
import shaderSource from "@/visual/promise-seal.wgsl?raw";

type PromiseSealProps = {
  className?: string;
  intensity?: number;
};

export function PromiseSeal({ className = "", intensity = 1 }: PromiseSealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let dispose: (() => void) | undefined;

    void import("vgpu")
      .then(async ({ clock, effect, frame, frameLoop, init, surface }) => {
        if (disposed || !navigator.gpu) {
          setAvailable(false);
          return;
        }
        const gpu = await init();
        if (disposed) {
          gpu.dispose();
          return;
        }
        const target = surface(gpu, canvas, {
          dpr: [1, 1.5],
          alphaMode: "premultiplied",
          clearColor: [0, 0, 0, 0],
          label: "promise-seal",
        });
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const params = { time: 0, motion: reducedMotion ? 0 : 1, aspect: 1, intensity };
        const seal = effect(gpu, shaderSource, {
          label: "promise-seal-effect",
          set: { params },
        });
        const unsubscribe = target.onResize(({ width, height }) => {
          params.aspect = width / Math.max(1, height);
          seal.set({ params });
        });
        const timer = clock(gpu);
        if (reducedMotion) {
          frame(gpu, (current) => current.pass(target, seal));
        }
        const loop = reducedMotion
          ? undefined
          : frameLoop(
              gpu,
              (current) => {
                params.time = timer.time;
                seal.set({ params });
                current.pass(target, seal);
              },
              { fps: 30 },
            );
        const unsubscribeError = gpu.onError(() => {
          if (!disposed) {
            setAvailable(false);
            dispose?.();
          }
        });
        let resourcesDisposed = false;
        dispose = () => {
          if (resourcesDisposed) return;
          resourcesDisposed = true;
          loop?.stop();
          unsubscribe();
          unsubscribeError();
          target.dispose();
          gpu.dispose();
        };
        void gpu.gpu.lost.then(() => {
          if (!disposed) {
            setAvailable(false);
            dispose?.();
          }
        });
      })
      .catch(() => setAvailable(false));

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [intensity]);

  return (
    <div aria-hidden="true" className={`promise-seal ${className}`} data-webgpu={available ? "ready" : "fallback"}>
      <canvas ref={canvasRef} />
      <span className="promise-seal-fallback">✦</span>
    </div>
  );
}
