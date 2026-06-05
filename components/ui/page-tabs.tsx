import React from "react";

import { cn } from "../../lib/utils";
import { TabsList, TabsTrigger } from "./tabs";

export interface PageTabItem {
  value: string;
  label: string;
  icon?: React.ElementType;
  disabled?: boolean;
}

interface PageTabsProps {
  items: PageTabItem[];
  className?: string;
  triggerClassName?: string;
}

interface PageTabSummaryProps {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  className?: string;
}

export function PageTabs({ items, className, triggerClassName }: PageTabsProps) {
  return (
    <TabsList
      variant="line"
      className={cn(
        "flex w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70 p-1.5 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/50 dark:shadow-black/10 sm:w-fit",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <TabsTrigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              "flex-none justify-start rounded-xl border border-transparent bg-transparent px-3.5 py-2.5 text-slate-500 shadow-none hover:bg-slate-100 hover:text-slate-900 data-active:border-blue-400/60 data-active:bg-blue-600 data-active:text-white data-active:shadow-md data-active:shadow-blue-900/15 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white dark:data-active:border-blue-400/40 dark:data-active:bg-blue-500/20 dark:data-active:text-white dark:data-active:shadow-blue-950/20 sm:min-h-11",
              triggerClassName
            )}
          >
            {Icon && (
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-current/10 text-current">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <span className="text-sm font-semibold">{item.label}</span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

export function PageTabSummary({ icon: Icon, title, description, className }: PageTabSummaryProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/55 dark:shadow-black/10",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-blue-200/70 bg-blue-50 text-blue-600 dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-200">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          {title && <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>}
          {description && <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
    </div>
  );
}
