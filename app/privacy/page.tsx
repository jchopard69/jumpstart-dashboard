import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité"
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">JumpStart Studio</p>
      <h1 className="page-heading mt-2">Politique de confidentialité</h1>
      <p className="mt-4 text-sm text-muted-foreground">Dernière mise à jour : 23 janvier 2026</p>

      <section className="mt-10 space-y-4 text-sm text-muted-foreground">
        <p>
          Cette Politique de confidentialité explique comment JumpStart Studio ("nous") collecte,
          utilise et protège les données personnelles dans le cadre de la plateforme JumpStart OS.
        </p>

        <h2 className="text-base font-semibold text-foreground">1. Responsable du traitement</h2>
        <p>
          JumpStart Studio est responsable du traitement des données liées à la gestion des comptes
          clients et à l'administration du Service.
        </p>

        <h2 className="text-base font-semibold text-foreground">2. Données collectées</h2>
        <p>
          Nous collectons notamment : identifiants de compte, informations de contact, profils clients,
          données de performance social media, contenus publiés et éléments de collaboration.
        </p>

        <h2 className="text-base font-semibold text-foreground">3. Finalités</h2>
        <p>
          Les données sont utilisées pour fournir le Service, produire des rapports, améliorer
          l'expérience utilisateur et assurer la sécurité de la plateforme.
        </p>

        <h2 className="text-base font-semibold text-foreground">4. Bases légales</h2>
        <p>
          Le traitement est fondé sur l'exécution du contrat, l'intérêt légitime et, lorsque requis,
          le consentement des utilisateurs.
        </p>

        <h2 className="text-base font-semibold text-foreground">5. Partage des données</h2>
        <p>
          Les données peuvent être partagées avec des prestataires techniques (hébergement, analytics,
          synchronisation via APIs) strictement nécessaires au fonctionnement du Service.
        </p>

        <h2 className="text-base font-semibold text-foreground">6. Conservation</h2>
        <p>
          Les données sont conservées pendant la durée de la relation contractuelle, puis archivées
          selon les obligations légales ou supprimées.
        </p>

        <h2 className="text-base font-semibold text-foreground">7. Sécurité</h2>
        <p>
          Nous mettons en place des mesures techniques et organisationnelles pour protéger les données,
          notamment le chiffrement des accès et des tokens d'API.
        </p>

        <h2 className="text-base font-semibold text-foreground">8. Vos droits</h2>
        <p>
          Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition et de
          portabilité. Pour exercer vos droits, contactez-nous.
        </p>

        <h2 className="text-base font-semibold text-foreground">9. Cookies</h2>
        <p>
          Le Service utilise des cookies strictement nécessaires au fonctionnement. Des cookies
          analytiques peuvent être utilisés si activés.
        </p>

        <h2 className="text-base font-semibold text-foreground">10. Contact</h2>
        <p>
          Pour toute question ou demande relative à vos données : contact@jumpstartstudio.fr
        </p>
      </section>
    </main>
  );
}

export const dynamic = "force-static";
