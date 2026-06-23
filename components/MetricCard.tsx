import React from 'react';
import { type Icon } from '@phosphor-icons/react';

import { cn } from '../lib/utils';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon: Icon;
  description?: React.ReactNode;
  tone?: 'slate' | 'blue' | 'amber' | 'emerald' | 'red';
  className?: string;
}

const toneClasses: Record<NonNullable<MetricCardProps['tone']>, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  blue: 'border-fti-blue-200 bg-fti-blue-50 text-fti-blue-700 dark:border-fti-blue-300/35 dark:bg-fti-blue-500/10 dark:text-fti-blue-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300',
  red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300',
};

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon: Icon,
  description,
  tone = 'slate',
  className,
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-fti-blue-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/10',
        className
      )}
    >
      <div className={cn('pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full', tone === 'blue' ? 'bg-fti-blue-600 dark:bg-fti-blue-300' : 'bg-slate-900 dark:bg-slate-100')} />
      <div className="flex items-start justify-between gap-4 pl-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <div className="mt-2 text-2xl font-bold tabular-nums text-slate-950 dark:text-white">
            {value}
          </div>
          {description ? (
            <div className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
              {description}
            </div>
          ) : null}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md border', toneClasses[tone])}>
          <Icon className="h-5 w-5" weight="duotone" />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
