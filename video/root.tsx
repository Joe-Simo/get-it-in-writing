import { Composition } from "remotion";
import { SignalGardenFilm } from "./SignalGardenFilm";

export const VideoRoot = () => (
  <Composition
    id="SignalGardenHackathon"
    component={SignalGardenFilm}
    durationInFrames={2430}
    fps={30}
    width={1920}
    height={1080}
  />
);
