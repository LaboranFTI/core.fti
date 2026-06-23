import React from 'react';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { cn } from '../../lib/utils';

interface TUSectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function TUSectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  headerClassName,
  contentClassName
}: TUSectionCardProps) {
  const hasHeader = title || description || Icon || actions;

  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900', className)}>
      {hasHeader && (
        <CardHeader
          className={cn(
            'border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/70',
            headerClassName
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {Icon && (
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                  <Icon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0">
                {title && <CardTitle className="text-base font-semibold text-slate-950 dark:text-white">{title}</CardTitle>}
                {description && <CardDescription className="mt-1 leading-6">{description}</CardDescription>}
              </div>
            </div>
            {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn('p-4 sm:p-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

type TUNoticeTone = 'info' | 'success' | 'danger' | 'neutral';

const noticeToneClass: Record<TUNoticeTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-200',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-200',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-200',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300'
};

interface TUNoticeProps {
  tone?: TUNoticeTone;
  children: React.ReactNode;
  className?: string;
}

export function TUNotice({ tone = 'neutral', children, className }: TUNoticeProps) {
  return <div className={cn('rounded-lg border px-4 py-3 text-sm leading-6', noticeToneClass[tone], className)}>{children}</div>;
}

interface TUMetricCardProps {
  title: string;
  value: React.ReactNode;
  description: React.ReactNode;
  icon: React.ReactNode;
  accentClassName?: string;
}

export function TUMetricCard({ title, value, description, icon, accentClassName }: TUMetricCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className={cn('rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200', accentClassName)}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

interface TUSegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface TUSegmentedControlProps<T extends string> {
  value: T;
  options: TUSegmentedControlOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function TUSegmentedControl<T extends string>({ value, options, onChange, className }: TUSegmentedControlProps<T>) {
  return (
    <div className={cn('inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800', className)}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? 'secondary' : 'ghost'}
          size="xs"
          className={cn(
            'h-8 rounded-md px-3 shadow-none',
            value === option.value
              ? 'border-slate-300 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 dark:text-slate-400'
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
