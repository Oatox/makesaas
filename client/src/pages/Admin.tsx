import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { AdminDashboardPage } from "@/components/admin/dashboard/AdminDashboardPage";
import { AdminUsersPage } from "@/components/admin/users/AdminUsersPage";
import { AdminUserDetailsPage } from "@/components/admin/users/AdminUserDetailsPage";
import { AdminPipelinePage } from "@/components/admin/pipeline/AdminPipelinePage";

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const isUsersPage = location === "/admin/users";
  const isPipelinePage = location === "/admin/pipeline";
  const [isUserDetailsPage, params] = useRoute<{ id: string }>("/admin/users/:id");

  if (!isAdmin) {
    return <AdminAccessDenied setLocation={setLocation} />;
  }

  if (isUsersPage) {
    return <AdminUsersPage />;
  }

  if (isPipelinePage) {
    return <AdminPipelinePage />;
  }

  if (isUserDetailsPage && params?.id) {
    return <AdminUserDetailsPage userId={params.id} />;
  }

  return <AdminDashboardPage />;
}
