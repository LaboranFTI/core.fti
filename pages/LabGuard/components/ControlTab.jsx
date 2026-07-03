import { Layers } from 'lucide-react';
import {
  labGuardInsetSurface,
  labGuardInput,
  labGuardMutedText,
  labGuardSurface,
  labGuardText,
} from '../constants';
import { AnimatePresence, motion } from '../motion';
import { formatBandwidthMbps } from '../utils';
import LabGuardToolbar from './LabGuardToolbar';

export default function ControlTab({
  filteredInterfaces,
  searchQuery,
  setSearchQuery,
  showOnlyLabs,
  setShowOnlyLabs,
  bandwidthDrafts,
  setBandwidthDrafts,
  loading,
  saveBandwidth,
  toggleInterface,
}) {
  return (
    <motion.div key="control" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6 sm:space-y-8">
      <LabGuardToolbar
        title="Kontrol Akses Internet Laboratorium"
        subtitle="Panel Kontrol Utama"
        placeholder="Cari Lab / VLAN..."
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showOnlyLabs={showOnlyLabs}
        setShowOnlyLabs={setShowOnlyLabs}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredInterfaces.map((iface, idx) => (
            <motion.div key={iface.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ delay: idx * 0.01 }} className={`${labGuardSurface} p-5 hover:border-blue-500/40 transition-all flex flex-col gap-5`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iface.enabled ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-500/10 text-gray-500'}`}>
                    <Layers size={18} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className={`text-sm font-bold uppercase tracking-tight truncate max-w-[120px] ${labGuardText}`}>{iface.name}</h3>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${iface.running ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      <span className="text-[8px] font-bold uppercase text-gray-400 tracking-wider">{iface.running ? 'Aktif' : 'Idle'}</span>
                    </div>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border shrink-0 ${iface.enabled ? 'border-blue-500/20 text-blue-500 bg-blue-500/10' : 'border-red-500/20 text-red-500 bg-red-500/10'}`}>
                  {iface.enabled ? 'Akses Aktif' : 'Akses Nonaktif'}
                </div>
              </div>

              <div className={`${labGuardInsetSurface} p-3 space-y-3`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Queue Tree (Batas Kecepatan)</p>
                    <p className={`text-[11px] font-bold uppercase tracking-wider truncate ${labGuardText}`}>{iface.hasQueueTree ? (iface.queueTreeName || iface.name) : 'Batas Tidak Ditemukan'}</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border shrink-0 ${iface.hasQueueTree
                    ? (iface.bandwidthEnabled
                      ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10'
                      : 'border-amber-500/20 text-amber-400 bg-amber-500/10')
                    : 'border-gray-500/20 text-gray-400 bg-gray-500/10'}`}
                  >
                    {iface.hasQueueTree ? (iface.bandwidthEnabled ? 'Aktif' : 'Nonaktif') : 'Tanpa Queue'}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Limit Saat Ini</p>
                    <p className={`text-sm font-bold tracking-tight ${labGuardText}`}>{iface.hasQueueTree ? `${formatBandwidthMbps(iface.bandwidthLimitMbps)} Mbps` : '--'}</p>
                  </div>
                  <div className="text-right min-w-0">
                    <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>NAT Dosen</p>
                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">{iface.teacherIp || '--'}</p>
                    <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${iface.teacherInternetEnabled
                      ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10'
                      : 'border-rose-500/20 text-rose-400 bg-rose-500/10'}`}
                    >
                      {iface.teacherInternetEnabled ? 'Dosen Aktif' : 'Dosen Nonaktif'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={bandwidthDrafts[iface.id] ?? ''}
                    onChange={(e) => setBandwidthDrafts(prev => ({ ...prev, [iface.id]: e.target.value }))}
                    placeholder="Mbps"
                    disabled={!iface.hasQueueTree}
                    className={`flex-1 min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 ${labGuardInput}`}
                  />
                  <button onClick={() => saveBandwidth(iface)} disabled={!iface.hasQueueTree || loading} className="px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all shrink-0 disabled:opacity-40">
                    Simpan
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className={`text-[9px] font-bold uppercase tracking-tight truncate min-w-0 ${labGuardMutedText}`}>{iface.comment || '-- Tanpa Catatan --'}</span>
                <button onClick={() => toggleInterface(iface.id, iface.enabled)} className={`px-4 sm:px-5 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shrink-0 ${iface.enabled
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-md'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-md'}`}
                >
                  {iface.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
