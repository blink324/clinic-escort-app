"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="主要ナビゲーション">
      <Link className={pathname === "/" || pathname.startsWith("/appointments") ? "active" : ""} href="/">
        <span>予定</span>
      </Link>
      <Link className={pathname.startsWith("/groups") ? "active" : ""} href="/groups">
        <span>グループ</span>
      </Link>
    </nav>
  );
}
