import { LegalPage, LegalSection, SupportEmail } from "@/components/legal/LegalPage";
import { LEGAL } from "@/config/legal";

export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité">
      <LegalSection title="1. Responsable du traitement">
        <p>
          Le responsable du traitement de vos données personnelles est {LEGAL.editorName},{" "}
          {LEGAL.editorStatus.toLowerCase()} (SIRET {LEGAL.siret}), éditeur de {LEGAL.siteName}. Pour toute question
          relative à vos données : <SupportEmail />.
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="text-foreground">Compte</span> : adresse email, nom et photo de profil (si vous vous
            connectez avec Google), mot de passe chiffré.
          </li>
          <li>
            <span className="text-foreground">Abonnement</span> : offre souscrite, statut et dates de l'abonnement,
            identifiants de l'abonnement chez notre prestataire de paiement. Vos coordonnées bancaires sont traitées
            uniquement par ce prestataire.
          </li>
          <li>
            <span className="text-foreground">Utilisation du service</span> : date de dernière activité, contenus
            envoyés aux fonctionnalités d'IA.
          </li>
          <li>
            <span className="text-foreground">Provenance</span> : site ou campagne par lequel vous avez découvert{" "}
            {LEGAL.siteName} (paramètres UTM, site référent), enregistré lors de l'inscription.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalités et bases légales">
        <ul className="list-disc space-y-1 pl-5">
          <li>Créer et gérer votre compte, fournir le service : exécution du contrat (CGU/CGV).</li>
          <li>Gérer votre abonnement et les paiements : exécution du contrat.</li>
          <li>Répondre à vos demandes au service client : exécution du contrat et intérêt légitime.</li>
          <li>Mesurer l'efficacité de nos canaux d'acquisition et améliorer le service : intérêt légitime.</li>
          <li>Prévenir la fraude et les abus, sécuriser le service : intérêt légitime.</li>
          <li>Respecter nos obligations comptables et légales : obligation légale.</li>
        </ul>
        <p>Vos données ne sont jamais vendues ni utilisées à des fins publicitaires.</p>
      </LegalSection>

      <LegalSection title="4. Destinataires et sous-traitants">
        <p>Vos données sont accessibles à l'éditeur et aux prestataires strictement nécessaires au service :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase : base de données et authentification ;</li>
          <li>Railway : hébergement du site ;</li>
          <li>Whop : paiement et gestion des abonnements ;</li>
          <li>Google : connexion avec un compte Google, si vous choisissez cette option ;</li>
          <li>Amplitude : mesure d'audience et enregistrement des sessions sur le site (voir la section 6) ;</li>
          <li>OneShotAPI : génération des contenus IA (contenu des textes envoyés).</li>
        </ul>
        <p>
          Certains prestataires étant situés hors de l'Union européenne (notamment aux États-Unis), les transferts sont encadrés
          par les clauses contractuelles types de la Commission européenne ou par le Data Privacy Framework.
        </p>
      </LegalSection>

      <LegalSection title="5. Durée de conservation">
        <ul className="list-disc space-y-1 pl-5">
          <li>Données du compte et d'utilisation : tant que le compte est actif, puis supprimées à sa suppression.</li>
          <li>Textes envoyés à l'IA : transmis pour générer la réponse, non conservés sur nos serveurs.</li>
          <li>Données de facturation : 10 ans, conformément aux obligations comptables.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Cookies et stockage local">
        <p>
          {LEGAL.siteName} n'utilise aucun cookie publicitaire. Le site enregistre dans votre navigateur les informations
          nécessaires à son fonctionnement : votre session de connexion, la progression de votre inscription et,
          pendant 30 jours au plus, la source de votre première visite. Le module de paiement Whop peut déposer ses
          propres cookies nécessaires au paiement.
        </p>
        <p>
          Pour comprendre où le parcours d'inscription bloque et l'améliorer, {LEGAL.siteName} utilise Amplitude, qui
          enregistre un identifiant dans votre navigateur. Il mesure les pages vues, les clics, les écrans de
          l'inscription parcourus et les réponses aux questions à choix (jamais les réponses écrites), et enregistre
          les sessions : les champs saisis y sont toujours masqués, et tous les textes une fois dans l'application.
        </p>
      </LegalSection>

      <LegalSection title="7. Sécurité">
        <p>
          Les échanges sont chiffrés (HTTPS), les mots de passe ne sont jamais stockés en clair et l'accès aux données
          est restreint par des règles de sécurité au niveau de la base de données : chaque utilisateur n'accède qu'à
          ses propres données.
        </p>
      </LegalSection>

      <LegalSection title="8. Vos droits">
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d'un droit d'accès, de rectification,
          d'effacement, de limitation, de portabilité et d'opposition sur vos données, ainsi que du droit de définir
          des directives relatives à leur sort après votre décès.
        </p>
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis la page Paramètres. Pour exercer vos autres droits,
          écrivez à <SupportEmail />. Nous répondons dans un délai d'un mois.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la
          CNIL (cnil.fr).
        </p>
      </LegalSection>

      <LegalSection title="9. Mineurs">
        <p>
          Le service est réservé aux personnes majeures. Nous ne collectons pas sciemment de données concernant des
          mineurs.
        </p>
      </LegalSection>

      <LegalSection title="10. Modification de la politique">
        <p>
          Cette politique peut être mise à jour. En cas de modification substantielle, les utilisateurs en sont
          informés.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
