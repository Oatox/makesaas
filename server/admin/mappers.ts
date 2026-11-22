import type { User } from "@supabase/supabase-js";

export type AdminSessionPayload = {
  id: string;
  device: string;
  ipAddress: string | null;
  status: "active" | "expired";
  createdAt: string | null;
  expiresAt: string | null;
};

export type AdminProviderPayload = {
  id: string;
  provider: string;
  status: "connected";
  connectedAt: string | null;
  lastSignInAt: string | null;
};

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function detectBrowser(userAgent: string): string {
  if (userAgent.includes("edg")) return "Edge";
  if (userAgent.includes("opr") || userAgent.includes("opera")) return "Opera";
  if (userAgent.includes("chrome")) return "Chrome";
  if (userAgent.includes("safari")) return "Safari";
  if (userAgent.includes("firefox")) return "Firefox";
  return "Navigateur";
}

function detectOs(userAgent: string): string {
  if (userAgent.includes("mac os") || userAgent.includes("macintosh")) return "macOS";
  if (userAgent.includes("windows")) return "Windows";
  if (userAgent.includes("android")) return "Android";
  if (userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("ios")) return "iOS";
  if (userAgent.includes("linux")) return "Linux";
  return "OS inconnu";
}

function formatDeviceLabel(userAgentRaw: unknown): string {
  if (typeof userAgentRaw !== "string" || !userAgentRaw.trim()) return "Session inconnue";

  const userAgent = userAgentRaw.toLowerCase();
  return `${detectBrowser(userAgent)} sur ${detectOs(userAgent)}`;
}

export function mapSessionRow(row: Record<string, unknown>): AdminSessionPayload {
  const expiresAt = parseDate(row.not_after ?? row.expires_at);
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;

  return {
    id: String(row.id ?? ""),
    device: formatDeviceLabel(row.user_agent),
    ipAddress: typeof row.ip === "string" ? row.ip : null,
    status: isExpired ? "expired" : "active",
    createdAt: parseDate(row.created_at),
    expiresAt,
  };
}

const connectedProvider = (key: string, id = `provider-${key}`): AdminProviderPayload => ({
  id,
  provider: key,
  status: "connected",
  connectedAt: null,
  lastSignInAt: null,
});

export function mapProviders(user: User | null | undefined): AdminProviderPayload[] {
  const providers = new Map<string, AdminProviderPayload>();

  for (const identity of user?.identities ?? []) {
    if (!identity.provider) continue;

    const key = identity.provider.toLowerCase();
    providers.set(key, {
      ...connectedProvider(key, identity.id ?? `${key}-${identity.created_at ?? "unknown"}`),
      connectedAt: parseDate(identity.created_at),
      lastSignInAt: parseDate(identity.last_sign_in_at),
    });
  }

  const appProviders: unknown = user?.app_metadata?.providers;
  for (const provider of Array.isArray(appProviders) ? appProviders : []) {
    if (typeof provider !== "string") continue;
    const key = provider.toLowerCase();
    if (!providers.has(key)) providers.set(key, connectedProvider(key));
  }

  if (user?.email && !providers.has("email")) providers.set("email", connectedProvider("email"));

  return Array.from(providers.values());
}
