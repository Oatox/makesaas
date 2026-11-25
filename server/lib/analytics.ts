import type { AnalyticsEvent } from "@shared/analytics";
import { logger } from "./logger";

// The Amplitude project is in the EU data region (`serverZone` in client/src/lib/analytics.ts): events
// go in through the HTTP V2 API, and the admin reads them back through the Dashboard REST API
// (server/admin/onboarding.ts). A US project: https://api2.amplitude.com/2/httpapi and https://amplitude.com/api/2.
const AMPLITUDE_URL = "https://api.eu.amplitude.com/2/httpapi";
export const AMPLITUDE_QUERY_URL = "https://analytics.eu.amplitude.com/api/2";
const TIMEOUT_MS = 5_000;

/**
 * Sends a product event that only the server sees (the payment, from the Whop webhook) to the same
 * Amplitude project as the browser, on the member's Supabase id, which the browser sets once signed in.
 * Uses the public project key VITE_AMPLITUDE_API_KEY; without it nothing is sent. Never throws:
 * analytics never fail the work around them. `insertId` makes a retried call count once.
 */
export async function trackServerEvent(userId: string, event: AnalyticsEvent, insertId: string, properties?: Record<string, unknown>) {
  const apiKey = process.env.VITE_AMPLITUDE_API_KEY;
  if (!apiKey) return;

  try {
    const res = await fetch(AMPLITUDE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        events: [{ user_id: userId, event_type: event, insert_id: insertId, time: Date.now(), event_properties: properties }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) logger.warn({ status: res.status, event }, "Amplitude rejected a server event");
  } catch (err) {
    logger.warn({ err, event }, "Failed to send a server event to Amplitude");
  }
}
