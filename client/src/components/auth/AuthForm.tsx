import { useState } from "react";
import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { useToast } from "@/hooks/use-toast";
import { registerWithEmail, signInWithEmail, signInWithGoogle } from "@/lib/auth-api";
import { translateSupabaseError } from "@/lib/error-translator";
import { tallInputClass } from "@/lib/field-styles";

export type AuthMode = "login" | "register";

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  testId,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  testId: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className={`${tallInputClass} pr-12`}
        data-testid={testId}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        data-testid={`button-toggle-${testId.replace("input-", "")}`}
      >
        {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

/**
 * Google button + email/password form, for both sign-in and sign-up. Shared by the auth pages and
 * the onboarding. The session it opens is picked up by useAuth; the caller reacts to it.
 */
export function AuthForm({
  mode,
  onModeChange,
  oauthRedirectPath,
  itemVariants,
}: {
  mode: AuthMode;
  /** Switch between sign-in and sign-up; without it, the form stays in `mode` (onboarding sign-up). */
  onModeChange?: (mode: AuthMode) => void;
  /** Where Google sends the user back, signed in. */
  oauthRedirectPath: string;
  /** Entrance of each block, driven by the parent's stagger. */
  itemVariants?: Variants;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const isLogin = mode === "login";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        await signInWithEmail(email, password);
        toast({ title: "Bon retour !", description: "Connexion réussie." });
      } else {
        await registerWithEmail(email, password);
        toast({ title: "Compte créé", description: "Votre compte a été créé avec succès." });
      }
    } catch (error) {
      toast({ variant: "destructive", ...translateSupabaseError(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle(oauthRedirectPath);
    } catch (error) {
      toast({ variant: "destructive", ...translateSupabaseError(error) });
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.div variants={itemVariants}>
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full text-base"
          onClick={handleGoogle}
          disabled={isLoading}
          data-testid="button-google-auth"
        >
          <SiGoogle className="!size-[18px]" />
          {isLogin ? "Continuer avec Google" : "S'inscrire avec Google"}
        </Button>
      </motion.div>

      <motion.div variants={itemVariants} className="my-6 flex items-center gap-4 text-xs uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        ou
        <div className="h-px flex-1 bg-border" />
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-foreground/90">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="nom@exemple.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={tallInputClass}
            data-testid="input-email"
          />
        </motion.div>

        <motion.div variants={itemVariants} className="relative space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-foreground/90">
            Mot de passe
          </Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete={isLogin ? "current-password" : "new-password"}
            testId="input-password"
          />
          {!isLogin && <PasswordStrengthMeter password={password} />}
        </motion.div>

        <motion.div variants={itemVariants} className="pt-2">
          <Button type="submit" className="h-12 w-full text-base" disabled={isLoading} data-testid="button-auth-submit">
            {isLoading && <Loader2 className="animate-spin" />}
            {isLogin ? "Se connecter" : "Créer mon compte"}
          </Button>
        </motion.div>

        {!isLogin && (
          <motion.p variants={itemVariants} className="text-center text-xs leading-relaxed text-muted-foreground">
            En créant un compte, vous acceptez les{" "}
            <Link href="/cgu" className="text-foreground/80 underline underline-offset-2 hover:text-foreground">
              CGU
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="text-foreground/80 underline underline-offset-2 hover:text-foreground">
              politique de confidentialité
            </Link>
            .
          </motion.p>
        )}
      </form>

      {onModeChange && (
        <motion.div variants={itemVariants} className="mt-8 text-center">
          <button
            type="button"
            onClick={() => onModeChange(isLogin ? "register" : "login")}
            className="rounded-[10px] px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <span className="font-semibold text-primary">{isLogin ? "S'inscrire" : "Se connecter"}</span>
          </button>
        </motion.div>
      )}
    </>
  );
}
