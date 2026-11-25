import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { PlatformTile } from "@/components/acquisition/PlatformTile";
import type { Saas } from "@shared/saas";
import type { TikTokAccount } from "@shared/schema";
import { EmptyState, ErrorState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountHeader } from "@/components/acquisition/AccountHeader";
import { AccountPicker, ALL_ACCOUNTS } from "@/components/acquisition/AccountPicker";
import { AcquisitionChart } from "@/components/acquisition/AcquisitionChart";
import { StatTiles } from "@/components/acquisition/StatTiles";
import { VideoList } from "@/components/acquisition/VideoList";
import { computeTotals } from "@/components/acquisition/stats";
import {
  useAutoSyncTikTokAccounts,
  useTikTokAccounts,
  useTikTokStats,
  useTikTokVideos,
} from "@/hooks/use-acquisition";
import { useSaas } from "@/hooks/use-saas";
import { NoSaasState } from "@/components/saas/NoSaasState";
import { SaasDialog, type SaasDialogState } from "@/components/saas/SaasDialog";
import { blurIn } from "@/lib/motion";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

/**
 * The page's title (as the Tableau de bord's), and on its row, at its right, the accounts it shows
 * (from sm; under it on phones).
 */
function StatsHeading({ saasName, children }: { saasName?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
      <motion.div initial="hidden" animate="visible" variants={fadeIn} className="min-w-0">
        <h2 className="font-display text-2xl font-light sm:text-[32px]">Tes statistiques</h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Les abonnés, les vues et l'engagement des comptes TikTok de {saasName ?? "ton SaaS"}.
        </p>
      </motion.div>
      {children && <div className="flex w-full min-w-0 sm:ml-auto sm:w-auto">{children}</div>}
    </div>
  );
}

/** A state under the title alone (loading, error, nothing to show yet). */
function WithHeading({ saasName, children }: { saasName?: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <StatsHeading saasName={saasName} />
      {children}
    </div>
  );
}

function LoadingSkeleton({ saasName }: { saasName?: string }) {
  return (
    <div className="space-y-5">
      <StatsHeading saasName={saasName}>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40 rounded-full" />
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
      </StatsHeading>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[152px] rounded-[18px] sm:h-[160px]" />
        ))}
      </div>
      <Skeleton className="h-[380px] rounded-[18px]" />
    </div>
  );
}

/** "All" only exists with several accounts; a removed account falls back to "all". */
function resolveSelection(accounts: TikTokAccount[] | undefined, picked: string): string {
  if (!accounts?.length) return ALL_ACCOUNTS;
  if (accounts.length === 1) return accounts[0].id;
  return accounts.some((account) => account.id === picked) ? picked : ALL_ACCOUNTS;
}

/** "Statistiques" part of the acquisition page: the active SaaS's TikTok accounts, their followers and video stats. */
export function StatsSection() {
  const saas = useSaas();
  if (saas.isError) {
    return (
      <WithHeading>
        <ErrorState
          title="Impossible de charger tes SaaS"
          message="Vérifie ta connexion internet puis réessaie."
          action={<Button onClick={saas.retry}>Réessayer</Button>}
        />
      </WithHeading>
    );
  }
  if (!saas.currentSaas) return saas.isLoading ? (
      <LoadingSkeleton />
    ) : (
      <WithHeading>
        <NoSaasState description="Les comptes TikTok sont suivis pour un SaaS. Crée le tien, puis ajoute ses comptes." />
      </WithHeading>
    );
  // Keyed by SaaS: switching SaaS starts from a fresh selection.
  return <SaasStats key={saas.currentSaas.id} saas={saas.currentSaas} />;
}

function SaasStats({ saas }: { saas: Saas }) {
  const accountsQuery = useTikTokAccounts();
  const videosQuery = useTikTokVideos();
  const statsQuery = useTikTokStats();
  const accounts = accountsQuery.data;
  useAutoSyncTikTokAccounts(accounts);

  const [picked, setPicked] = useState<string>(ALL_ACCOUNTS);
  const selected = resolveSelection(accounts, picked);
  const selectedAccount = accounts?.find((account) => account.id === selected);

  const view = useMemo(() => {
    const inView = (accountId: string) => selected === ALL_ACCOUNTS || accountId === selected;
    const shownAccounts = (accounts ?? []).filter((account) => inView(account.id));
    const videos = (videosQuery.data ?? []).filter((video) => inView(video.account_id));
    const stats = (statsQuery.data ?? []).filter((row) => inView(row.account_id));
    // With several accounts, rows and tooltips name the account of each video.
    const accountsById =
      selected === ALL_ACCOUNTS && shownAccounts.length > 1
        ? new Map<string, TikTokAccount>(shownAccounts.map((account) => [account.id, account]))
        : undefined;
    return { videos, stats, accountsById, totals: computeTotals(shownAccounts, videos) };
  }, [accounts, videosQuery.data, statsQuery.data, selected]);

  const error = accountsQuery.error ?? videosQuery.error ?? statsQuery.error;
  if (error) {
    return (
      <WithHeading saasName={saas.name}>
        <ErrorState
          title="Impossible de charger tes comptes TikTok"
          message="Vérifie ta connexion internet puis réessaie."
          action={
            <Button
              onClick={() => {
                accountsQuery.refetch();
                videosQuery.refetch();
                statsQuery.refetch();
              }}
            >
              Réessayer
            </Button>
          }
        />
      </WithHeading>
    );
  }

  if (!accounts || videosQuery.isPending || statsQuery.isPending) return <LoadingSkeleton saasName={saas.name} />;

  if (accounts.length === 0) {
    return (
      <WithHeading saasName={saas.name}>
        <NoAccountState saas={saas} />
      </WithHeading>
    );
  }

  return (
    <motion.div className="space-y-5" initial="hidden" animate="visible" transition={{ staggerChildren: 0.06 }}>
      <StatsHeading saasName={saas.name}>
        <motion.div variants={fadeIn} className="min-w-0 max-w-full">
          <AccountPicker accounts={accounts} selected={selected} onSelect={setPicked} />
        </motion.div>
      </StatsHeading>

      {selectedAccount && (
        <motion.div variants={fadeIn}>
          <AccountHeader account={selectedAccount} />
        </motion.div>
      )}

      <motion.div variants={fadeIn}>
        <StatTiles totals={view.totals} stats={view.stats} videos={view.videos} />
      </motion.div>

      <motion.div variants={fadeIn}>
        <AcquisitionChart videos={view.videos} stats={view.stats} accountsById={view.accountsById} />
      </motion.div>

      <motion.div variants={fadeIn}>
        {/* Keyed by account: picking another one starts again from its first page. */}
        <VideoList key={selected} videos={view.videos} accountsById={view.accountsById} />
      </motion.div>
    </motion.div>
  );
}

// The outline, in the card's color, separates the two overlapping tiles.
const PLATFORM_TILE = "h-12 w-12 rounded-[13px] outline outline-4 outline-[hsl(160_7%_11%)]";

/**
 * No account followed yet: the accounts are added from the SaaS's settings (TikTok tab), opened
 * from here. Once one is added there, this page shows its stats.
 */
function NoAccountState({ saas }: { saas: Saas }) {
  const [dialog, setDialog] = useState<SaasDialogState>(null);
  // Bumped on every opening so the dialog starts from the SaaS's current values (see SaasDialog).
  const [dialogKey, setDialogKey] = useState(0);

  return (
    <>
      <EmptyState
        size="large"
        icon={SiTiktok}
        visual={
          // The platforms side by side, tilted, as the payment providers of the revenue dashboard.
          <div className="flex items-center">
            <PlatformTile platform="tiktok" className={`${PLATFORM_TILE} -rotate-6`} />
            <PlatformTile platform="instagram" className={`${PLATFORM_TILE} -ml-2 rotate-6`} />
          </div>
        }
        title={`Suis l'acquisition de ${saas.name}`}
        description="Ajoute ses comptes TikTok publics pour suivre leurs abonnés, leurs vues et l'engagement de leurs vidéos. Instagram arrive bientôt."
        action={
          <Button
            onClick={() => {
              setDialogKey((key) => key + 1);
              setDialog({ mode: "edit", saas, tab: "tiktok" });
            }}
            data-testid="button-open-tiktok-settings"
          >
            <Plus /> Ajouter un compte TikTok
          </Button>
        }
      />
      <SaasDialog key={dialogKey} state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
