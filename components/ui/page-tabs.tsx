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
        "flex w-full gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/80 p-1.5 shadow-sm shadow-fti-blue-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-800/70 dark:shadow-black/10 sm:w-fit",
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
              "flex-none justify-start rounded-md border border-transparent bg-transparent px-3.5 py-2.5 text-slate-600 shadow-none hover:border-fti-blue-100 hover:bg-white hover:text-fti-blue-700 data-active:!border-fti-blue-200 data-active:!bg-white data-active:!text-fti-blue-700 data-active:shadow-sm dark:text-slate-300 dark:hover:border-fti-blue-300/20 dark:hover:bg-slate-800 dark:hover:text-fti-blue-200 dark:data-active:!border-fti-blue-300/25 dark:data-active:!bg-slate-900 dark:data-active:!text-fti-blue-200 sm:min-h-11",
              triggerClassName
            )}
          >
            {Icon && (
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-current/10 bg-current/10 text-current">
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
        "rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-fti-blue-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/10",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-md border border-fti-blue-100 bg-fti-blue-50 text-fti-blue-700 dark:border-fti-blue-300/25 dark:bg-fti-blue-500/10 dark:text-fti-blue-200">
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
