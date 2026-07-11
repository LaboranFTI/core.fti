import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loan, Equipment, LabStaff, Role, ToastMessage } from '../types';
import { Search, Filter, Plus, Check, X, Clock, Box, User, Save, Trash2, CreditCard, Eye, Calendar, QrCode, MapPin, Loader2, Edit } from 'lucide-react';
import { inventoryApi } from '../services/inventoryService';
import { loansApi } from '../services/loanService';
import { staffApi } from '../services/staffService';
import QRScannerModal from '../components/QRScannerModal';
import SearchableSelect, { SelectOption } from '../components/SearchableSelect';
import { formatDateID } from '../src/utils/formatters';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import PageHeader from '../components/PageHeader';
import PageCard from '../components/PageCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

interface FormData {
  equipmentIds: string[];
  borrowerName: string;
  guarantee: string;
  nim: string;
  borrowDate: string;
  borrowTime: string;
  borrowOfficer: string;
  location: string;
}

interface ReturnConfirmation {
  loans: Loan[];
  returnDate: string;
  returnTime: string;
  returnOfficer: string;
  returnLocation: string;
  condition: 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
}

interface SelectedGroup {
  key: string;
  loans: Loan[];
}

interface PeminjamanBarangProps {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', sticky?: boolean) => void;
}

const PeminjamanBarang: React.FC<PeminjamanBarangProps> = ({ showToast }) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [activeStaff, setActiveStaff] = useState<LabStaff[]>([]);

  const [filter, setFilter] = useState('All');

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{equipmentIds: string[], borrowerName: string, guarantee: string, nim: string, borrowDate: string, borrowTime: string, borrowOfficer: string, location: string}>({
    equipmentIds: [''],
    borrowerName: '',
    guarantee: 'KTM',
    nim: '',
    borrowDate: new Date().toISOString().split('T')[0],
    borrowTime: new Date().toTimeString().slice(0, 5),
    borrowOfficer: '',
    location: ''
  });

  // Detail & Return Modal State
  const [selectedGroup, setSelectedGroup] = useState<{key: string, loans: Loan[]} | null>(null);
  const [returnConfirmation, setReturnConfirmation] = useState<{loans: Loan[], returnTime: string, returnDate: string, returnOfficer: string, returnLocation: string, condition: 'Baik'} | null>(null);
  const [isReturning, setIsReturning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Scanner State - using reusable QRScannerModal
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningRowIndex, setScanningRowIndex] = useState<number | null>(null);

  // Menyimpan data scan terakhir untuk mencegah spam
  const lastScannedRef = useRef<{text: string, time: number}>({ text: '', time: 0 });

  const handleCloseScanner = () => {
    setIsScannerOpen(false);
    setScanningRowIndex(null);
  };

  // Scanner success handler - handles both global and per-row scanning
  const onScanSuccess = (decodedText: string) => {
    const now = Date.now();
    // Abaikan jika QR yang sama discan dalam waktu kurang dari 3 detik
    if (lastScannedRef.current.text === decodedText && now - lastScannedRef.current.time < 3000) {
      return;
    }
    lastScannedRef.current = { text: decodedText, time: now };

    const item = equipment.find(e => e.id === decodedText);
    
    if (item) {
      if (!item.isAvailable) {
        showToast(`Barang ${item.name} sedang dipinjam!`, "error");
        return;
      }

      const isDuplicate = formData.equipmentIds.some((id, idx) => 
        id === decodedText && (scanningRowIndex === null || idx !== scanningRowIndex)
      );

      if (isDuplicate) {
        showToast("Barang sudah ada di daftar", "warning");
        return;
      }

      setFormData(prev => {
        const newIds = [...prev.equipmentIds];

        if (scanningRowIndex !== null) {
          newIds[scanningRowIndex] = decodedText;
        } else {
          if (newIds.length === 1 && newIds[0] === '') {
            newIds[0] = decodedText;
          } else {
            newIds.push(decodedText);
          }
        }
        return { ...prev, equipmentIds: newIds };
      });
      showToast(`Ditambahkan: ${item.name}`, "success");
    } else {
      showToast(`ID ${decodedText} tidak ditemukan`, "error");
    }
  };

  // Handle Direct Scan from URL (QR Code Entry)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scanId = params.get('scan');

    if (scanId && equipment.length > 0) {
      const item = equipment.find(e => e.id === scanId);
      if (item) {
        if (item.isAvailable) {
          setFormData(prev => ({
            ...prev,
            equipmentIds: [scanId]
          }));
          setEditingTransactionId(null);
          setIsModalOpen(true);
          showToast(`Barang terdeteksi: ${item.name}`, "success");
        } else {
          showToast(`Barang ${item.name} sedang dipinjam!`, "error");
        }
      } else {
        showToast(`Barang dengan ID ${scanId} tidak ditemukan.`, "error");
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [equipment]);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    fetchStaff();
  }, []);

  const fetchData = async () => {
    try {
      const [loansRes, eqRes] = await Promise.all([
        loansApi.list(),
        inventoryApi.list()
      ]);
      if (loansRes.ok) setLoans(await loansRes.json());
      if (eqRes.ok) {
        const equipmentData: Equipment[] = await eqRes.json();
        setEquipment(equipmentData);
      }
    } catch (e) { console.error(e); }
  };

  const fetchStaff = async () => {
    try {
      const staffRes = await staffApi.list();
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        // Filter only active staff (status = 'Aktif')
        const activeStaffData = staffData
          .filter((staff: any) => staff.status === 'Aktif')
          .map((staff: any) => ({
            id: staff.id,
            name: staff.nama,
            nim: staff.identifier,
            email: staff.email,
            phone: staff.telepon,
            jabatan: staff.jabatan,
            status: staff.status
          }));
        setActiveStaff(activeStaffData);
      }
    } catch (e) { console.error(e); }
  };

  const getEquipmentOptions = (currentSelectedId: string): SelectOption[] => {
    const optionsEquipment = equipment.filter(e => 
      e.isAvailable || (editingTransactionId && formData.equipmentIds.includes(e.id))
    );

    return optionsEquipment.map(item => ({
      value: item.id,
      label: item.name,
      subLabel: item.id,
      disabled: formData.equipmentIds.includes(item.id) && item.id !== currentSelectedId
    }));
  };

  const petugasOptions: SelectOption[] = activeStaff.map((staff: LabStaff) => ({
    value: staff.name,
    label: staff.name
  })); 

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Dipinjam': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'Dikembalikan': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Terlambat': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const initiateReturn = (loansToReturn: Loan[]) => {
    const now = new Date();
    setReturnConfirmation({
      loans: loansToReturn,
      returnDate: now.toLocaleDateString('en-CA'),
      returnTime: now.toTimeString().slice(0, 5),
      returnOfficer: '',
      returnLocation: loansToReturn[0]?.originalLocation || loansToReturn[0]?.location || '',
                    condition: 'Baik'
    });
  };

  const confirmReturn = async () => {
    if (!returnConfirmation) return;

    const { loans, returnDate, returnTime, returnOfficer, returnLocation, condition } = returnConfirmation;
    
    if (!returnOfficer || !returnLocation) {
      showToast("Petugas dan Lokasi Pengembalian wajib diisi.", "error");
      return;
    }

    setIsReturning(true);

    try {
      // 1. Bulk Update Loan Status (Menggunakan endpoint yang benar di server.js)
      const loanIds = loans.map(l => l.id);
      const resLoans = await loansApi.returnBulk({
        loanIds,
        returnDate,
        returnTime,
        returnOfficer,
        returnLocation,
        condition
      });

      if (!resLoans.ok) throw new Error(`Gagal memproses pengembalian`);

      
      await fetchData();
      showToast(`${loans.length} barang berhasil dikembalikan dan perpindahan tercatat.`, "success");
      
      // Update state selectedGroup agar UI Modal Detail langsung berubah statusnya
      if (selectedGroup) {
        const returnedIds = loans.map(l => l.id);
        setSelectedGroup(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            loans: prev.loans.map(l => 
              returnedIds.includes(l.id)
                ? {
                    ...l,
                    status: 'Dikembalikan',
                    actualReturnDate: returnDate,
                    actualReturnTime: returnTime,
                    returnOfficer: returnOfficer,
                    returnLocation: returnLocation,
                    condition: condition
                  }
                : l
            )
          };
        });
      }

      setReturnConfirmation(null);
    } catch (e: any) { 
      showToast(`Gagal memproses pengembalian: ${e.message || e}`, "error"); 
    } finally {
      setIsReturning(false);
    }
  };

  const handleDeleteGroup = async (groupLoans: Loan[]) => {
    if (confirm(`Hapus riwayat peminjaman untuk ${groupLoans.length} barang ini? Data tidak dapat dikembalikan.`)) {
      setIsDeleting(true);
      try {
        await loansApi.deleteGroup(groupLoans.map(l => l.id));
        await fetchData();
        showToast("Data peminjaman dihapus.", "info");
        setSelectedGroup(null);
      } catch (e) { showToast("Gagal menghapus data", "error"); }
      finally { setIsDeleting(false); }
    }
  };

  const handleEditGroup = (groupLoans: Loan[]) => {
    const firstLoan = groupLoans[0];

    setFormData({
      equipmentIds: groupLoans.map(l => l.equipmentId),
      borrowerName: firstLoan.borrowerName,
      guarantee: firstLoan.guarantee,
      nim: (firstLoan as any).nim || '',
      borrowDate: firstLoan.borrowDate,
      borrowTime: firstLoan.borrowTime || new Date().toTimeString().slice(0, 5),
      borrowOfficer: firstLoan.borrowOfficer,
      location: firstLoan.location || ''
    });
    setEditingTransactionId(firstLoan.transactionId);
    setSelectedGroup(null);
    setIsModalOpen(true);
  };

  const addEquipmentRow = () => {
    setFormData(prev => ({ ...prev, equipmentIds: [...prev.equipmentIds, ''] }));
  };

  const removeEquipmentRow = (index: number) => {
    if (formData.equipmentIds.length > 1) {
      setFormData(prev => ({
        ...prev,
        equipmentIds: prev.equipmentIds.filter((_, i) => i !== index)
      }));
    }
  };

  const updateEquipmentRow = (index: number, value: string) => {
    const newIds = [...formData.equipmentIds];
    newIds[index] = value;
    setFormData(prev => ({ ...prev, equipmentIds: newIds }));
  };

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedIds = formData.equipmentIds.filter(id => id !== '');

    if (selectedIds.length === 0 || !formData.borrowerName || !formData.borrowDate || !formData.borrowTime || !formData.borrowOfficer || !formData.location) {
      showToast("Mohon lengkapi data peminjaman.", "error");
      return;
    }

    if (formData.guarantee === 'KTM' && !formData.nim.trim()) {
      showToast("NIM wajib diisi jika jaminan adalah KTM.", "error");
      return;
    }

    try {
      if (editingTransactionId) {
        const res = await loansApi.updateGroup(editingTransactionId, {
          equipmentIds: selectedIds,
          borrowerName: formData.borrowerName,
          nim: formData.nim,
          guarantee: formData.guarantee,
          borrowDate: formData.borrowDate,
          borrowTime: formData.borrowTime,
          borrowOfficer: formData.borrowOfficer,
          location: formData.location
        });
        if (res.ok) {
          fetchData();
          showToast(`Data peminjaman berhasil diperbarui.`, "success");
        } else {
          const data = await res.json();
          showToast(data.error || "Gagal memperbarui data", "error");
          return;
        }
      } else {
        const res = await loansApi.create({
          equipmentIds: selectedIds,
          borrowerName: formData.borrowerName,
          nim: formData.nim,
          guarantee: formData.guarantee,
          borrowDate: formData.borrowDate,
          borrowTime: formData.borrowTime,
          borrowOfficer: formData.borrowOfficer,
          location: formData.location
        });
        if (res.ok) {
          fetchData();
          showToast(`${selectedIds.length} Peminjaman berhasil dicatat.`, "success");
        } else {
          const data = await res.json();
          showToast(data.error || "Gagal menyimpan data", "error");
          return;
        }
      }
    } catch (e) { showToast("Gagal menyimpan data", "error"); return; }

    setIsModalOpen(false);
    setEditingTransactionId(null);
    setFormData({ 
      equipmentIds: [''], 
      borrowerName: '', 
      guarantee: 'KTM', 
      nim: '', 
      borrowDate: new Date().toISOString().split('T')[0],
      borrowTime: new Date().toTimeString().slice(0, 5),
      borrowOfficer: '',
      location: ''
    });
  };

  const filteredLoans = React.useMemo(() => {
    return loans.filter(loan => {
      const matchesSearch = loan.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            ((loan as any).nim && (loan as any).nim.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            loan.equipmentName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'All' || loan.status === filter;
      
      let matchesDate = true;
      if (startDate && endDate) {
        matchesDate = loan.borrowDate >= startDate && loan.borrowDate <= endDate;
      } else if (startDate) {
        matchesDate = loan.borrowDate >= startDate;
      } else if (endDate) {
        matchesDate = loan.borrowDate <= endDate;
      }

      return matchesSearch && matchesFilter && matchesDate;
    });
  }, [loans, searchTerm, filter, startDate, endDate]);

  const groupedLoans = React.useMemo(() => {
    return filteredLoans.reduce((groups, loan) => {
      const key = loan.transactionId;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(loan);
      return groups;
    }, {} as Record<string, Loan[]>);
  }, [filteredLoans]);

  const sortedGroupKeys = React.useMemo(() => {
    return Object.keys(groupedLoans).sort((a, b) => b.localeCompare(a));
  }, [groupedLoans]);

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    paginatedData: currentKeys,
    totalPages
  } = usePagination(sortedGroupKeys, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, startDate, endDate, itemsPerPage, setCurrentPage]);

  return (
    <>
      <div className="space-y-6">
      <PageHeader
        title="Peminjaman Barang"
        description="Kelola sirkulasi peminjaman inventaris, status pengembalian, dan riwayat transaksi barang."
        actions={
          <button
            onClick={() => {
              setEditingTransactionId(null);
              setFormData({
                equipmentIds: [''],
                borrowerName: '',
                guarantee: 'KTM',
                nim: '',
                borrowDate: new Date().toISOString().split('T')[0],
                borrowTime: new Date().toTimeString().slice(0, 5),
                borrowOfficer: '',
                location: ''
              });
              setIsModalOpen(true);
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus className="mr-2 h-4 w-4" /> Peminjaman Baru
          </button>
        }
      />

      <PageCard padding="none" className="overflow-hidden">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/60 sm:flex-row">
          <div className="w-full sm:w-auto">
            <SearchBar 
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Cari nama peminjam atau barang..."
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300"
              />
              <span className="text-gray-500 dark:text-gray-400">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select 
                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="All">Semua Status</option>
                <option value="Dipinjam">Dipinjam</option>
                <option value="Dikembalikan">Dikembalikan</option>
              </select>
            </div>
          </div>
        </div>

          <Table className="text-left text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-6">Peminjam</TableHead>
                <TableHead className="px-6">Waktu Pinjam</TableHead>
                <TableHead className="px-6">Jumlah Barang</TableHead>
                <TableHead className="px-6">Status</TableHead>
                <TableHead className="px-6 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentKeys.length > 0 ? currentKeys.map((key) => {
                const groupLoans = groupedLoans[key];
                const firstLoan = groupLoans[0];
                
                const allReturned = groupLoans.every(l => l.status === 'Dikembalikan');
                const anyLate = groupLoans.some(l => l.status === 'Terlambat');
                const displayStatus = allReturned ? 'Dikembalikan' : (anyLate ? 'Terlambat' : 'Dipinjam');

                return (
                  <TableRow
                    key={key} 
                    onClick={() => setSelectedGroup({ key, loans: groupLoans })}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 group"
                  >
                    <TableCell className="px-6 py-4">
                      <div className="text-gray-900 dark:text-white font-medium">
                        {firstLoan.borrowerName} {((firstLoan as any).nim) ? `(${(firstLoan as any).nim})` : ''}
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mt-1">
                        Oleh: {firstLoan.borrowOfficer} | Jaminan: {firstLoan.guarantee}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="text-gray-900 dark:text-white text-sm">{formatDateID(firstLoan.borrowDate)}</div>
                      <div className="text-xs text-gray-500">{firstLoan.borrowTime}</div>
                      {allReturned && firstLoan.actualReturnDate && (
                        <div className="mt-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                          <div className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">Dikembalikan:</div>
                          <div className="text-xs text-gray-500">{formatDateID(firstLoan.actualReturnDate)} {firstLoan.actualReturnTime} (Oleh: {firstLoan.returnOfficer})</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <Box className="w-3 h-3 mr-1" /> {groupLoans.length} Barang
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(displayStatus)}`}>
                        {displayStatus}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center">
                      <button type="button" className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center justify-center mx-auto">
                        <Eye className="w-4 h-4 mr-1" /> Detail
                      </button>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center">
                      <Box className="w-12 h-12 text-gray-300 mb-3" />
                      <p>Tidak ada data peminjaman.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        <div className="print:hidden">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedGroupKeys.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </PageCard>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-full sm:max-w-lg md:max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up max-h-[90vh] flex flex-col">
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center text-sm sm:text-base">
                {editingTransactionId ? <Edit className="w-5 h-5 mr-2 text-blue-600" /> : <Plus className="w-5 h-5 mr-2 text-blue-600" />}
                {editingTransactionId ? 'Edit Peminjaman' : 'Input Peminjaman Baru'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); setEditingTransactionId(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitLoan} className="p-3 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Peminjam</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" required
                      value={formData.borrowerName}
                      onChange={(e) => setFormData({...formData, borrowerName: e.target.value})}
                      placeholder="Nama Lengkap"
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Jaminan</label>
                  <select 
                    value={formData.guarantee}
                    onChange={(e) => setFormData({...formData, guarantee: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="KTM">KTM (Mahasiswa)</option>
                    <option value="KTP">KTP (Umum)</option>
                    <option value="SIM">SIM</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.guarantee === 'KTM' ? 'NIM' : 
                      formData.guarantee === 'KTP' ? 'NIK' : 
                      formData.guarantee === 'SIM' ? 'No. SIM' : 
                      formData.guarantee === 'Lainnya' ? 'Nama Jaminan' : 'Nomor Identitas'}
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" required
                      value={formData.nim}
                      onChange={(e) => setFormData({...formData, nim: e.target.value})}
                      placeholder={formData.guarantee === 'KTM' ? '6720xxxx' : formData.guarantee === 'Lainnya' ? 'Contoh: STNK / HP' : 'Nomor Identitas'}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Pinjam</label>
                  <input 
                    type="date" required
                    value={formData.borrowDate}
                    onChange={(e) => setFormData({...formData, borrowDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Pinjam</label>
                  <input 
                    type="time" required
                    value={formData.borrowTime}
                    onChange={(e) => setFormData({...formData, borrowTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Petugas Peminjaman</label>
                  <SearchableSelect 
                    options={petugasOptions}
                    value={formData.borrowOfficer}
                    onChange={(val) => setFormData({...formData, borrowOfficer: val})}
                    placeholder="-- Pilih Petugas --"
                    searchPlaceholder="Cari petugas..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi Peminjaman</label>
                  <input 
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="Contoh: Ruang Kelas / Luar Kampus"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Daftar Barang */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Daftar Barang</label>
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => {
                        setScanningRowIndex(null);
                        setIsScannerOpen(true);
                      }}
                      className="text-xs text-blue-600 hover:underline flex items-center font-medium"
                    >
                      <QrCode className="w-3 h-3 mr-1" /> Scan Tambah
                    </button>
                    <button type="button" onClick={addEquipmentRow} className="text-xs text-blue-600 hover:underline flex items-center font-medium">
                      <Plus className="w-3 h-3 mr-1" /> Tambah Manual
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {formData.equipmentIds.map((selectedId, index) => (
                    <div key={index} className="flex gap-2 animate-fade-in-up">
                      <SearchableSelect
                        options={getEquipmentOptions(selectedId)}
                        value={selectedId}
                        onChange={(val) => updateEquipmentRow(index, val)}
                        placeholder="-- Pilih Barang --"
                        searchPlaceholder="Cari barang..."
                        required
                        className="flex-1"
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          setScanningRowIndex(index);
                          setIsScannerOpen(true);
                        }}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Scan QR untuk baris ini"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      {formData.equipmentIds.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeEquipmentRow(index)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingTransactionId(null); }} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center shadow-md hover:shadow-lg transition-all">
                  <Save className="w-4 h-4 mr-2" /> Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Using reusable QRScannerModal component */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={handleCloseScanner}
        onScanSuccess={onScanSuccess}
        title="Scan QR Code Barang"
        closeOnSuccess={scanningRowIndex !== null}
      />

      {/* Detail Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Detail Peminjaman
              </h3>
              <button onClick={() => setSelectedGroup(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-6 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Peminjam</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedGroup.loans[0].borrowerName} {((selectedGroup.loans[0] as any).nim) ? `(${(selectedGroup.loans[0] as any).nim})` : ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Jaminan: {selectedGroup.loans[0].guarantee}</p>
                  {selectedGroup.loans[0].location && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center">
                      <MapPin className="w-3 h-3 mr-1" /> Lokasi: {selectedGroup.loans[0].location}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Waktu Pinjam</p>
                  <p className="text-md font-medium text-gray-900 dark:text-white flex items-center justify-end">
                    <Calendar className="w-4 h-4 mr-1" /> {formatDateID(selectedGroup.loans[0].borrowDate)}
                  </p>
                  <p className="text-md font-medium text-gray-900 dark:text-white flex items-center justify-end mt-1">
                    <Clock className="w-4 h-4 mr-1" /> {selectedGroup.loans[0].borrowTime || '-'}
                  </p>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Daftar Barang Dipinjam</h4>
              
              {selectedGroup.loans.filter(l => l.status === 'Dipinjam').length > 1 && (
                <button 
                  onClick={() => initiateReturn(selectedGroup.loans.filter(l => l.status === 'Dipinjam'))}
                  disabled={isReturning}
                  className="mb-3 w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isReturning && returnConfirmation && returnConfirmation.loans.length > 1 ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</>
                  ) : (
                    <><Check className="w-4 h-4 mr-2" /> Kembalikan Semua ({selectedGroup.loans.filter(l => l.status === 'Dipinjam').length} Barang)</>
                  )}
                </button>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedGroup.loans.map((loan) => (
                  <div key={loan.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Box className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      {loan.status === 'Dipinjam' ? (
                        <button 
                          onClick={() => initiateReturn([loan])}
                          disabled={isReturning}
                          className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm ml-2 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isReturning && returnConfirmation?.loans.some(l => l.id === loan.id) ? (
                            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Memproses</>
                          ) : (
                            <><Check className="w-3 h-3 mr-1" /> Kembalikan</>
                          )}
                        </button>
                      ) : (
                        <div className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 font-semibold rounded-lg">
                          Dikembalikan
                        </div>
                      )}
                    </div>
                    <h5 className="font-bold text-gray-900 dark:text-white text-sm mb-1 truncate">{loan.equipmentName}</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">ID: <span className="font-mono">{loan.equipmentId}</span></p>
                    {loan.returnLocation && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-1 flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        Dikembalikan ke: {loan.returnLocation}
                      </p>
                    )}
                    {loan.condition && (
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        loan.condition === 'Baik' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        loan.condition === 'Rusak Ringan' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        Kondisi: {loan.condition}
                      </div>
                    )}
                    {loan.actualReturnDate && (
                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">Info Pengembalian:</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center">
                          <Calendar className="w-3 h-3 mr-1 text-gray-400" /> {formatDateID(loan.actualReturnDate)} {loan.actualReturnTime}
                        </p>
                        {loan.returnOfficer && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center mt-1">
                            <User className="w-3 h-3 mr-1 text-gray-400" /> Penerima: {loan.returnOfficer}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between">
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleDeleteGroup(selectedGroup.loans)}
                  disabled={isDeleting}
                  className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                  {isDeleting ? 'Menghapus...' : 'Hapus Riwayat'}
                </button>
                {selectedGroup.loans.some(l => l.status === 'Dipinjam') && (
                  <button 
                    onClick={() => handleEditGroup(selectedGroup.loans)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center ml-2"
                  >
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </button>
                )}
              </div>
              <button onClick={() => setSelectedGroup(null)} className="px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-500">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Confirmation Modal */}
      {returnConfirmation && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Konfirmasi Pengembalian</h3>
            <div className="space-y-3 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">Barang</p>
                <p className="font-medium text-gray-900 dark:text-white">
{(() => {
  const rc = returnConfirmation!;
  const loans = rc.loans;
  return loans.length === 1 ? loans[0].equipmentName : `${loans.length} Barang Terpilih`;
})()}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Kembali</label>
                  <input 
                    type="date" required
                    value={returnConfirmation.returnDate}
                    onChange={e => setReturnConfirmation({...returnConfirmation, returnDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Kembali</label>
                  <input 
                    type="time" required
                    value={returnConfirmation.returnTime}
                    onChange={e => setReturnConfirmation({...returnConfirmation, returnTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Petugas Pengembalian</label>
                  <SearchableSelect 
                    options={petugasOptions}
                    value={returnConfirmation.returnOfficer}
                    onChange={(val) => setReturnConfirmation({...returnConfirmation, returnOfficer: val})}
                    placeholder="-- Pilih Petugas --"
                    searchPlaceholder="Cari petugas..."
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    Lokasi Pengembalian
                  </label>
                  <input 
                    type="text" required
                    value={returnConfirmation.returnLocation}
                    onChange={e => setReturnConfirmation({...returnConfirmation, returnLocation: e.target.value})}
                    placeholder="Ruang / Rak pengembalian"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kondisi Barang</label>
                  <select 
                    required
                    value={returnConfirmation.condition}
                    onChange={e => setReturnConfirmation({...returnConfirmation, condition: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setReturnConfirmation(null)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Batal</button>
              <button 
                disabled={!returnConfirmation.returnDate || !returnConfirmation.returnTime || !returnConfirmation.returnLocation || isReturning}
                onClick={confirmReturn}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isReturning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default PeminjamanBarang;
