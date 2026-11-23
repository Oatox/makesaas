import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { AdminDashboardPage } from "@/components/admin/dashboard/AdminDashboardPage";
import { AdminUsersPage } from "@/components/admin/users/AdminUsersPage";
import { AdminUserDetailsPage } from "@/components/admin/users/AdminUserDetailsPage";
import { AdminPipelinePage } from "@/components/admin/pipeline/AdminPipelinePage";
import { AdminMarketingPage } from "@/components/admin/marketing/AdminMarketingPage";
import { MarketingToolPage } from "@/components/admin/marketing/MarketingToolPage";

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const isUsersPage = location === "/admin/users";
  const isPipelinePage = location === "/admin/pipeline";
  const isMarketingPage = location === "/admin/marketing";
  const [isMarketingToolPage, toolParams] = useRoute<{ toolId: string }>("/admin/marketing/:toolId");
  const [isUserDetailsPage, params] = useRoute<{ id: string }>("/admin/users/:id");
  const [isPipelineDetailsPage, pipelineParams] = useRoute<{ slug: string }>("/admin/pipeline/:slug");

  if (!isAdmin) {
    return <AdminAccessDenied setLocation={setLocation} />;
  }

  if (isUsersPage) {
    return <AdminUsersPage />;
  }

  if (isPipelinePage) {
    return <AdminPipelinePage />;
  }

  if (isPipelineDetailsPage && pipelineParams?.slug) {
    return <AdminPipelinePage slug={pipelineParams.slug} />;
  }

  if (isMarketingPage) {
    return <AdminMarketingPage />;
  }

  if (isMarketingToolPage && toolParams?.toolId) {
    return <MarketingToolPage toolId={toolParams.toolId} />;
  }

  if (isUserDetailsPage && params?.id) {
    return <AdminUserDetailsPage userId={params.id} />;
  }

  return <AdminDashboardPage />;
}
