import { CaretDown as ChevronDown, MagnifyingGlass as Search } from '@phosphor-icons/react';
import {
  labGuardInsetSurface,
  labGuardInput,
  labGuardMutedText,
  labGuardSurface,
  labGuardText,
} from '../constants';
import { motion } from '../motion';
import SitePolicySection from './SitePolicySection';

const PolicyAccordionHeader = ({ title, subtitle, count, isOpen, onToggle }) => (
  <button onClick={onToggle} className={`${labGuardSurface} w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:border-blue-500/40 transition-colors`}>
    <div className="min-w-0">
      <h3 className={`text-sm sm:text-base font-bold uppercase tracking-wider ${labGuardText}`}>{title}</h3>
      <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1 ${labGuardMutedText}`}>{subtitle}</p>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <div className="px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-blue-500/20 text-blue-400 bg-blue-500/10">
        {count} Aturan
      </div>
      <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </div>
  </button>
);

const renderPolicyReferences = (rule) => (
  (rule.references || []).length > 0 ? (
    rule.references.map((reference) => (
      <span key={`${rule.id}-${reference}`} className="px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[8px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {reference}
      </span>
    ))
  ) : (
    <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Tidak Ada Daftar Terkait</span>
  )
);

const renderSampleTargets = (resource) => (
  (resource.sampleTargets || []).length > 0 ? (
    resource.sampleTargets.map((target) => (
      <span key={`${resource.id}-${target}`} className="px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[8px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {target}
      </span>
    ))
  ) : (
    <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Tidak Ada Contoh Target</span>
  )
);

export default function SitePolicyTab({
  sitePolicySearchQuery,
  setSitePolicySearchQuery,
  policyAccordion,
  togglePolicyAccordion,
  policyManagerType,
  setPolicyManagerType,
  selectedPolicyList,
  setSelectedPolicyList,
  availablePolicyLists,
  newPolicyList,
  setNewPolicyList,
  handleCreatePolicyList,
  handleDeletePolicyList,
  newPolicyEntry,
  setNewPolicyEntry,
  addPolicyEntry,
  filteredPolicyEntries,
  policyEntryDrafts,
  setPolicyEntryDrafts,
  policyManagerLoading,
  fetchAddressListEntries,
  savePolicyEntry,
  togglePolicyEntry,
  deletePolicyEntry,
  filteredWhitelistRules,
  filteredBlacklistResources,
}) {
  return (
    <motion.div key="site-policy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6 sm:space-y-8">
      <div className="space-y-6 sm:space-y-8">
        <div className="flex items-center gap-3 px-1 sm:px-4">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full shrink-0" />
          <h2 className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${labGuardMutedText}`}>Kebijakan Akses Situs</h2>
        </div>
        <div className="px-1 sm:px-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={sitePolicySearchQuery}
              onChange={(e) => setSitePolicySearchQuery(e.target.value)}
              placeholder="Cari aturan, nama daftar, atau target..."
              className={`w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none ${labGuardInput}`}
            />
          </div>
        </div>

        <div className="space-y-4">
          <PolicyAccordionHeader
            title="Manajer Daftar Kebijakan"
            subtitle="Kelola daftar pengecualian (whitelist) dan pemblokiran (blacklist) berbasis Address List pada router."
            count={filteredPolicyEntries.length}
            isOpen={policyAccordion.manager}
            onToggle={() => togglePolicyAccordion('manager')}
          />

          {policyAccordion.manager && (
            <div className={`${labGuardSurface} p-5 space-y-5`}>
              <div className="rounded-xl border border-dashed border-blue-500/30 bg-blue-500/[0.03] p-4 space-y-3">
                <p className="text-[8px] font-bold uppercase tracking-wider text-blue-400">Buat Daftar Baru</p>
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px] gap-3">
                  <input
                    type="text"
                    value={newPolicyList.name}
                    onChange={(e) => setNewPolicyList((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nama list baru (cth: gaming, streaming)"
                    className={`px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 ${labGuardInput}`}
                  />
                  <select
                    value={newPolicyList.type}
                    onChange={(e) => setNewPolicyList((prev) => ({ ...prev, type: e.target.value }))}
                    className={`px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold uppercase tracking-wide outline-none focus:ring-2 focus:ring-blue-500/20 ${labGuardInput}`}
                  >
                    <option value="blacklist">Daftar Hitam</option>
                    <option value="whitelist">Daftar Putih</option>
                  </select>
                </div>
                <textarea
                  value={newPolicyList.entriesText}
                  onChange={(e) => setNewPolicyList((prev) => ({ ...prev, entriesText: e.target.value }))}
                  placeholder={`Initial entries (opsional, satu per baris)\ncth:\nsteam.com\nepicgames.com`}
                  rows={3}
                  className={`w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 resize-none ${labGuardInput}`}
                />
                {newPolicyList.type === 'blacklist' && (
                  <label className="flex items-center gap-3 px-1 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={newPolicyList.strictBlacklist}
                      onChange={(e) => setNewPolicyList((prev) => ({ ...prev, strictBlacklist: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Blokir Ketat Situs Web (TLS Host)</span>
                  </label>
                )}
                <button onClick={handleCreatePolicyList} disabled={policyManagerLoading || !newPolicyList.name.trim()} className="px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-40">
                  Buat Daftar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_auto_auto] gap-3">
                <select value={policyManagerType} onChange={(e) => setPolicyManagerType(e.target.value)} className={`px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold uppercase tracking-wide outline-none focus:ring-2 focus:ring-blue-500/20 ${labGuardInput}`}>
                  <option value="blacklist">Daftar Hitam</option>
                  <option value="whitelist">Daftar Putih</option>
                </select>
                <select value={selectedPolicyList} onChange={(e) => setSelectedPolicyList(e.target.value)} disabled={!availablePolicyLists.length} className={`px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold uppercase tracking-wide outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 ${labGuardInput}`}>
                  {availablePolicyLists.length > 0 ? (
                    availablePolicyLists.map((listName) => <option key={listName} value={listName}>{listName}</option>)
                  ) : (
                    <option value="">Tidak Ada Daftar Alamat</option>
                  )}
                </select>
                <button onClick={() => selectedPolicyList && fetchAddressListEntries(selectedPolicyList)} disabled={!selectedPolicyList || policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-40">
                  Muat Ulang
                </button>
                <button onClick={handleDeletePolicyList} disabled={!selectedPolicyList || policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-md transition-all disabled:opacity-40">
                  Hapus Daftar
                </button>
              </div>

              <div className={`${labGuardInsetSurface} p-4 space-y-3`}>
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Tambah Target Baru</p>
                  <span className="text-[8px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Daftar: {selectedPolicyList || '--'}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3">
                  <input
                    type="text"
                    value={newPolicyEntry.address}
                    onChange={(e) => setNewPolicyEntry((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Alamat host / target"
                    disabled={!selectedPolicyList}
                    className={`px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 ${labGuardInput}`}
                  />
                  <input
                    type="text"
                    value={newPolicyEntry.comment}
                    onChange={(e) => setNewPolicyEntry((prev) => ({ ...prev, comment: e.target.value }))}
                    placeholder="Keterangan (opsional)"
                    disabled={!selectedPolicyList}
                    className={`px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 ${labGuardInput}`}
                  />
                  <button onClick={addPolicyEntry} disabled={!selectedPolicyList || policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all disabled:opacity-40">
                    Tambah
                  </button>
                </div>
                {policyManagerType === 'blacklist' && (
                  <label className="flex items-center gap-3 px-1 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={newPolicyEntry.strictBlacklist}
                      onChange={(e) => setNewPolicyEntry((prev) => ({ ...prev, strictBlacklist: e.target.checked }))}
                      disabled={!selectedPolicyList}
                      className="w-4 h-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500/20 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Blokir Ketat Situs Web (TLS Host)</span>
                  </label>
                )}
                <p className="text-[9px] font-bold text-gray-500">
                  Untuk domain web, sistem otomatis menambahkan host root dan versi www jika relevan. Saat mode strict aktif, sistem juga menambah rule TLS host supaya block lebih susah lolos.
                </p>
              </div>

              {selectedPolicyList ? (
                <div className="space-y-3">
                  {filteredPolicyEntries.length > 0 ? (
                    filteredPolicyEntries.map((entry) => (
                      <div key={entry.id} className={`${labGuardInsetSurface} p-4 space-y-3`}>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>ID Entri</p>
                            <p className="text-[10px] font-bold text-slate-600 break-all dark:text-slate-300">{entry.id}</p>
                          </div>
                          <div className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase border shrink-0 ${entry.disabled ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' : 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10'}`}>
                            {entry.disabled ? 'Nonaktif' : 'Aktif'}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={policyEntryDrafts[entry.id]?.address ?? ''}
                            onChange={(e) => setPolicyEntryDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], address: e.target.value } }))}
                            placeholder="Alamat host / target"
                            className={`px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 ${labGuardInput}`}
                          />
                          <input
                            type="text"
                            value={policyEntryDrafts[entry.id]?.comment ?? ''}
                            onChange={(e) => setPolicyEntryDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], comment: e.target.value } }))}
                            placeholder="Keterangan"
                            className={`px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 ${labGuardInput}`}
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button onClick={() => savePolicyEntry(entry)} disabled={policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-40">
                            Simpan Entri
                          </button>
                          <button onClick={() => togglePolicyEntry(entry)} disabled={policyManagerLoading} className={`px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md transition-all disabled:opacity-40 ${entry.disabled
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
                          >
                            {entry.disabled ? 'Aktifkan Entri' : 'Nonaktifkan Entri'}
                          </button>
                          <button onClick={() => deletePolicyEntry(entry)} disabled={policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-md transition-all disabled:opacity-40">
                            Hapus Entri
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-5 py-10 text-center text-slate-500 dark:text-slate-400">
                      <p className="text-[10px] font-bold uppercase tracking-wider">{policyManagerLoading ? 'Memuat Entri...' : 'Tidak Ditemukan Entri yang Cocok'}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-5 py-10 text-center text-slate-500 dark:text-slate-400">
                  <p className="text-[10px] font-bold uppercase tracking-wider">Belum ada daftar alamat yang tersedia untuk dikelola</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <PolicyAccordionHeader
            title="Aturan Whitelist"
            subtitle="Rule accept yang menjadi pengecualian akses untuk domain atau layanan tertentu."
            count={filteredWhitelistRules.length}
            isOpen={policyAccordion.whitelist}
            onToggle={() => togglePolicyAccordion('whitelist')}
          />

          {policyAccordion.whitelist && (
            <SitePolicySection
              title="Aturan Whitelist"
              subtitle="Rule accept yang menjadi pengecualian akses untuk domain atau layanan tertentu."
              emptyLabel="Belum ada aturan whitelist yang terdeteksi"
              items={filteredWhitelistRules}
              hideHeader={true}
              renderItem={(rule) => (
                <div key={rule.id} className={`${labGuardSurface} p-5 space-y-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className={`text-sm font-bold uppercase tracking-tight ${labGuardText}`}>{rule.name}</h4>
                      <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${labGuardMutedText}`}>{rule.source}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase border shrink-0 ${rule.status === 'active' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/20 text-amber-400 bg-amber-500/10'}`}>
                      {rule.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Pencocokan</p>
                    <p className="text-[11px] font-bold text-slate-700 break-words dark:text-slate-200">{rule.matcher || '--'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">{renderPolicyReferences(rule)}</div>
                </div>
              )}
            />
          )}
        </div>

        <div className="space-y-4">
          <PolicyAccordionHeader
            title="Sumber Blacklist"
            subtitle="Sumber data yang digunakan router untuk memblokir situs, termasuk address-list dan layer7."
            count={filteredBlacklistResources.length}
            isOpen={policyAccordion.blacklist}
            onToggle={() => togglePolicyAccordion('blacklist')}
          />

          {policyAccordion.blacklist && (
            <SitePolicySection
              title="Sumber Blacklist"
              subtitle="Sumber data yang digunakan router untuk memblokir situs, termasuk address-list dan layer7."
              emptyLabel="Belum ada sumber blacklist yang terdeteksi"
              items={filteredBlacklistResources}
              hideHeader={true}
              renderItem={(resource) => (
                <div key={resource.id} className={`${labGuardSurface} p-5 space-y-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className={`text-sm font-bold uppercase tracking-tight ${labGuardText}`}>{resource.name}</h4>
                      <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${labGuardMutedText}`}>{resource.type}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase border shrink-0 ${resource.status === 'active' ? 'border-blue-500/20 text-blue-400 bg-blue-500/10' : 'border-amber-500/20 text-amber-400 bg-amber-500/10'}`}>
                      {resource.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`${labGuardInsetSurface} px-4 py-3`}>
                      <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Jumlah Entri</p>
                      <p className={`text-lg font-bold tracking-tight mt-1 ${labGuardText}`}>{resource.totalEntries ?? '--'}</p>
                    </div>
                    <div className={`${labGuardInsetSurface} px-4 py-3`}>
                      <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Tipe</p>
                      <p className={`text-sm font-bold tracking-tight mt-1 uppercase ${labGuardText}`}>{resource.type || '--'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-[8px] font-bold uppercase tracking-wider ${labGuardMutedText}`}>Contoh Target</p>
                    <div className="flex flex-wrap gap-2">{renderSampleTargets(resource)}</div>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
