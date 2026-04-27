import { NextRequest, NextResponse } from "next/server";
import { getValidToken, getSessionEnv } from "@/lib/session";
import { getEnvConfig } from "@/lib/api2-client";

async function proxyRequest(request: NextRequest, params: Promise<{ path: string[] }>) {
  const token = await getValidToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const env = await getSessionEnv();
  const config = getEnvConfig(env);

  const { path } = await params;
  const targetPath = path.join("/");
  const url = new URL(`/${targetPath}`, config.baseUrl);

  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const res = await fetch(url.toString(), {
    method: request.method,
    headers: {
      Authorization: token,
      "X-Api-Key": config.apiKey,
      Accept: "application/json",
      ...(request.method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
    ...(request.method !== "GET" ? { body: await request.text() } : {}),
  });

  if (res.status === 401) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 });
  }

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context.params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context.params);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context.params);
}
