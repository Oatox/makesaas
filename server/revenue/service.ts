import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALREADY_CONNECTED_MESSAGE,
  REVENUE_CONNECTION_COLUMNS,
  REVENUE_PROVIDER_NAMES,
  type ConnectRevenueBody,
  type RevenueConnection,
  type RevenueDashboard,
  type RevenueSnapshot,
} from "@shared/revenue";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { getExchangeRates } from "./exchange-rates";
import { buildOverview, buildSnapshot, currenciesOf, seriesStartFor, type RevenueData, type SnapshotSource } from "./metrics";
import { createRevenueSource, ProviderError, type RevenueSource } from "./providers";
import type { SecretBox } from "./secret-box";

/** An account synced longer ago is re-synced in the background when the dashboard is opened. */
const STALE_AFTER_MS = 30 * 60 * 1000;
/** "Actualiser" skips the accounts synced (or tried) within this delay. */
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
const SNAPSHOT_VERSION = 1;

const TABLE = "revenue_connections";
const SERVER_COLUMNS = `${REVENUE_CONNECTION_COLUMNS}, account_id, encrypted_key, snapshot, sync_attempted_at`;

type ConnectionRow = RevenueConnection & {
  account_id: string | null;
  encrypted_key: string;
  snapshot: RevenueSnapshot | null;
  sync_attempted_at: string | null;
};

const toPublic = ({ id, provider, account_name, livemode, key_hint, last_synced_at, last_error, created_at }: ConnectionRow): RevenueConnection => ({
  id,
  provider,
  account_name,
  livemode,
  key_hint,
  last_synced_at,
  last_error,
  created_at,
});

const hasCurrentSnapshot = (row: ConnectionRow) => row.snapshot?.version === SNAPSHOT_VERSION;

/** Revenue of the members' own businesses: connected accounts, their syncs and the combined dashboard. */
export class RevenueService {
  /** Syncs running, by connection id: a second request joins the running one. */
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly db: SupabaseClient,
    private readonly box: SecretBox,
  ) {}

  /** Throws a 404 unless the SaaS belongs to the user. */
  private async assertOwnedSaas(userId: string, saasId: string) {
    const { data, error } = await this.db.from("saas").select("id").eq("id", saasId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "SaaS introuvable.");
  }

  /** The SaaS's connections; checks first that the SaaS is the user's. */
  private async rows(userId: string, saasId: string): Promise<ConnectionRow[]> {
    await this.assertOwnedSaas(userId, saasId);
    const { data, error } = await this.db
      .from(TABLE)
      .select(SERVER_COLUMNS)
      .eq("user_id", userId)
      .eq("saas_id", saasId)
      .order("created_at");
    if (error) throw error;
    return data as ConnectionRow[];
  }

  private isStale(row: ConnectionRow, now: number, after = STALE_AFTER_MS) {
    if (!hasCurrentSnapshot(row) && !row.last_error) return true;
    return !row.sync_attempted_at || now - Date.parse(row.sync_attempted_at) > after;
  }

  /** The SaaS's dashboard as stored; stale accounts start syncing in the background (listed in `syncing`). */
  async getDashboard(userId: string, saasId: string): Promise<RevenueDashboard> {
    const rows = await this.rows(userId, saasId);
    const now = Date.now();
    for (const row of rows) {
      if (this.isStale(row, now)) void this.sync(row);
    }
    return this.toDashboard(rows);
  }

  /** Re-syncs every account of the SaaS now (except those synced in the last minute), then answers its dashboard. */
  async refresh(userId: string, saasId: string): Promise<RevenueDashboard> {
    const now = Date.now();
    const rows = await this.rows(userId, saasId);
    await Promise.all(
      rows.map((row) => this.inFlight.get(row.id) ?? (this.isStale(row, now, MIN_REFRESH_INTERVAL_MS) ? this.sync(row) : null)),
    );
    return this.toDashboard(await this.rows(userId, saasId));
  }

  /** Checks the key, imports the account into the SaaS and stores it (a reconnected account gets its new key). */
  async connect(userId: string, { saasId, provider, apiKey }: ConnectRevenueBody): Promise<RevenueConnection> {
    const existing = await this.rows(userId, saasId);
    const source = createRevenueSource(provider, apiKey);

    const account = await this.callProvider(() => source.account());
    // One payment account per SaaS: once connected, only that same account can be reconnected (to
    // change its key). Refused before the import when the key already names another account.
    const connectedRow = (id: string | null) =>
      id ? existing.find((row) => row.provider === provider && row.account_id === id && row.livemode === account.livemode) : undefined;
    if (existing.length > 0 && account.accountId && !connectedRow(account.accountId)) {
      throw new HttpError(409, ALREADY_CONNECTED_MESSAGE);
    }

    const { snapshot, seller } = await this.callProvider(() => this.importSnapshot(source));
    // A key that cannot read its account: the imported data may name it.
    const accountId = account.accountId ?? seller?.id ?? null;
    const accountName = account.accountName ?? seller?.name ?? null;

    const match = connectedRow(accountId);
    if (!match && existing.length > 0) throw new HttpError(409, ALREADY_CONNECTED_MESSAGE);

    const values = {
      provider,
      account_id: accountId,
      account_name: accountName,
      livemode: account.livemode,
      key_hint: apiKey.slice(-4),
      encrypted_key: this.box.seal(apiKey),
      snapshot,
      last_synced_at: snapshot.syncedAt,
      sync_attempted_at: snapshot.syncedAt,
      last_error: null,
    };

    const query = match
      ? this.db.from(TABLE).update(values).eq("id", match.id).eq("user_id", userId)
      : this.db.from(TABLE).insert({ user_id: userId, saas_id: saasId, ...values });
    const { data, error } = await query.select(SERVER_COLUMNS).single();
    // Another account was connected to the SaaS in the meantime (revenue_connections_saas_key).
    if (error?.code === "23505") throw new HttpError(409, ALREADY_CONNECTED_MESSAGE);
    // The SaaS was deleted during the import (composite foreign key).
    if (error?.code === "23503") throw new HttpError(404, "SaaS introuvable.");
    if (error) throw error;
    return toPublic(data as ConnectionRow);
  }

  /** Provider errors become messages for the member: a wrong key or permission is theirs to fix (400). */
  private async callProvider<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (err) {
      if (err instanceof ProviderError) throw new HttpError(err.kind === "unavailable" ? 502 : 400, err.message);
      throw err;
    }
  }

  private async importSnapshot(source: RevenueSource): Promise<{ snapshot: RevenueSnapshot; seller: RevenueData["account"] }> {
    const now = Date.now();
    const data = await source.fetch(seriesStartFor(now), now);
    return { snapshot: buildSnapshot(data, now), seller: data.account };
  }

  private sync(row: ConnectionRow): Promise<void> {
    const running = this.inFlight.get(row.id);
    if (running) return running;
    const run = this.runSync(row)
      .catch((err) => logger.error({ err, connectionId: row.id }, "Revenue sync crashed"))
      .finally(() => this.inFlight.delete(row.id));
    this.inFlight.set(row.id, run);
    return run;
  }

  /** Never throws: a failure is stored on the row (last_error) and the previous snapshot is kept. */
  private async runSync(row: ConnectionRow): Promise<void> {
    const attemptedAt = new Date().toISOString();
    let update: Record<string, unknown>;

    try {
      let apiKey: string;
      try {
        apiKey = this.box.open(row.encrypted_key);
      } catch {
        throw new ProviderError("invalid_key", "La clé enregistrée ne peut plus être lue : reconnecte ce compte.");
      }
      const { snapshot, seller } = await this.importSnapshot(createRevenueSource(row.provider, apiKey, row.livemode));
      update = { snapshot, last_synced_at: snapshot.syncedAt, last_error: null, sync_attempted_at: attemptedAt };
      // Named once the account has data (connected before its first sale).
      if (!row.account_name && seller?.name) update.account_name = seller.name;
    } catch (err) {
      if (!(err instanceof ProviderError)) logger.error({ err, connectionId: row.id }, "Revenue sync failed");
      const message = err instanceof ProviderError ? err.message : "La synchronisation a échoué, réessaie dans un instant.";
      update = { last_error: message, sync_attempted_at: attemptedAt };
    }

    const { error } = await this.db.from(TABLE).update(update).eq("id", row.id);
    // The connection may have been removed meanwhile: nothing to update then, nothing to report.
    if (error) logger.error({ err: error, connectionId: row.id }, "Failed to store a revenue sync");
  }

  private async toDashboard(rows: ConnectionRow[]): Promise<RevenueDashboard> {
    const sources: SnapshotSource[] = rows.filter(hasCurrentSnapshot).map((row) => ({
      connectionId: row.id,
      provider: row.provider,
      label: row.account_name ?? REVENUE_PROVIDER_NAMES[row.provider],
      snapshot: row.snapshot!,
    }));
    // Rates are only needed to add up several currencies.
    const rates = currenciesOf(sources).size > 1 ? await getExchangeRates() : null;

    return {
      connections: rows.map(toPublic),
      overview: buildOverview(sources, rates),
      syncing: rows.filter((row) => this.inFlight.has(row.id)).map((row) => row.id),
    };
  }
}
