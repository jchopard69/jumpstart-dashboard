import { Resend } from "resend";

const FROM_ADDRESS =
  process.env.RESEND_FROM || "JumpStart Studio <reports@jumpstartstudio.fr>";

export async function sendReportEmail({
  to,
  tenantName,
  frequency,
  pdfBuffer,
}: {
  to: string[];
  tenantName: string;
  frequency: "weekly" | "monthly";
  pdfBuffer: Buffer;
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not configured");
    return { success: false, error: "RESEND_API_KEY manquant" };
  }

  const resend = new Resend(apiKey);
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = tenantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+$/, "");

  const subject = `Rapport ${frequency === "weekly" ? "hebdomadaire" : "mensuel"} - ${tenantName}`;
  const periodLabel =
    frequency === "weekly" ? "hebdomadaire" : "mensuel";

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f8f9fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
    <tr>
      <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);padding:32px 24px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">JumpStart Studio</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Rapport ${periodLabel}</p>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:32px 24px;">
        <p style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.6;">
          Bonjour,
        </p>
        <p style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.6;">
          Votre rapport ${periodLabel} pour <strong>${tenantName}</strong> est en piece jointe de cet email.
        </p>
        <p style="margin:0 0 24px;color:#64748b;font-size:13px;line-height:1.5;">
          Ce rapport contient une analyse de vos performances sur les reseaux sociaux,
          incluant vos KPIs, votre score JumpStart et des recommandations strategiques.
        </p>
        <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            Ce rapport a ete genere automatiquement le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.
          </p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#f1f5f9;padding:16px 24px;border-radius:0 0 12px 12px;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:11px;">
          JumpStart Studio &mdash; Votre partenaire social media
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      attachments: [
        {
          filename: `rapport-${safeName}-${dateStr}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("[email] Resend API error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur inconnue lors de l'envoi";
    console.error("[email] Send failed:", message);
    return { success: false, error: message };
  }
}
