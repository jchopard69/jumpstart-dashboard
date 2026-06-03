export type ProductionReadinessShoot = {
  shoot_date?: string | null;
  location?: string | null;
};

export type ProductionReadinessDocument = {
  file_name?: string | null;
  name?: string | null;
  tag?: string | null;
};

export type ProductionReadiness = {
  shootDaysRemaining: number;
  nextShootLabel: string;
  nextShootLocation: string;
  documentCount: number;
  featuredDocuments: Array<{ name: string; tag: string }>;
  status: "ready" | "watch" | "quiet";
  statusLabel: string;
  summary: string;
};

function daysUntil(dateValue: string): number | null {
  const frenchDate = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = frenchDate
    ? new Date(Number(frenchDate[3]), Number(frenchDate[2]) - 1, Number(frenchDate[1]))
    : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatShootLabel(dateValue?: string | null): string {
  if (!dateValue) return "Aucun jalon planifié";
  const diff = daysUntil(dateValue);
  if (diff === null) return "Date à confirmer";
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff < 0) return `Passé depuis ${Math.abs(diff)} j`;
  return `Dans ${diff} j`;
}

export function buildProductionReadiness(input: {
  shootDaysRemaining?: number | null;
  shoots?: ProductionReadinessShoot[] | null;
  documents?: ProductionReadinessDocument[] | null;
}): ProductionReadiness {
  const shoots = [...(input.shoots ?? [])]
    .filter((shoot) => Boolean(shoot.shoot_date))
    .sort((a, b) => String(a.shoot_date).localeCompare(String(b.shoot_date)));
  const nextShoot = shoots[0];
  const shootDaysRemaining = Math.max(0, input.shootDaysRemaining ?? 0);
  const documents = (input.documents ?? [])
    .map((document) => ({
      name: document.name ?? document.file_name ?? "Document",
      tag: document.tag ?? "ressource",
    }))
    .filter((document) => document.name.trim().length > 0);

  const status: ProductionReadiness["status"] =
    nextShoot && shootDaysRemaining > 2
      ? "ready"
      : nextShoot || shootDaysRemaining > 0 || documents.length > 0
        ? "watch"
        : "quiet";
  const statusLabel =
    status === "ready"
      ? "Production cadrée"
      : status === "watch"
        ? "À suivre"
        : "Rythme calme";
  const nextShootLabel = formatShootLabel(nextShoot?.shoot_date);
  const nextShootLocation = nextShoot?.location?.trim() || "Lieu à définir";
  const summary =
    status === "ready"
      ? `${shootDaysRemaining} jour${shootDaysRemaining > 1 ? "s" : ""} de shooting disponible${shootDaysRemaining > 1 ? "s" : ""} et prochain jalon ${nextShootLabel.toLowerCase()}.`
      : status === "watch"
        ? "Le pilotage de production mérite une vérification légère sur la prochaine période."
        : "Aucun jalon de production actif sur cette période.";

  return {
    shootDaysRemaining,
    nextShootLabel,
    nextShootLocation,
    documentCount: documents.length,
    featuredDocuments: documents.slice(0, 3),
    status,
    statusLabel,
    summary,
  };
}
