import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  Info,
  Loader2,
  Repeat,
  RefreshCw,
  ShoppingBag,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import {
  type PaymentKind,
  type RevenueConnection,
  type RevenueOverview,
  type RevenueProvider,
} from "@shared/revenue";
import type { Saas } from "@shared/saas";
import { ErrorState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRefreshRevenue, useRevenueDashboard } from "@/hooks/use-revenue";
import { useSaas } from "@/hooks/use-saas";
import { NoSaasState } from "@/components/saas/NoSaasState";
import { blurIn } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ConnectDialog } from "./ConnectDialog";
import { ConnectFirst } from "./ConnectFirst";
import { KpiCards } from "./KpiCards";
import { PROVIDERS } from "./providers";
import { bucketPoints, formatMoney, PERIODS, periodOf, periodStats, type PeriodKey } from "./stats";
import { chartHasMrr, RevenueChart, RevenueChartLegend } from "./TrendChart";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

const timeAgo = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: fr });

const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  new_subscription: "Nouvel abonnement",
  renewal: "Renouvellement",
  subscription: "Abonnement",
  one_time: "Paiement unique",
};

const connectionName = (connection: RevenueConnection) => connection.account_name ?? PROVIDERS[connection.provider].name;

// ---------------------------------------------------------------------------------------------
// Figures

function Overview({ overview, period }: { overview: RevenueOverview; period: PeriodKey }) {
  const { days, since } = periodOf(period);
  const stats = periodStats(overview, days);
  const money = (value: number) => formatMoney(value, overview.currency);
  const axisMoney = (value: number) => formatMoney(value, overview.currency, { compact: value >= 10_000 });

  // Same buckets for both series: revenue adds up over a bucket, the MRR is read at its last day.
  const revenueBuckets = bucketPoints(overview, overview.revenue, days, true);
  const mrrBuckets = bucketPoints(overview, overview.mrr, days, false);
  const chartPoints = revenueBuckets.map((bucket, index) => ({
    label: bucket.label,
    title: bucket.title,
    revenue: bucket.value,
    mrr: mrrBuckets[index]?.value ?? 0,
  }));
  const step = days <= 31 ? "par jour" : days <= 120 ? "par semaine" : "par mois";

  return (
    <>
      {/* The period's key figures first (the MRR among them), then their evolution. */}
      <KpiCards overview={overview} stats={stats} days={days} since={since} />

      <motion.section variants={fadeIn} className="card-3d space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="font-medium">MRR et encaissements</h2>
          <RevenueChartLegend step={step} twoAxes={chartHasMrr(chartPoints)} />
        </div>
        <RevenueChart points={chartPoints} formatValue={money} formatAxis={axisMoney} step={step} />
      </motion.section>

      <RecentPayments overview={overview} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Payments and accounts

function PaymentKindIcon({ kind }: { kind: PaymentKind | null }) {
  const Icon = kind ? PAYMENT_KIND_ICONS[kind] : CreditCard;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-white/[0.06] bg-secondary",
        kind === "new_subscription" ? "text-success" : "text-foreground/70",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

/** What a payment was for, as an icon (the provider's logo would repeat on every row). */
const PAYMENT_KIND_ICONS: Record<PaymentKind, LucideIcon> = {
  new_subscription: UserPlus,
  renewal: Repeat,
  subscription: Repeat,
  one_time: ShoppingBag,
};

function RecentPayments({ overview }: { overview: RevenueOverview }) {
  return (
    <motion.section variants={fadeIn} className="card-3d p-4 sm:p-6">
      <h2 className="mb-3 font-medium">Derniers paiements</h2>
      {overview.recentPayments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucun paiement sur les 12 derniers mois.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {overview.recentPayments.map((payment, index) => (
            <li key={`${payment.connectionId}-${payment.date}-${index}`} className="flex items-center gap-3 py-2.5">
              <PaymentKindIcon kind={payment.kind} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{payment.kind ? PAYMENT_KIND_LABELS[payment.kind] : "Paiement"}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(payment.date)}</p>
              </div>
              {/* Money in: the green of the revenue curve. */}
              <p className="text-sm font-semibold tabular-nums text-success">+{formatMoney(payment.amount, payment.currency)}</p>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

// ---------------------------------------------------------------------------------------------
// Page states

/** No SaaS yet: the revenue is followed per SaaS, created from the sidebar or right here. */
function CreateSaasFirst() {
  return (
    <NoSaasState
      title="Ajoute ton premier SaaS"
      description="Tes revenus se suivent SaaS par SaaS. Crée le tien, puis connecte Stripe ou Whop pour voir son MRR."
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement des revenus">
      <Skeleton className="h-9 w-48 rounded-[10px]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[168px] rounded-[18px]" />
        ))}
      </div>
      <Skeleton className="h-[380px] rounded-[18px]" />
    </div>
  );
}

/** The page heading above a dashboard state that has no filter row to share it with. */
function WithHeading({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-4 sm:space-y-5">
      {heading}
      {children}
    </div>
  );
}

/**
 * Revenue of the active SaaS: MRR, revenue, subscribers and churn from its connected payment accounts.
 * `heading` (the page's greeting) shares the row of the period filter once there are figures, and
 * stands alone above the other states.
 */
export function RevenueDashboard({ heading }: { heading: ReactNode }) {
  const { currentSaas, isLoading, isError, retry } = useSaas();

  if (currentSaas) return <SaasRevenue saas={currentSaas} heading={heading} />;
  return (
    <WithHeading heading={heading}>
      {isLoading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <ErrorState title="Impossible de charger tes SaaS" message="Vérifie ta connexion puis réessaie." action={<Button onClick={retry}>Réessayer</Button>} />
      ) : (
        <CreateSaasFirst />
      )}
    </WithHeading>
  );
}

function SaasRevenue({ saas, heading }: { saas: Saas; heading: ReactNode }) {
  const dashboard = useRevenueDashboard(saas.id);
  const refresh = useRefreshRevenue(saas.id);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectProvider, setConnectProvider] = useState<RevenueProvider | null>(null);

  const openConnect = (provider: RevenueProvider | null) => {
    setConnectProvider(provider);
    setConnectOpen(true);
  };
  const dialog = <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} provider={connectProvider} saasId={saas.id} />;

  if (dashboard.isPending) {
    return (
      <WithHeading heading={heading}>
        <DashboardSkeleton />
      </WithHeading>
    );
  }
  if (dashboard.isError) {
    return (
      <WithHeading heading={heading}>
        <ErrorState
          title="Impossible de charger tes revenus"
          message={dashboard.error.message}
          action={<Button onClick={() => dashboard.refetch()}>Réessayer</Button>}
        />
      </WithHeading>
    );
  }

  const data = dashboard.data;
  if (data.connections.length === 0) {
    return (
      <WithHeading heading={heading}>
        <motion.div initial="hidden" animate="visible">
          <ConnectFirst saasName={saas.name} onConnect={openConnect} />
          {dialog}
        </motion.div>
      </WithHeading>
    );
  }

  const { overview } = data;
  const syncing = data.syncing.length > 0 || refresh.isPending;
  const failed = data.connections.filter((connection) => connection.last_error && !data.syncing.includes(connection.id));

  return (
    <motion.div className="space-y-4 sm:space-y-5" initial="hidden" animate="visible" transition={{ staggerChildren: 0.06 }}>
      {/* The page heading, then one filter row above everything it scopes, on the same line. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        {heading}
        {/* Phones: a full-width row under the greeting, the period stretched; from sm, at its right.
            The payment account is managed from the SaaS settings (Paiements tab), not from here. */}
        <motion.div variants={fadeIn} className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodKey)}>
            {/* A button, not a native field: text-sm does not make iOS zoom in. */}
            <SelectTrigger
              className="h-9 flex-1 justify-start gap-2 whitespace-nowrap text-sm sm:w-auto sm:flex-none md:h-9 [&>svg:last-child]:ml-auto"
              aria-label="Période"
            >
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {PERIODS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-[10px] bg-card hover:border-foreground/25 sm:size-9"
            onClick={() => refresh.mutate()}
            disabled={syncing}
            aria-label={syncing ? "Synchronisation…" : "Actualiser les chiffres"}
            title={syncing ? "Synchronisation…" : "Actualiser"}
          >
            <RefreshCw className={cn(syncing && "animate-spin")} />
          </Button>
        </motion.div>
      </div>

      {/* A failed sync (revoked key, missing permission): the figures shown are the last ones read. */}
      {failed.length > 0 && (
        <motion.ul variants={fadeIn} className="space-y-1.5">
          {failed.map((connection) => (
            <li key={connection.id} className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {connectionName(connection)} : {connection.last_error}
              </span>
            </li>
          ))}
        </motion.ul>
      )}

      {overview && overview.warnings.length > 0 && (
        <motion.ul variants={fadeIn} className="space-y-1.5">
          {overview.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" /> {warning}
            </li>
          ))}
        </motion.ul>
      )}

      {/* A manual refresh keeps the figures in place, dimmed, until the new ones arrive. */}
      <div className={cn("space-y-4 transition-opacity duration-300 sm:space-y-5", refresh.isPending && "opacity-60")}>
        {overview ? (
          <Overview overview={overview} period={period} />
        ) : (
          <motion.div variants={fadeIn} className="card-3d flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Import de tes chiffres en cours…
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
