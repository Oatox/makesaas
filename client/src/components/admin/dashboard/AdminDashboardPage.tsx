import { useAdminMetrics, useUserGrowth } from "@/hooks/use-supabase";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";
import { PageGreeting } from "@/components/layout/PageGreeting";
import { AdminStats } from "./AdminStats";
import { AdminGrowthChart } from "./AdminGrowthChart";

/** /admin: the greeting, as on Accueil, then the sign-up figures and their growth. */
export function AdminDashboardPage() {
  const { data: metrics, isLoading: isLoadingMetrics } = useAdminMetrics();
  const { data: growthData, isLoading: isLoadingGrowth } = useUserGrowth();

  const isLoading = isLoadingMetrics || isLoadingGrowth;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageGreeting />
      <div className="space-y-6">
        {isLoading ? (
          <AdminSkeleton />
        ) : (
          <>
            <AdminStats metrics={metrics} />
            <AdminGrowthChart data={growthData} />
          </>
        )}
      </div>
    </div>
  );
}
