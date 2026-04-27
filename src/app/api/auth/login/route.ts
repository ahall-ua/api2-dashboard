import { NextResponse } from "next/server";
import { api2Login, type Api2Env } from "@/lib/api2-client";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const { username, password, env = "prod" } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const api2Env: Api2Env = env === "stage" ? "stage" : "prod";

  try {
    const result = await api2Login(username, password, api2Env);
    const session = await getSession();
    session.token = result.auth_token;
    session.expiresAt = Date.now() + 55 * 60 * 1000;
    session.username = username;
    session.password = password;
    session.env = api2Env;
    await session.save();

    return NextResponse.json({ ok: true, username, env: api2Env });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    const status = (err as { status?: number }).status || 500;
    return NextResponse.json({ error: message }, { status: status === 401 ? 401 : 500 });
  }
}
