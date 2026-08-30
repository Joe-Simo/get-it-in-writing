import {
  Brand,
  Canvas,
  Headline,
  Kicker,
  Metric,
  Reveal,
  Screen,
  Subhead,
} from "../design";

export const EvidenceScene = () => (
  <Canvas>
    <Brand chapter="05 / Evidence earns readiness" />
    <Reveal delay={4}>
      <div style={{ position: "absolute", left: 76, top: 160, width: 680 }}>
        <Kicker>Real production run</Kicker>
        <Headline size={88}>21 claims. Two sources. One cited brief.</Headline>
        <Subhead maxWidth={650}>
          Quotes stay attached to sources. Disputes and unknowns remain visible.
          The brief is synthesized only after every seed reaches a terminal
          state.
        </Subhead>
        <div style={{ display: "flex", gap: 30, marginTop: 54 }}>
          <Metric value="21" label="inspectable claims" />
          <Metric value="Ready" label="cited brief" />
        </div>
      </div>
    </Reveal>
    <Reveal delay={28} distance={70}>
      <div
        style={{
          position: "absolute",
          left: 820,
          right: 76,
          top: 150,
          height: 820,
        }}
      >
        <Screen
          src="mission-ready.png"
          label="Production evidence field"
          objectPosition="top"
          tilt={-0.5}
        />
      </div>
    </Reveal>
  </Canvas>
);
