import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Bypass — Studio-Grade Discord Music Bot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BARS = [28, 52, 84, 44, 20];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0c0a09",
          backgroundImage: "radial-gradient(#2b2520 2px, transparent 2px)",
          backgroundSize: "56px 56px",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              height: 84,
              padding: "18px 22px",
              backgroundColor: "#1d1916",
              border: "2px solid #3d342c",
              borderRadius: 20,
            }}
          >
            {BARS.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: h * 0.55,
                  borderRadius: 5,
                  backgroundColor: i === 2 ? "#ffc24d" : "#f8aa2a",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, color: "#f4efe9" }}>Bypass</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 96, fontWeight: 800, color: "#f4efe9", lineHeight: 1.02 }}>
            Sound that
          </div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 1.02 }}>
            <span style={{ color: "#f4efe9" }}>fills the&nbsp;</span>
            <span style={{ color: "#f8aa2a" }}>room.</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "2px solid #2b2520",
            paddingTop: 32,
          }}
        >
          <div style={{ fontSize: 28, color: "#a89d90" }}>
            Studio-grade Discord music bot · 320kbps · Web dashboard
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#0c0a09",
              backgroundColor: "#f8aa2a",
              padding: "10px 24px",
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            FREE
          </div>
        </div>
      </div>
    ),
    size
  );
}
