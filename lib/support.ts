export function getSupportEmail(): string {
  return (
    process.env.SUPPORT_EMAIL?.trim() ||
    process.env.DEMO_CONTACT_EMAIL?.trim() ||
    "contact@jumpstartstudio.fr"
  );
}

export function getSupportContactHref(subject = "Support JumpStart OS"): string {
  const email = getSupportEmail();
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
