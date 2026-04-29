import { NextResponse } from "next/server";
import { getValidToken } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const token = await getValidToken();

  if (!token) {
    if (next) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (next && next.startsWith("/")) {
    return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.json({ ok: true });
}
