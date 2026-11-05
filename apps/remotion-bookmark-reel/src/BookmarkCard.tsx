import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type BookmarkProps = { title: string; handle: string; text: string; accent: string };

export const BookmarkCard = ({ title, handle, text, accent }: BookmarkProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const fade = (start: number) => interpolate(frame, [start, start + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progress = frame / (durationInFrames - 1);
  return (
    <AbsoluteFill style={{ background: "#0a0a0a", justifyContent: "center", alignItems: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ width: 860, padding: 64, borderRadius: 32, background: "#fafafa", color: "#0a0a0a", transform: `translateY(${(1 - enter) * 200}px) scale(${0.9 + enter * 0.1})`, opacity: enter, boxShadow: `0 30px 80px ${accent}55` }}>
        <div style={{ fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: accent, opacity: fade(10) }}>Bookmark of the day</div>
        <div style={{ fontSize: 96, fontWeight: 800, marginTop: 16, opacity: fade(20) }}>{title}</div>
        <div style={{ fontSize: 36, color: "#525252", marginTop: 8, opacity: fade(30) }}>{handle}</div>
        <div style={{ fontSize: 40, lineHeight: 1.4, marginTop: 40, opacity: fade(45) }}>{text}</div>
        <div style={{ height: 12, borderRadius: 6, background: "#e5e5e5", marginTop: 56, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress * 100}%`, background: accent }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
