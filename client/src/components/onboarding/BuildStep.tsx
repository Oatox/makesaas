import { buzz } from "./haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { LEGAL } from "@/config/legal";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { dreamWords, euros, fillTemplate, firstName, goalOf, roadmapSteps, timeLabel } from "./insights";
import { QuickQuestionDialog } from "./QuickQuestionDialog";
import { STEP_TITLE_CLASS } from "./StepHeader";
import type { BuildStep as BuildStepConfig } from "./steps";

type Part = { think: string; done: string; file: string; lines: string[] };
type Beat = { part: number; kind: "think" } | { part: number; kind: "line"; line: number };

const THINK_MS = 1450;
const LINE_MS = 230;
const BLANK_MS = 115;

/** The plan as code, written file by file, built on the answers (nothing is computed: it is a show). */
function buildParts(answers: OnboardingAnswers): Part[] {
  const name = firstName(answers);
  // Accents split off (NFD), then everything that cannot be in a variable name dropped.
  const slug = name.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = /^[a-z]/.test(slug) ? slug.slice(0, 16) : "toi";
  const goal = goalOf(answers);
  const perMonth = `${euros.format(goal)} par mois`;
  const dream = dreamWords(answers)[0];
  const quote = (value: string) => `"${value.replace(/"/g, "'")}"`;
  const lib = LEGAL.siteName.toLowerCase();

  return [
    {
      think: "Je lis tes réponses",
      done: "J'ai lu tes réponses",
      file: `plan-${id}.ts`,
      lines: [
        `// Le plan de ${name} : ${perMonth}`,
        `import { coach } from "${lib}";`,
        "",
        `const ${id} = {`,
        `  temps: ${quote(timeLabel(answers))},`,
        `  objectif: ${goal},`,
        ...(dream ? [`  reve: ${quote(dream.charAt(0).toLowerCase() + dream.slice(1))},`] : []),
        "};",
      ],
    },
    {
      think: "Je cherche les 3 idées faites pour toi",
      done: "J'ai choisi tes 3 idées",
      file: "idees.ts",
      lines: ["", `const idees = await coach.idees(${id}, { nombre: 3 });`, "// de la plus simple à la plus ambitieuse"],
    },
    {
      think: "J'écris le prompt de ton site",
      done: "J'ai écrit le prompt de ton site",
      file: "site.ts",
      lines: ["", "const site = coach.site(idees[0], {", '  logiciel: "sans code",', '  pages: ["accueil", "paiement"],', "});"],
    },
    {
      think: "Je cherche où trouver tes premiers clients",
      done: "J'ai trouvé où chercher tes clients",
      file: "clients.ts",
      lines: ["", 'const clients = coach.canaux(site, ["TikTok", "Instagram"]);'],
    },
    {
      think: "Je découpe ton objectif en étapes",
      done: "J'ai découpé ton objectif en étapes",
      file: "roadmap.ts",
      lines: ["", "export const roadmap = coach.etapes({", "  depart: 0,", `  arrivee: ${id}.objectif, // ${perMonth}`, "});"],
    },
  ];
}

const TOKENS = /(\/\/.*$)|("[^"]*")|(\b\d[\d\s]*\b)|\b(const|await|export|import|from)\b|(\b[a-z]+)(?=:)/g;
const TOKEN_CLASS = ["text-muted-foreground", "text-success", "text-primary", "text-[#c792ea]", "text-[#7cc4ff]"];

/** A line of code with its comments, strings, numbers, keywords and keys colored. */
function Code({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  const tokens = new RegExp(TOKENS.source, "g");
  let at = 0;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(text))) {
    const index = match.index;
    if (index > at) out.push(text.slice(at, index));
    const group = match.slice(1).findIndex((g: string | undefined) => g !== undefined);
    out.push(
      <span key={index} className={TOKEN_CLASS[group]}>
        {match[0]}
      </span>,
    );
    at = index + match[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

/**
 * "On construit ton plan": the plan written live like an agent writing code, paused by two quick
 * questions. Once done, the plan sheet slides up with the roadmap and "Voir mon plan".
 */
export function BuildStep({
  step,
  answers,
  onContinue,
}: {
  step: BuildStepConfig;
  answers: OnboardingAnswers;
  onContinue: (quickAnswers: OnboardingAnswers) => void;
}) {
  const reduceMotion = useReducedMotion();
  const parts = useMemo(() => buildParts(answers), [answers]);
  const beats = useMemo<Beat[]>(
    () => parts.flatMap((p, part) => [{ part, kind: "think" as const }, ...p.lines.map((_, line) => ({ part, kind: "line" as const, line }))]),
    [parts],
  );
  const durationOf = (beat: Beat) => (beat.kind === "think" ? THINK_MS : parts[beat.part].lines[beat.line] ? LINE_MS : BLANK_MS);
  const starts = useMemo(() => {
    const out: number[] = [];
    beats.reduce((at, beat) => (out.push(at), at + durationOf(beat)), 0);
    return out;
    // durationOf only reads `parts`.
  }, [beats, parts]);
  const total = starts[starts.length - 1] + durationOf(beats[beats.length - 1]);

  const [elapsed, setElapsed] = useState(0);
  const [quick, setQuick] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  const nextQuestion = step.questions.find((q) => !(q.id in quick));
  const limit = (nextQuestion ? nextQuestion.at : 1) * total;
  const pending = nextQuestion && elapsed >= nextQuestion.at * total ? nextQuestion : null;
  const done = elapsed >= total;
  const progress = Math.min(1, elapsed / total);

  // The clock runs up to the next question (or the end), then waits.
  useEffect(() => {
    if (pending || done) return;
    if (reduceMotion) {
      setElapsed(limit);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      setElapsed((e) => Math.min(limit, e + delta));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pending, done, limit, reduceMotion]);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => {
      setSheet(true);
      buzz(20);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [done]);

  // Index of the beat being written (all of them once done).
  let current = beats.length;
  if (!done) for (let i = beats.length - 1; i >= 0; i--) if (starts[i] <= elapsed) { current = i; break; }

  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight, behavior: "smooth" });
  }, [current]);

  const now = beats[current];
  const status = done ? "Ton plan est prêt" : now?.kind === "think" ? `${parts[now.part].think}…` : `J'écris ${parts[now?.part ?? 0].file}`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4">
        <h1 className={STEP_TITLE_CLASS}>{fillTemplate("On construit ton plan, {prenom}.", answers)}</h1>
        <span className="mt-2 font-display text-lg tabular-nums text-primary" aria-live="polite">
          {Math.round(progress * 100)} %
        </span>
      </div>

      <div aria-hidden className="card-3d mt-6 overflow-hidden">
        <div ref={body} className="h-[300px] space-y-3 overflow-y-auto p-4 font-mono text-[12px] leading-relaxed [scrollbar-width:none] md:h-[340px] [&::-webkit-scrollbar]:hidden">
          {parts.map((part, p) => {
            const first = beats.findIndex((b) => b.part === p);
            if (first > current) return null;
            const nextFirst = beats.findIndex((b) => b.part === p + 1);
            const partDone = done || (nextFirst !== -1 && current >= nextFirst);
            const thinking = current === first && !done;
            const written = beats.slice(0, current + 1).filter((b) => b.part === p && b.kind === "line").length;
            const lines = part.lines.slice(0, written).filter(Boolean);

            return (
              <motion.div key={part.file} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-1.5">
                <p className={cn("flex items-center gap-2", thinking ? "text-foreground" : "text-muted-foreground")}>
                  <span className={cn("text-primary", thinking && "animate-pulse")}>◆</span>
                  {thinking ? `${part.think}…` : "Réflexion"}
                </p>
                {written > 0 && (
                  <p className="flex items-center gap-2">
                    {partDone ? <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    <b className="font-semibold text-foreground">{partDone ? part.done : `J'écris ${part.file}`}</b>
                    <em className="not-italic text-success">+{lines.length}</em>
                  </p>
                )}
                {lines.length > 0 && (
                  <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                    {lines.slice(-3).map((line, i) => (
                      <code key={`${i}-${line}`} className="block whitespace-pre-wrap break-all">
                        <span className="mr-2 text-success">+</span>
                        <Code text={line.trim()} />
                      </code>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full", done ? "bg-success" : "bg-primary")} style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            {done ? <Check className="h-4 w-4 text-success" strokeWidth={3} /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {status}
          </p>
        </div>
      </div>

      <QuickQuestionDialog question={pending} onAnswer={(id, value) => setQuick((current) => ({ ...current, [id]: value }))} />

      <AnimatePresence>
        {sheet && (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="onboarding-plan-ready"
              className="card-3d w-full max-w-[520px] rounded-b-none px-6 pb-8 pt-3"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            >
              <span aria-hidden className="mx-auto block h-1 w-10 rounded-full bg-muted-foreground/30" />
              <span aria-hidden className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="h-6 w-6" strokeWidth={3} />
              </span>
              <h2 id="onboarding-plan-ready" className="mt-4 text-center font-display text-2xl leading-tight">
                Ton plan personnalisé est prêt.
              </h2>
              <p className="mt-1 text-center text-muted-foreground">{fillTemplate("Maintenant, il est temps de passer à l'action, {prenom}.", answers)}</p>

              <ol className="mt-5 space-y-2">
                {roadmapSteps(answers).map((milestone, i) => (
                  <li key={milestone.title} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5">
                    <i className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold not-italic text-primary">{i + 1}</i>
                    <div className="min-w-0 flex-1">
                      <b className="block text-sm font-semibold">{milestone.title}</b>
                      <small className="text-xs text-muted-foreground">{milestone.detail}</small>
                    </div>
                    {i === 0 && <Check className="h-4 w-4 text-success" strokeWidth={3} />}
                  </li>
                ))}
              </ol>

              <ContinueButton onClick={() => onContinue(quick)} label="Voir mon plan" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
