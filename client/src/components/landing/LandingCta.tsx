import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/** Landing call to action: signed-in visitors go straight to the app, others to the onboarding. */
export function LandingCta({ label = "Démarrer", className }: { label?: string; className?: string }) {
  const { user } = useAuth();
  return (
    <Link href={user ? "/app" : "/onboarding"} className={cn("inline-flex", className)}>
      <Button className="group h-11 px-5 text-base">
        {label}
        <ArrowRight className="!size-[18px] transition-transform duration-200 group-hover:translate-x-1" />
      </Button>
    </Link>
  );
}
