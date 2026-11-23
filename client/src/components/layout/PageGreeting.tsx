import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { blurIn } from "@/lib/motion";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

/** Title at the top of a home page (Accueil, admin overview): "Salut, <first name> 👋". */
export function PageGreeting() {
  const { profile, user } = useAuth();
  const firstName = (profile?.full_name || user?.user_metadata?.full_name || "").split(" ")[0];

  return (
    <motion.h2 initial="hidden" animate="visible" variants={fadeIn} className="font-display text-2xl font-light">
      {firstName ? `Salut, ${firstName} 👋` : "Salut 👋"}
    </motion.h2>
  );
}
