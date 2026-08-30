import {
  Brand,
  Canvas,
  Headline,
  Kicker,
  Reveal,
  Screen,
  Subhead,
} from "../design";

export const BoundaryScene = () => (
  <Canvas>
    <Brand chapter="03 / Bounded by design" />
    <Reveal delay={8}>
      <div style={{ position: "absolute", left: 76, top: 160, width: 690 }}>
        <Kicker>Inspectable before launch</Kicker>
        <Headline size={86}>
          Budget, depth, and trusted seeds are explicit.
        </Headline>
        <Subhead maxWidth={640}>
          No hidden expansion. External links and subdomains stay off unless the
          operator changes the boundary.
        </Subhead>
      </div>
    </Reveal>
    <Reveal delay={28} distance={80}>
      <div
        style={{
          position: "absolute",
          left: 830,
          right: 76,
          top: 150,
          height: 820,
        }}
      >
        <Screen
          src="mission-boundary.png"
          label="Mission boundary"
          objectPosition="center"
          tilt={0.7}
        />
      </div>
    </Reveal>
  </Canvas>
);
