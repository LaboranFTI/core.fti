import React from 'react';

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
        'flex flex-col gap-4 md:flex-row md:items-center md:justify-between',
        centered && 'items-center text-center md:flex-col md:justify-center',
        className
      )}
    >
      <div
        className={cn(
          'space-y-1',
          centered && 'max-w-3xl',
          contentClassName
        )}
      >
        <h1
          className={cn(
            'text-2xl font-bold text-gray-900 dark:text-white',
            titleClassName
          )}
        >
          {title}
        </h1>
        {description ? (
          <div
            className={cn(
              'text-sm text-gray-500 dark:text-gray-400',
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
            centered ? 'flex justify-center' : '',
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
