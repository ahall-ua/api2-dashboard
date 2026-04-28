import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { clearMatrixCacheForUser } from "@/lib/fetch-matrix";

export async function POST() {
  const session = await getSession();
  if (session.username) clearMatrixCacheForUser(session.username);
  session.destroy();
  return NextResponse.json({ ok: true });
}
