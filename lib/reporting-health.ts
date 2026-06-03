export type ReportScheduleHealthInput = {
  id: string;
  frequency: "weekly" | "monthly";
  recipients: string[];
  is_active: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
};

export type ReportingHealth = {
  status: "healthy" | "watch" | "risk";
  label: string;
  score: number;
  summary: string;
  nextAction: string;
  proof: string;
  activeCount: number;
  recipientCount: number;
  nextSendAt: string | null;
  lastSentAt: string | null;
};

type BuildReportingHealthParams = {
  schedules: ReportScheduleHealthInput[];
  now?: Date;
};

const DAY_MS = 1000 * 60 * 60 * 24;

function daysUntil(dateValue: string | null, now: Date) {
  if (!dateValue) return null;
  return Math.ceil((new Date(dateValue).getTime() - now.getTime()) / DAY_MS);
}

function daysSince(dateValue: string | null, now: Date) {
  if (!dateValue) return null;
  return Math.floor((now.getTime() - new Date(dateValue).getTime()) / DAY_MS);
}

function uniqueRecipients(schedules: ReportScheduleHealthInput[]) {
  return new Set(
    schedules.flatMap((schedule) =>
      schedule.recipients.map((recipient) => recipient.trim().toLowerCase()).filter(Boolean)
    )
  ).size;
}

export function buildReportingHealth({
  schedules,
  now = new Date(),
}: BuildReportingHealthParams): ReportingHealth {
  const activeSchedules = schedules.filter((schedule) => schedule.is_active);
  const recipientCount = uniqueRecipients(activeSchedules);
  const nextSendAt = activeSchedules
    .map((schedule) => schedule.next_send_at)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;
  const lastSentAt = schedules
    .map((schedule) => schedule.last_sent_at)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const nextSendDays = daysUntil(nextSendAt, now);
  const lastSentDays = daysSince(lastSentAt, now);

  if (schedules.length === 0) {
    return {
      status: "risk",
      label: "À configurer",
      score: 35,
      summary: "Aucun rapport automatique n'est configuré pour installer un rituel client.",
      nextAction: "Créer un envoi hebdomadaire avec les décideurs et l'équipe opérationnelle.",
      proof: "0 rapport configuré",
      activeCount: 0,
      recipientCount: 0,
      nextSendAt: null,
      lastSentAt: null,
    };
  }

  if (activeSchedules.length === 0) {
    return {
      status: "risk",
      label: "Inactif",
      score: 42,
      summary: "Des rapports existent, mais aucun envoi automatique n'est actif.",
      nextAction: "Réactiver au moins un rapport ou supprimer les rythmes obsolètes.",
      proof: `${schedules.length} rapport${schedules.length > 1 ? "s" : ""} inactif${schedules.length > 1 ? "s" : ""}`,
      activeCount: 0,
      recipientCount: 0,
      nextSendAt,
      lastSentAt,
    };
  }

  if (recipientCount === 0) {
    return {
      status: "risk",
      label: "Destinataires manquants",
      score: 45,
      summary: "Un envoi actif sans destinataire utile ne peut pas créer de suivi client.",
      nextAction: "Ajouter les emails client à la planification active.",
      proof: `${activeSchedules.length} rapport${activeSchedules.length > 1 ? "s" : ""} actif${activeSchedules.length > 1 ? "s" : ""}, 0 destinataire`,
      activeCount: activeSchedules.length,
      recipientCount,
      nextSendAt,
      lastSentAt,
    };
  }

  if (nextSendDays === null) {
    return {
      status: "watch",
      label: "Date à vérifier",
      score: 62,
      summary: "Le reporting est actif, mais la prochaine date d'envoi n'est pas visible.",
      nextAction: "Recalculer ou modifier la fréquence du rapport actif.",
      proof: `${activeSchedules.length} rapport${activeSchedules.length > 1 ? "s" : ""} actif${activeSchedules.length > 1 ? "s" : ""}`,
      activeCount: activeSchedules.length,
      recipientCount,
      nextSendAt,
      lastSentAt,
    };
  }

  if (nextSendDays < 0) {
    return {
      status: "risk",
      label: "Envoi en retard",
      score: 48,
      summary: "La prochaine date d'envoi est passée, le rituel client risque de ne plus partir.",
      nextAction: "Relancer le cron d'envoi ou modifier la planification pour recalculer la prochaine échéance.",
      proof: `En retard de ${Math.abs(nextSendDays)} jour${Math.abs(nextSendDays) > 1 ? "s" : ""}`,
      activeCount: activeSchedules.length,
      recipientCount,
      nextSendAt,
      lastSentAt,
    };
  }

  if (lastSentDays !== null && lastSentDays > 45) {
    return {
      status: "watch",
      label: "Rythme à surveiller",
      score: 68,
      summary: "Le reporting est actif, mais aucun envoi récent n'a été enregistré.",
      nextAction: "Vérifier l'historique d'envoi et les destinataires avant la prochaine échéance.",
      proof: `Dernier envoi il y a ${lastSentDays} jours`,
      activeCount: activeSchedules.length,
      recipientCount,
      nextSendAt,
      lastSentAt,
    };
  }

  const hasWeekly = activeSchedules.some((schedule) => schedule.frequency === "weekly");
  return {
    status: hasWeekly ? "healthy" : "watch",
    label: hasWeekly ? "Rituel actif" : "Rythme mensuel",
    score: hasWeekly ? 92 : 76,
    summary: hasWeekly
      ? "Le reporting automatique soutient un suivi client régulier."
      : "Le reporting mensuel est actif, mais un rythme hebdomadaire peut renforcer le pilotage.",
    nextAction: hasWeekly
      ? "Surveiller les prochains envois et garder les destinataires à jour."
      : "Ajouter un point hebdomadaire si le client attend un suivi plus opérationnel.",
    proof: `${activeSchedules.length} actif${activeSchedules.length > 1 ? "s" : ""}, ${recipientCount} destinataire${recipientCount > 1 ? "s" : ""}`,
    activeCount: activeSchedules.length,
    recipientCount,
    nextSendAt,
    lastSentAt,
  };
}
