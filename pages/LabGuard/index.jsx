import { Pulse as Activity, WarningCircle as AlertCircle, ArrowCounterClockwise as RefreshCcw, GearSix as SettingsIcon, ShieldWarning as ShieldAlert } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader';
import { Tabs } from '../../components/ui/tabs';
import { PageTabs } from '../../components/ui/page-tabs';
import { AnimatePresence } from './motion';
import useLabGuard from './hooks/useLabGuard';
import ControlTab from './components/ControlTab';
import MonitoringTab from './components/MonitoringTab';
import SitePolicyTab from './components/SitePolicyTab';

export default function LabGuard() {
  const labGuardTabs = [
    { value: 'control', label: 'Kontrol Akses', icon: SettingsIcon },
    { value: 'monitoring', label: 'Pemantauan Trafik', icon: Activity },
    { value: 'site-policy', label: 'Kebijakan Akses', icon: ShieldAlert },
  ];

  const labGuard = useLabGuard();
  const {
    activeTab,
    setActiveTab,
    routerStatus,
    trafficHistory,
    uplinkTraffic,
    sitePolicySearchQuery,
    setSitePolicySearchQuery,
    policyAccordion,
    policyManagerType,
    setPolicyManagerType,
    selectedPolicyList,
    setSelectedPolicyList,
    policyEntryDrafts,
    setPolicyEntryDrafts,
    newPolicyEntry,
    setNewPolicyEntry,
    newPolicyList,
    setNewPolicyList,
    policyManagerLoading,
    loading,
    error,
    connectionAlert,
    searchQuery,
    setSearchQuery,
    showOnlyLabs,
    setShowOnlyLabs,
    bandwidthDrafts,
    setBandwidthDrafts,
    filteredInterfaces,
    availablePolicyLists,
    filteredWhitelistRules,
    filteredBlacklistResources,
    filteredPolicyEntries,
    handleRefresh,
    fetchAddressListEntries,
    toggleInterface,
    saveBandwidth,
    addPolicyEntry,
    savePolicyEntry,
    togglePolicyEntry,
    deletePolicyEntry,
    handleCreatePolicyList,
    handleDeletePolicyList,
    togglePolicyAccordion,
  } = labGuard;

  return (
    <div className="space-y-6 sm:space-y-8 text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-6 transition-colors duration-500 dark:text-slate-100">
      <PageHeader
        title="LabGuard"
        description="Kontrol Akses VLAN Laboratorium."
        actions={(
          <button onClick={handleRefresh} className="flex items-center justify-center p-2.5 rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-fti-blue-600 hover:text-fti-blue-700 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-fti-blue-300 dark:hover:text-white">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      />

      {error && (
        <div className="mb-6 sm:mb-10 bg-red-950/20 border border-red-900/30 p-4 sm:p-6 rounded-xl flex items-center gap-3 sm:gap-4 text-red-400">
          <AlertCircle size={20} className="shrink-0" />
          <div className="flex-grow">
            <p className="text-xs font-bold uppercase tracking-wider leading-none mb-1">Kesalahan Sistem</p>
            <p className="text-xs font-semibold opacity-95">
              {error === 'Gagal memuat daftar interface. Silakan cek koneksi router.'
                ? 'Gagal memuat daftar interface. Silakan cek koneksi router.'
                : error === 'System connection error. Please try again.'
                  ? 'Koneksi sistem bermasalah. Silakan coba lagi.'
                  : error}
            </p>
          </div>
          <button onClick={handleRefresh} className="hidden sm:block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-lg">
            Coba Lagi
          </button>
        </div>
      )}

      <div className="space-y-6 sm:space-y-8">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="flex w-full flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 print:hidden">
            <PageTabs items={labGuardTabs} />

            {connectionAlert && (
              <button
                onClick={handleRefresh}
                title="Klik untuk memeriksa ulang koneksi router CCR"
                className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg border transition-all duration-300 active:scale-95 cursor-pointer sm:w-fit justify-center ${
                  connectionAlert.type === 'success'
                    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/25 hover:bg-green-100/50 dark:hover:bg-green-500/20'
                    : connectionAlert.type === 'warning'
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 hover:bg-amber-100/50 dark:hover:bg-amber-500/20'
                      : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 hover:bg-rose-100/50 dark:hover:bg-rose-500/20'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${
                  connectionAlert.type === 'success'
                    ? 'bg-green-500 animate-pulse'
                    : connectionAlert.type === 'warning'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-rose-500'
                }`}
                />
                {connectionAlert.type === 'success'
                  ? `CCR Terhubung : ${routerStatus.resource?.['board-name'] || 'MikroTik CCR'}`
                  : connectionAlert.type === 'warning'
                    ? 'CCR: Mode Simulasi'
                    : 'Koneksi CCR Gagal'}
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'monitoring' ? (
              <MonitoringTab
                filteredInterfaces={filteredInterfaces}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showOnlyLabs={showOnlyLabs}
                setShowOnlyLabs={setShowOnlyLabs}
                uplinkTraffic={uplinkTraffic}
                routerStatus={routerStatus}
                trafficHistory={trafficHistory}
              />
            ) : activeTab === 'site-policy' ? (
              <SitePolicyTab
                sitePolicySearchQuery={sitePolicySearchQuery}
                setSitePolicySearchQuery={setSitePolicySearchQuery}
                policyAccordion={policyAccordion}
                togglePolicyAccordion={togglePolicyAccordion}
                policyManagerType={policyManagerType}
                setPolicyManagerType={setPolicyManagerType}
                selectedPolicyList={selectedPolicyList}
                setSelectedPolicyList={setSelectedPolicyList}
                availablePolicyLists={availablePolicyLists}
                newPolicyList={newPolicyList}
                setNewPolicyList={setNewPolicyList}
                handleCreatePolicyList={handleCreatePolicyList}
                handleDeletePolicyList={handleDeletePolicyList}
                newPolicyEntry={newPolicyEntry}
                setNewPolicyEntry={setNewPolicyEntry}
                addPolicyEntry={addPolicyEntry}
                filteredPolicyEntries={filteredPolicyEntries}
                policyEntryDrafts={policyEntryDrafts}
                setPolicyEntryDrafts={setPolicyEntryDrafts}
                policyManagerLoading={policyManagerLoading}
                fetchAddressListEntries={fetchAddressListEntries}
                savePolicyEntry={savePolicyEntry}
                togglePolicyEntry={togglePolicyEntry}
                deletePolicyEntry={deletePolicyEntry}
                filteredWhitelistRules={filteredWhitelistRules}
                filteredBlacklistResources={filteredBlacklistResources}
              />
            ) : (
              <ControlTab
                filteredInterfaces={filteredInterfaces}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showOnlyLabs={showOnlyLabs}
                setShowOnlyLabs={setShowOnlyLabs}
                bandwidthDrafts={bandwidthDrafts}
                setBandwidthDrafts={setBandwidthDrafts}
                loading={loading}
                saveBandwidth={saveBandwidth}
                toggleInterface={toggleInterface}
              />
            )}
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}
