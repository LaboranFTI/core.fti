import React from "react";
import { List } from "@phosphor-icons/react";

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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-8px_24px_rgba(7,52,95,0.14)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/96 md:hidden print:hidden">
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
              className={`flex min-h-16 flex-1 flex-col items-center justify-center rounded-lg border px-2 py-2 text-[11px] font-semibold tracking-[0.01em] transition-colors ${
                isActive
                  ? "border-fti-blue-200 bg-fti-blue-50 text-fti-blue-700 shadow-sm dark:border-fti-blue-300/30 dark:bg-fti-blue-500/10 dark:text-fti-blue-200"
                  : "border-transparent text-slate-500 hover:border-fti-blue-100 hover:bg-fti-blue-50 hover:text-fti-blue-700 dark:text-slate-400 dark:hover:border-fti-blue-300/20 dark:hover:bg-fti-blue-500/10 dark:hover:text-fti-blue-200"
              }`}
            >
              <span className={`mb-1 flex h-7 w-7 items-center justify-center rounded-md ${isActive ? 'bg-white text-fti-blue-700 dark:bg-slate-950/60 dark:text-fti-blue-300' : 'bg-transparent'}`}>
                <Icon className="h-4 w-4" weight={isActive ? 'duotone' : 'regular'} />
              </span>
              <span className="truncate leading-none">{mobileLabel}</span>
            </button>
          );
        })}

        {showMenuButton && (
          <button
            type="button"
            onClick={onOpenMenu}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center rounded-lg border px-2 py-2 text-[11px] font-semibold tracking-[0.01em] transition-colors ${
              moreIsActive
                ? "border-fti-blue-200 bg-fti-blue-50 text-fti-blue-700 shadow-sm dark:border-fti-blue-300/30 dark:bg-fti-blue-500/10 dark:text-fti-blue-200"
                : "border-transparent text-slate-500 hover:border-fti-blue-100 hover:bg-fti-blue-50 hover:text-fti-blue-700 dark:text-slate-400 dark:hover:border-fti-blue-300/20 dark:hover:bg-fti-blue-500/10 dark:hover:text-fti-blue-200"
            }`}
          >
            <span className={`mb-1 flex h-7 w-7 items-center justify-center rounded-md ${moreIsActive ? 'bg-white text-fti-blue-700 dark:bg-slate-950/60 dark:text-fti-blue-300' : 'bg-transparent'}`}>
              <List className="h-4 w-4" weight={moreIsActive ? 'duotone' : 'bold'} />
            </span>
            <span className="leading-none">Lainnya</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
