import { supabase } from "@/lib/supabase";
import { AUTH_CONFIG } from "@/config/auth";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Machine-readable reason sent by some routes (e.g. QUOTA_EXHAUSTED, SUBSCRIPTION_REQUIRED). */
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number>;
  body?: unknown;
  signal?: AbortSignal;
};

const SESSION_EXPIRED = "Session expirée. Veuillez vous reconnecter.";

/** Current Supabase access token, for calls that cannot go through apiRequest (e.g. streamed responses). */
export async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new ApiError(401, SESSION_EXPIRED);
  return session.access_token;
}

/**
 * Calls the Express API with the current Supabase access token.
 * Throws ApiError with the server's (French) message so the UI can show it as is.
 */
export async function apiRequest<T>(path: string, { method = "GET", query, body, signal }: ApiRequestOptions = {}): Promise<T> {
  const accessToken = await getAccessToken();
  const url = query ? `${path}?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}` : path;

  const response = await fetch(url, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace(AUTH_CONFIG.LOGIN_PATH);
    throw new ApiError(401, SESSION_EXPIRED);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = typeof payload?.message === "string" ? payload.message : "Une erreur est survenue, réessayez.";
    throw new ApiError(response.status, message, typeof payload?.code === "string" ? payload.code : undefined);
  }

  return (response.status === 204 ? undefined : await response.json()) as T;
}
