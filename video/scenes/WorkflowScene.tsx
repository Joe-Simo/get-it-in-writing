import { interpolate, useCurrentFrame } from "remotion";
import {
  Brand,
  Canvas,
  Headline,
  Kicker,
  Metric,
  Reveal,
  Screen,
  palette,
} from "../design";

export const WorkflowScene = () => {
  const frame = useCurrentFrame();
  const swap = interpolate(frame, [210, 250], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Canvas>
      <Brand chapter="04 / Live orchestration" />
      <div style={{ position: "absolute", left: 76, top: 160, width: 610 }}>
        <Reveal>
          <Kicker>Convex is the system of record</Kicker>
          <Headline size={82}>Every provider state arrives live.</Headline>
        </Reveal>
        <Reveal delay={24}>
          <div style={{ display: "flex", gap: 28, marginTop: 58 }}>
            <Metric value="3/3" label="providers ready" />
            <Metric value="Live" label="reactive mission state" />
          </div>
        </Reveal>
        <div
          style={{
            marginTop: 56,
            fontSize: 28,
            lineHeight: 1.35,
            color: palette.muted,
          }}
        >
          Firecrawl acquires bounded sources. OpenAI extracts supported claims.
          AgentMail keeps verified replies behind human review.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 760,
          right: 76,
          top: 150,
          height: 820,
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 1 - swap }}>
          <Screen
            src="workspace-ready.png"
            label="Deployment readiness"
            objectPosition="top"
          />
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: swap }}>
          <Screen
            src="mission-ready.png"
            label="Realtime mission completion"
            objectPosition="top"
          />
        </div>
      </div>
    </Canvas>
  );
};
