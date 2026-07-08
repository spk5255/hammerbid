import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iPhone home-screen icon (Safari → Share → Add to Home Screen).
export default function AppleIcon() {
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
        <svg width="140" height="140" viewBox="0 0 100 100">
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
