import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AuthForm } from "@/components/auth/AuthForm";
import { AUTH_CONFIG } from "@/config/auth";
import { useAuth } from "@/hooks/use-auth";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";

/**
 * "Sauvegarde ta progression": the account is created here, in the middle of the onboarding,
 * right after the diagnosis. Google brings the visitor back to the onboarding, signed in. Once
 * signed in (now or already), the step moves on by itself. Members sign in from the landing page.
 */
export function AccountStep({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const moved = useRef(false);

  useEffect(() => {
    if (!user || moved.current) return;
    moved.current = true;
    onDone();
  }, [user, onDone]);

  if (user) return null;

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
    >
      <div className="space-y-2">
        <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
          Sauvegarde ta progression <span className="text-primary">pour ne rien perdre.</span>
        </motion.h1>
        <motion.p variants={stepAppear} className="text-base text-muted-foreground md:text-lg">
          Tu pourras retrouver tes données à tout moment.
        </motion.p>
      </div>

      <div className="mt-8 w-full">
        <AuthForm mode="register" oauthRedirectPath={AUTH_CONFIG.ONBOARDING_PATH} itemVariants={stepAppear} />
      </div>
    </motion.div>
  );
}
