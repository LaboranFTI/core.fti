import { CheckCircle as CheckCircle2, MagnifyingGlass as Search, XCircle } from '@phosphor-icons/react';
import { labGuardInput, labGuardMutedText, labGuardText } from '../constants';

export default function LabGuardToolbar({
  title,
  subtitle,
  placeholder,
  searchQuery,
  setSearchQuery,
  showOnlyLabs,
  setShowOnlyLabs,
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 px-1 sm:px-4">
      <div className="space-y-1">
        <h2 className={`text-xl sm:text-2xl font-bold tracking-tight uppercase leading-tight ${labGuardText}`}>{title}</h2>
        <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>{subtitle}</p>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative group w-full sm:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none ${labGuardInput}`}
          />
        </div>
        <button
          onClick={() => setShowOnlyLabs(!showOnlyLabs)}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all border ${showOnlyLabs
            ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
        >
          {showOnlyLabs ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          Hanya Lab
        </button>
      </div>
    </div>
  );
}
