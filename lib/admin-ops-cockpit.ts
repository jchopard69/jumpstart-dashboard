export type AdminOpsCockpitInput = {
  tenantsCount: number;
  accountsCount: number;
  failedSyncCount: number;
  disconnectedAccountCount: number;
  unreadNotificationCount: number;
  latestSyncStatus: string | null;
  latestSyncAt: string | null;
  now?: Date;
};

export type AdminOpsCockpit = {
  status: "healthy" | "watch" | "risk";
  label: string;
  score: number;
  summary: string;
  nextAction: string;
  proof: string;
  priorityHref: "/admin/health" | "/admin/clients";
};

const DAY_MS = 1000 * 60 * 60 * 24;

function daysSince(value: string | null, now: Date) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

export function buildAdminOpsCockpit(input: AdminOpsCockpitInput): AdminOpsCockpit {
  const now = input.now ?? new Date();
  const latestSyncAge = daysSince(input.latestSyncAt, now);
  const hasNoClients = input.tenantsCount <= 0;
  const hasNoAccounts = input.accountsCount <= 0;
  const syncIsStale = latestSyncAge === null || latestSyncAge >= 2;

  if (hasNoClients || hasNoAccounts) {
    return {
      status: "risk",
      label: "Setup incomplet",
      score: hasNoClients ? 28 : 42,
      summary: hasNoClients
        ? "Aucun client actif n'est disponible dans l'espace agence."
        : "Les clients existent, mais aucun compte social n'est connecté.",
      nextAction: hasNoClients
        ? "Créer ou réactiver un client avant de piloter le dashboard."
        : "Ouvrir les clients et connecter les comptes sociaux prioritaires.",
      proof: `${input.tenantsCount} client${input.tenantsCount > 1 ? "s" : ""}, ${input.accountsCount} compte${input.accountsCount > 1 ? "s" : ""}`,
      priorityHref: "/admin/clients",
    };
  }

  if (input.disconnectedAccountCount > 0) {
    return {
      status: "risk",
      label: "Connexions à réparer",
      score: 55,
      summary: "Des comptes expirés ou révoqués peuvent bloquer la valeur client.",
      nextAction: "Prioriser les reconnexions avant le prochain reporting client.",
      proof: `${input.disconnectedAccountCount} compte${input.disconnectedAccountCount > 1 ? "s" : ""} à reconnecter`,
      priorityHref: "/admin/health",
    };
  }

  if (input.failedSyncCount > 0 || input.latestSyncStatus === "failed") {
    return {
      status: "risk",
      label: "Synchronisations KO",
      score: 58,
      summary: "Des synchronisations récentes sont en échec et peuvent fausser les dashboards.",
      nextAction: "Ouvrir la santé système, identifier les tenants touchés et relancer les syncs.",
      proof: `${input.failedSyncCount} échec${input.failedSyncCount > 1 ? "s" : ""} récent${input.failedSyncCount > 1 ? "s" : ""}`,
      priorityHref: "/admin/health",
    };
  }

  if (input.unreadNotificationCount > 0) {
    return {
      status: "watch",
      label: "Alertes à traiter",
      score: 72,
      summary: "Le système est stable, mais des alertes client restent non traitées.",
      nextAction: "Lire les alertes non vues et documenter l'action réalisée côté client.",
      proof: `${input.unreadNotificationCount} notification${input.unreadNotificationCount > 1 ? "s" : ""} non lue${input.unreadNotificationCount > 1 ? "s" : ""}`,
      priorityHref: "/admin/health",
    };
  }

  if (syncIsStale) {
    return {
      status: "watch",
      label: "Sync à rafraîchir",
      score: 76,
      summary: "Les données semblent stables, mais la dernière synchronisation est ancienne ou inconnue.",
      nextAction: "Vérifier le cron global et relancer une synchronisation avant les prochains points clients.",
      proof: latestSyncAge === null ? "Aucune synchronisation récente" : `Dernière sync il y a ${latestSyncAge} jours`,
      priorityHref: "/admin/health",
    };
  }

  return {
    status: "healthy",
    label: "Ops sous contrôle",
    score: 94,
    summary: "Les synchronisations, connexions et alertes sont dans un état exploitable.",
    nextAction: "Continuer la surveillance et traiter les signaux faibles depuis les fiches clients.",
    proof: `${input.tenantsCount} client${input.tenantsCount > 1 ? "s" : ""}, ${input.accountsCount} compte${input.accountsCount > 1 ? "s" : ""} connecté${input.accountsCount > 1 ? "s" : ""}`,
    priorityHref: "/admin/health",
  };
}
