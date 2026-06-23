import React from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder = "Cari...", className = "w-full sm:w-64" }) => {
  return (
    <div className={`relative ${className}`}>
      <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fti-blue-700 dark:text-fti-blue-300" weight="bold" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-base text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-fti-blue-600 focus:ring-3 focus:ring-fti-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-fti-blue-300 dark:focus:ring-fti-blue-300/20 md:text-sm"
      />
    </div>
  );
};

export default SearchBar;
