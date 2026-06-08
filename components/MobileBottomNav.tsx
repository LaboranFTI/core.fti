import React from "react";
import { Menu } from "lucide-react";

import { Role } from "../types";
import { getMobilePrimaryItems } from "../lib/navigation";

interface MobileBottomNavProps {
  currentRole: Role;
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenMenu: () => void;
  showMenuButton: boolean;
}

const getMobileNavLabel = (id: string, label: string) => {
  if (id === "ruangan") return "Daftar Ruang";
  if (id === "pesanan-ruang") return "Pesanan Ruang";
  if (id === "inventaris") return "Inventaris";
  return label;
};

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRole,
  currentPage,
  onNavigate,
  onOpenMenu,
  showMenuButton,
}) => {
  const visibleItems = getMobilePrimaryItems(currentRole);
  const primaryItems = showMenuButton
    ? visibleItems.slice(0, 3)
    : visibleItems.slice(0, 4);

  const moreIsActive =
    showMenuButton &&
    currentPage !== "" &&
    !primaryItems.some((item) => item.id === currentPage);

  if (primaryItems.length === 0 && !showMenuButton) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/96 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/96 md:hidden print:hidden">
      <div className="mx-auto flex max-w-xl items-stretch gap-1.5">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const mobileLabel = getMobileNavLabel(item.id, item.label);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.url) {
                  window.open(item.url, '_blank', 'noopener,noreferrer');
                } else {
                  onNavigate(item.id);
                }
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-16 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium tracking-[0.01em] transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              }`}
            >
              <span className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full ${isActive ? 'bg-blue-100 dark:bg-blue-950/60' : 'bg-transparent'}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate leading-none">{mobileLabel}</span>
            </button>
          );
        })}

        {showMenuButton && (
          <button
            type="button"
            onClick={onOpenMenu}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium tracking-[0.01em] transition-colors ${
              moreIsActive
                ? "bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-900/40 dark:text-blue-300"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <span className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full ${moreIsActive ? 'bg-blue-100 dark:bg-blue-950/60' : 'bg-transparent'}`}>
              <Menu className="h-4 w-4" />
            </span>
            <span className="leading-none">Lainnya</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
