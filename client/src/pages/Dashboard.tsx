import { RevenueDashboard } from "@/components/revenue/RevenueDashboard";
import { PageGreeting } from "@/components/layout/PageGreeting";

/** Home of the app once subscribed: the revenue of the member's SaaS (connected Stripe / Whop accounts). */
export default function Dashboard() {
  // Handed to the dashboard, which puts it on the row of its period filter.
  return <RevenueDashboard heading={<PageGreeting />} />;
}
