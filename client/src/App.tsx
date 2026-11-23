import * as React from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useSaas } from "@/hooks/use-saas";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/Auth";
import OnboardingPage from "@/pages/Onboarding";
// Private pages are loaded on demand: visitors of the public pages never download their code.
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const Acquisition = React.lazy(() => import("@/pages/Acquisition"));
const Discussions = React.lazy(() => import("@/pages/Discussions"));
const Launch = React.lazy(() => import("@/pages/Launch"));
const Roadmap = React.lazy(() => import("@/pages/Roadmap"));
const AdminPage = React.lazy(() => import("@/pages/Admin"));
const Settings = React.lazy(() => import("@/pages/Settings"));
const Subscribe = React.lazy(() => import("@/pages/Subscribe"));
import { getPageTitle } from "@/config/page-titles";
import { PUBLIC_PAGES } from "@/config/seo";
import MentionsLegales from "@/pages/MentionsLegales";
import CGU from "@/pages/CGU";
import CGV from "@/pages/CGV";
import Confidentialite from "@/pages/Confidentialite";
import { Loader2 } from "lucide-react";
import { AUTH_CONFIG } from "@/config/auth";

/**
 * Pages a subscriber reaches without a SaaS yet: the ideas that create it, their account (to manage
 * the subscription) and, for admins, the admin pages.
 */
const isOpenWithoutSaas = (path: string) =>
  path === AUTH_CONFIG.LAUNCH_PATH || path.startsWith("/settings") || path.startsWith("/admin");

// Protected Route Wrapper: the app is reserved to subscribers (there is no free plan). Visitors go
// to the onboarding (sign-up is asked during it), signed-in users without a subscription to the paywall,
// and subscribers without a SaaS to Gus's ideas (/lancement): the app starts with a project.
// `bare`: full screen, without the sidebar and header (the ideas of /lancement).
function ProtectedRoute({ component: Component, bare = false }: { component: React.ComponentType; bare?: boolean }) {
  const { user, hasAccess, isLoading, isProfileError, retryProfile } = useAuth();
  const { saasList, isLoading: saasLoading, isError: saasError } = useSaas();
  const [location] = useLocation();
  const gated = hasAccess && !isOpenWithoutSaas(location);

  if (isLoading || (gated && saasLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Unknown access (profile not loaded): offer a retry rather than sending a subscriber to the paywall.
  if (isProfileError) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4">
        <ErrorState
          title="Impossible de charger votre compte"
          message="Vérifiez votre connexion internet puis réessayez."
          action={<Button onClick={retryProfile}>Réessayer</Button>}
        />
      </div>
    );
  }

  if (!hasAccess) return <Redirect to={user ? AUTH_CONFIG.SUBSCRIBE_PATH : AUTH_CONFIG.ONBOARDING_PATH} />;

  // No SaaS yet (a list that failed to load does not lock the member out).
  if (gated && !saasError && saasList.length === 0) return <Redirect to={AUTH_CONFIG.LAUNCH_PATH} />;

  if (bare) {
    return (
      <ErrorBoundary>
        <React.Suspense
          fallback={
            <div className="flex h-screen w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <Component />
        </React.Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <AppLayout>
      <ErrorBoundary>
        <React.Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <Component />
        </React.Suspense>
      </ErrorBoundary>
    </AppLayout>
  );
}

function Router() {
  const { user } = useAuth();
  const [location] = useLocation();

  React.useEffect(() => {
    // Public pages keep the exact title they were prerendered with (config/seo.ts).
    const seoPage = PUBLIC_PAGES.find((page) => page.path === location);
    document.title = seoPage?.title ?? `${getPageTitle(location) ?? "MakeSaaS"} | MakeSaaS`;
  }, [location]);

  return (
    <Switch>
      {/* Public Routes */}
      <Route path={AUTH_CONFIG.LANDING_PATH} component={Landing} />
      <Route path="/mentions-legales" component={MentionsLegales} />
      <Route path="/cgu" component={CGU} />
      <Route path="/cgv" component={CGV} />
      <Route path="/confidentialite" component={Confidentialite} />
      
      <Route path={AUTH_CONFIG.ONBOARDING_PATH} component={OnboardingPage} />
      <Route path={AUTH_CONFIG.SUBSCRIBE_PATH}>
        <React.Suspense
          fallback={
            <div className="flex h-screen w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <Subscribe />
        </React.Suspense>
      </Route>

      <Route path={AUTH_CONFIG.LOGIN_PATH}>
        {user ? <Redirect to={AUTH_CONFIG.REDIRECT_PATH} /> : <AuthPage />}
      </Route>
      <Route path={AUTH_CONFIG.REGISTER_PATH}>
        {user ? <Redirect to={AUTH_CONFIG.REDIRECT_PATH} /> : <AuthPage />}
      </Route>

      {/* Protected Routes */}
      <Route path="/app">
        <ProtectedRoute component={Dashboard} />
      </Route>

      <Route path={AUTH_CONFIG.LAUNCH_PATH}>
        <ProtectedRoute component={Launch} bare />
      </Route>

      <Route path="/roadmap">
        <ProtectedRoute component={Roadmap} />
      </Route>

      <Route path="/acquisition">
        <ProtectedRoute component={Acquisition} />
      </Route>
      <Route path="/acquisition/contenu">
        <ProtectedRoute component={Acquisition} />
      </Route>
      <Route path="/acquisition/contenu/:carouselId">
        <ProtectedRoute component={Acquisition} />
      </Route>

      <Route path="/discussions">
        <ProtectedRoute component={Discussions} />
      </Route>
      <Route path="/discussions/:id">
        <ProtectedRoute component={Discussions} />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>


      {/* Admin Route */}
      <Route path="/admin">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/admin/pipeline">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/admin/pipeline/:slug">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/admin/marketing">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/admin/marketing/:toolId">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/admin/users/:id">
        <ProtectedRoute component={AdminPage} />
      </Route>
      
      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
