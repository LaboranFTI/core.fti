import React from 'react';

import { cn } from '../lib/utils';
import { Card } from './ui/card';

type PageCardPadding = 'none' | 'sm' | 'md' | 'lg';

interface PageCardProps extends React.ComponentProps<typeof Card> {
  padding?: PageCardPadding;
}

const paddingClasses: Record<PageCardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-4 sm:p-6',
};

const PageCard: React.FC<PageCardProps> = ({
  className,
  padding = 'sm',
  ...props
}) => {
  return (
    <Card
      className={cn(
        'border border-slate-200 shadow-sm shadow-fti-blue-900/5 dark:border-slate-700 dark:shadow-black/10',
        paddingClasses[padding],
        className
      )}
      {...props}
    />
  );
};

export default PageCard;
