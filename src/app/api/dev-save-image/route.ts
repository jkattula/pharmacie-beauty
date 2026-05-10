// Dev-only endpoint: accepts {filename, base64} and writes to public/images/products/
// Used to bring AI-generated product images from a browser tab into the catalog.
// Disabled in production via NODE_ENV check.
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public/images/products");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 403, headers: corsHeaders });
  }
  try {
    const { filename, base64 } = await req.json();
    if (!filename || !base64) {
      return NextResponse.json({ error: "missing fields" }, { status: 400, headers: corsHeaders });
    }
    // Filename safety: must end in .png and contain only safe chars
    const safe = String(filename).replace(/[^a-z0-9_.-]/gi, "_");
    if (!safe.endsWith(".png")) {
      return NextResponse.json({ error: "must be .png" }, { status: 400, headers: corsHeaders });
    }
    const b64 = String(base64).replace(/^data:image\/[^;]+;base64,/, "");
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 5_000) {
      return NextResponse.json({ error: "image too small" }, { status: 400, headers: corsHeaders });
    }
    const outPath = path.join(PUBLIC_DIR, safe);
    await fs.writeFile(outPath, buf);
    return NextResponse.json(
      { ok: true, filename: safe, bytes: buf.length },
      { headers: corsHeaders }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}
