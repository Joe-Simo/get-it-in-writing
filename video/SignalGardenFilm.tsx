import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { BoundaryScene } from "./scenes/BoundaryScene";
import { ClosingScene } from "./scenes/ClosingScene";
import { EvidenceScene } from "./scenes/EvidenceScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { ProductScene } from "./scenes/ProductScene";
import { PublicScene } from "./scenes/PublicScene";
import { WorkflowScene } from "./scenes/WorkflowScene";

const transition = linearTiming({ durationInFrames: 15 });

export const SignalGardenFilm = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={210}>
      <OpeningScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={transition} />
    <TransitionSeries.Sequence durationInFrames={360}>
      <ProductScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={slide({ direction: "from-right" })}
      timing={transition}
    />
    <TransitionSeries.Sequence durationInFrames={330}>
      <BoundaryScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={transition} />
    <TransitionSeries.Sequence durationInFrames={480}>
      <WorkflowScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={slide({ direction: "from-bottom" })}
      timing={transition}
    />
    <TransitionSeries.Sequence durationInFrames={480}>
      <EvidenceScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={transition} />
    <TransitionSeries.Sequence durationInFrames={390}>
      <PublicScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={transition} />
    <TransitionSeries.Sequence durationInFrames={270}>
      <ClosingScene />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
