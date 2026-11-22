import { Link } from "wouter";
import { LegalPage, LegalSection, SupportEmail } from "@/components/legal/LegalPage";
import { LEGAL } from "@/config/legal";

const link = "text-foreground underline underline-offset-2 hover:text-primary";

export default function CGU() {
  return (
    <LegalPage title="Conditions générales d'utilisation">
      <LegalSection title="1. Objet">
        <p>
          Les présentes conditions générales d'utilisation (CGU) encadrent l'accès et l'utilisation du site{" "}
          {LEGAL.domain} et du service en ligne {LEGAL.siteName}, édité par {LEGAL.editorName},{" "}
          {LEGAL.editorStatus.toLowerCase()} (SIRET {LEGAL.siret}).
        </p>
        <p>
          Les conditions de souscription et de paiement des abonnements sont régies par les{" "}
          <Link href="/cgv" className={link}>conditions générales de vente</Link> (CGV).
        </p>
      </LegalSection>

      <LegalSection title="2. Acceptation">
        <p>
          La création d'un compte vaut acceptation pleine et entière des présentes CGU. Si vous n'acceptez pas ces
          conditions, vous ne devez pas utiliser le service.
        </p>
      </LegalSection>

      <LegalSection title="3. Accès au service">
        <p>
          Le site vitrine et les pages publiques sont accessibles librement. L'accès à l'application est réservé aux
          utilisateurs disposant d'un compte et d'un abonnement payant en cours (offre Starter ou Pro). Il n'existe
          pas d'offre gratuite.
        </p>
        <p>
          Le service est réservé aux personnes majeures (18 ans et plus). En créant un compte, vous déclarez être
          majeur.
        </p>
      </LegalSection>

      <LegalSection title="4. Compte utilisateur">
        <p>
          Vous pouvez créer un compte avec une adresse email et un mot de passe, ou via votre compte Google. Vous vous
          engagez à fournir des informations exactes et à garder vos identifiants confidentiels. Toute action réalisée
          depuis votre compte est réputée faite par vous.
        </p>
        <p>
          Le compte est strictement personnel : il ne peut être ni partagé, ni cédé, ni revendu.
        </p>
      </LegalSection>

      <LegalSection title="5. Description du service">
        {/* ⚠️ PLACEHOLDER: describe your product's features. */}
        <p>{LEGAL.siteName} propose notamment :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>un espace personnel accessible après abonnement ;</li>
          <li>des fonctionnalités s'appuyant sur l'intelligence artificielle.</li>
        </ul>
        <p>
          Le contenu et les fonctionnalités du service peuvent évoluer à tout moment, notamment pour l'améliorer.
        </p>
      </LegalSection>

      <LegalSection title="6. Contenus générés par intelligence artificielle">
        <p>
          Certains contenus du service sont générés par une intelligence artificielle susceptible de commettre des
          erreurs. Ils sont fournis à titre informatif et ne constituent ni une garantie de résultat, ni un conseil
          professionnel. L'utilisateur reste seul responsable de l'usage qu'il fait des informations fournies.
        </p>
      </LegalSection>

      <LegalSection title="7. Utilisations interdites">
        <p>Il est notamment interdit :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>d'extraire ou d'aspirer massivement les contenus du service (scraping, robots) ;</li>
          <li>de revendre, republier ou redistribuer les contenus du service à des fins commerciales ;</li>
          <li>de contourner les limites d'utilisation de votre offre ou les mesures de sécurité du service ;</li>
          <li>d'utiliser les fonctionnalités d'IA pour obtenir des contenus illicites ;</li>
          <li>de porter atteinte au bon fonctionnement du site.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Suspension et suppression du compte">
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis la page Paramètres. Pensez à résilier votre
          abonnement au préalable, la suppression du compte ne valant pas résiliation auprès du prestataire de
          paiement.
        </p>
        <p>
          En cas de manquement aux présentes CGU, l'éditeur peut suspendre ou supprimer le compte concerné, après
          avoir informé l'utilisateur lorsque c'est possible.
        </p>
      </LegalSection>

      <LegalSection title="9. Disponibilité et responsabilité">
        <p>
          L'éditeur met tout en œuvre pour assurer l'accès au service, sans garantir une disponibilité continue. Le
          service peut être interrompu pour maintenance, mise à jour ou en cas d'indisponibilité d'un prestataire. La responsabilité de l'éditeur est limitée aux dommages directs et prévisibles résultant d'un
          manquement prouvé à ses obligations.
        </p>
      </LegalSection>

      <LegalSection title="10. Propriété intellectuelle">
        <p>
          Les contenus du service (textes, interface, logo) restent la propriété de l'éditeur. L'abonnement
          vous confère un droit d'usage personnel et non commercial, pour la durée de votre abonnement.
        </p>
      </LegalSection>

      <LegalSection title="11. Données personnelles">
        <p>
          Le traitement de vos données personnelles est décrit dans la{" "}
          <Link href="/confidentialite" className={link}>politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection title="12. Modification des CGU">
        <p>
          L'éditeur peut modifier les présentes CGU. Les utilisateurs sont informés de toute modification
          substantielle. La poursuite de l'utilisation du service après cette information vaut acceptation des
          nouvelles conditions.
        </p>
      </LegalSection>

      <LegalSection title="13. Droit applicable et contact">
        <p>
          Les présentes CGU sont soumises au droit français. Pour toute question : <SupportEmail />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
