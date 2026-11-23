import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import { RollingNumber } from "./RollingNumber";
import { StripeIcon } from "./StripeIcon";
import type { MessageStep } from "./steps";

/* Illustrations of the explainer screens (MessageStep), drawn in a card under the title. Each one
   animates on arrival; the figures they show are the ones of the step's text. */

// ─── "Le modèle": Stripe notifications that keep coming, the monthly revenue climbing with them ───

// ⚠️ PLACEHOLDER: example monthly prices, one per new subscriber in turn, for the illustration only.
const PRICES = [29, 49, 19, 99, 39, 59];
const priceOf = (subscriber: number) => PRICES[subscriber % PRICES.length];
const priceLabel = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const SHOWN_NOTIFICATIONS = 3;
const NEXT_SUBSCRIBER_MS = 1500;

function RecurringVisual() {
  const reduceMotion = useReducedMotion();
  // Subscribers so far: one more every 1.5s for as long as the screen is open ("sans limite").
  const [count, setCount] = useState(reduceMotion ? SHOWN_NOTIFICATIONS : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const add = () => setCount((c) => c + 1);
    let interval = 0;
    const first = window.setTimeout(() => {
      add();
      interval = window.setInterval(add, NEXT_SUBSCRIBER_MS);
    }, 700);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [reduceMotion]);

  // Monthly revenue: every subscriber so far, each at their price.
  const revenue = Array.from({ length: count }, (_, i) => priceOf(i)).reduce((sum, price) => sum + price, 0);
  // Newest on top.
  const shown = Array.from({ length: Math.min(count, SHOWN_NOTIFICATIONS) }, (_, i) => count - 1 - i);

  return (
    <div>
      <div className="relative h-[198px] overflow-hidden">
        {/* popLayout: the notification leaving at the bottom no longer takes room, so the stack slides as one. */}
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((id, i) => (
            // A phone notification: app icon, app name and time, then the message.
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, y: -14, scale: 0.97 }}
              animate={{ opacity: 1 - i * 0.28, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="mb-2 flex items-center gap-3 rounded-[18px] border border-white/[0.08] bg-white/[0.06] px-3 py-2.5 shadow-[0_10px_24px_-14px_rgb(0_0_0/0.9)]"
            >
              <StripeIcon />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold">Stripe</span>
                  <span className="text-[11px] text-muted-foreground">maintenant</span>
                </span>
                <span className="block truncate text-[13px] text-foreground/80">
                  Nouvel abonnement : <span className="font-semibold text-foreground">{priceLabel.format(priceOf(id))}</span>/mois
                </span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex items-baseline justify-between border-t border-white/[0.06] pt-4">
        <span className="text-xs text-muted-foreground">Revenu tous les mois</span>
        <RollingNumber value={revenue} suffix={" €"} className="font-display text-2xl font-light" />
      </div>
    </div>
  );
}

/** The illustration of each explainer screen, by the `visual` of its step. */
export const MESSAGE_VISUALS: Record<NonNullable<MessageStep["visual"]>, () => JSX.Element> = {
  recurring: RecurringVisual,
};
