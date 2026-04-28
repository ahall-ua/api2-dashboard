import { NextResponse } from "next/server";
import { getValidToken, getSession, getSessionEnv } from "@/lib/session";
import { fetchMatrix } from "@/lib/fetch-matrix";
import { hasStandardVersions, hasFirmwareVersions } from "@/lib/version-utils";
import { ALL_PHASES } from "@/lib/phase-constants";

export async function GET(request: Request) {
  const token = await getValidToken();
  if (!token) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const phase = url.searchParams.get("phase");
  if (!phase || !ALL_PHASES.includes(phase)) {
    return NextResponse.json({ error: "invalid phase" }, { status: 400 });
  }

  const env = await getSessionEnv();
  const session = await getSession();
  const username = session.username;

  const [allAppRows, pluginRows] = await Promise.all([
    fetchMatrix("/apps", token, env, { includeFirmware: true, username, phases: [phase] }),
    fetchMatrix("/plugins", token, env, { username, phases: [phase] }),
  ]);

  return NextResponse.json({
    phase,
    appRows: allAppRows.filter(hasStandardVersions),
    firmwareRows: allAppRows.filter(hasFirmwareVersions),
    pluginRows,
  });
}
