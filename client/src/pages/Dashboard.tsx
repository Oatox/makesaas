import { motion } from "framer-motion";
import { RevenueDashboard } from "@/components/revenue/RevenueDashboard";
import { useSaas } from "@/hooks/use-saas";
import { blurIn } from "@/lib/motion";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

/** The page's title and what it shows, for the active SaaS. */
function DashboardTitle() {
  const { currentSaas } = useSaas();
  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="min-w-0">
      <h2 className="font-display text-2xl font-light sm:text-[32px]">Ton tableau de bord</h2>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">
        {currentSaas ? `Le MRR, les abonnés et les paiements de ${currentSaas.name}.` : "Le MRR, les abonnés et les paiements de ton SaaS."}
      </p>
    </motion.div>
  );
}

/** /dash, Tableau de bord: the revenue of the member's SaaS (its connected Stripe / Whop account). */
export default function Dashboard() {
  // Handed to the dashboard, which puts it on the row of its period filter.
  return <RevenueDashboard heading={<DashboardTitle />} />;
}
