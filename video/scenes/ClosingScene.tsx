import {
  Brand,
  Canvas,
  Headline,
  Kicker,
  Reveal,
  Subhead,
  palette,
} from "../design";

export const ClosingScene = () => (
  <Canvas>
    <Brand chapter="Signal Garden / All Gas" />
    <div style={{ position: "absolute", left: 76, top: 210, right: 76 }}>
      <Reveal delay={4}>
        <Kicker>Convex · OpenAI · Firecrawl · AgentMail</Kicker>
        <Headline size={120} maxWidth={1540}>
          Don’t trust the brief.{" "}
          <span style={{ color: palette.acid }}>Inspect it.</span>
        </Headline>
      </Reveal>
      <Reveal delay={26}>
        <Subhead maxWidth={1050}>
          Live now on Convex static hosting. Built as one production system—from
          private mission to public evidence garden.
        </Subhead>
      </Reveal>
    </div>
    <Reveal delay={48}>
      <div
        style={{
          position: "absolute",
          left: 76,
          bottom: 78,
          fontSize: 30,
          letterSpacing: "-0.015em",
          color: palette.paper,
        }}
      >
        resilient-salamander-937.convex.site
      </div>
    </Reveal>
  </Canvas>
);
