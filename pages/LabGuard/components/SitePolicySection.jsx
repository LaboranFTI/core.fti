import { labGuardMutedText, labGuardText } from '../constants';

export default function SitePolicySection({ title, subtitle, emptyLabel, items, renderItem, hideHeader = false }) {
  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-3 px-1 sm:px-2">
          <div className="min-w-0">
            <h3 className={`text-sm sm:text-base font-bold uppercase tracking-wider ${labGuardText}`}>{title}</h3>
            <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] mt-1 ${labGuardMutedText}`}>{subtitle}</p>
          </div>
          <div className="px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-blue-500/20 text-blue-400 bg-blue-500/10 shrink-0">
            {items.length} Aturan
          </div>
        </div>
      )}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {items.map(renderItem)}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <p className="text-[10px] font-bold uppercase tracking-wider">{emptyLabel}</p>
        </div>
      )}
    </div>
  );
}
