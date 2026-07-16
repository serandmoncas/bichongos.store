import { ImageResponse } from "next/og";

// Satori (the renderer behind ImageResponse) does not parse the oklch()
// CSS function, so brand colors are hardcoded here as their sRGB hex
// equivalents rather than referencing the oklch() tokens in globals.css:
//   #faf0e3 = --color-crema      (oklch(96% 0.02 75))
//   #1a160b = --color-tinta      (oklch(20% 0.02 90))
//   #2d8949 = --color-musgo      (oklch(56% 0.13 150))

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf0e3" /* --color-crema: oklch(96% 0.02 75) */,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 54 54">
          <circle cx="27" cy="16" r="5" fill="#1a160b" />
          <circle cx="16" cy="26" r="5" fill="#1a160b" />
          <circle cx="38" cy="26" r="5" fill="#1a160b" />
          <circle cx="27" cy="36" r="5" fill="#1a160b" />
          <circle cx="27" cy="26" r="3" fill="#2d8949" />
        </svg>
      </div>
    ),
    size
  );
}
