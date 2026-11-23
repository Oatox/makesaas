import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { AUTH_CONFIG } from "@/config/auth";

const SIZES = {
  default: { button: "h-11 px-5 text-base", arrow: "!size-[18px]" },
  // The hero's main call to action: taller, wider, larger text.
  lg: { button: "h-[52px] px-7 text-[17px] sm:h-14 sm:px-9 sm:text-lg", arrow: "!size-5" },
};

/** Landing call to action: signed-in visitors go straight to the app, others to the onboarding. */
export function LandingCta({
  label = "Commencer",
  size = "default",
  className,
}: {
  label?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { user } = useAuth();
  return (
    <Link href={user ? AUTH_CONFIG.REDIRECT_PATH : AUTH_CONFIG.ONBOARDING_PATH} className={cn("inline-flex", className)}>
      <Button className={cn("group", SIZES[size].button)}>
        {label}
        <ArrowRight className={cn(SIZES[size].arrow, "transition-transform duration-200 group-hover:translate-x-1")} />
      </Button>
    </Link>
  );
}
