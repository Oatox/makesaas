import { Link } from "wouter";
import { COACH_NAME } from "@/components/brand/Coach";
import { LegalPage, LegalSection, SupportEmail } from "@/components/legal/LegalPage";
import { LEGAL } from "@/config/legal";
import { PLAN } from "@shared/billing";

const link = "text-foreground underline underline-offset-2 hover:text-primary";
const strong = "text-foreground";

// Plain-language terms of sale. The editor's postal address is deliberately not published (see
// config/legal.ts). ⚠️ Have them checked before launch, the consumer mediator (article 14) in
// particular.
export default function CGV() {
  return (
    <LegalPage title="Conditions générales de vente">
      <p className="text-foreground">
        L'essentiel, en clair. Ces conditions s'appliquent à l'abonnement {LEGAL.siteName}. En vous abonnant, vous les
        acceptez. Elles ne vous retirent aucun droit que la loi vous accorde.
      </p>

      <LegalSection title="1. Qui vend">
        <p>
          {LEGAL.siteName} est un service édité par {LEGAL.editorName}, {LEGAL.editorStatus.toLowerCase()} (SIRET{" "}
          {LEGAL.siret}). Contact : <SupportEmail />.
        </p>
        <p>
          Le paiement est encaissé par Whop (whop.com), notre prestataire de paiement. {LEGAL.editorName} reste votre
          vendeur et votre seul interlocuteur pour le service, le remboursement et la rétractation.
        </p>
      </LegalSection>

      <LegalSection title="2. Ce que fait MakeSaaS">
        {/* ⚠️ PLACEHOLDER: keep in line with what the app really provides. */}
        <p>
          {LEGAL.siteName} vous aide à lancer votre premier business en ligne. Répondre aux questions du début est
          gratuit. Avec l'abonnement, vous accédez à votre plan personnalisé, à {COACH_NAME}, votre coach, qui connaît
          votre projet, et aux outils pour créer votre site et trouver vos premiers clients.
        </p>
        <p>
          Les réponses de {COACH_NAME} et les contenus générés pour vous sont produits par une intelligence
          artificielle. Ils peuvent contenir des erreurs et ne remplacent pas l'avis d'un professionnel du droit, de la
          fiscalité ou de la finance.
        </p>
      </LegalSection>

      <LegalSection title="3. Aucune garantie de revenu">
        <p>
          {LEGAL.siteName} est un outil d'accompagnement. Il ne garantit <span className={strong}>aucun revenu, aucun
          client et aucun résultat</span>. Les montants que vous indiquez sont vos objectifs, pas des prévisions, et
          les projections affichées sont des estimations. Ce que vous obtenez dépend de votre travail, de votre projet
          et de votre marché.
        </p>
      </LegalSection>

      <LegalSection title="4. Âge">
        <p>
          {LEGAL.siteName} est réservé aux personnes de 18 ans et plus. En vous abonnant, vous déclarez avoir au moins
          18 ans.
        </p>
      </LegalSection>

      <LegalSection title="5. Prix et paiement">
        <p>
          {LEGAL.siteName} propose un abonnement unique, <span className={strong}>{PLAN.name}</span>, payable selon
          l'offre choisie par période d'un mois, de trois mois ou de douze mois : toutes donnent le même accès. Le prix
          toutes taxes comprises de chaque offre est affiché avant le paiement : le prix applicable est celui affiché au
          moment de votre achat. TVA non applicable, article 293 B du Code général des impôts.
        </p>
        <p>
          Le prix de la période choisie est prélevé à la souscription, puis au début de chaque nouvelle période, jusqu'à
          la résiliation. Vous payez
          par carte ou par les moyens proposés dans la fenêtre de paiement sécurisée de Whop : {LEGAL.siteName} n'a
          jamais accès aux données de votre carte.
        </p>
        <p>
          En cas de changement de prix, nous vous prévenons par e-mail au moins 30 jours avant votre prochain
          prélèvement. Vous pouvez alors résilier sans frais.
        </p>
      </LegalSection>

      <LegalSection title="6. Sans engagement, résiliation en ligne">
        <p>
          L'abonnement est sans engagement. Vous pouvez le résilier à tout moment, en ligne, depuis votre compte
          (Paramètres, « Résilier ») ou en écrivant à <SupportEmail />. La résiliation arrête les
          prélèvements suivants, et vous gardez l'accès jusqu'à la fin de la période déjà payée.
        </p>
      </LegalSection>

      <LegalSection title="7. Rétractation et remboursement">
        <p>
          Vous disposez de 14 jours après votre premier paiement pour vous rétracter, sans justification,
          <span className={strong}> tant que vous n'avez pas commencé à utiliser {LEGAL.siteName}</span>. Utiliser{" "}
          {LEGAL.siteName}, c'est envoyer un message à {COACH_NAME}, ouvrir votre plan ou une tâche de votre roadmap, ou
          utiliser un outil de l'application. En demandant l'accès immédiat au service lors de la souscription, vous
          acceptez que, dès cette première utilisation, le service vous ait été fourni et que votre droit de
          rétractation ne puisse plus être exercé (articles L.221-25 et L.221-28 du Code de la consommation).
        </p>
        <p>
          Pour vous rétracter, écrivez à <SupportEmail /> avec l'adresse e-mail de votre compte. Si votre demande remplit
          ces conditions, nous vous remboursons sous 14 jours sur votre moyen de paiement et vous le confirmons par
          e-mail.
        </p>
        <p>
          Les renouvellements ne sont pas remboursés, et une période commencée n'est pas remboursée au prorata. Exceptions : la
          garantie {LEGAL.siteName} (article 8), une suspension de compte qui ne vous est pas imputable (article 9), une
          erreur de notre part ou une obligation légale.
        </p>
      </LegalSection>

      <LegalSection id="garantie" title={`8. Garantie ${LEGAL.siteName}`}>
        {/* Same conditions as FirstMRR's guarantee: an offer you can pay for, online before the first
            video, then 6 videos in 48 hours. */}
        <p>
          En plus de ce droit, et <span className={strong}>même si vous avez utilisé {LEGAL.siteName}</span>, votre
          premier paiement vous est remboursé si :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>vous avez mis votre offre en ligne, avec un paiement possible, avant votre première vidéo ;</li>
          <li>
            vous avez publié au moins 6 vidéos dans les 48 heures, dont la première dans les 24 heures qui suivent votre
            paiement, dans les formats recommandés par votre plan ;
          </li>
          <li>et vous n'avez réalisé aucune vente.</li>
        </ul>
        <p>
          Pour en bénéficier, écrivez à <SupportEmail /> au plus tard 30 jours après votre premier paiement, avec
          l'adresse e-mail de votre compte, le lien de votre offre et les liens de vos vidéos. Nous vérifions ces
          conditions et vous remboursons sous 14 jours. La garantie s'applique une seule fois par personne, au premier
          paiement uniquement.
        </p>
      </LegalSection>

      <LegalSection title="9. Votre compte">
        <p>
          Votre accès est personnel : gardez vos identifiants pour vous. Il est interdit de revendre ou de partager
          l'abonnement, de tenter d'accéder aux données d'autres membres, de perturber le service ou de l'utiliser pour
          des activités illégales ou trompeuses, comme promettre des revenus à des tiers.
        </p>
        <p>
          En cas d'abus grave, nous pouvons suspendre votre accès après vous avoir prévenu, sauf urgence. Si la
          suspension ne vous est pas imputable, nous vous remboursons la période restante.
        </p>
      </LegalSection>

      <LegalSection title="10. Vos contenus">
        <p>
          Vos réponses, vos idées et ce que vous écrivez dans {LEGAL.siteName} vous appartiennent. Vous pouvez réutiliser
          librement les plans, messages et textes produits pour vous. Le logiciel, la marque et les contenus de{" "}
          {LEGAL.siteName} restent la propriété de leur éditeur.
        </p>
      </LegalSection>

      <LegalSection title="11. Disponibilité et évolutions">
        <p>
          Nous faisons de notre mieux pour que le service fonctionne en continu, sans pouvoir garantir l'absence de
          panne. Le service évolue : nous pouvons ajouter, modifier ou retirer des fonctionnalités, sans retirer
          l'essentiel de ce que vous avez payé. Si une modification vous pénalise, vous pouvez résilier sans frais.
        </p>
      </LegalSection>

      <LegalSection title="12. Responsabilité">
        <p>
          Nous sommes responsables de fournir le service décrit ici. Le projet que vous lancez est le vôtre : les idées
          et les conseils de {LEGAL.siteName} sont des suggestions, et c'est vous qui décidez de les suivre. Vous êtes
          seul responsable de votre site, de ce qu'il vend et de sa conformité à la loi. Nous ne sommes responsables ni
          de vos décisions, ni de vos résultats, ni des services de tiers que vous choisissez d'utiliser. Rien dans ces
          conditions ne limite notre responsabilité au-delà de ce que la loi permet.
        </p>
      </LegalSection>

      <LegalSection title="13. Données personnelles">
        <p>
          La façon dont nous traitons vos données est expliquée dans la{" "}
          <Link href="/confidentialite" className={link}>politique de confidentialité</Link>. Ces conditions complètent
          les <Link href="/cgu" className={link}>conditions générales d'utilisation</Link>.
        </p>
      </LegalSection>

      <LegalSection title="14. Une question, un problème">
        {/* ⚠️ PLACEHOLDER: name the consumer mediator you have joined (required to sell to consumers in France). */}
        <p>
          Écrivez-nous à <SupportEmail /> : nous répondons sous 48 heures ouvrées. Si aucune solution n'est trouvée
          ensemble, vous pouvez recourir gratuitement à un médiateur de la consommation (articles L.611-1 et suivants du
          Code de la consommation) ou à la plateforme européenne de règlement en ligne des litiges. Ces conditions sont
          soumises au droit français ; à défaut d'accord, le litige est porté devant les juridictions compétentes.
        </p>
      </LegalSection>

      <LegalSection title="15. Modifications de ces conditions">
        <p>
          Nous pouvons mettre ces conditions à jour : la date en haut de la page change à chaque version. Si un
          changement important vous concerne, nous vous prévenons par e-mail avant qu'il s'applique, et vous pouvez
          résilier si vous n'êtes pas d'accord.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
