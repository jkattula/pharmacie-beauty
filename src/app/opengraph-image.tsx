import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "Pharmacie Beauty — Your French pharmacy guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const interlope = await readFile(
    path.join(process.cwd(), "public/fonts/Interlope-Regular.woff")
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FDFBF5",
          color: "#1A1410",
          fontFamily: "Interlope",
          padding: 100,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            lineHeight: 0.92,
          }}
        >
          <div style={{ fontSize: 200 }}>pharmacie</div>
          <div style={{ fontSize: 200, marginLeft: 110 }}>beauty.</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Interlope",
          data: interlope,
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
}
