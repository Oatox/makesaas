import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { AuthForm } from "@/components/auth/AuthForm";
import { Logo } from "@/components/brand/Logo";
import { blurIn } from "@/lib/motion";

// Same entrance as the landing hero: fade in from a blur, slightly from below.
const fadeIn = blurIn();

function HomeLogoLink() {
  return (
    <Link href="/" className="inline-flex transition-opacity hover:opacity-80">
      <Logo className="h-5" />
    </Link>
  );
}

/** Sign-in and sign-up: the form alone, centered on every screen size, the logo on top and the legal links below. */
export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const isLogin = location === "/login";

  return (
    <div className="bg-grain relative min-h-[100svh] bg-background">
      <div className="relative flex min-h-[100svh] flex-col px-6 py-6 sm:px-10">
        <header>
          <HomeLogoLink />
        </header>

        <motion.main
          key={isLogin ? "login" : "register"}
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.06 }}
          className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10"
        >
          <motion.div variants={fadeIn} className="mb-8 space-y-2">
            <h1 className="font-display text-[32px] font-light leading-tight sm:text-4xl">
              {isLogin ? "Bon retour parmi nous" : "Créer un compte"}
            </h1>
            <p className="text-base text-muted-foreground">
              {isLogin ? "Connectez-vous pour retrouver votre espace." : "Créez votre compte en moins d'une minute."}
            </p>
          </motion.div>

          <AuthForm
            mode={isLogin ? "login" : "register"}
            onModeChange={(mode) => setLocation(mode === "login" ? "/login" : "/register")}
            oauthRedirectPath="/app"
            itemVariants={fadeIn}
          />
        </motion.main>

        <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link href="/mentions-legales" className="transition-colors hover:text-foreground">Mentions légales</Link>
          <Link href="/cgu" className="transition-colors hover:text-foreground">CGU</Link>
          <Link href="/cgv" className="transition-colors hover:text-foreground">CGV</Link>
          <Link href="/confidentialite" className="transition-colors hover:text-foreground">Confidentialité</Link>
        </footer>
      </div>
    </div>
  );
}
