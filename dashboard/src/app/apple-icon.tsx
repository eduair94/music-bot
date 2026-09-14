import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BARS = [12, 24, 32, 20, 8];

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 10,
          padding: "0 0 58px",
          backgroundColor: "#1d1916",
        }}
      >
        {BARS.map((h, i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: h * 3.4,
              borderRadius: 7,
              backgroundColor: i === 2 ? "#ffc24d" : "#f8aa2a",
            }}
          />
        ))}
      </div>
    ),
    size
  );
}
