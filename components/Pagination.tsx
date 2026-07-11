import { CaretLeft as ChevronLeft, CaretRight as ChevronRight } from '@phosphor-icons/react';
import React from 'react';
import { buttonVariants } from './ui/button';
import { cn } from '../lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange
}) => {
  return (
    <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white dark:bg-gray-800 rounded-b-xl shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>Tampilkan</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-700 shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 sm:h-10 sm:text-sm"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span>dari {totalItems} data</span>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2">
        <button onClick={() => onPageChange(Math.max(currentPage - 1, 1))} disabled={currentPage <= 1} className={cn(buttonVariants({ variant: 'secondary', size: 'icon-sm' }), 'text-gray-600 dark:text-gray-300')}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-center text-gray-700 dark:text-gray-300 px-2 flex-1 sm:flex-none">Halaman {currentPage} dari {totalPages || 1}</span>
        <button onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))} disabled={currentPage >= totalPages || totalPages === 0} className={cn(buttonVariants({ variant: 'secondary', size: 'icon-sm' }), 'text-gray-600 dark:text-gray-300')}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
