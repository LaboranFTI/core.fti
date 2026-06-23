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
  if (id === "dashboard") return "Beranda";
  if (id === "ruangan") return "Ruang";
  if (id === "pesanan-ruang") return "Pesanan";
  if (id === "peminjaman-barang") return "Pinjam";
  if (id === "inventaris") return "Barang";
  if (id === "pemesanan-saya") return "Saya";
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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden print:hidden">
      <div className="mx-auto grid max-w-xl grid-flow-col auto-cols-fr items-stretch gap-1">
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
              aria-label={mobileLabel}
              className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-colors ${
                isActive
                  ? "bg-fti-blue-50 text-fti-blue-700 dark:bg-fti-blue-500/10 dark:text-fti-blue-200"
                  : "text-slate-500 hover:bg-slate-100 hover:text-fti-blue-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-fti-blue-200"
              }`}
            >
              {isActive ? <span className="absolute inset-x-5 top-1 h-0.5 rounded-full bg-fti-blue-600 dark:bg-fti-blue-300" /> : null}
              <span className={`mb-1 flex size-6 items-center justify-center rounded-md ${isActive ? 'text-fti-blue-700 dark:text-fti-blue-300' : 'text-current'}`}>
                <Icon className="h-4 w-4" weight={isActive ? 'duotone' : 'regular'} />
              </span>
              <span className="w-full truncate text-center leading-none">{mobileLabel}</span>
            </button>
          );
        })}

        {showMenuButton && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Buka menu lainnya"
            className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-colors ${
              moreIsActive
                ? "bg-fti-blue-50 text-fti-blue-700 dark:bg-fti-blue-500/10 dark:text-fti-blue-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-fti-blue-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-fti-blue-200"
            }`}
          >
            {moreIsActive ? <span className="absolute inset-x-5 top-1 h-0.5 rounded-full bg-fti-blue-600 dark:bg-fti-blue-300" /> : null}
            <span className={`mb-1 flex size-6 items-center justify-center rounded-md ${moreIsActive ? 'text-fti-blue-700 dark:text-fti-blue-300' : 'text-current'}`}>
              <List className="h-4 w-4" weight={moreIsActive ? 'duotone' : 'bold'} />
            </span>
            <span className="w-full truncate text-center leading-none">Menu</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
