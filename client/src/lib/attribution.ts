import type { SignupSource } from "@shared/schema";
import { apiRequest } from "@/lib/api-client";

const STORAGE_KEY = "makesaas_signup_source";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // first-touch kept for 30 days
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

// Hosts that appear as referrer during auth redirects and must not count as a source.
const IGNORED_REFERRER_HOSTS = ["supabase.co", "accounts.google.com"];

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

function externalReferrer(): string | null {
  if (!document.referrer) return null;

  try {
    const url = new URL(document.referrer);
    if (url.host === window.location.host) return null;
    if (IGNORED_REFERRER_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      return null;
    }
    return clean(url.origin + url.pathname);
  } catch {
    return null;
  }
}

function readStored(): SignupSource | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignupSource) : null;
  } catch {
    return null;
  }
}

/**
 * Records where the visitor came from on their first visit (first-touch attribution).
 * A later visit only replaces it once the stored entry is older than 30 days.
 */
export function captureSignupSource() {
  if (typeof window === "undefined") return;

  const stored = readStored();
  const storedAt = stored?.captured_at ? new Date(stored.captured_at).getTime() : 0;
  if (stored && Date.now() - storedAt < MAX_AGE_MS) return;

  const params = new URLSearchParams(window.location.search);
  const source: SignupSource = {
    ref: clean(params.get("ref") ?? params.get("via")),
    referrer: externalReferrer(),
    landing_path: clean(window.location.pathname),
    captured_at: new Date().toISOString(),
  };

  for (const key of UTM_KEYS) {
    source[key] = clean(params.get(key));
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(source));
  } catch {
    // Storage unavailable (private mode, quota): attribution is best-effort.
  }
}

export function getSignupSource(): SignupSource | null {
  return readStored();
}

const SYNC_WINDOW_MS = 60 * 60 * 1000;

/**
 * OAuth signups (Google) never hit /api/auth/register, so the source is attached
 * right after the first sign-in. The server only writes it once, on recent accounts.
 */
export function syncSignupSource(session: { user: { id: string; created_at?: string } }) {
  const createdAt = session.user.created_at ? new Date(session.user.created_at).getTime() : 0;
  if (!createdAt || Date.now() - createdAt > SYNC_WINDOW_MS) return;

  const sentKey = `${STORAGE_KEY}_sent_${session.user.id}`;
  const source = readStored();
  if (!source) return;

  try {
    if (localStorage.getItem(sentKey)) return;
    localStorage.setItem(sentKey, "1");
  } catch {
    return;
  }

  apiRequest<void>("/api/auth/signup-source", { method: "POST", body: { signup_source: source } }).catch(() => {
    // Best-effort: missing attribution must never block the user.
  });
}
