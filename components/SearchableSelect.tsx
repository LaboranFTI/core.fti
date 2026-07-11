import { CaretDown as ChevronDown, MagnifyingGlass as Search } from '@phosphor-icons/react';
import React, { useState, useEffect, useRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Pilih --',
  searchPlaceholder = 'Cari...',
  disabled = false,
  className = '',
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => {
    const safeLabel = opt.label || '';
    const safeSubLabel = opt.subLabel || '';
    const safeSearchTerm = searchTerm || '';
    return safeLabel.toLowerCase().includes(safeSearchTerm.toLowerCase()) || 
           safeSubLabel.toLowerCase().includes(safeSearchTerm.toLowerCase());
  });

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {required && (
        <input 
          type="text" 
          className="absolute opacity-0 w-0 h-0" 
          value={value} 
          onChange={() => {}} 
          required 
          tabIndex={-1}
        />
      )}
      <div 
        className={`w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus-within:ring-2 focus-within:ring-blue-500 flex justify-between items-center shadow-sm min-h-11 ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : 'cursor-pointer'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`${!selectedOption ? 'text-gray-500 text-base md:text-sm' : 'truncate text-base md:text-sm'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 ml-2" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xl max-h-72 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2.5 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  className={`px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-base md:text-sm flex justify-between items-center ${
                    opt.disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : 
                    value === opt.value ? 'bg-blue-50 dark:bg-gray-700/50 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'
                  }`}
                  onClick={() => {
                    if (!opt.disabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }
                  }}
                >
                  <span className="truncate pr-2">{opt.label}</span>
                  {opt.subLabel && <span className="text-xs text-gray-500 shrink-0 ml-2">{opt.subLabel}</span>}
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-center text-gray-500 text-sm">
                Tidak ditemukan
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
