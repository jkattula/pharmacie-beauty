import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/db-queries";

// Product IDs are Postgres UUIDs. AI-suggested cards use synthetic ids like
// "ai-<timestamp>-<idx>" which are not real products — guard against them so a
// non-UUID id returns a clean 404 instead of throwing a DB cast error (500).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const product = await getProductById(id);

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
