"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type AdminNavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function AdminNavLink({ href, children, className }: AdminNavLinkProps) {
  const pathname = usePathname();
  const isActive =
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn("nav-pill", isActive && "nav-pill-active", className)}
    >
      {children}
    </Link>
  );
}
