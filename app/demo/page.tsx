import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoEntry } from "./demo-entry";
import {
  getDemoContactHref,
  getDemoCredentials,
  getDemoExpiryDate,
  isDemoEnabled,
} from "@/lib/demo";

export const metadata: Metadata = {
  title: "Démo",
};

export default function DemoPage() {
  if (!isDemoEnabled()) {
    notFound();
  }

  const expiry = getDemoExpiryDate();
  const expiresAtLabel = expiry
    ? expiry.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : null;

  let demoEmail = "demo@jumpstart.studio";
  try {
    demoEmail = getDemoCredentials().email;
  } catch {
    // Keep fallback label if env is incomplete.
  }

  return (
    <DemoEntry
      contactHref={getDemoContactHref()}
      demoEmail={demoEmail}
      expiresAtLabel={expiresAtLabel}
    />
  );
}

