import { interpolate, useCurrentFrame } from "remotion";
import {
  Brand,
  Canvas,
  Headline,
  Kicker,
  Reveal,
  Subhead,
  palette,
} from "../design";

export const OpeningScene = () => {
  const frame = useCurrentFrame();
  const line = interpolate(frame, [20, 150], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Canvas>
      <Brand chapter="01 / A research instrument" />
      <div style={{ position: "absolute", left: 76, right: 76, top: 245 }}>
        <Reveal delay={5}>
          <Kicker>Convex All Gas Hackathon</Kicker>
          <Headline size={128} maxWidth={1500}>
            Research you can <span style={{ color: palette.acid }}>see.</span>
          </Headline>
        </Reveal>
        <Reveal delay={28}>
          <Subhead maxWidth={1040}>
            Signal Garden turns bounded web research into a live, inspectable
            evidence field—before a brief earns the word ready.
          </Subhead>
        </Reveal>
      </div>
      <div
        style={{
          position: "absolute",
          left: 76,
          bottom: 75,
          width: `${line}%`,
          maxWidth: 1768,
          height: 1,
          background: `linear-gradient(90deg, ${palette.acid}, transparent)`,
        }}
      />
    </Canvas>
  );
};
