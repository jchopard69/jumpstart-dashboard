export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">JumpStart Studio</p>
      <h1 className="page-heading mt-2">Conditions d'utilisation</h1>
      <p className="mt-4 text-sm text-muted-foreground">Dernière mise à jour : 23 janvier 2026</p>

      <section className="mt-10 space-y-4 text-sm text-muted-foreground">
        <p>
          Les présentes Conditions d'utilisation ("Conditions") régissent l'accès et l'utilisation
          de la plateforme JumpStart OS (le "Service") fournie par JumpStart Studio.
          En accédant au Service, vous acceptez ces Conditions.
        </p>

        <h2 className="text-base font-semibold text-foreground">1. Accès au Service</h2>
        <p>
          L'accès est réservé aux utilisateurs autorisés par JumpStart Studio. Vous êtes responsable
          de la confidentialité de vos identifiants et de toute activité effectuée via votre compte.
        </p>

        <h2 className="text-base font-semibold text-foreground">2. Description du Service</h2>
        <p>
          JumpStart OS fournit un tableau de bord de performance social media, un espace de collaboration
          et un suivi des livrables. Les données sont synchronisées depuis des plateformes tierces
          autorisées par le client.
        </p>

        <h2 className="text-base font-semibold text-foreground">3. Utilisation acceptable</h2>
        <p>
          Vous vous engagez à utiliser le Service de manière licite, à ne pas perturber son fonctionnement
          et à ne pas tenter d'accéder à des données qui ne vous sont pas destinées.
        </p>

        <h2 className="text-base font-semibold text-foreground">4. Données et contenus</h2>
        <p>
          Les données affichées proviennent de sources tierces. JumpStart Studio ne garantit pas
          l'exactitude ou la disponibilité permanente de ces données.
        </p>

        <h2 className="text-base font-semibold text-foreground">5. Propriété intellectuelle</h2>
        <p>
          Le Service, ses interfaces, et ses contenus sont protégés. Aucune partie ne peut être
          reproduite sans autorisation écrite préalable de JumpStart Studio.
        </p>

        <h2 className="text-base font-semibold text-foreground">6. Confidentialité</h2>
        <p>
          JumpStart Studio met en œuvre des mesures raisonnables pour protéger les données. Vous êtes
          responsable des accès accordés aux membres de votre organisation.
        </p>

        <h2 className="text-base font-semibold text-foreground">7. Suspension et résiliation</h2>
        <p>
          JumpStart Studio peut suspendre l'accès en cas d'usage abusif, de violation des Conditions,
          ou pour des raisons de sécurité.
        </p>

        <h2 className="text-base font-semibold text-foreground">8. Limitation de responsabilité</h2>
        <p>
          JumpStart Studio ne pourra être tenue responsable des pertes indirectes, de l'indisponibilité
          des plateformes tierces, ni des décisions prises sur la base des données affichées.
        </p>

        <h2 className="text-base font-semibold text-foreground">9. Contact</h2>
        <p>
          Pour toute question : contact@jumpstartstudio.fr
        </p>
      </section>
    </main>
  );
}

export const dynamic = "force-static";
