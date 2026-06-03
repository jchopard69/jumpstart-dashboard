"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function NavLink({ href, children, className }: NavLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  // Preserve tenantId across client pages so admin context isn't lost
  const tenantId = searchParams.get("tenantId");
  const resolvedHref = tenantId && href.startsWith("/client")
    ? `${href}?tenantId=${encodeURIComponent(tenantId)}`
    : href;

  return (
    <Link
      href={resolvedHref}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "nav-pill transition-colors",
        isActive && "nav-pill-active font-medium",
        className
      )}
    >
      {children}
    </Link>
  );
}
