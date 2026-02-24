import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionProfile, requireClientAccess, assertTenant } from "@/lib/auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShootCalendar } from "@/components/os/shoot-calendar";
import { NotesEditor } from "@/components/os/notes-editor";

export const metadata: Metadata = {
  title: "Ma collaboration"
};

export default async function CollaborationPage({
  searchParams
}: {
  searchParams?: { tenantId?: string };
}) {
  const profile = await getSessionProfile();
  if (profile.role === "agency_admin") {
    if (!searchParams?.tenantId && !profile.tenant_id) {
      redirect("/admin");
    }
  } else {
    await requireClientAccess(profile);
  }

  const isAdmin = profile.role === "agency_admin" && !!searchParams?.tenantId;
  const tenantId = isAdmin ? searchParams?.tenantId! : assertTenant(profile);
  const supabase = isAdmin ? createSupabaseServiceClient() : createSupabaseServerClient();
  const canEdit = profile.role === "agency_admin" || profile.role === "client_manager";

  const [{ data: collaboration }, { data: shoots }, { data: documents }] = await Promise.all([
    supabase
      .from("collaboration")
      .select("shoot_days_remaining,notes,updated_at")
      .eq("tenant_id", tenantId)
      .single(),
    supabase
      .from("upcoming_shoots")
      .select("id,shoot_date,location,notes")
      .eq("tenant_id", tenantId)
      .order("shoot_date", { ascending: true }),
    supabase
      .from("documents")
      .select("id,file_name,tag,created_at,file_path,pinned")
      .eq("tenant_id", tenantId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
  ]);

  const signedUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(doc.file_path, 60 * 60);
      return { id: doc.id, url: data?.signedUrl ?? "" };
    })
  );

  const shootDays = collaboration?.shoot_days_remaining ?? 0;

  async function updateNotes(formData: FormData) {
    "use server";
    const notes = String(formData.get("notes") ?? "");
    const client = createSupabaseServerClient();
    await client
      .from("collaboration")
      .upsert({ tenant_id: tenantId, notes, updated_at: new Date().toISOString() });
    revalidatePath("/client/collaboration");
  }

  async function addShoot(formData: FormData) {
    "use server";
    const shootDate = String(formData.get("shoot_date") ?? "");
    const location = String(formData.get("location") ?? "");
    const notes = String(formData.get("notes") ?? "");
    if (!shootDate) return;
    const client = createSupabaseServerClient();
    await client.from("upcoming_shoots").insert({
      tenant_id: tenantId,
      shoot_date: shootDate,
      location: location || null,
      notes: notes || null
    });
    revalidatePath("/client/collaboration");
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">JumpStart Studio</p>
            <h1 className="page-heading">Ma collaboration</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tournages, documents et suivi de votre collaboration.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-white/80 px-5 py-4">
            <p className="section-label">Jours de tournage</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-bold font-display tabular-nums ${shootDays === 0 ? "text-rose-500" : shootDays <= 2 ? "text-amber-500" : "text-foreground"}`}>
                {shootDays}
              </span>
              <span className="text-sm text-muted-foreground">restants</span>
            </div>
          </div>
        </div>
      </section>

      {/* Shoots + Notes */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ShootCalendar shoots={shoots ?? []} canEdit={canEdit} addShootAction={addShoot} />
        <NotesEditor
          notes={collaboration?.notes ?? null}
          updatedAt={collaboration?.updated_at ?? null}
          canEdit={canEdit}
          updateNotesAction={updateNotes}
        />
      </section>

      {/* Documents */}
      <section>
        <Card className="card-surface p-6 fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <h2 className="section-title">Documents & livrables</h2>
                <p className="text-xs text-muted-foreground">Ressources partagees par votre equipe.</p>
              </div>
            </div>
            {(documents ?? []).length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {(documents ?? []).length} fichier{(documents ?? []).length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {(documents ?? []).length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Aucun document partagé pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(documents ?? []).map((doc) => {
                const url = signedUrls.find((u) => u.id === doc.id)?.url;
                return (
                  <div
                    key={doc.id}
                    className="group flex items-center gap-3 rounded-xl border border-border/50 p-3.5 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(doc.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.pinned && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Epingle
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{doc.tag}</Badge>
                      {url && (
                        <a
                          href={url}
                          className="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:text-purple-600 hover:bg-purple-50"
                          download
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
