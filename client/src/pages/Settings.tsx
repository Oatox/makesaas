import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { ManageSubscription } from "@/components/settings/ManageSubscription";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { blurIn } from "@/lib/motion";
import { motion } from "framer-motion";
import { AlertTriangle, LogOut, Crown } from "lucide-react";
import { PLAN, grantsAccess, renewsBilling } from "@shared/billing";
import { formatDate } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

// Same entrance as the landing and auth pages.
const fadeIn = blurIn({ blur: 8, duration: 0.6 });

function Section({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={fadeIn}
      className={`card-3d p-5 sm:p-6 ${danger ? "card-3d-danger" : ""}`}
    >
      <div className="mb-5 space-y-1">
        <h2 className={`font-display text-lg font-normal ${danger ? "text-destructive" : ""}`}>{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </motion.section>
  );
}

// One clickable/action row inside a section: icon tile, label + hint, trailing element.
function Row({ icon: Icon, title, hint, iconClass, children }: {
  icon: LucideIcon;
  title: string;
  hint: string;
  iconClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${iconClass ?? "bg-secondary text-foreground/80"}`}>
          <Icon className="h-[22px] w-[22px]" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { profile, hasAccess, signOut } = useAuth();
  // A renewing Whop subscription must be cancelled before the account is deleted (the server refuses it too).
  const subscription = profile?.subscription;
  const isWhop = subscription?.provider === "whop" && grantsAccess(subscription.status);
  const hasActiveBilling = renewsBilling(subscription);
  const renewal = isWhop && subscription.current_period_end ? formatDate(subscription.current_period_end) : null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.06 }}
      className="space-y-5"
    >
      <Section title="Profil" description="Le nom affiché dans l'application.">
        <ProfileForm fullName={profile?.full_name} />
      </Section>

      <Section title="Abonnement" description="Votre offre actuelle.">
        <Row
          icon={Crown}
          title={hasAccess ? PLAN.name : "Aucun abonnement"}
          hint={[
            hasAccess ? `${PLAN.description}.` : "Abonnez-vous pour accéder à MakeSaaS.",
            renewal && (subscription?.cancel_at_period_end ? `Se termine le ${renewal}.` : `Renouvellement le ${renewal}.`),
          ]
            .filter(Boolean)
            .join(" ")}
          iconClass={hasAccess ? "bg-primary/15 text-primary" : undefined}
        >
          {isWhop && <ManageSubscription subscription={subscription} periodEnd={renewal} />}
        </Row>
      </Section>

      <Section title="Session" description="Vous êtes connecté sur cet appareil.">
        <Row icon={LogOut} title="Se déconnecter" hint="Vous pourrez vous reconnecter à tout moment.">
          <Button variant="secondary" className="h-11 w-full px-5 sm:w-auto" onClick={() => signOut()}>
            Déconnexion
          </Button>
        </Row>
      </Section>

      <Section title="Zone de danger" description="Actions définitives sur votre compte." danger>
        <Row
          icon={AlertTriangle}
          title="Supprimer le compte"
          hint="Droit à l'effacement (RGPD) : toutes vos données personnelles seront supprimées, immédiatement et sans retour possible."
          iconClass="bg-destructive/10 text-destructive"
        >
          <DeleteAccountDialog hasActiveBilling={hasActiveBilling} />
        </Row>
      </Section>
    </motion.div>
  );
}
