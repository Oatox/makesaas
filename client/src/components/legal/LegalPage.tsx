import type { ReactNode } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { LEGAL } from "@/config/legal";

/** Shared layout of the legal pages: back link, title, last update and a card of sections. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-20">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-primary hover:underline">← Retour à l'accueil</Link>
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">Dernière mise à jour : {LEGAL.updatedAt}</p>
        </div>

        <Card>
          <CardContent className="space-y-8 pt-6 leading-relaxed text-muted-foreground">{children}</CardContent>
        </Card>

        <nav aria-label="Pages légales" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link href="/mentions-legales" className="hover:text-foreground">Mentions légales</Link>
          <Link href="/cgu" className="hover:text-foreground">CGU</Link>
          <Link href="/cgv" className="hover:text-foreground">CGV</Link>
          <Link href="/confidentialite" className="hover:text-foreground">Confidentialité</Link>
        </nav>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function SupportEmail() {
  return (
    <a href={`mailto:${LEGAL.supportEmail}`} className="text-foreground underline underline-offset-2 hover:text-primary">
      {LEGAL.supportEmail}
    </a>
  );
}
