import { Lock, MagnifyingGlass as Search, LockOpen as Unlock, WifiSlash as WifiOff } from '@phosphor-icons/react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import {
  labGuardInsetSurface,
  labGuardMutedText,
  labGuardSurface,
  labGuardText,
} from '../constants';
import { AnimatePresence, motion } from '../motion';
import { TRAFFIC_SOURCE_SIMULATION } from '../constants';
import LabGuardToolbar from './LabGuardToolbar';
import UplinkTrafficCard from './UplinkTrafficCard';

export default function MonitoringTab({
  filteredInterfaces,
  searchQuery,
  setSearchQuery,
  showOnlyLabs,
  setShowOnlyLabs,
  uplinkTraffic,
  routerStatus,
  trafficHistory,
}) {
  return (
    <motion.div key="monitoring" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6 sm:space-y-10">
      <div className="space-y-5 sm:space-y-6">
        <LabGuardToolbar
          title="Pemantauan Trafik Real-time"
          subtitle="Throughput Antarmuka Jaringan"
          placeholder="Cari Antarmuka..."
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showOnlyLabs={showOnlyLabs}
          setShowOnlyLabs={setShowOnlyLabs}
        />

        <UplinkTrafficCard
          uplinkTraffic={uplinkTraffic}
          isSimulated={uplinkTraffic?.source === TRAFFIC_SOURCE_SIMULATION || routerStatus.status === 'simulated'}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredInterfaces.length > 0 ? (
              filteredInterfaces.map((iface, idx) => (
                <motion.div key={iface.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ delay: idx * 0.01 }} className={`${labGuardSurface} p-4 hover:border-blue-500/40 transition-all group flex flex-col h-full`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-inner ${iface.enabled ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600'}`}>
                      {iface.enabled ? <Unlock size={18} /> : <Lock size={18} />}
                    </div>
                    <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border transition-colors ${iface.enabled
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/30'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30'}`}
                    >
                      {iface.enabled ? 'Aktif' : 'Nonaktif'}
                    </div>
                  </div>
                  <div className="space-y-0.5 mb-4 flex-grow">
                    <h4 className={`text-sm font-bold tracking-tight uppercase line-clamp-1 ${labGuardText}`}>{iface.name}</h4>
                    <p className={`text-[9px] font-semibold uppercase tracking-wider truncate ${labGuardMutedText}`}>{iface.comment || 'Antarmuka VLAN'}</p>
                  </div>
                  <div className="h-12 w-full mt-auto bg-slate-50/70 dark:bg-slate-800/60 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-950/30 transition-colors">
                    {iface.enabled ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trafficHistory[iface.id] || []} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`color-${iface.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="download" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill={`url(#color-${iface.id})`} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center opacity-10 grayscale">
                        <WifiOff size={14} />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-12 sm:py-16 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                <Search size={28} className="mb-3 opacity-20" />
                <p className="text-[9px] font-bold uppercase tracking-wider">Antarmuka Tidak Ditemukan</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
