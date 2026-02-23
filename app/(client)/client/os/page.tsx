import { redirect } from "next/navigation";

export default function ClientOsPage({
  searchParams
}: {
  searchParams?: { tenantId?: string };
}) {
  const params = searchParams?.tenantId ? `?tenantId=${searchParams.tenantId}` : "";
  redirect(`/client/collaboration${params}`);
}
