"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DocumentUploader({
  tenantId,
  onUploaded
}: {
  tenantId: string;
  onUploaded: (payload: { filePath: string; fileName: string; tag: string; pinned: boolean }) => void;
}) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tag, setTag] = useState("other");
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const path = `${tenantId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("client-documents").upload(path, file, {
      cacheControl: "3600",
      upsert: true
    });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setFilePath(path);
    setFileName(file.name);
  };

  const handleSubmit = () => {
    if (!filePath || !fileName) return;
    onUploaded({ filePath, fileName, tag, pinned });
    setFilePath(null);
    setFileName(null);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Importer un fichier</Label>
        <Input type="file" onChange={handleFileChange} />
        {fileName ? <p className="text-xs text-muted-foreground">Fichier chargé : {fileName}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contract">Contrat</SelectItem>
            <SelectItem value="brief">Brief</SelectItem>
            <SelectItem value="report">Rapport</SelectItem>
            <SelectItem value="other">Autre</SelectItem>
          </SelectContent>
        </Select>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
          Épingler
        </label>
        <Button type="button" onClick={handleSubmit} disabled={!filePath || loading}>
          {loading ? "Import en cours..." : "Enregistrer les infos"}
        </Button>
      </div>
    </div>
  );
}
