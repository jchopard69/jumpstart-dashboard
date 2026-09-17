import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PdfDocument } from "@/lib/pdf-document";
import { fetchDashboardAccounts, fetchDashboardData } from "@/lib/queries";
import { prepareReport } from "@/lib/prepare-report";
import { getScheduledReportPeriod } from "@/lib/report-period";
import { sendReportEmail } from "@/lib/email";
import { createTenantNotification } from "@/lib/notifications";

const REPORT_SCHEDULE_LOCK_TIMEOUT_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// computeNextSendAt
// ---------------------------------------------------------------------------

export { computeNextSendAt } from "./report-send-time";
import { computeNextSendAt } from "./report-send-time";
import { getReportRecipients } from "./report-recipients";

// ---------------------------------------------------------------------------
// PDF generation for a tenant (service-level, no user session)
// ---------------------------------------------------------------------------

async function generateTenantPdfBuffer(tenantId: string, frequency: "weekly" | "monthly", scheduledAt: Date): Promise<Buffer> {
  const supabase = createSupabaseServiceClient();
  const { data: tenant, error } = await supabase.from("tenants").select("name,is_demo").eq("id", tenantId).single();
  if (error || !tenant) throw new Error("Impossible de charger le client du rapport.");
  // Called only from the authenticated cron route. The same tenant-scoped reads and
  // report preparation are used by manual exports; no connector or OAuth mutation.
  const profile = { tenant_id: tenantId, role: "agency_admin" };
  const accounts = await fetchDashboardAccounts({ profile, tenantId });
  const period = getScheduledReportPeriod(frequency, scheduledAt);
  const data = await fetchDashboardData({
    profile, tenantId, preset: "custom", from: period.from, to: period.to,
    platforms: [...new Set(accounts.map(account => account.platform))],
  });
  const props = await prepareReport({ data, accounts, tenantName: tenant.name, watermark: tenant.is_demo ? "DEMO" : undefined });
  return Buffer.from(await renderToBuffer(PdfDocument(props)));
}

// ---------------------------------------------------------------------------
// processScheduledReports
// ---------------------------------------------------------------------------

export async function processScheduledReports(): Promise<{
  sent: number;
  errors: number;
  deferred?: number;
}> {
  const startedAt = Date.now();
  const supabase = createSupabaseServiceClient();

  const { data: schedules, error } = await supabase
    .from("report_schedules")
    .select("id,tenant_id,frequency,recipients,is_active,last_sent_at,next_send_at,processing_started_at")
    .eq("is_active", true)
    .lte("next_send_at", new Date().toISOString()).order("next_send_at", { ascending: true });

  if (error) {
    console.error("[report-scheduler] Failed to query schedules:", error.message);
    return { sent: 0, errors: 1 };
  }

  if (!schedules?.length) {
    console.log("[report-scheduler] No reports due");
    return { sent: 0, errors: 0 };
  }

  let sent = 0;
  let errors = 0;

  let deferred = 0;
  for (const [index, schedule] of schedules.entries()) {
    // Do not claim another report near Vercel's 300s deadline. Unclaimed reports
    // remain due and are picked up by the next daily run, oldest first.
    if (Date.now() - startedAt > 210_000) { deferred = schedules.length - index; break; }
    const scheduledAt = new Date(schedule.next_send_at);

    let emailSent = false;
    const lockStartedAt = new Date().toISOString();
    const staleLockBefore = new Date(
      Date.now() - REPORT_SCHEDULE_LOCK_TIMEOUT_MS
    ).toISOString();
    let sentAtIso: string | null = null;
    let nextSendAtIso: string | null = null;

    try {
      const { data: claimedRows, error: claimError } = await supabase
        .from("report_schedules")
        .update({
          processing_started_at: lockStartedAt,
          updated_at: lockStartedAt,
        })
        .eq("id", schedule.id)
        .eq("is_active", true)
        .eq("next_send_at", schedule.next_send_at)
        .or(
          `processing_started_at.is.null,processing_started_at.lt.${staleLockBefore}`
        )
        .select("id")
        .limit(1);

      if (claimError) {
        console.error(
          `[report-scheduler] Failed to claim schedule ${schedule.id}:`,
          claimError.message
        );
        errors++;
        continue;
      }

      if (!claimedRows?.length) {
        console.log(
          `[report-scheduler] Schedule ${schedule.id} already claimed, skipping`
        );
        continue;
      }

      console.log(
        `[report-scheduler] Processing schedule ${schedule.id} for tenant ${schedule.tenant_id}`
      );

      // Get tenant name
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", schedule.tenant_id)
        .single();

      const tenantName = tenant?.name ?? "Client";

      const recipients = await getReportRecipients(schedule.tenant_id, schedule.recipients);
      if (!recipients.length) throw new Error("Aucun destinataire configuré ne dispose encore d’un accès à ce client.");

      // Generate PDF
      const pdfBuffer = await generateTenantPdfBuffer(schedule.tenant_id, schedule.frequency, scheduledAt);

      // Send email
      const result = await sendReportEmail({
        to: recipients,
        idempotencyKey: `report-${schedule.id}-${schedule.next_send_at}`,
        period: getScheduledReportPeriod(schedule.frequency, scheduledAt),
        tenantName,
        frequency: schedule.frequency,
        pdfBuffer,
      });

      if (!result.success) {
        await supabase
          .from("report_schedules")
          .update({
            processing_started_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id)
          .eq("processing_started_at", lockStartedAt);

        console.error(
          `[report-scheduler] Email failed for schedule ${schedule.id}:`,
          result.error
        );

        await createTenantNotification({
          tenantId: schedule.tenant_id,
          type: "info",
          title: "Echec d'envoi du rapport automatique",
          message: (result.error ?? "Erreur inconnue lors de l'envoi").slice(0, 400),
          metadata: {
            schedule_id: schedule.id,
            frequency: schedule.frequency,
            recipients: schedule.recipients,
          },
          dedupeWindowMinutes: 12 * 60,
        });
        errors++;
        continue;
      }

      emailSent = true;
      const now = new Date();
      const nextSend = computeNextSendAt(schedule.frequency, now);
      sentAtIso = now.toISOString();
      nextSendAtIso = nextSend;

      const { data: finalizedSchedule, error: finalizeError } = await supabase
        .from("report_schedules")
        .update({
          processing_started_at: null,
          last_sent_at: sentAtIso,
          next_send_at: nextSend,
          updated_at: sentAtIso,
        })
        .eq("id", schedule.id)
        .eq("processing_started_at", lockStartedAt)
        .select("id")
        .maybeSingle();

      if (finalizeError || !finalizedSchedule) {
        throw new Error(
          `Failed to finalize schedule ${schedule.id}: ${finalizeError?.message ?? "lock lost"}`
        );
      }

      console.log(
        `[report-scheduler] Sent report for schedule ${schedule.id}, next: ${nextSend}`
      );
      await createTenantNotification({ tenantId: schedule.tenant_id, type: 'info', title: 'Rapport accepté par le service email', message: 'Resend a accepté le rapport. La livraison au serveur destinataire reste à vérifier dans Resend.', metadata: { schedule_id: schedule.id, message_id: result.messageId, period: getScheduledReportPeriod(schedule.frequency, scheduledAt) }, dedupeWindowMinutes: 0 });
      sent++;
    } catch (err) {
      if (emailSent && sentAtIso && nextSendAtIso) {
        const { error: rescueFinalizeError } = await supabase
          .from("report_schedules")
          .update({
            processing_started_at: null,
            last_sent_at: sentAtIso,
            next_send_at: nextSendAtIso,
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id);

        if (rescueFinalizeError) {
          console.error(
            `[report-scheduler] Failed to rescue-finalize schedule ${schedule.id}:`,
            rescueFinalizeError.message
          );
        }
      } else {
        await supabase
          .from("report_schedules")
          .update({
            processing_started_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id)
          .eq("processing_started_at", lockStartedAt);

        await createTenantNotification({
          tenantId: schedule.tenant_id,
          type: "info",
          title: "Echec du rapport automatique",
          message: (err instanceof Error ? err.message : String(err)).slice(0, 400),
          metadata: {
            schedule_id: schedule.id,
            frequency: schedule.frequency,
            recipients: schedule.recipients,
          },
          dedupeWindowMinutes: 12 * 60,
        });
      }

      console.error(
        `[report-scheduler] Failed to process schedule ${schedule.id}:`,
        err instanceof Error ? err.message : err
      );
      errors++;
    }
  }

  console.log(`[report-scheduler] Done: ${sent} sent, ${errors} errors`);
  return { sent, errors, deferred };
}
