import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// The app icon, generated at request time (no binary assets in the repo):
// the hero's stepped price line — up, the withdrawal dip, up to a live dot.
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
          background: "linear-gradient(180deg, #141a24 0%, #0c0f14 100%)",
        }}
      >
        <svg width="400" height="400" viewBox="0 0 100 100">
          <path
            d="M8 78 L26 78 L26 58 L44 58 L44 40 L56 40 L56 55 L70 55 L70 30 L88 30"
            fill="none"
            stroke="#34d399"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="88" cy="30" r="8" fill="#38bdf8" />
        </svg>
      </div>
    ),
    size
  );
}
