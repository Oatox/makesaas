import { Link } from "wouter";
import { LegalPage, LegalSection, SupportEmail } from "@/components/legal/LegalPage";
import { LEGAL } from "@/config/legal";
import { PLAN } from "@shared/billing";

const link = "text-foreground underline underline-offset-2 hover:text-primary";

export default function CGV() {
  return (
    <LegalPage title="Conditions générales de vente">
      <LegalSection title="1. Objet">
        <p>
          Les présentes conditions générales de vente (CGV) régissent la souscription et l'utilisation des abonnements
          payants au service {LEGAL.siteName}, édité par {LEGAL.editorName}, {LEGAL.editorStatus.toLowerCase()} (SIRET{" "}
          {LEGAL.siret}), joignable à l'adresse <SupportEmail />.
        </p>
        <p>
          Elles complètent les <Link href="/cgu" className={link}>conditions générales d'utilisation</Link>. Toute
          souscription implique leur acceptation sans réserve.
        </p>
      </LegalSection>

      <LegalSection title="2. Offre">
        {/* ⚠️ PLACEHOLDER: describe what the plan gives (same wording as PLAN in shared/billing.ts). */}
        <p>
          {LEGAL.siteName} propose un abonnement mensuel unique, <span className="text-foreground">{PLAN.name}</span>,
          qui donne accès à l'ensemble du service. Il n'existe pas d'offre gratuite.
        </p>
        <p>Le contenu de l'offre est celui décrit sur la page d'abonnement au moment de la souscription.</p>
      </LegalSection>

      <LegalSection title="3. Prix">
        <p>
          Les prix sont indiqués en euros, toutes taxes comprises, sur la page d'abonnement au moment de la
          souscription. TVA non applicable, article 293 B du Code général des impôts.
        </p>
        <p>
          L'éditeur peut modifier ses prix à tout moment. Le nouveau prix s'applique au renouvellement suivant, après
          information préalable de l'abonné, qui reste libre de résilier avant cette échéance.
        </p>
      </LegalSection>

      <LegalSection title="4. Souscription et paiement">
        <p>
          La souscription s'effectue en ligne, depuis la page d'abonnement, après création d'un compte. Le paiement est
          traité de façon sécurisée par notre prestataire Whop (whop.com) ; {LEGAL.siteName} n'a jamais accès à vos
          coordonnées bancaires complètes.
        </p>
        <p>
          L'abonnement est activé dès la confirmation du paiement. Il est ensuite renouvelé automatiquement chaque mois,
          à la date anniversaire de la souscription, jusqu'à sa résiliation. En cas d'échec de paiement, l'accès peut
          être maintenu pendant que le prestataire tente un nouveau prélèvement, puis suspendu.
        </p>
      </LegalSection>

      <LegalSection title="5. Droit de rétractation">
        <p>
          Conformément à l'article L.221-18 du Code de la consommation, vous disposez d'un délai de 14 jours à compter
          de la souscription pour exercer votre droit de rétractation, sans avoir à vous justifier, en écrivant à{" "}
          <SupportEmail />.
        </p>
        <p>
          En souscrivant, vous demandez l'exécution immédiate du service. Conformément aux articles L.221-25 et
          L.221-28 du Code de la consommation, si vous avez utilisé le service pendant ce délai, vous reconnaissez que
          son exécution a commencé avec votre accord : le droit de rétractation ne peut plus être exercé pour le contenu
          déjà fourni. Si vous n'avez pas utilisé le service, vous êtes remboursé intégralement dans un délai de 14
          jours.
        </p>
      </LegalSection>

      <LegalSection title="6. Résiliation">
        <p>
          L'abonnement est sans engagement. Vous pouvez le résilier à tout moment depuis la page Paramètres (« Gérer mon
          abonnement ») ou en écrivant à <SupportEmail />.
        </p>
        <p>
          La résiliation prend effet à la fin de la période mensuelle en cours : vous conservez l'accès jusqu'à cette
          date et aucun nouveau prélèvement n'est effectué. Aucun remboursement au prorata n'est accordé pour la
          période entamée.
        </p>
      </LegalSection>

      <LegalSection title="7. Remboursements">
        <p>
          En dehors du droit de rétractation, toute demande de remboursement peut être adressée à <SupportEmail />.
          Chaque demande est étudiée au cas par cas, notamment en cas d'indisponibilité prolongée du service.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilité">
        <p>
          L'éditeur fournit le service avec diligence, sans garantir une disponibilité continue et sans interruption.
          En cas d'indisponibilité prolongée de son fait, une compensation au prorata peut être accordée sur demande.
        </p>
      </LegalSection>

      <LegalSection title="9. Service client">
        <p>
          Pour toute question sur votre abonnement, la facturation ou un remboursement, écrivez à <SupportEmail />.
          Nous nous engageons à répondre sous 48 heures ouvrées.
        </p>
      </LegalSection>

      <LegalSection title="10. Droit applicable et litiges">
        <p>Les présentes CGV sont soumises au droit français.</p>
        <p>
          En cas de litige, adressez d'abord une réclamation écrite au service client. À défaut de solution amiable,
          vous pouvez recourir gratuitement à un médiateur de la consommation, conformément aux articles L.611-1 et
          suivants du Code de la consommation, ou à la plateforme européenne de règlement en ligne des litiges. À
          défaut d'accord, le litige sera porté devant les juridictions compétentes selon les règles de droit commun.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
