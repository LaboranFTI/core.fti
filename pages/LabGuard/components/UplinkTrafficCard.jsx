import { Activity } from 'lucide-react';
import { labGuardInsetSurface, labGuardMutedText, labGuardText } from '../constants';
import { formatRateMbps } from '../utils';
import LabGuardCard from './LabGuardCard';

export default function UplinkTrafficCard({ uplinkTraffic, isSimulated = false }) {
  return (
    <LabGuardCard padding="sm" className="sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-300">
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <p className={`text-[9px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Backbone Uplink (Total Bandwidth Terpakai)</p>
              <h3 className={`text-sm sm:text-base font-bold uppercase tracking-tight truncate ${labGuardText}`}>{uplinkTraffic?.name || 'ether2-backboneUKSW'}</h3>
            </div>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase border shrink-0 ${isSimulated
          ? 'border-amber-500/20 text-amber-400 bg-amber-500/10'
          : 'border-blue-500/20 text-blue-400 bg-blue-500/10'}`}
        >
          {isSimulated ? 'Simulasi' : 'Live'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`${labGuardInsetSurface} px-4 py-3`}>
          <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Download</p>
          <p className={`text-lg font-bold tracking-tight mt-1 ${labGuardText}`}>{formatRateMbps(uplinkTraffic?.rxRate)}</p>
        </div>
        <div className={`${labGuardInsetSurface} px-4 py-3`}>
          <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Upload</p>
          <p className={`text-lg font-bold tracking-tight mt-1 ${labGuardText}`}>{formatRateMbps(uplinkTraffic?.txRate)}</p>
        </div>
      </div>
    </LabGuardCard>
  );
}
