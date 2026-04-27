import { NextResponse } from "next/server";
import { getValidToken } from "@/lib/session";

export async function GET() {
  const token = await getValidToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
