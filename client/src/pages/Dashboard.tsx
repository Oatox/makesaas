import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { AI_INPUT_MAX_LENGTH, aiApi, type AiExampleResult } from "@shared/ai-pipeline";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api-client";
import { blurIn } from "@/lib/motion";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

/** Demo of the AI pipeline (editable by admins at /admin/pipeline): replace it with your product. */
function AiExampleCard() {
  const [input, setInput] = useState("");
  const run = useMutation({
    mutationFn: (text: string) => apiRequest<AiExampleResult>(aiApi.example.path, { method: "POST", body: { input: text } }),
  });

  return (
    <motion.section variants={fadeIn} className="card-3d space-y-5 p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-display text-lg font-normal">
          <Sparkles className="h-5 w-5 text-primary" /> Essayer le pipeline IA
        </h2>
        <p className="text-sm text-muted-foreground">
          Colle un texte : l'IA le résume en quelques points clés. Les prompts se modifient dans Admin → Pipeline.
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (input.trim()) run.mutate(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={AI_INPUT_MAX_LENGTH}
          rows={5}
          placeholder="Ton texte…"
          data-testid="input-ai-example"
        />
        <Button type="submit" disabled={!input.trim() || run.isPending} data-testid="button-ai-example">
          {run.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Lancer
        </Button>
      </form>

      {run.isError && <p className="text-sm text-destructive">{run.error.message}</p>}

      {run.data && (
        <div className="space-y-3 rounded-[12px] border border-border/60 bg-secondary/40 p-4">
          <p className="leading-relaxed">{run.data.summary}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {run.data.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
}

/** Home of the app once subscribed: the place to build the product itself. */
export default function Dashboard() {
  const { profile, user } = useAuth();
  const firstName = (profile?.full_name || user?.user_metadata?.full_name || "").split(" ")[0];

  return (
    <motion.div
      className="mx-auto w-full max-w-3xl space-y-6"
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.08 }}
    >
      <motion.section variants={fadeIn} className="card-3d space-y-3 p-5 sm:p-6">
        <h1 className="font-display text-2xl font-light">{firstName ? `Bienvenue, ${firstName} !` : "Bienvenue !"}</h1>
        <p className="text-muted-foreground">
          Cette page est le point de départ de ton produit : remplace-la par ta fonctionnalité principale
          (<code className="text-foreground">client/src/pages/Dashboard.tsx</code>).
        </p>
      </motion.section>

      <AiExampleCard />
    </motion.div>
  );
}
