import { Brand, Canvas, Headline, Kicker, Reveal, Screen } from "../design";

export const ProductScene = () => (
  <Canvas>
    <Brand chapter="02 / From question to field" />
    <div style={{ position: "absolute", left: 76, top: 180, width: 600 }}>
      <Reveal>
        <Kicker>One calm control surface</Kicker>
        <Headline size={86} maxWidth={590}>
          Frame the question. Expose the boundary.
        </Headline>
      </Reveal>
    </div>
    <Reveal delay={24} distance={70}>
      <div
        style={{
          position: "absolute",
          left: 720,
          right: 76,
          top: 150,
          height: 820,
        }}
      >
        <Screen
          src="landing.png"
          label="resilient-salamander-937.convex.site"
          objectPosition="top"
          tilt={-0.8}
        />
      </div>
    </Reveal>
  </Canvas>
);
