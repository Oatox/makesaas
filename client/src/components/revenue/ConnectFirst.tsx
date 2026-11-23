import { motion } from "framer-motion";
import { REVENUE_PROVIDERS, type RevenueProvider } from "@shared/revenue";
import { blurIn } from "@/lib/motion";
import { ProviderButton } from "./ConnectDialog";
import { ProviderTile } from "./providers";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

/** Empty state of the revenue dashboard: the SaaS has no payment account yet. Plain card background. */
export function ConnectFirst({ saasName, onConnect }: { saasName: string; onConnect: (provider: RevenueProvider) => void }) {
  return (
    <motion.section variants={fadeIn} className="card-3d px-5 pb-12 pt-10 sm:px-10 sm:pb-16 sm:pt-14">
      <div className="flex flex-col items-center text-center">
        <div aria-hidden className="flex items-center">
          <ProviderTile provider="stripe" className="h-12 w-12 -rotate-6 rounded-[13px] outline outline-4 outline-[hsl(160_7%_11%)]" />
          <ProviderTile provider="whop" className="-ml-2 h-12 w-12 rotate-6 rounded-[13px] outline outline-4 outline-[hsl(160_7%_11%)]" />
        </div>

        <h2 className="mt-6 max-w-xl text-balance font-display text-2xl font-light leading-tight sm:text-[32px]">
          Connecte {saasName} pour suivre son MRR
        </h2>
        <p className="mt-3 max-w-md text-balance text-sm text-muted-foreground">
          MRR, revenu encaissé, abonnés et churn se calculent tout seuls à partir de tes paiements.
        </p>

        <div className="mt-8 grid w-full max-w-[42rem] gap-2.5 sm:grid-cols-2">
          {REVENUE_PROVIDERS.map((provider) => (
            <ProviderButton
              key={provider}
              provider={provider}
              onClick={() => onConnect(provider)}
              className="bg-background/70 hover:bg-background/80"
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
