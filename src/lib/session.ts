import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { api2Login, type Api2Env } from "./api2-client";

export interface SessionData {
  token?: string;
  expiresAt?: number;
  username?: string;
  password?: string;
  env?: Api2Env;
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "fallback-secret-must-be-at-least-32-chars-long!!",
  cookieName: "api2-dashboard-session",
  cookieOptions: {
    secure: process.env.COOKIE_SECURE === "true",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getValidToken(): Promise<string | null> {
  const session = await getSession();

  if (!session.username || !session.password) return null;

  if (session.token && session.expiresAt && Date.now() < session.expiresAt - 60_000) {
    return session.token;
  }

  try {
    const result = await api2Login(session.username, session.password, session.env || "prod");
    session.token = result.auth_token;
    session.expiresAt = Date.now() + 55 * 60 * 1000;
    await session.save();
    return session.token;
  } catch {
    session.destroy();
    return null;
  }
}

/**
 * Read-only token access — returns current token without attempting refresh.
 * Safe to use in server components (no cookie writes).
 */
export async function getReadOnlyToken(): Promise<string | null> {
  const session = await getSession();
  if (!session.token) return null;
  return session.token;
}

export async function getSessionEnv(): Promise<Api2Env> {
  const session = await getSession();
  return session.env || "prod";
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  if (!session.token || !session.username) return false;
  return true;
}
