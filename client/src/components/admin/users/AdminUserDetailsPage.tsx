import { AlertCircle } from "lucide-react";
import { grantsAccess } from "@shared/billing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAdminUserDetails } from "@/hooks/use-admin-profiles";
import { AdminUserDetailsSkeleton } from "./details/AdminUserDetailsSkeleton";
import { BillingCard } from "./details/BillingCard";
import { OnboardingCard } from "./details/OnboardingCard";
import { ProfileCard } from "./details/ProfileCard";
import { ProvidersCard } from "./details/ProvidersCard";
import { SaasCard } from "./details/SaasCard";
import { SessionsCard } from "./details/SessionsCard";
import { SignupSourceCard } from "./details/SignupSourceCard";

export function AdminUserDetailsPage({ userId }: { userId: string }) {
  const { data, isLoading, error } = useAdminUserDetails(userId);

  if (isLoading) return <AdminUserDetailsSkeleton />;

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Impossible de charger l’utilisateur</AlertTitle>
        <AlertDescription>{error?.message ?? "Une erreur inconnue est survenue."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileCard profile={data.profile} />
      <BillingCard profile={data.profile} />
      <SaasCard
        userId={userId}
        journey={data.journey}
        hasAccess={data.profile.role === "admin" || grantsAccess(data.profile.subscription?.status)}
      />
      <OnboardingCard journey={data.journey} />
      <SignupSourceCard source={data.profile.signupSource} />
      <SessionsCard userId={userId} sessions={data.sessions} sessionsUnavailable={data.sessionsUnavailable} />
      <ProvidersCard providers={data.providers} />
    </div>
  );
}
