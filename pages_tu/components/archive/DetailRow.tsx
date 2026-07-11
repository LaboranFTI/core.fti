interface DetailRowProps {
  label: string;
  value: string;
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-gray-700 py-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500 dark:text-gray-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800 dark:text-white">{value}</span>
    </div>
  );
}
