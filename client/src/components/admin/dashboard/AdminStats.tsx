import { ShieldCheck, TrendingUp, Users } from "lucide-react";
import type { AdminMetrics } from "@/hooks/use-supabase";
import { AdminStatCard } from "./AdminStatCard";

export function AdminStats({ metrics }: { metrics?: AdminMetrics }) {

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <AdminStatCard
        title="Aujourd'hui"
        value={metrics?.today ?? 0}
        icon={<TrendingUp className="h-4 w-4 text-success" />}
        description="Nouveaux inscrits"
      />
      <AdminStatCard
        title="Cette semaine"
        value={metrics?.week ?? 0}
        icon={<Users className="h-4 w-4 text-primary" />}
        description="Inscriptions 7j"
      />
      <AdminStatCard
        title="Ce mois"
        value={metrics?.month ?? 0}
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
        description="Inscriptions 30j"
      />
      <AdminStatCard
        title="Admins"
        value={metrics?.admins ?? 0}
        icon={<ShieldCheck className="h-4 w-4 text-primary" />}
        description="Administrateurs système"
      />
    </div>
  );
}
