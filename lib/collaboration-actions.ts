import type { CollaborationData, DocumentData, UpcomingShoot } from "./types/dashboard";

export type CollaborationDocumentSignal = DocumentData & {
  created_at?: string | null;
  pinned?: boolean | null;
};

export type CollaborationNextAction = {
  id: string;
  label: string;
  title: string;
  detail: string;
  proof: string;
  href: string;
  priority: "high" | "medium" | "low";
};

type BuildCollaborationActionsParams = {
  collaboration: CollaborationData | null;
  shoots: UpcomingShoot[];
  documents: CollaborationDocumentSignal[];
  now?: Date;
};

const DAY_MS = 1000 * 60 * 60 * 24;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysUntil(dateValue: string, now: Date) {
  const target = startOfDay(new Date(dateValue));
  return Math.ceil((target.getTime() - startOfDay(now).getTime()) / DAY_MS);
}

function daysSince(dateValue: string | null | undefined, now: Date) {
  if (!dateValue) return null;
  return Math.floor((startOfDay(now).getTime() - startOfDay(new Date(dateValue)).getTime()) / DAY_MS);
}

function formatCountdown(days: number) {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days < 0) return `il y a ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}`;
  return `dans ${days} jour${days > 1 ? "s" : ""}`;
}

export function buildCollaborationNextActions({
  collaboration,
  shoots,
  documents,
  now = new Date(),
}: BuildCollaborationActionsParams): CollaborationNextAction[] {
  const actions: CollaborationNextAction[] = [];
  const futureShoots = shoots
    .map((shoot) => ({ shoot, days: daysUntil(shoot.shoot_date, now) }))
    .filter(({ days }) => days >= 0)
    .sort((a, b) => a.days - b.days);
  const nextShoot = futureShoots[0];
  const pinnedDocuments = documents.filter((document) => Boolean(document.pinned));
  const latestDocument = [...documents].sort((a, b) => {
    const aTime = new Date(a.created_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? 0).getTime();
    return bTime - aTime;
  })[0];
  const notesAgeDays = daysSince(collaboration?.updated_at, now);
  const shootDays = collaboration?.shoot_days_remaining ?? 0;

  if (shootDays <= 0) {
    actions.push({
      id: "collaboration-plan-shoot-days",
      label: "Production",
      title: "Replanifier le crédit de tournage",
      detail: "Le compteur de jours disponibles est à zéro. Il faut valider un nouveau créneau ou confirmer que la production est terminée.",
      proof: "0 jour de tournage restant",
      href: "#collaboration-shoots",
      priority: "high",
    });
  } else if (nextShoot && nextShoot.days <= 7) {
    actions.push({
      id: "collaboration-prepare-next-shoot",
      label: "À préparer",
      title: "Verrouiller le prochain tournage",
      detail: "Brief, lieu, objectifs de contenu et contraintes doivent être confirmés avant le créneau.",
      proof: `${nextShoot.shoot.location ?? "Lieu à définir"} ${formatCountdown(nextShoot.days)}`,
      href: "#collaboration-shoots",
      priority: nextShoot.days <= 2 ? "high" : "medium",
    });
  } else if (!nextShoot) {
    actions.push({
      id: "collaboration-schedule-next-shoot",
      label: "Planning",
      title: "Planifier le prochain tournage",
      detail: "Aucun shooting futur n'est visible dans l'espace client. Ajouter une date améliore la visibilité opérationnelle.",
      proof: `${shootDays} jour${shootDays > 1 ? "s" : ""} disponible${shootDays > 1 ? "s" : ""}`,
      href: "#collaboration-shoots",
      priority: "medium",
    });
  }

  if (pinnedDocuments.length > 0) {
    actions.push({
      id: "collaboration-review-pinned-documents",
      label: "Livrables",
      title: "Revoir les documents épinglés",
      detail: "Les documents mis en avant doivent servir de référence au brief, aux retours et à la validation client.",
      proof: `${pinnedDocuments.length} document${pinnedDocuments.length > 1 ? "s" : ""} épinglé${pinnedDocuments.length > 1 ? "s" : ""}`,
      href: "#collaboration-documents",
      priority: "medium",
    });
  } else if (latestDocument) {
    actions.push({
      id: "collaboration-check-latest-document",
      label: "Livrable",
      title: "Valider le dernier document partagé",
      detail: "Le dernier ajout peut contenir un brief, un planning ou un retour à intégrer dans la production.",
      proof: latestDocument.file_name,
      href: "#collaboration-documents",
      priority: "low",
    });
  }

  if (notesAgeDays === null || notesAgeDays >= 14) {
    actions.push({
      id: "collaboration-refresh-notes",
      label: "Suivi",
      title: "Mettre à jour le carnet de bord",
      detail: "Actualiser les décisions, blocages et prochains retours évite les pertes d'information entre client et studio.",
      proof: notesAgeDays === null ? "Aucune mise à jour enregistrée" : `Dernière mise à jour il y a ${notesAgeDays} jours`,
      href: "#collaboration-notes",
      priority: notesAgeDays === null || notesAgeDays >= 30 ? "medium" : "low",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "collaboration-healthy-loop",
      label: "Suivi",
      title: "Continuer le rythme de production",
      detail: "Le planning, les livrables et le carnet de bord sont suffisamment à jour pour garder le suivi fluide.",
      proof: "Collaboration à jour",
      href: "#collaboration-shoots",
      priority: "low",
    });
  }

  return actions
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 3);
}
