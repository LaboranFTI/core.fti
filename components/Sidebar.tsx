import React, { useEffect, useState } from 'react';
import { CaretDown, CaretRight, SidebarSimple, X } from '@phosphor-icons/react';
import { Role } from '../types';
import {
  getVisibleMainItems,
  getVisibleNavigationGroups,
} from '../lib/navigation';

interface SidebarProps {
  currentRole: Role;
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentRole, currentPage, onNavigate, isOpen, isCollapsed = false, onToggleCollapse, onClose }) => {
  const [hoveredItem, setHoveredItem] = useState<{ label: string; top: number } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isHovered, setIsHovered] = useState(false);
  const mainItems = React.useMemo(() => getVisibleMainItems(currentRole), [currentRole]);
  const menuGroups = React.useMemo(() => getVisibleNavigationGroups(currentRole), [currentRole]);

  useEffect(() => {
    const activeGroup = menuGroups.find((group) =>
      group.items.some((item) => item.id === currentPage)
    );

    if (!activeGroup) {
      return;
    }

    setExpandedGroups((prev) => {
      if (prev.has(activeGroup.id)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(activeGroup.id);
      return next;
    });
  }, [currentPage, menuGroups]);

  // Menentukan status ciut secara visual (melebar saat di-hover)
  const effectiveCollapsed = isCollapsed && !isHovered;

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${isOpen ? 'translate-x-0' : '-translate-x-full'} fixed bottom-0 left-0 top-14 z-40 flex h-[calc(100dvh-3.5rem)] w-[min(22rem,92vw)] flex-col border-r border-slate-100 bg-slate-50/95 shadow-2xl shadow-fti-blue-900/10 backdrop-blur-md transition-all duration-200 dark:border-slate-800/80 dark:bg-slate-950/95 md:relative md:top-auto md:h-full md:translate-x-0 md:bg-slate-50/90 md:shadow-none md:dark:bg-slate-950/90 ${effectiveCollapsed ? 'md:w-[5.25rem]' : 'md:w-[18.5rem]'} print:hidden`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-900/60 md:hidden">
        <span className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">
          Navigasi
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100 bg-white/50 text-slate-500 shadow-sm transition-colors hover:border-slate-200 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700 dark:hover:text-white"
          aria-label="Tutup menu"
        >
          <X className="h-4.5 w-4.5" weight="bold" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-8 pt-4 md:pt-5 scrollbar-thin">
        {/* Main Items */}
        <div className="mb-6">
          {!effectiveCollapsed && (
            <div className="mb-2 px-3 text-xs font-bold uppercase text-slate-400 dark:text-slate-600">
              Utama
            </div>
          )}
          <nav className="space-y-0.5">
            {mainItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.url) {
                      window.open(item.url, '_blank', 'noopener,noreferrer');
                    } else {
                      onNavigate(item.id);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (effectiveCollapsed) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredItem({ label: item.label, top: rect.top + rect.height / 2 });
                    }
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`group relative flex w-full min-h-10 items-center rounded-lg py-2 text-sm font-medium transition-all duration-200 ${effectiveCollapsed ? 'justify-center px-2' : 'px-3'} ${
                    isActive
                      ? 'bg-fti-blue-600 text-white shadow-sm shadow-fti-blue-900/20 dark:bg-fti-blue-300 dark:text-fti-ink dark:shadow-none'
                      : 'text-slate-600 hover:bg-fti-blue-50 hover:text-fti-blue-700 dark:text-slate-400 dark:hover:bg-fti-blue-500/10 dark:hover:text-fti-blue-200'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${effectiveCollapsed ? '' : 'mr-3'} ${isActive ? 'text-current' : 'text-slate-400 group-hover:text-fti-blue-700 dark:group-hover:text-fti-blue-200'}`}>
                    <Icon className="h-4.5 w-4.5" weight={isActive ? 'duotone' : 'regular'} />
                  </span>
                  {!effectiveCollapsed && <span className="overflow-hidden whitespace-nowrap transition-all duration-250">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Dropdown Groups */}
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          const isActiveGroup = group.items.some(item => currentPage === item.id);
          const GroupIcon = group.icon;

          return (
            <div key={group.id} className="mb-2">
              <button
                onClick={() => {
                  if (isCollapsed && onToggleCollapse) {
                    onToggleCollapse();
                    const newExpanded = new Set(expandedGroups);
                    newExpanded.add(group.id);
                    setExpandedGroups(newExpanded);
                    return;
                  }
                  const newExpanded = new Set(expandedGroups);
                  if (isExpanded) {
                    newExpanded.delete(group.id);
                  } else {
                    newExpanded.add(group.id);
                  }
                  setExpandedGroups(newExpanded);
                }}
                onMouseEnter={(e) => {
                  if (effectiveCollapsed) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredItem({ label: group.title, top: rect.top + rect.height / 2 });
                  }
                }}
                onMouseLeave={() => setHoveredItem(null)}
                className={`group relative flex w-full min-h-10 items-center rounded-lg py-2 text-sm font-medium transition-all duration-200 ${effectiveCollapsed ? 'justify-center px-2' : 'px-3'} ${
                  isActiveGroup
                    ? 'bg-fti-blue-50 text-fti-blue-700 font-semibold dark:bg-fti-blue-500/10 dark:text-fti-blue-200'
                    : isExpanded
                      ? 'bg-slate-100/60 text-slate-900 dark:bg-slate-900/35 dark:text-slate-200'
                      : 'text-slate-600 hover:bg-fti-blue-50 hover:text-fti-blue-700 dark:text-slate-400 dark:hover:bg-fti-blue-500/10 dark:hover:text-fti-blue-200'
                }`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${effectiveCollapsed ? '' : 'mr-3'} ${isActiveGroup ? 'text-fti-blue-700 dark:text-fti-blue-200' : isExpanded ? 'text-slate-900 dark:text-white' : 'text-slate-400 group-hover:text-fti-blue-700 dark:group-hover:text-fti-blue-200'}`}>
                  <GroupIcon className="h-4.5 w-4.5" weight={isActiveGroup || isExpanded ? 'duotone' : 'regular'} />
                </span>
                {!effectiveCollapsed && <span className="flex-1 text-left">{group.title}</span>}
                {!effectiveCollapsed && <CaretDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-250 ${isExpanded ? 'rotate-180' : ''}`} weight="bold" />}
              </button>
              {isExpanded && !effectiveCollapsed && (
                <nav className="ml-5.5 mt-1.5 space-y-0.5 border-l border-slate-200/60 pl-3.5 dark:border-slate-800">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.url) {
                            window.open(item.url, '_blank', 'noopener,noreferrer');
                          } else {
                            onNavigate(item.id);
                          }
                        }}
                        className={`group flex w-full min-h-9 items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-fti-blue-50 text-fti-blue-700 font-semibold dark:bg-fti-blue-500/10 dark:text-fti-blue-200'
                            : 'text-slate-500 hover:bg-fti-blue-50 hover:text-fti-blue-700 dark:text-slate-400 dark:hover:bg-fti-blue-500/10 dark:hover:text-fti-blue-200'
                        }`}
                      >
                        <Icon className={`mr-2 h-3.5 w-3.5 shrink-0 ${isActive ? 'text-fti-blue-600 dark:text-fti-blue-300' : 'text-slate-400 group-hover:text-fti-blue-700 dark:group-hover:text-fti-blue-200'} transition-colors`} weight={isActive ? 'duotone' : 'regular'} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              )}
            </div>
          );
        })}

      </div>

      {/* Toggle Button (Desktop Only) */}
      <button
        onClick={onToggleCollapse}
        title={isCollapsed ? "Expand" : "Collapse"}
        className="absolute -right-3 top-6 z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-slate-300 hover:text-slate-700 hover:scale-110 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500 dark:hover:text-slate-300 md:flex"
      >
        {isCollapsed ? <CaretRight className="h-3.5 w-3.5" weight="bold" /> : <SidebarSimple className="h-3.5 w-3.5" weight="duotone" />}
      </button>

      {/* Custom Tooltip for Collapsed Mode */}
      {effectiveCollapsed && hoveredItem && (
        <div 
          className="pointer-events-none fixed left-[5.5rem] z-50 ml-2 whitespace-nowrap rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg animate-fade-in-up dark:border-slate-600 dark:bg-slate-800"
          style={{ top: hoveredItem.top, transform: 'translateY(-50%)' }}
        >
          {hoveredItem.label}
          <div className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-slate-700 bg-slate-950 dark:border-slate-600 dark:bg-slate-800"></div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
