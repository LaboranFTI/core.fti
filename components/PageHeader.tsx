import React from 'react';
import { Buildings, CaretRight } from '@phosphor-icons/react';

import { cn } from '../lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  centered?: boolean;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionsClassName?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  centered = false,
  className,
  contentClassName,
  titleClassName,
  descriptionClassName,
  actionsClassName,
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-fti-blue-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/10 md:flex md:items-center md:justify-between md:gap-5 md:p-5',
        centered && 'items-center text-center md:flex-col md:justify-center',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-fti-blue-600 dark:bg-fti-blue-300" />
      <div
        className={cn(
          'min-w-0 space-y-2 pl-2',
          centered && 'max-w-3xl',
          contentClassName
        )}
      >
        <div className="inline-flex max-w-full items-center gap-2 text-[11px] font-bold uppercase text-fti-blue-700 dark:text-fti-blue-300">
          <Buildings size={15} weight="duotone" />
          CORE.FTI
          <CaretRight size={12} weight="bold" />
          Operasional
        </div>
        <h1
          className={cn(
            'text-2xl font-bold text-balance text-slate-950 dark:text-white',
            titleClassName
          )}
        >
          {title}
        </h1>
        {description ? (
          <div
            className={cn(
              'max-w-2xl text-sm leading-6 text-pretty text-slate-600 dark:text-slate-400',
              descriptionClassName
            )}
          >
            {description}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div
          className={cn(
            centered ? 'mt-4 flex justify-center' : 'mt-4 flex w-full flex-col gap-2 md:mt-0 md:w-auto md:flex-row md:items-center md:justify-end [&>button]:w-full [&>a]:w-full md:[&>button]:w-auto md:[&>a]:w-auto',
            actionsClassName
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
};

export default PageHeader;
