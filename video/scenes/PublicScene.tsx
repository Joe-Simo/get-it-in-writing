import { interpolate, useCurrentFrame } from "remotion";
import {
  Brand,
  Canvas,
  Headline,
  Kicker,
  Reveal,
  Screen,
  Subhead,
} from "../design";

export const PublicScene = () => {
  const frame = useCurrentFrame();
  const swap = interpolate(frame, [170, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Canvas>
      <Brand chapter="06 / Public, without the private" />
      <Reveal>
        <div style={{ position: "absolute", left: 76, top: 170, width: 640 }}>
          <Kicker>One-click read-only garden</Kicker>
          <Headline size={86}>Share the evidence—not the workspace.</Headline>
          <Subhead maxWidth={620}>
            Team identities, email metadata, private notes, and webhook records
            are excluded server-side.
          </Subhead>
        </div>
      </Reveal>
      <div
        style={{
          position: "absolute",
          left: 770,
          right: 76,
          top: 150,
          height: 820,
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 1 - swap }}>
          <Screen
            src="mission-published.png"
            label="Published from the mission"
            objectPosition="top"
          />
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: swap }}>
          <Screen
            src="public-garden.png"
            label="Public read-only garden"
            objectPosition="top"
          />
        </div>
      </div>
    </Canvas>
  );
};
