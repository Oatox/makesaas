import { useAdminMetrics, useUserGrowth } from "@/hooks/use-supabase";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";
import { AdminStats } from "./AdminStats";
import { AdminGrowthChart } from "./AdminGrowthChart";

export function AdminDashboardPage() {
  const { data: metrics, isLoading: isLoadingMetrics } = useAdminMetrics();
  const { data: growthData, isLoading: isLoadingGrowth } = useUserGrowth();

  const isLoading = isLoadingMetrics || isLoadingGrowth;

  return (
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
  );
}
