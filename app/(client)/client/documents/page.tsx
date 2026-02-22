import type { Metadata } from "next";
import { getSessionProfile, assertTenant } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Documents"
};

export default async function ClientDocumentsPage({
  searchParams
}: {
  searchParams: { tenantId?: string };
}) {
  const profile = await getSessionProfile();
  if (profile.role === "agency_admin" && !searchParams.tenantId) {
    redirect("/admin");
  }
  const tenantId = profile.role === "agency_admin" && searchParams.tenantId
    ? searchParams.tenantId
    : assertTenant(profile);
  const supabase =
    profile.role === "agency_admin" && searchParams.tenantId
      ? createSupabaseServiceClient()
      : createSupabaseServerClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("id,file_name,tag,created_at,file_path,pinned")
    .eq("tenant_id", tenantId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const signedUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(doc.file_path, 60 * 60);
      return { id: doc.id, url: data?.signedUrl ?? "" };
    })
  );

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Espace client</p>
            <h1 className="page-heading">Documents</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ressources et livrables partages.</p>
          </div>
          <Badge variant="secondary">Bibliotheque</Badge>
        </div>
      </section>

      <Card className="card-surface p-6 fade-in-up">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Ajouté</TableHead>
              <TableHead>Télécharger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(documents ?? []).map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {doc.pinned ? <Badge variant="secondary">Épinglé</Badge> : null}
                    <span>{doc.file_name}</span>
                  </div>
                </TableCell>
                <TableCell>{doc.tag}</TableCell>
                <TableCell>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</TableCell>
                <TableCell>
                  <a className="text-sm font-medium text-primary underline" href={signedUrls.find((url) => url.id === doc.id)?.url}>
                    Télécharger
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";
