import { Link } from "wouter";
import { LegalPage, LegalSection, SupportEmail } from "@/components/legal/LegalPage";
import { LEGAL } from "@/config/legal";

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales">
      <LegalSection title="1. Éditeur du site">
        <p>Le site {LEGAL.domain} et le service {LEGAL.siteName} sont édités par :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Nom : {LEGAL.editorName}</li>
          <li>Statut : {LEGAL.editorStatus}</li>
          <li>SIRET : {LEGAL.siret}</li>
          <li>Email : <SupportEmail /></li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Directeur de la publication">
        <p>
          Le directeur de la publication est {LEGAL.editorName}, joignable à l'adresse <SupportEmail />.
        </p>
      </LegalSection>

      <LegalSection title="3. Hébergeur">
        <p>Le site est hébergé par :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Nom : {LEGAL.host.name}</li>
          <li>Site web : {LEGAL.host.website}</li>
          <li>Adresse : {LEGAL.host.address}</li>
        </ul>
        <p>
          Les comptes utilisateurs et les données associées sont stockés par Supabase Inc. (supabase.com), fournisseur
          de base de données et d'authentification du service.
        </p>
      </LegalSection>

      <LegalSection title="4. Propriété intellectuelle">
        <p>
          L'ensemble des contenus du site (textes, graphismes, logos, icônes, logiciels) est protégé par les
          lois françaises et internationales relatives à la propriété intellectuelle. Toute reproduction, représentation
          ou exploitation, totale ou partielle, sans autorisation préalable de l'éditeur est interdite et peut faire
          l'objet de poursuites.
        </p>
      </LegalSection>

      <LegalSection title="5. Limitation de responsabilité">
        <p>
          L'éditeur s'efforce d'assurer l'exactitude des informations publiées, sans garantir l'absence totale d'erreur
          ou d'omission (voir les{" "}
          <Link href="/cgu" className="text-foreground underline underline-offset-2 hover:text-primary">CGU</Link>).
        </p>
      </LegalSection>

      <LegalSection title="6. Contact">
        <p>Pour toute question relative au site : <SupportEmail />.</p>
      </LegalSection>
    </LegalPage>
  );
}
