import React, { useState, useEffect } from 'react';
import { Room, Role, RoomComputer, Software } from '../types';
import { 
  Monitor, Cpu, HardDrive, Keyboard, Mouse, Download, FileSpreadsheet,
  Plus, Edit2, Trash2, Search, ChevronRight, X, Loader2,
  Save, Package, Filter
} from 'lucide-react';
import { api } from '../services/api';
import ExcelJS from 'exceljs';
import ComputerForm from '../components/ComputerForm';
import SoftwareForm from '../components/SoftwareForm';
import ConfirmModal from '../components/ConfirmModal';
import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';

interface ManajemenSpesifikasiProps {
  role: Role;
  isDarkMode: boolean;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const getConditionColor = (condition?: string) => {
  switch (condition) {
    case 'Baik': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'Rusak Ringan': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'Rusak Berat': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const ManajemenSpesifikasi: React.FC<ManajemenSpesifikasiProps> = ({ role, isDarkMode, showToast }) => {
  const isAdmin = role.toString().toUpperCase() === Role.ADMIN.toString().toUpperCase();
  const isLaboran = role.toString().toUpperCase() === Role.LABORAN.toString().toUpperCase();
  const isSupervisor = role.toString().toUpperCase() === 'SUPERVISOR';
  const canManage = isAdmin || isLaboran || isSupervisor;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [activeTab, setActiveTab] = useState<'computers' | 'software'>('computers');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPcOperator, setFilterPcOperator] = useState<'all' | 'lt' | 'eq' | 'gt'>('all');
  const [filterPcCount, setFilterPcCount] = useState<number | ''>('');

  // Computer State
  const [roomComputers, setRoomComputers] = useState<RoomComputer[]>([]);
  const [editingComputer, setEditingComputer] = useState<Partial<RoomComputer> | null>(null);

  // Software State
  const [softwareList, setSoftwareList] = useState<Software[]>([]);
  const [editingSoftware, setEditingSoftware] = useState<Partial<Software> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Modal States
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', targetId: '', actionType: ''
  });
  const [isConfirming, setIsConfirming] = useState(false);

  // Filter
  const filteredRooms = rooms.filter(room => {
    const isLab = room.category === 'Laboratorium Komputer';
    const hasComputer = room.facilities?.includes('Komputer') || false;
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesPcCount = true;
    const pcCount = (room as any).computerCount || 0;
    if (filterPcOperator !== 'all' && filterPcCount !== '') {
      if (filterPcOperator === 'lt') matchesPcCount = pcCount < Number(filterPcCount);
      else if (filterPcOperator === 'eq') matchesPcCount = pcCount === Number(filterPcCount);
      else if (filterPcOperator === 'gt') matchesPcCount = pcCount > Number(filterPcCount);
    }

    return (isLab || hasComputer) && matchesSearch && matchesPcCount;
  });

  const filteredComputers = roomComputers.filter(pc => 
    pc.pcNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.cpu?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.os?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSoftware = softwareList.filter(soft => 
    soft.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    soft.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    soft.version?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchRooms();
    if (selectedRoom) {
      fetchRoomComputers();
      fetchSoftware();
    }
  }, [selectedRoom]);

  // Auto-select room when navigating from "Daftar Ruang" via "Kelola Unit" button
  useEffect(() => {
    const targetId = localStorage.getItem('targetSpecRoomId');
    if (targetId && rooms.length > 0) {
      const targetRoom = rooms.find(r => r.id === targetId);
      if (targetRoom) {
        setSelectedRoom(targetRoom);
      }
      localStorage.removeItem('targetSpecRoomId');
    }
  }, [rooms]);

  const fetchRooms = async () => {
    try {
      const res = await api('/api/rooms?exclude_image=true');
      if (res.ok) setRooms(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchRoomComputers = async () => {
    if (!selectedRoom) return;
    try {
      const res = await api(`/api/rooms/${selectedRoom.id}/computers`);
      if (res.ok) setRoomComputers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchSoftware = async () => {
    if (!selectedRoom) return;
    try {
      const res = await api(`/api/software?roomId=${selectedRoom.id}`);
      if (res.ok) setSoftwareList(await res.json());
    } catch (e) { console.error(e); }
  };

  // --- COMPUTER HANDLERS ---

  const handleSaveComputer = async (computerData: Partial<RoomComputer>) => {
    if (!selectedRoom) return;

    setIsSaving(true);
    const payload = {
      ...computerData,
      id: computerData.id || `PC-${Date.now()}`,
      roomId: selectedRoom.id
    };

    try {
      await api('/api/computers', { method: 'POST', data: payload });
      showToast("Data komputer berhasil disimpan.", "success");
      setEditingComputer(null);
      fetchRoomComputers();
      fetchRooms(); // Update jumlah komputer pada card
    } catch (e) { 
      showToast("Gagal menyimpan data komputer", "error"); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteComputerClick = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Data Komputer',
      message: 'Apakah Anda yakin ingin menghapus data komputer ini?',
      targetId: id,
      actionType: 'delete_computer'
    });
  };

  const handleDeleteAllComputersClick = () => {
    if (!selectedRoom) return;
    setConfirmModal({
      isOpen: true,
      title: 'Reset Semua Data Komputer',
      message: `PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data komputer di ruangan ${selectedRoom.name}? Tindakan ini tidak dapat dibatalkan.`,
      targetId: selectedRoom.id,
      actionType: 'delete_all_computers'
    });
  };

  const executeConfirmAction = async () => {
    setIsConfirming(true);
    try {
      if (confirmModal.actionType === 'delete_computer') {
        await api(`/api/computers/${confirmModal.targetId}`, { method: 'DELETE' });
        showToast("Data komputer berhasil dihapus.", "info");
      } else if (confirmModal.actionType === 'delete_all_computers') {
        await api(`/api/rooms/${confirmModal.targetId}/computers`, { method: 'DELETE' });
        showToast("Semua data komputer telah dihapus.", "success");
      } else if (confirmModal.actionType === 'delete_software') {
        await api(`/api/software/${confirmModal.targetId}`, { method: 'DELETE' });
        showToast("Data software berhasil dihapus.", "info");
      }
      fetchRoomComputers();
      fetchSoftware();
      fetchRooms();
    } catch (e) {
      showToast("Gagal menghapus data.", "error");
    } finally {
      setIsConfirming(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    
    if (activeTab === 'computers') {
      const worksheet = workbook.addWorksheet('Template Komputer');
      worksheet.columns = [
        { header: 'No PC', key: 'pcNumber', width: 10 },
        { header: 'OS', key: 'os', width: 15 },
        { header: 'CPU', key: 'cpu', width: 25 },
        { header: 'Tipe GPU', key: 'gpuType', width: 25 },
        { header: 'Model GPU', key: 'gpuModel', width: 20 },
        { header: 'VRAM', key: 'vram', width: 10 },
        { header: 'RAM', key: 'ram', width: 10 },
        { header: 'Storage', key: 'storage', width: 25 },
        { header: 'Monitor', key: 'monitor', width: 20 },
        { header: 'Keyboard', key: 'keyboard', width: 20 },
        { header: 'Mouse', key: 'mouse', width: 20 },
        { header: 'Kondisi', key: 'condition', width: 15 },
      ];
      worksheet.addRow({ pcNumber: 'PC-01', os: 'Windows 11', cpu: 'Intel Core i5-12400', gpuType: 'Integrated', gpuModel: 'Intel UHD 730', vram: '-', ram: '16GB', storage: 'SSD 512GB', monitor: 'Dell 24"', keyboard: 'Logitech', mouse: 'Logitech', condition: 'Baik' });
    } else {
      const worksheet = workbook.addWorksheet('Template Software');
      worksheet.columns = [
        { header: 'Nama Software', key: 'name', width: 30 },
        { header: 'Versi', key: 'version', width: 15 },
        { header: 'Kategori', key: 'category', width: 20 },
        { header: 'Tipe Lisensi', key: 'licenseType', width: 15 },
        { header: 'Vendor', key: 'vendor', width: 20 },
        { header: 'Tanggal Install', key: 'installDate', width: 15 },
        { header: 'Catatan', key: 'notes', width: 30 },
      ];
      worksheet.addRow({ name: 'Microsoft Office', version: '2021', category: 'Office', licenseType: 'Commercial', vendor: 'Microsoft', installDate: '2024-01-01', notes: '-' });
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab === 'computers' ? 'template_data_komputer.xlsx' : 'template_data_software.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;
    
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
            showToast("File Excel kosong", "error");
            return;
        }
        const promises: Promise<any>[] = [];
        
        if (activeTab === 'computers') {
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const pcNumber = row.getCell(1).text;
            if (!pcNumber) return;
            const payload = {
              id: `PC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              roomId: selectedRoom.id,
              pcNumber: pcNumber,
              os: row.getCell(2).text,
              cpu: row.getCell(3).text,
              gpuType: row.getCell(4).text || 'Integrated',
              gpuModel: row.getCell(5).text,
              vram: row.getCell(6).text,
              ram: row.getCell(7).text,
              storage: row.getCell(8).text,
              monitor: row.getCell(9).text,
              keyboard: row.getCell(10).text,
              mouse: row.getCell(11).text,
              condition: row.getCell(12).text || 'Baik',
            };
            promises.push(api('/api/computers', { method: 'POST', data: payload }));
          });
          await Promise.all(promises);
          showToast("Berhasil import komputer", "success");
          fetchRoomComputers();
          fetchRooms(); // Update jumlah komputer pada card
        } else if (activeTab === 'software') {
          let addedCount = 0;
          let duplicateCount = 0;
          const existingSoftware = new Set(softwareList.map(s => `${s.name}-${s.version || ''}`.toLowerCase().trim()));

          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const name = row.getCell(1).text?.trim();
            const version = row.getCell(2).text?.trim() || '';

            if (!name) return;
            
            const key = `${name}-${version}`.toLowerCase();
            if (existingSoftware.has(key)) {
              duplicateCount++;
              return;
            }
            existingSoftware.add(key);
            addedCount++;

            let installDateStr = row.getCell(6).text;
            const installDateVal = row.getCell(6).value;
            if (installDateVal instanceof Date) {
              const yyyy = installDateVal.getFullYear();
              const mm = String(installDateVal.getMonth() + 1).padStart(2, '0');
              const dd = String(installDateVal.getDate()).padStart(2, '0');
              installDateStr = `${yyyy}-${mm}-${dd}`;
            }

            const payload = {
              roomId: selectedRoom.id,
              name: name,
              version: version,
              category: row.getCell(3).text,
              licenseType: row.getCell(4).text || 'Free',
              vendor: row.getCell(5).text,
              installDate: installDateStr,
              notes: row.getCell(7).text,
            };
            promises.push(api('/api/software', { method: 'POST', data: payload }));
          });

          if (promises.length > 0) {
            await Promise.all(promises);
            fetchSoftware();
          }
          
          if (addedCount > 0 && duplicateCount > 0) {
            showToast(`Berhasil import ${addedCount} software. Diabaikan ${duplicateCount} duplikat.`, "warning");
          } else if (addedCount > 0) {
            showToast(`Berhasil import ${addedCount} software`, "success");
          } else if (duplicateCount > 0) {
            showToast(`Semua software (${duplicateCount}) sudah ada (duplikat diabaikan).`, "info");
          } else {
            showToast("Tidak ada data valid yang diimport.", "warning");
          }
        }
      } catch (error) { 
        console.error(error);
        showToast("Gagal process Excel", "error"); 
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      setIsImporting(false);
      showToast("Gagal membaca file Excel", "error");
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExportComputers = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Komputer ${selectedRoom?.name}`);

      worksheet.columns = [
        { header: 'No PC', key: 'pcNumber', width: 10 },
        { header: 'OS', key: 'os', width: 20 },
        { header: 'CPU', key: 'cpu', width: 30 },
        { header: 'Tipe GPU', key: 'gpuType', width: 15 },
        { header: 'Model GPU', key: 'gpuModel', width: 25 },
        { header: 'VRAM', key: 'vram', width: 10 },
        { header: 'RAM', key: 'ram', width: 15 },
        { header: 'Storage', key: 'storage', width: 25 },
        { header: 'Monitor', key: 'monitor', width: 20 },
        { header: 'Keyboard', key: 'keyboard', width: 20 },
        { header: 'Mouse', key: 'mouse', width: 20 },
        { header: 'Kondisi', key: 'condition', width: 15 },
      ];

      filteredComputers.forEach(pc => worksheet.addRow(pc));
      worksheet.getRow(1).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spek_komputer_${selectedRoom?.name.replace(/\s/g, '_')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast("Data komputer berhasil diexport!", "success");
    } catch (error) {
      console.error("Export error:", error);
      showToast("Gagal mengekspor data.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSoftware = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Software ${selectedRoom?.name}`);

      worksheet.columns = [
        { header: 'Nama Software', key: 'name', width: 30 },
        { header: 'Versi', key: 'version', width: 15 },
        { header: 'Kategori', key: 'category', width: 20 },
        { header: 'Tipe Lisensi', key: 'licenseType', width: 15 },
        { header: 'Vendor', key: 'vendor', width: 20 },
        { header: 'Tanggal Install', key: 'installDate', width: 15 },
        { header: 'Catatan', key: 'notes', width: 30 },
      ];

      filteredSoftware.forEach(soft => worksheet.addRow(soft));
      worksheet.getRow(1).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `software_${selectedRoom?.name.replace(/\s/g, '_')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast("Data software berhasil diexport!", "success");
    } catch (error) {
      console.error("Export error:", error);
      showToast("Gagal mengekspor data.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // --- SOFTWARE HANDLERS ---

  const handleSaveSoftware = async (softwareData: Partial<Software>) => {
    if (!selectedRoom) return;

    setIsSaving(true);
    const payload = {
      ...softwareData,
      id: softwareData.id,
      roomId: selectedRoom?.id
    };

    try {
      if (softwareData.id) {
        await api(`/api/software/${softwareData.id}`, { method: 'PUT', data: payload });
        showToast("Data software berhasil diperbarui.", "success");
      } else {
        await api('/api/software', { method: 'POST', data: payload });
        showToast("Software baru berhasil ditambahkan.", "success");
      }
      setEditingSoftware(null);
      fetchSoftware();
    } catch (e) { showToast("Gagal menyimpan software", "error"); } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSoftwareClick = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Software',
      message: 'Apakah Anda yakin ingin menghapus data software ini?',
      targetId: id,
      actionType: 'delete_software'
    });
  };

  // --- RENDER ---

  if (!selectedRoom) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Spesifikasi & Software</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Pilih ruangan untuk mengelola spesifikasi komputer dan software</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Cari ruangan..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
             <Filter className="w-4 h-4 text-gray-400 hidden sm:block" />
             <select
               value={filterPcOperator}
               onChange={(e) => setFilterPcOperator(e.target.value as any)}
               className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
             >
                <option value="all">Semua Jumlah PC</option>
                <option value="lt">Kurang dari (&lt;)</option>
                <option value="eq">Sama dengan (=)</option>
                <option value="gt">Lebih dari (&gt;)</option>
             </select>
             {filterPcOperator !== 'all' && (
               <input
                 type="number"
                 min="0"
                 placeholder="Jml"
                 value={filterPcCount}
                 onChange={(e) => setFilterPcCount(e.target.value ? Number(e.target.value) : '')}
                 className="w-20 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
               />
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map(room => (
            <div 
              key={room.id} 
              onClick={() => setSelectedRoom(room)}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg cursor-pointer transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600">{room.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{room.category}</p>
                </div>
                <Monitor className="w-8 h-8 text-gray-400 group-hover:text-blue-500" />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded dark:bg-blue-900/30 dark:text-blue-300">Kapasitas: {room.capacity}</span>
                  {((room as any).computerCount && (room as any).computerCount > 0) ? (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded dark:bg-purple-900/30 dark:text-purple-300">{(room as any).computerCount} Unit PC</span>
                  ) : null}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
              </div>
            </div>
          ))}
          {filteredRooms.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">Tidak ada ruangan ditemukan</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedRoom(null)} 
            className="text-sm text-blue-500 hover:underline"
          >
            &larr; Pilih Ruangan
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {selectedRoom.name}
          </h2>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={handleDownloadTemplate} disabled={isImporting || isExporting} variant="secondary" size="sm">
              <Download className="w-4 h-4 mr-2" /> Template
            </Button>
            {isExporting ? (
              <button disabled className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm flex items-center opacity-70 cursor-not-allowed">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengekspor...
              </button>
            ) : (
              <button onClick={activeTab === 'computers' ? handleExportComputers : handleExportSoftware} disabled={isImporting} className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm hover:bg-green-800 flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export
              </button>
            )}
            {isImporting ? (
              <button disabled className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm flex items-center opacity-70 cursor-not-allowed">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengimport...
              </button>
            ) : (
              <label className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), isExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Import
                <input type="file" accept=".xlsx" className="hidden" onChange={handleExcelUpload} disabled={isImporting || isExporting} />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('computers')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'computers' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          <Monitor className="w-4 h-4 inline mr-2" />
          Spesifikasi Komputer
        </button>
        <button
          onClick={() => setActiveTab('software')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'software' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Software
        </button>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative max-w-md w-full">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder={activeTab === 'computers' ? "Cari No PC, CPU, atau OS..." : "Cari software..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg dark:text-white"
          />
        </div>
        {canManage && activeTab === 'computers' && (
          <div className="flex gap-2">
            <button 
              onClick={handleDeleteAllComputersClick}
              disabled={isImporting || isExporting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Semua
            </button>
            <button 
              onClick={() => setEditingComputer({ pcNumber: '', cpu: '', gpuType: 'Integrated', gpuModel: '', vram: '', ram: '', storage: '', os: '', keyboard: '', mouse: '', monitor: '', condition: 'Baik' })}
              disabled={isImporting || isExporting}
              className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'disabled:cursor-not-allowed')}
            >
              <Plus className="w-4 h-4 mr-2" /> Tambah Komputer
            </button>
          </div>
        )}
        {canManage && activeTab === 'software' && (
          <button 
            onClick={() => setEditingSoftware({ name: '', version: '', licenseType: 'Free', category: '' })}
            disabled={isImporting || isExporting}
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'disabled:cursor-not-allowed')}
          >
            <Plus className="w-4 h-4 mr-2" /> Tambah Software
          </button>
        )}
      </div>

      {/* COMPUTERS TABLE */}
      {activeTab === 'computers' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">No. PC</th>
                  <th className="px-4 py-3">CPU</th>
                  <th className="px-4 py-3">GPU</th>
                  <th className="px-4 py-3">RAM/Storage</th>
                  <th className="px-4 py-3">Kondisi</th>
                  <th className="px-4 py-3">OS</th>
                  {canManage && <th className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredComputers.map(pc => (
                  <tr key={pc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-900 dark:text-gray-100">
                    <td className="px-4 py-3 font-bold">{pc.pcNumber}</td>
                    <td className="px-4 py-3">{pc.cpu}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs">{pc.gpuModel}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">{pc.gpuType} ({pc.vram})</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{pc.ram}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{pc.storage}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getConditionColor(pc.condition)}`}>{pc.condition}</span>
                    </td>
                    <td className="px-4 py-3">{pc.os}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setEditingComputer(pc)} className="text-blue-600 hover:text-blue-800 mr-3"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => handleDeleteComputerClick(pc.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4"/></button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredComputers.length === 0 && (
                  <tr><td colSpan={canManage ? 7 : 6} className="text-center py-8 text-gray-500 dark:text-gray-400">Belum ada data komputer</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOFTWARE TABLE */}
      {activeTab === 'software' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Nama Software</th>
                  <th className="px-4 py-3">Versi</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Lisensi</th>
                  <th className="px-4 py-3">Vendor</th>
                  {canManage && <th className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSoftware.map(soft => (
                  <tr key={soft.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-900 dark:text-gray-100">
                    <td className="px-4 py-3 font-medium">{soft.name}</td>
                    <td className="px-4 py-3">{soft.version}</td>
                    <td className="px-4 py-3">{soft.category || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        soft.licenseType === 'Commercial' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                        soft.licenseType === 'Open Source' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {soft.licenseType}
                      </span>
                    </td>
                    <td className="px-4 py-3">{soft.vendor || '-'}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setEditingSoftware(soft)} className="text-blue-600 hover:text-blue-800 mr-3"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => handleDeleteSoftwareClick(soft.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4"/></button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredSoftware.length === 0 && (
                  <tr><td colSpan={canManage ? 6 : 5} className="text-center py-8 text-gray-500 dark:text-gray-400">Belum ada data software</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ComputerForm 
        isOpen={!!editingComputer}
        onClose={() => setEditingComputer(null)}
        onSave={handleSaveComputer}
        initialData={editingComputer}
        isSaving={isSaving}
      />

      <SoftwareForm
        isOpen={!!editingSoftware}
        onClose={() => setEditingSoftware(null)}
        onSave={handleSaveSoftware}
        initialData={editingSoftware}
        isSaving={isSaving}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Ya, Hapus"
        type="danger"
        isLoading={isConfirming}
      />
    </div>
  );
};


export default ManajemenSpesifikasi;
