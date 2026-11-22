import { motion } from "framer-motion";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 3D progress bar of the loaders: recessed track, glossy fill with a moving sheen, percentage. */
export function LoaderProgressBar({ value, done }: { value: number; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="recessed-3d relative h-4 flex-1 overflow-hidden rounded-full border border-border">
        <motion.div
          className={cn(
            "surface-3d absolute inset-y-0 left-0 min-w-4 overflow-hidden rounded-full",
            done ? "surface-3d-success" : "surface-3d-primary",
          )}
          initial={false}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: done ? 0.4 : 0.3, ease: "easeOut" }}
        >
          {/* Soft sheen sweeping along the fill while it runs. */}
          {!done && (
            <div
              aria-hidden
              className="absolute inset-0 animate-[loader-shimmer_1.6s_linear_infinite]"
              style={{
                backgroundImage: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.22), transparent)",
                backgroundSize: "40% 100%",
                backgroundRepeat: "no-repeat",
              }}
            />
          )}
        </motion.div>
      </div>
      <span className="w-12 whitespace-nowrap text-right font-display text-sm font-normal tabular-nums">{formatPercent(value)}</span>
    </div>
  );
}
