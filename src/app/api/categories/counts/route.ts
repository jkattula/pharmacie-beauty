import { NextResponse } from "next/server";
import { getCategoryCounts } from "@/lib/db-queries";

export async function GET() {
  try {
    const counts = await getCategoryCounts();
    return NextResponse.json(counts);
  } catch (error) {
    console.error("Error fetching category counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch category counts" },
      { status: 500 }
    );
  }
}

// Cache this endpoint for 10 minutes
export const revalidate = 600;
