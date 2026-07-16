import { ImageResponse } from "next/og";

// Satori (the renderer behind ImageResponse) does not parse the oklch()
// CSS function, so brand colors are hardcoded here as their sRGB hex
// equivalents rather than referencing the oklch() tokens in globals.css:
//   #1a160b = --color-tinta       (oklch(20% 0.02 90))
//   #2d8949 = --color-musgo       (oklch(56% 0.13 150))
//   #fcf8f3 = --color-crema-claro (oklch(98% 0.008 75))

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "#1a160b",
        }}
      >
        <svg width="90" height="90" viewBox="0 0 54 54">
          <circle cx="27" cy="16" r="5" fill="#2d8949" />
          <circle cx="16" cy="26" r="5" fill="#2d8949" opacity={0.75} />
          <circle cx="38" cy="26" r="5" fill="#2d8949" opacity={0.75} />
          <circle cx="27" cy="36" r="5" fill="#2d8949" opacity={0.5} />
          <circle cx="27" cy="26" r="3" fill="#fcf8f3" />
        </svg>
        <div style={{ fontSize: 64, color: "#fcf8f3", fontWeight: 600 }}>
          Bichongos
        </div>
      </div>
    ),
    size
  );
}
