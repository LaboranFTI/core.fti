import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, X } from 'lucide-react';
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
      className={`${isOpen ? 'translate-x-0' : '-translate-x-full'} fixed bottom-0 left-0 top-14 z-40 flex h-[calc(100dvh-3.5rem)] w-[min(21rem,90vw)] flex-col border-r border-gray-200 bg-white/95 shadow-2xl backdrop-blur-xl transition-all duration-200 dark:border-gray-700 dark:bg-gray-900/95 md:relative md:top-auto md:h-full md:translate-x-0 md:shadow-none ${effectiveCollapsed ? 'md:w-24' : 'md:w-72'} print:hidden`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700 md:hidden">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
          Navigasi
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
          aria-label="Tutup menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4 md:pt-5">
        {/* Main Items */}
        <div className="mb-8">
          {!effectiveCollapsed && (
            <div className="mb-3 px-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-gray-400 transition-opacity duration-200">
              Utama
            </div>
          )}
          <nav className="space-y-1">
            {mainItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  onMouseEnter={(e) => {
                    if (effectiveCollapsed) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredItem({ label: item.label, top: rect.top + rect.height / 2 });
                    }
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`group flex w-full min-h-12 items-center rounded-2xl py-3 text-sm font-semibold transition-all duration-200 ${effectiveCollapsed ? 'justify-center px-2.5' : 'px-4'} ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-900/60'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${effectiveCollapsed ? '' : 'mr-3'} ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'} transition-all duration-200`} />
                  {!effectiveCollapsed && <span className="overflow-hidden whitespace-nowrap transition-all duration-200">{item.label}</span>}
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
            <div key={group.id} className="mb-4">
              <button
                onClick={() => {
                  if (isCollapsed && onToggleCollapse) {
                    onToggleCollapse(); // Otomatis lebarkan sidebar
                    // Buka dropdown untuk kategori yang diklik
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
                className={`group flex w-full min-h-12 items-center rounded-2xl py-3 text-sm font-semibold transition-all duration-200 ${effectiveCollapsed ? 'justify-center px-2.5' : 'px-4'} ${
                  isActiveGroup
                    ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-900/60'
                    : isExpanded
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <GroupIcon className={`h-5 w-5 ${effectiveCollapsed ? '' : 'mr-3'} ${isActiveGroup || isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'} transition-all duration-200`} />
                {!effectiveCollapsed && <span className="flex-1 text-left">{group.title}</span>}
                {!effectiveCollapsed && <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />}
              </button>
              {isExpanded && !effectiveCollapsed && (
                <nav className="mt-2 space-y-1 border-l border-gray-200 pl-3 dark:border-gray-800 md:ml-4">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`group flex w-full min-h-11 items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                        }`}
                      >
                        <Icon className={`mr-3 h-4 w-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'} transition-colors`} />
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
        className="absolute -right-3 top-6 z-50 hidden items-center justify-center rounded-full border border-gray-200 bg-white p-1.5 text-gray-500 shadow-md transition-colors hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 md:flex"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      {/* Custom Tooltip for Collapsed Mode */}
      {effectiveCollapsed && hoveredItem && (
        <div 
          className="pointer-events-none fixed left-24 z-50 ml-2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg animate-fade-in-up dark:bg-gray-700"
          style={{ top: hoveredItem.top, transform: 'translateY(-50%)' }}
        >
          {hoveredItem.label}
          <div className="absolute top-1/2 -left-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 transform -translate-y-1/2 rotate-45"></div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
