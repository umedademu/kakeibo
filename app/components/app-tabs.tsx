"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "資産" },
  { href: "/fixed-costs", label: "固定費" },
  { href: "/incomes", label: "収入" },
  { href: "/debts", label: "借金" },
];

export default function AppTabs() {
  const pathname = usePathname();

  return (
    <nav className="app-tabs" aria-label="家計簿の表示切り替え">
      {tabs.map((tab) => (
        <Link
          aria-current={pathname === tab.href ? "page" : undefined}
          href={tab.href}
          key={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
