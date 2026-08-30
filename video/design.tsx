import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const palette = {
  ink: "#07100c",
  paper: "#f3f5ed",
  acid: "#c9ff52",
  sage: "#8aac78",
  coral: "#ff7766",
  blue: "#9ab0ff",
  line: "rgba(229, 244, 216, 0.18)",
  muted: "rgba(229, 244, 216, 0.67)",
};

const sans: CSSProperties = {
  fontFamily:
    '"Instrument Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
};

const serif: CSSProperties = {
  fontFamily: '"Newsreader", Georgia, serif',
};

export const Canvas = ({ children }: { children: ReactNode }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 450], [0, 70], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        ...sans,
        color: palette.paper,
        background:
          "radial-gradient(circle at 72% 10%, rgba(201,255,82,.13), transparent 30%), radial-gradient(circle at 4% 84%, rgba(154,176,255,.12), transparent 28%), #07100c",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -140,
          opacity: 0.28,
          transform: `translate3d(${drift}px, ${-drift * 0.35}px, 0)`,
          backgroundImage:
            "linear-gradient(rgba(229,244,216,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(229,244,216,.055) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(circle at center, black 10%, transparent 74%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          right: -220 + drift * 0.8,
          top: -310 + drift * 0.3,
          borderRadius: "50%",
          border: `1px solid ${palette.line}`,
          boxShadow: "0 0 160px rgba(201,255,82,.08)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const Brand = ({ chapter }: { chapter: string }) => (
  <div
    style={{
      position: "absolute",
      top: 62,
      left: 76,
      right: 76,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: 20,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: palette.muted,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span
        style={{
          display: "inline-block",
          width: 15,
          height: 15,
          borderRadius: "50%",
          background: palette.acid,
          boxShadow: "0 0 22px rgba(201,255,82,.72)",
        }}
      />
      Signal Garden
    </div>
    <span>{chapter}</span>
  </div>
);

export const Kicker = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      fontSize: 22,
      lineHeight: 1,
      letterSpacing: "0.13em",
      textTransform: "uppercase",
      color: palette.acid,
      marginBottom: 30,
    }}
  >
    {children}
  </div>
);

export const Headline = ({
  children,
  size = 94,
  maxWidth = 1180,
}: {
  children: ReactNode;
  size?: number;
  maxWidth?: number;
}) => (
  <h1
    style={{
      ...serif,
      fontSize: size,
      fontWeight: 430,
      letterSpacing: "-0.045em",
      lineHeight: 0.96,
      maxWidth,
      margin: 0,
    }}
  >
    {children}
  </h1>
);

export const Subhead = ({
  children,
  maxWidth = 850,
}: {
  children: ReactNode;
  maxWidth?: number;
}) => (
  <p
    style={{
      fontSize: 36,
      lineHeight: 1.2,
      letterSpacing: "-0.025em",
      maxWidth,
      color: palette.muted,
      margin: "34px 0 0",
    }}
  >
    {children}
  </p>
);

export const Reveal = ({
  children,
  delay = 0,
  distance = 44,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.9 },
  });
  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * distance}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const Screen = ({
  src,
  label,
  objectPosition = "center",
  tilt = 0,
}: {
  src: string;
  label: string;
  objectPosition?: string;
  tilt?: number;
}) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 360], [1.035, 1.0], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        background: "#0b1510",
        border: `1px solid ${palette.line}`,
        borderRadius: 26,
        overflow: "hidden",
        boxShadow: "0 44px 120px rgba(0,0,0,.48)",
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <div
        style={{
          height: 46,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 18px",
          borderBottom: `1px solid ${palette.line}`,
          color: palette.muted,
          fontSize: 17,
          letterSpacing: "0.02em",
        }}
      >
        {[palette.coral, palette.acid, palette.blue].map((color) => (
          <span
            key={color}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: color,
            }}
          />
        ))}
        <span style={{ marginLeft: 8 }}>{label}</span>
      </div>
      <div style={{ height: "calc(100% - 46px)", overflow: "hidden" }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition,
            transform: `scale(${zoom})`,
          }}
        />
      </div>
    </div>
  );
};

export const Metric = ({ value, label }: { value: string; label: string }) => (
  <div
    style={{
      borderTop: `1px solid ${palette.line}`,
      paddingTop: 20,
      minWidth: 190,
    }}
  >
    <div style={{ ...serif, fontSize: 58, lineHeight: 1, color: palette.acid }}>
      {value}
    </div>
    <div style={{ fontSize: 19, color: palette.muted, marginTop: 9 }}>
      {label}
    </div>
  </div>
);
