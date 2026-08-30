import { useEffect, useRef, useState } from "react";

type PromiseSealProps = {
  className?: string;
  intensity?: number;
};

export function PromiseSeal({
  className = "",
  intensity = 1,
}: PromiseSealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let dispose: (() => void) | undefined;

    void Promise.all([
      import("vgpu"),
      fetch("/promise-seal.wgsl").then(async (response) => {
        if (!response.ok) throw new Error("Promise seal shader unavailable");
        return await response.text();
      }),
    ])
      .then(
        async ([
          { clock, effect, frame, frameLoop, init, surface },
          shaderSource,
        ]) => {
          if (disposed || !navigator.gpu) {
            setMode("fallback");
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
          const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          const params = {
            time: 0,
            motion: reducedMotion ? 0 : 1,
            aspect: 1,
            intensity,
          };
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
              setMode("fallback");
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
          setMode("ready");
          void gpu.gpu.lost.then(() => {
            if (!disposed) {
              setMode("fallback");
              dispose?.();
            }
          });
        },
      )
      .catch(() => setMode("fallback"));

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [intensity]);

  return (
    <div
      aria-hidden="true"
      className={`promise-seal ${className}`}
      data-webgpu={mode}
    >
      <canvas ref={canvasRef} />
      <span className="promise-seal-fallback">✦</span>
    </div>
  );
}
