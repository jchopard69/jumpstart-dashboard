"use client";

import { useState } from "react";
import { DocumentUploader } from "@/components/admin/document-uploader";
import { Button } from "@/components/ui/button";

type Payload = {
  filePath: string;
  fileName: string;
  tag: string;
  pinned: boolean;
};

export function DocumentManager({
  tenantId,
  uploadAction
}: {
  tenantId: string;
  uploadAction: (formData: FormData) => Promise<void>;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);

  const handleUploaded = (data: Payload) => {
    setPayload(data);
  };

  return (
    <form action={uploadAction} className="space-y-4">
      <DocumentUploader tenantId={tenantId} onUploaded={handleUploaded} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="file_path" value={payload?.filePath ?? ""} />
      <input type="hidden" name="file_name" value={payload?.fileName ?? ""} />
      <input type="hidden" name="tag" value={payload?.tag ?? "other"} />
      <input type="hidden" name="pinned" value={payload?.pinned ? "true" : "false"} />
      <Button type="submit" disabled={!payload}>
        Ajouter à la bibliothèque
      </Button>
    </form>
  );
}
