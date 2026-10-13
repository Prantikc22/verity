import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Branded 1200×630 social card for a content page. */
export function ogCard(eyebrow: string, title: string, accent?: string) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #050608 0%, #0d0b1f 60%, #1b1440 100%)", color: "#f7f7f3", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, letterSpacing: 10, fontWeight: 600 }}>
          <div style={{ width: 44, height: 44, background: "#7657ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, letterSpacing: 0 }}>V</div>
          VERITY
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, letterSpacing: 4, color: "#79f2a6", fontWeight: 600 }}>{eyebrow}</div>
          <div style={{ marginTop: 22, fontSize: 68, lineHeight: 1.04, fontWeight: 760, letterSpacing: -2, maxWidth: 1000 }}>{title}</div>
          {accent && <div style={{ marginTop: 10, fontSize: 68, lineHeight: 1.04, fontWeight: 760, letterSpacing: -2, color: "#a99bff", maxWidth: 1000 }}>{accent}</div>}
        </div>
        <div style={{ fontSize: 24, color: "#9b9da5" }}>verity.qashifthq.com · Free plan · Unlimited runs in your CI</div>
      </div>
    ),
    OG_SIZE,
  );
}
