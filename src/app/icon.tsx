import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
          fontSize: 30,
          lineHeight: 1,
          paddingBottom: 2,
        }}
      >
        pb
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
