import React, { useState, useEffect } from 'react';
import { Equipment, Role } from '../types';
import { Search, Plus, Filter, Edit, Trash2, X, Check, AlertCircle, Box, FileSpreadsheet, Download, QrCode, Printer, FileText, ChevronDown, Camera, Loader2, ArrowUpDown, ArrowUp, ArrowDown, MapPin } from 'lucide-react';
import ExcelJS from 'exceljs';
import QRCode from "react-qr-code";
import { api } from '../services/api';
import QRScannerModal from '../components/QRScannerModal'; // Assuming this is a reusable component
import ConfirmModal from '../components/ConfirmModal'; // Assuming this is a reusable component
import { TableSkeleton } from '../components/Skeleton';
import { useInventory } from '../hooks/useInventory';
import { usePagination } from '../hooks/usePagination';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import PageCard from '../components/PageCard';
import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';

const getLabelDimensions = (size: '4x2' | '5x3' | '8x6') => {
    // Using a base DPI for high-quality PNG generation.
    const DPI = 300;
    const MM_TO_INCH = 0.0393701;
    const convertMmToPx = (mm: number) => Math.round(mm * MM_TO_INCH * DPI);

    //bagian mengganti ukuran label, QR code, dan font berdasarkan pilihan ukuran label
    switch (size) {
        case '5x3': return {
            width: '50mm', height: '30mm', canvasWidth: convertMmToPx(50), canvasHeight: convertMmToPx(30),
            qrSize: 128, qrMaxW: '18mm', qrMaxH: '18mm',
            headerFont: '18pt', idFont: '22pt', nameFont: '16pt',
            cssHeaderFont: '7pt', cssIdFont: '8.5pt', cssNameFont: '6.5pt'
        };
        case '8x6': return {
            width: '80mm', height: '60mm', canvasWidth: convertMmToPx(80), canvasHeight: convertMmToPx(60),
            qrSize: 256, qrMaxW: '38mm', qrMaxH: '38mm',
            headerFont: '32pt', idFont: '40pt', nameFont: '28pt',
            cssHeaderFont: '14pt', cssIdFont: '16pt', cssNameFont: '12pt'
        };
        default: return { // 4x2
            width: '40mm', height: '20mm', canvasWidth: convertMmToPx(40), canvasHeight: convertMmToPx(20),
            qrSize: 40, qrMaxW: '12mm', qrMaxH: '12mm',
            headerFont: '12pt', idFont: '16pt', nameFont: '12pt',
            cssHeaderFont: '5pt', cssIdFont: '6.5pt', cssNameFont: '5pt'
        };
    }
};

const LabelComponent = ({
  item,
  includeQR = true,
  labelSize = '4x2' as '4x2' | '5x3' | '8x6'
}: {
  item: Equipment;
  includeQR?: boolean;
  labelSize?: '4x2' | '5x3' | '8x6';
}) => {
  const dims = getLabelDimensions(labelSize);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-[0.5mm] font-[system-ui] text-center overflow-hidden bg-white border border-gray-200 print:border-transparent"
      style={{width: dims.width, height: dims.height, fontFamily: "'Roboto', 'Helvetica Neue', Arial, sans-serif"}}
    >
        {/* Header: branding */}
        <div className="w-full text-center mb-[0.5mm]">
            <p className={`text-[#4A5568] font-bold leading-none tracking-tight`} style={{fontSize: dims.cssHeaderFont}}>CORE.FTI</p>
        </div>

        {/* QR Code - centered, high scannability */}
        {includeQR && (
            <div className="flex-1 flex items-center justify-center mb-[0.5mm]" style={{maxWidth: dims.qrMaxW, maxHeight: dims.qrMaxH}}>
                <QRCode
                    value={item.id}
                    size={dims.qrSize}
                    level="M"
                    style={{ height: "auto", maxWidth: "100%", maxHeight: "100%" }}
                />
            </div>
        )}

        {/* Asset ID - monospace bold */}
        {!includeQR && (
            <div className="flex-1 flex items-center justify-center">
                <p className={`font-['Courier_New',monospace] font-black text-black leading-none tracking-tight px-0.5`} style={{fontSize: dims.cssIdFont}}>{item.id}</p>
            </div>
        )}

        {/* Asset ID below QR */}
        <div className="w-full text-center mb-[0.5mm]">
            <p className={`font-['Courier_New',monospace] font-black text-black leading-none tracking-tight whitespace-nowrap overflow-hidden text-ellipsis px-0.5`} style={{fontSize: dims.cssIdFont}}>{item.id}</p>
        </div>

        {/* Asset Name - bottom, truncated */}
        <div className="w-full text-center">
            <p className={`text-[#2D3748] font-medium leading-tight line-clamp-2 px-0.5`} style={{lineHeight: '1.1', fontSize: dims.cssNameFont}}>{item.name}</p>
        </div>
    </div>
  );
};

interface InventoryProps {
  role: Role;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const Inventory: React.FC<InventoryProps> = ({ role, showToast }) => {
  const { items, isLoading, fetchItems } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCondition, setFilterCondition] = useState<'All' | 'Baik' | 'Rusak Ringan' | 'Rusak Berat'>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [paperSize, setPaperSize] = useState<'A4' | 'F4'>('A4');
  const [labelSize, setLabelSize] = useState<'4x2' | '5x3' | '8x6'>('4x2');
  const [singleLabelPaperSize, setSingleLabelPaperSize] = useState<'A4' | 'F4'>('A4');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [includeQR, setIncludeQR] = useState(true);

  // Modal State for Form
  const [addMode, setAddMode] = useState<'manual' | 'excel'>('manual');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<Partial<Equipment>>({
    id: '', ukswCode: '', name: '', category: '', condition: 'Baik', isAvailable: true, serialNumber: '', location: '', vendor: ''
  });

  // Modal State for Delete Confirmation (using reusable ConfirmModal)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal State for QR Code
  const [qrItem, setQrItem] = useState<Equipment | null>(null);

  // Modal State for Detail View
  const [viewDetailItem, setViewDetailItem] = useState<Equipment | null>(null);

  // Scanner State (using reusable QRScannerModal)
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof Equipment; direction: 'asc' | 'desc' } | null>(null);
  const canManageInventory = [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR].some(
    (allowedRole) => allowedRole.toString().toUpperCase() === role.toString().toUpperCase()
  );
  const readOnlyMessage = "Akses inventaris untuk role Anda hanya dapat melihat data.";

  const renderLabelSizeSelector = () => (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium dark:text-gray-300 whitespace-nowrap">Ukuran Label:</label>
      <select value={labelSize} onChange={e => setLabelSize(e.target.value as '4x2' | '5x3' | '8x6')} className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none cursor-pointer">
        <option value="4x2">4×2 cm</option>
        <option value="5x3">5×3 cm</option>
        <option value="8x6">8×6 cm</option>
      </select>
    </div>
  );

  const renderPaperSizeSelector = (value: 'A4' | 'F4', setter: (val: 'A4' | 'F4') => void) => (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium dark:text-gray-300 whitespace-nowrap">Ukuran Kertas:</label>
      <select value={value} onChange={e => setter(e.target.value as 'A4' | 'F4')} className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none cursor-pointer">
        <option value="A4">A4</option>
        <option value="F4">F4</option>
      </select>
    </div>
  );

  const filteredItems = React.useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.ukswCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCondition = filterCondition === 'All' || item.condition === filterCondition;
      const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
      return matchesSearch && matchesCondition && matchesCategory;
    });
  }, [items, searchTerm, filterCondition, filterCategory]);

  // Sorting Logic
  const sortedItems = React.useMemo(() => {
    let sortableItems = [...filteredItems];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === bValue) return 0;
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if ((aValue as any) < (bValue as any)) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if ((aValue as any) > (bValue as any)) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredItems, sortConfig]);

// Menggunakan custom hook paginasi
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    paginatedData: currentItems,
    totalPages
  } = usePagination(sortedItems, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCondition, filterCategory, itemsPerPage, setCurrentPage]);


  const handleSort = (key: keyof Equipment) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManageInventory) return;
    if (e.target.checked) {
        const newItems = currentItems.map(i => i.id);
        setSelectedItems(prev => Array.from(new Set([...prev, ...newItems])));
    } else {
        setSelectedItems(prev => prev.filter(id => !currentItems.some(item => item.id === id)));
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
      if (!canManageInventory) return;
      setSelectedItems(prev =>
          checked ? [...prev, id] : prev.filter(itemId => itemId !== id)
      );
  };

  const handleOpenModal = (item?: Equipment) => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "info");
      return;
    }
    if (item) {
      setEditingItem(item);
      setFormData(item);
      setAddMode('manual');
    } else {
      setEditingItem(null);
      setFormData({ id: '', ukswCode: '', name: '', category: '', condition: 'Baik', isAvailable: true, serialNumber: '', location: '', vendor: '' });
      setAddMode('manual');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageInventory) {
      showToast(readOnlyMessage, "warning");
      return;
    }
    setIsSaving(true);
    try {
      if (editingItem) {
        const res = await api(`/api/inventory/${editingItem.id}`, {
          method: 'PUT',
          data: formData
        });
        if (res.ok) {
          await fetchItems();
          setIsModalOpen(false);
          showToast("Data barang berhasil diperbarui.", "success");
        } else {
          const data = await res.json();
          showToast(data.error || "Gagal memperbarui data.", "error");
        }
      } else {
        if (!formData.id) {
            showToast("Kode FTI (ID) wajib diisi!", "warning");
            setIsSaving(false);
            return;
        }
        const res = await api('/api/inventory', {
          method: 'POST',
          data: formData
        });
        if (res.ok) {
          await fetchItems();
          setIsModalOpen(false);
          showToast("Data barang berhasil disimpan.", "success");
        } else {
          showToast("Gagal menyimpan data baru.", "error");
        }
      }
    } catch (error) {
      showToast("Gagal menyimpan data.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const downloadTemplate = async () => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "info");
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    worksheet.columns = [
      { header: 'id', key: 'id', width: 20 },
      { header: 'ukswCode', key: 'ukswCode', width: 20 },
      { header: 'name', key: 'name', width: 30 },
      { header: 'category', key: 'category', width: 15 },
      { header: 'condition', key: 'condition', width: 15 },
      { header: 'serialNumber', key: 'serialNumber', width: 20 },
      { header: 'location', key: 'location', width: 25 },
      { header: 'vendor', key: 'vendor', width: 25 }
    ];

    worksheet.addRow({
      id: "FTI-NEW-001",
      ukswCode: "UKSW-NEW-001",
      name: "Barang Baru",
      category: "Elektronik",
      condition: "Baik",
      serialNumber: "SN12345678",
      location: "Rak 1",
      vendor: "PT. Teknologi Maju"
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'template_inventaris.xlsx';
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "info");
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Inventaris');

    worksheet.columns = [
      { header: 'Kode FTI', key: 'id', width: 15 },
      { header: 'Kode UKSW', key: 'ukswCode', width: 20 },
      { header: 'Nama Barang', key: 'name', width: 30 },
      { header: 'Kategori', key: 'category', width: 15 },
      { header: 'Kondisi', key: 'condition', width: 15 },
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Lokasi', key: 'location', width: 25 },
      { header: 'Vendor', key: 'vendor', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    sortedItems.forEach(item => {
      worksheet.addRow({
        id: item.id,
        ukswCode: item.ukswCode,
        name: item.name,
        category: item.category,
        condition: item.condition,
        serialNumber: item.serialNumber,
        location: item.location || '',
        vendor: item.vendor || '',
        status: item.isAvailable ? 'Tersedia' : 'Dipinjam'
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `inventaris_fti_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setIsExportOpen(false);
  };

  const handleExportCSV = () => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "info");
      return;
    }
    const headers = ["Kode FTI", "Kode UKSW", "Nama Barang", "Kategori", "Kondisi", "Serial Number", "Lokasi", "Vendor", "Status"];
    const rows = sortedItems.map(item => [
      item.id, item.ukswCode, item.name, item.category, item.condition, item.serialNumber || '-', item.location || '-', item.vendor || '-', item.isAvailable ? 'Tersedia' : 'Dipinjam'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.map(c => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventaris_fti_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportOpen(false);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "warning");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      try {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);
          const worksheet = workbook.getWorksheet(1);

          if (!worksheet) {
             showToast("File Excel kosong atau format salah.", "error");
             return;
          }

          const newItems: Equipment[] = [];

          const headers: {[key: number]: string} = {};
          worksheet.getRow(1).eachCell((cell, colNumber) => {
              headers[colNumber] = cell.value ? cell.value.toString() : '';
          });

          worksheet.eachRow((row, rowNumber) => {
              if (rowNumber === 1) return;

              const rowData: any = {};
              row.eachCell((cell, colNumber) => {
                  const header = headers[colNumber];
                  if (header) {
                      rowData[header] = cell.value ? cell.value.toString() : '';
                  }
              });

              if (rowData.id && rowData.name) {
                  const id = String(rowData.id).trim();
                  if (!items.some(existing => existing.id === id) && !newItems.some(n => n.id === id)) {
                      newItems.push({
                          id: id,
                          ukswCode: rowData.ukswCode ? String(rowData.ukswCode).trim() : '',
                          name: String(rowData.name).trim(),
                          category: rowData.category ? String(rowData.category).trim() : 'Umum',
                          condition: rowData.condition ? String(rowData.condition).trim() as any : 'Baik',
                          isAvailable: true,
                          serialNumber: rowData.serialNumber ? String(rowData.serialNumber).trim() : '',
                          location: rowData.location ? String(rowData.location).trim() : '',
                          vendor: rowData.vendor ? String(rowData.vendor).trim() : ''
                      } as Equipment);
                  }
              }
          });

          if (newItems.length > 0) {
              let successCount = 0;
              let errorCount = 0;
              const errorIds: string[] = [];

              for (const item of newItems) {
                  try {
                      const res = await api('/api/inventory', {
                          method: 'POST',
                          data: item
                      });
                      if (res.ok) {
                          successCount++;
                      } else {
                          errorCount++;
                          errorIds.push(item.id);
                      }
                  } catch (err) {
                      console.error(`Gagal menyimpan item ${item.id}:`, err);
                      errorCount++;
                      errorIds.push(item.id);
                  }
              }

              await fetchItems();

              if (successCount > 0 && errorCount === 0) {
                  showToast(`Berhasil mengimport ${successCount} barang ke database.`, "success");
              } else if (successCount > 0 && errorCount > 0) {
                  showToast(`Berhasil mengimport ${successCount} barang. ${errorCount} barang gagal (ID: ${errorIds.join(', ')}).`, "warning");
              } else {
                  showToast("Gagal mengimport data. Pastikan ID belum ada di database.", "error");
              }

              setIsModalOpen(false);
          } else {
              showToast("Tidak ada data valid yang diimport. Pastikan ID unik dan format benar.", "warning");
          }

      } catch (error) {
          console.error(error);
          showToast("Gagal memproses file Excel.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Delete handlers using ConfirmModal
  const handleDeleteClick = (id: string) => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "warning");
      return;
    }
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "warning");
      return;
    }
    if (deleteTargetId) {
      setIsDeleting(true);
      try {
        await api(`/api/inventory/${deleteTargetId}`, { method: 'DELETE' });
        await fetchItems();
        setShowDeleteModal(false);
        setDeleteTargetId(null);
        showToast("Barang berhasil dihapus.", "success");
      } catch (e) { showToast("Gagal menghapus data.", "error"); }
      finally { setIsDeleting(false); }
    }
  };

  const handlePrintMulti = (overrideItems?: Equipment[], overridePaperSize?: 'A4' | 'F4') => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "info");
      return;
    }
    const targetItems = overrideItems || items.filter(i => selectedItems.includes(i.id));
    if (targetItems.length === 0) return;
    const activePaperSize = overridePaperSize || paperSize;

    const getQRCodeURL = (value: string) => {
      return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(value)}`;
    };

    const dims = getLabelDimensions(labelSize);

    const labelsHTML = targetItems.map(item => `
      <div style="width: ${dims.width}; height: ${dims.height}; padding: 0.5mm 1.5mm; box-sizing: border-box; border: 1px dashed #ddd; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; page-break-inside: avoid; float: left; margin: 1mm; background: white; font-family: 'Roboto', 'Helvetica Neue', Arial, sans-serif;">
        <!-- CORE.FTI Header -->
        <div style="width: 100%; text-align: center; margin-bottom: 0.3mm;">
          <span style="font-size: ${dims.cssHeaderFont}; color: #4A5568; font-weight: 700; letter-spacing: 0.1px; line-height: 1;">CORE.FTI</span>
        </div>

        <!-- QR Code (70% height for scannability) -->
        ${includeQR ? `
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; margin-bottom: 0.4mm; max-height: ${dims.qrMaxH};">
          <img src="${getQRCodeURL(item.id)}" alt="QR ${item.id}" style="width: ${dims.qrMaxW}; height: ${dims.qrMaxH}; max-width: 100%; max-height: 100%; image-rendering: -webkit-optimize-contrast; object-fit: contain;" />
        </div>
        ` : ''}

        <!-- Asset ID -->
        <div style="width: 100%; text-align: center; margin-bottom: 0.3mm;">
          <p style="margin: 0; font-family: 'Courier New', monospace; font-weight: 900; font-size: ${dims.cssIdFont}; color: #000; line-height: 1; letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.id}</p>
        </div>

        <!-- Asset Name -->
        <div style="width: 100%; text-align: center;">
          <p style="margin: 0; font-size: ${dims.cssNameFont}; color: #2D3748; line-height: 1.1; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.name}</p>
        </div>
      </div>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Asset Labels - CORE.FTI</title>
          <style>
            @page {
              size: ${activePaperSize};
              margin: 0.5cm;
              size-adjust: 100%;
            }
            body {
              margin: 0;
              padding: 5mm;
              font-family: 'Roboto', 'Helvetica Neue', Arial, sans-serif;
              font-size: 10pt;
              background: white;
            }
            .label-container {
              width: ${activePaperSize === 'A4' ? '210mm' : '215mm'};
              min-height: ${activePaperSize === 'A4' ? '297mm' : '330mm'};
            }
            .clearfix::after {
              content: "";
              clear: both;
              display: table;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="label-container clearfix">
            ${labelsHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 800);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handlePrintSingle = () => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "info");
      return;
    }
    if (!qrItem) return;

    const dims = getLabelDimensions(labelSize);
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${dims.qrSize * 2}x${dims.qrSize * 2}&data=${encodeURIComponent(qrItem.id)}`;

    const canvas = document.createElement('canvas');
    canvas.width = dims.canvasWidth;
    canvas.height = dims.canvasHeight;
    const ctx = canvas.getContext('2d')!;

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#4A5568';
      ctx.font = `bold ${dims.headerFont} Roboto, Helvetica Neue, Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('CORE.FTI', canvas.width / 2, canvas.height * 0.05);

      const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) => {
        const words = text.split(' ');
        let line = '';
        let testLine = '';
        let currentLine = 0;
        for (let n = 0; n < words.length; n++) {
          testLine = line + words[n] + ' ';
          const metrics = context.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            if (currentLine < maxLines - 1) {
              context.fillText(line.trim(), x, y);
              line = words[n] + ' ';
              y += lineHeight;
              currentLine++;
            } else {
              context.fillText(line.trim() + '...', x, y);
              break;
            }
          } else {
            line = testLine;
          }
        }
        if (currentLine < maxLines) {
          context.fillText(line.trim(), x, y);
        }
      };

      if (includeQR) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const qrCanvasSize = dims.qrSize * 2;
          const qrY = canvas.height * 0.2;
          const qrX = (canvas.width - qrCanvasSize) / 2;
          ctx.drawImage(img, qrX, qrY, qrCanvasSize, qrCanvasSize);

          ctx.fillStyle = '#000000';
          ctx.font = `900 ${dims.idFont} 'Courier New', monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(qrItem.id, canvas.width / 2, qrY + qrCanvasSize + (canvas.height * 0.05));

          ctx.fillStyle = '#2D3748';
          ctx.font = `500 ${dims.nameFont} Roboto, Helvetica Neue, Arial`;
          ctx.textAlign = 'center';
          wrapText(ctx, qrItem.name, canvas.width / 2, qrY + qrCanvasSize + (canvas.height * 0.15), canvas.width - 40, parseInt(dims.nameFont) * 1.2, 2);

          downloadPNG(canvas, qrItem.id);
        };
        img.onerror = () => showToast('QR generation failed. Retry.', 'error');
        img.src = qrImageUrl;
      } else {
        ctx.fillStyle = '#000000';
        ctx.font = `900 ${parseInt(dims.idFont) * 1.5}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(qrItem.id, canvas.width / 2, canvas.height / 2 - 10);

        ctx.textBaseline = 'top';
        ctx.fillStyle = '#2D3748';
        ctx.font = `500 ${parseInt(dims.nameFont) * 1.2}px Roboto, Helvetica Neue, Arial`;
        wrapText(ctx, qrItem.name, canvas.width / 2, canvas.height / 2 + 15, canvas.width - 40, parseInt(dims.nameFont) * 1.4, 3);

        downloadPNG(canvas, qrItem.id);
      }
    }

    function downloadPNG(canvas: HTMLCanvasElement, id: string) {
      const link = document.createElement('a');
      link.download = `asset-label-${id}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    }
  };

  const handlePrintSingleToSheet = () => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "info");
      return;
    }
    if (!qrItem) return;

    handlePrintMulti([qrItem], singleLabelPaperSize);
  };

  const handleShowQR = (item: Equipment) => {
    if (!canManageInventory) {
      showToast(readOnlyMessage, "info");
      return;
    }
    setQrItem(item);
  };

  // Scanner handler using QRScannerModal
  const handleScannerScan = (decodedText: string) => {
    const foundItem = items.find(i => i.id === decodedText);
    if (foundItem) {
      setViewDetailItem(foundItem);
      showToast(`Ditemukan: ${foundItem.name}`, "success");
    } else {
      showToast(`ID ${decodedText} tidak ditemukan`, "error");
    }
  };

  // Handle URL scan parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scanId = params.get('scan');

    if (scanId && items.length > 0) {
      const foundItem = items.find(i => i.id === scanId);
      if (foundItem) {
        setViewDetailItem(foundItem);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [items]);

  const handleEditFromDetail = () => {
      if (!canManageInventory) {
          showToast(readOnlyMessage, "info");
          return;
      }
      if (viewDetailItem) {
          const itemToEdit = viewDetailItem;
          setViewDetailItem(null);
          handleOpenModal(itemToEdit);
      }
  };

  const getConditionColor = (condition: string) => {
    switch(condition) {
        case 'Baik': return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200';
        case 'Rusak Ringan': return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200';
        case 'Rusak Berat': return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200';
        default: return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
    }
  };

  const categories = React.useMemo(() => {
    return Array.from(new Set(items.map(i => i.category)));
  }, [items]);

  const SortIcon = ({ columnKey }: { columnKey: keyof Equipment }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    return sortConfig.direction === 'asc'
        ? <ArrowUp className="ml-1 h-3 w-3 text-slate-700 dark:text-slate-200" />
        : <ArrowDown className="ml-1 h-3 w-3 text-slate-700 dark:text-slate-200" />;
  };

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-6">

      {/* Print Report Header */}

      <PageHeader
        title="Inventaris Barang"
        description={canManageInventory ? 'Kelola daftar aset dan barang FTI' : 'Lihat daftar aset dan barang FTI'}
        className="print:hidden"
        actions={canManageInventory ? (
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:items-center">
            <div className="relative lg:col-span-1">

                <Button onClick={() => setIsExportOpen(!isExportOpen)} variant="secondary" size="sm">
                    <Download className="h-4 w-4" /> Export <ChevronDown className="h-4 w-4" />
                </Button>
                {isExportOpen && (
                    <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <button onClick={handleExportExcel} className="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Excel (.xlsx)
                        </button>
                        <button onClick={handleExportCSV} className="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                            <FileText className="w-4 h-4 mr-2 text-blue-600" /> CSV
                        </button>
                        <button onClick={() => { window.print(); setIsExportOpen(false); }} className="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                            <Printer className="w-4 h-4 mr-2 text-gray-600" /> PDF (Print)
                        </button>
                    </div>
                )}
            </div>
            <Button
                onClick={() => setIsPrintModalOpen(true)}
                disabled={selectedItems.length === 0}
                variant="secondary"
                size="sm"
                className="justify-center"
                title="Pilih barang untuk mencetak label"
            >
                <Printer className="h-4 w-4" /> Cetak Label ({selectedItems.length})
            </Button>
            <Button onClick={() => setIsScannerOpen(true)} variant="secondary" size="sm">
                <Camera className="h-4 w-4" /> Scan QR
            </Button>
            <Button onClick={() => handleOpenModal()} variant="primary" size="sm">
                <Plus className="h-4 w-4" /> Tambah Barang
            </Button>
        </div>
        ) : undefined}
      />
      <div className="print:hidden">
         <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">

           <div className="flex min-w-0">
             <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Cari nama, Kode FTI, UKSW, atau SN..."
                className="w-full"
             />
           </div>

           <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-center">
               <div className="relative">
                   <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-700 outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-300 lg:w-44"
                   >
                       <option value="All">Semua Kategori</option>
                       {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                       ))}
                   </select>
                   <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
               </div>

               <div className="relative">
               <select
                  value={filterCondition}
                  onChange={(e) => setFilterCondition(e.target.value as any)}
                  className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-700 outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-300 lg:w-44"
               >
                   <option value="All">Semua Kondisi</option>
                   <option value="Baik">Baik</option>
                   <option value="Rusak Ringan">Rusak Ringan</option>
                   <option value="Rusak Berat">Rusak Berat</option>
               </select>
               <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
           </div>
        </div>
      </div>
      </div>


      <PageCard padding="none" className="mx-auto flex max-w-full flex-col overflow-hidden print:border-2 print:border-black print:shadow-none">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">



                    <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400 print:bg-gray-200 print:text-black">
                        <tr>
                            {canManageInventory && (
                            <th className="px-4 py-4 w-12 print:hidden shrink-0">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                                    onChange={handleSelectAll}
                                    checked={currentItems.length > 0 && currentItems.every(i => selectedItems.includes(i.id))}
                                    ref={input => {
                                        if (input) {
                                            const someSelected = currentItems.some(i => selectedItems.includes(i.id));
                                            input.indeterminate = someSelected && !currentItems.every(i => selectedItems.includes(i.id));
                                        }
                                    }}
                                />
                            </th>
                            )}
                            <th className="cursor-pointer px-4 py-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('name')}>
                                <div className="flex items-center">Barang <SortIcon columnKey="name" /></div>
                            </th>
                            <th className="cursor-pointer px-4 py-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('id')}>
                                <div className="flex items-center">Identitas <SortIcon columnKey="id" /></div>
                            </th>
                            <th className="cursor-pointer px-4 py-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('condition')}>
                                <div className="flex items-center">Kondisi & Lokasi <SortIcon columnKey="condition" /></div>
                            </th>
                            <th className="cursor-pointer px-4 py-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('isAvailable')}>
                                <div className="flex items-center">Status <SortIcon columnKey="isAvailable" /></div>
                            </th>

                            {canManageInventory && <th className="px-4 py-4 text-right print:hidden">Aksi</th>}
                        </tr>

                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 print:divide-gray-400">
                        {currentItems.length > 0 ? currentItems.map(item => (
                            <tr key={item.id} className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => setViewDetailItem(item)}>
                                {canManageInventory && (
                                <td className="px-4 py-3 print:hidden shrink-0 w-12" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        className="mx-auto h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                                        checked={selectedItems.includes(item.id)}
                                        onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                                    />
                                </td>
                                )}
                                <td className="px-4 py-3">
                                    <div className="text-sm font-bold text-slate-950 dark:text-white">{item.name}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">{item.category}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{item.id}</div>
                                    <div className="mt-0.5 font-mono text-xs text-slate-500" title="Kode UKSW">{item.ukswCode || '-'}</div>
                                    {item.serialNumber && <div className="mt-0.5 font-mono text-xs text-slate-400" title="Serial Number">SN: {item.serialNumber}</div>}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="mb-1.5">
                                        <span className={`rounded-md border px-2 py-0.5 text-xs font-bold print:border-gray-400 ${getConditionColor(item.condition)}`}>
                                        {item.condition}
                                    </span>
                                    </div>
                                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                                        <MapPin className="w-3 h-3 mr-1" /> {item.location || '-'}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold print:border-gray-400 ${item.isAvailable ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200'}`}>
                                        {item.isAvailable ? 'Tersedia' : 'Dipinjam'}
                                    </span>
                                </td>

                                {canManageInventory && (
                                <td className="px-4 py-3 text-right print:hidden" onClick={(e) => e.stopPropagation()}>

                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => handleShowQR(item)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-slate-600 dark:text-slate-300')} title="Lihat QR Code"><QrCode className="w-4 h-4"/></button>
                                        <button onClick={() => handleOpenModal(item)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-slate-600 dark:text-slate-300')} title="Edit"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteClick(item.id)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-red-600 dark:text-red-400')} title="Hapus"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </td>
                                )}
                            </tr>
                        )) : (
                           <tr>
                              <td colSpan={canManageInventory ? 6 : 4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                 <div className="flex flex-col items-center justify-center">
                                    <Box className="w-12 h-12 text-gray-300 mb-3" />
                                    <p>Tidak ada barang yang ditemukan.</p>
                                 </div>
                              </td>
                           </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="print:hidden">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={sortedItems.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
      </PageCard>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-full sm:max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                 <h3 className="font-bold text-gray-900 dark:text-white">
                    {editingItem ? 'Edit Barang' : 'Tambah Barang Baru'}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                    <X className="w-5 h-5" />
                 </button>
              </div>

              {!editingItem && (
                  <div className="flex border-b border-gray-200 dark:border-gray-700">
                      <button
                          type="button"
                          className={`flex-1 py-3 text-sm font-medium transition-colors ${addMode === 'manual' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                          onClick={() => setAddMode('manual')}
                      >
                          Input Manual
                      </button>
                      <button
                          type="button"
                          className={`flex-1 py-3 text-sm font-medium transition-colors ${addMode === 'excel' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                          onClick={() => setAddMode('excel')}
                      >
                          Import Excel
                      </button>
                  </div>
              )}

              {addMode === 'manual' ? (
              <form onSubmit={handleSave} className="p-6 space-y-4 animate-fade-in-up">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Barang</label>
                    <input
                        type="text" required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Contoh: Projector Epson X1"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode FTI (ID)</label>
                        <input
                            type="text" required
                            value={formData.id}
                            onChange={e => setFormData({...formData, id: e.target.value})}
                            disabled={!!editingItem}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                            placeholder="FTI-XXX-001"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode UKSW</label>
                        <input
                            type="text" required
                            value={formData.ukswCode}
                            onChange={e => setFormData({...formData, ukswCode: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                            placeholder="UKSW-INV-..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial Number</label>
                        <input
                            type="text"
                            value={formData.serialNumber || ''}
                            onChange={e => setFormData({...formData, serialNumber: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                            placeholder="SN-XXXXX"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
                        <input
                            type="text" required
                            value={formData.category}
                            onChange={e => setFormData({...formData, category: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Elektronik"
                        />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kondisi</label>
                    <select
                        value={formData.condition}
                        onChange={e => setFormData({...formData, condition: e.target.value as any})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                    <option value="Baik">Baik</option>
                        <option value="Rusak Ringan">Rusak Ringan</option>
                        <option value="Rusak Berat">Rusak Berat</option>
                    </select>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi / Rak</label>
                        <input
                            type="text"
                            value={formData.location || ''}
                            onChange={e => setFormData({...formData, location: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Contoh: Rak 1, Ruang 301"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor / Toko</label>
                        <input
                            type="text"
                            value={formData.vendor || ''}
                            onChange={e => setFormData({...formData, vendor: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Contoh: CV. Komputer Maju"
                        />
                     </div>
                 </div>

                 <div className="flex items-center space-x-2 pt-2">
                    <input
                        type="checkbox"
                        id="isAvailable"
                        checked={formData.isAvailable}
                        onChange={e => setFormData({...formData, isAvailable: e.target.checked})}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800"
                    />
                    <label htmlFor="isAvailable" className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none cursor-pointer">
                        Status Tersedia (Dapat Dipinjam)
                    </label>
                 </div>

                 <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                       Batal
                    </button>
                    <Button type="submit" disabled={isSaving} variant="primary">
                       {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                       {isSaving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                 </div>
              </form>
              ) : (
                <div className="p-6 space-y-6 animate-fade-in-up">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-2" /> Petunjuk Import
                        </h4>
                        <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                            Gunakan file Excel (.xlsx) dengan header: <code>id, ukswCode, name, category, condition, serialNumber, location, vendor</code>.
                            Pastikan <strong>id</strong> (Kode FTI) unik dan belum ada di database.
                        </p>
                        <button
                            onClick={downloadTemplate}
                            className={cn(buttonVariants({ variant: 'secondary', size: 'xs' }), 'w-fit text-blue-600 dark:text-blue-400')}
                        >
                            <Download className="w-3 h-3 mr-1.5" /> Unduh Template Excel
                        </button>
                    </div>

                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <input
                            type="file"
                            id="csv-upload"
                            accept=".xlsx, .xls"
                            onChange={handleExcelUpload}
                            className="hidden"
                        />
                        <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full mb-3">
                                <FileSpreadsheet className="w-8 h-8" />
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Klik untuk upload file Excel</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maksimal 2MB</span>
                        </label>
                    </div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* Using reusable ConfirmModal component */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteTargetId(null);
        }}
        onConfirm={confirmDelete}
        title="Hapus Barang"
        message="Apakah Anda yakin ingin menghapus barang ini dari inventaris? Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
        isLoading={isDeleting}
      />

      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print-modal-active">
            <style>{`
              @media print {
                body > *:not(.print-modal-active) {
                  display: none;
                }
                .print-modal-active {
                  position: static;
                  background: none;
                  backdrop-filter: none;
                }
                .print-content-wrapper {
                  box-shadow: none;
                  border: none;
                  height: auto;
                  max-height: none;
                }
                .print-controls, .no-print {
                  display: none;
                }
                #print-preview-area {
                  padding: 0;
                  background: none;
                }
                #multi-label-print-area {
                  box-shadow: none;
                  margin: 0;
                  padding: 0;
                }
                .sticker-label {
                  border: none !important; /* Hilangkan border saat print */
                }
                @page {
                  size: ${paperSize};
                  margin: 0.5cm;
                }
              }
            `}</style>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl lg:max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up print-content-wrapper">

                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 shrink-0 print-controls">
                    <h3 className="font-bold text-gray-900 dark:text-white">Cetak Label ({selectedItems.length} Barang)</h3>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={includeQR} onChange={(e) => setIncludeQR(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                            <span className="text-gray-700 dark:text-gray-300">Sertakan QR Code</span>
                        </label>
                        {renderLabelSizeSelector()}
                        {renderPaperSizeSelector(paperSize, setPaperSize)}
                        <Button onClick={() => handlePrintMulti()} variant="primary">
                            <Printer className="w-4 h-4 mr-2" /> Cetak
                        </Button>
                        <button onClick={() => setIsPrintModalOpen(false)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div id="print-preview-area" className="flex-1 overflow-auto p-6 bg-gray-200 dark:bg-gray-900">
                    <div id="multi-label-print-area" className="bg-white shadow-lg mx-auto p-[5mm] box-border flex flex-wrap content-start gap-0" style={paperSize === 'A4' ? { width: '210mm', minHeight: '297mm' } : { width: '215mm', minHeight: '330mm' }}>
                        {items.filter(i => selectedItems.includes(i.id)).map(item => {
                            const previewDims = labelSize === '5x3' ? {width: '50mm', height: '30mm'} : labelSize === '8x6' ? {width: '80mm', height: '60mm'} : {width: '40mm', height: '20mm'};
                            return (
                                <div key={item.id} className="sticker-label" style={{
                                    width: previewDims.width,
                                    height: previewDims.height,
                                    padding: '2mm',
                                    boxSizing: 'border-box',
                                    border: '1px dashed #ccc',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    pageBreakInside: 'avoid',
                                    marginBottom: '2mm'
                                }}>
                                    <LabelComponent item={item} includeQR={includeQR} labelSize={labelSize} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
      )}

      {viewDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md lg:max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">

              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                 <h3 className="font-bold text-gray-900 dark:text-white flex items-center text-base">
                    <Box className="w-5 h-5 mr-2 text-blue-600" />
                    Detail Barang
                 </h3>
                 <button onClick={() => setViewDetailItem(null)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="p-6 space-y-4">
                  <div className="text-center mb-4">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{viewDetailItem.name}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{viewDetailItem.category}</p>
                  </div>

                  <div className="space-y-3 text-sm">
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                          <span className="text-gray-500 dark:text-gray-400">Kode FTI (ID)</span>
                          <span className="font-mono font-medium text-gray-900 dark:text-white">{viewDetailItem.id}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                          <span className="text-gray-500 dark:text-gray-400">Kode UKSW</span>
                          <span className="font-mono font-medium text-gray-900 dark:text-white">{viewDetailItem.ukswCode}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                          <span className="text-gray-500 dark:text-gray-400">Serial Number</span>
                          <span className="font-mono font-medium text-gray-900 dark:text-white">{viewDetailItem.serialNumber || '-'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                          <span className="text-gray-500 dark:text-gray-400">Lokasi</span>
                          <span className="font-medium text-gray-900 dark:text-white">{viewDetailItem.location || '-'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                          <span className="text-gray-500 dark:text-gray-400">Vendor</span>
                          <span className="font-medium text-gray-900 dark:text-white">{viewDetailItem.vendor || '-'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                          <span className="text-gray-500 dark:text-gray-400">Kondisi</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getConditionColor(viewDetailItem.condition)}`}>
                              {viewDetailItem.condition}
                          </span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-gray-500 dark:text-gray-400">Status</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${viewDetailItem.isAvailable ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {viewDetailItem.isAvailable ? 'Tersedia' : 'Dipinjam'}
                          </span>
                      </div>
                  </div>

                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button onClick={() => setViewDetailItem(null)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm">
                          Tutup
                      </button>
                      {canManageInventory && (
                      <Button onClick={handleEditFromDetail} variant="primary" className="flex-1 justify-center">
                          <Edit className="w-4 h-4 mr-2" /> Edit Barang
                      </Button>
                      )}
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* Using reusable QRScannerModal component */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScannerScan}
        title="Scan QR Code Barang"
        closeOnSuccess={true}
      />

      {qrItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                 <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                    <QrCode className="w-5 h-5 mr-2 text-blue-600" />
                    Label Barang
                 </h3>
                 <button onClick={() => setQrItem(null)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div id="single-label-print-area" className="bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4 min-h-62.5">
                  {/* The dynamic LabelComponent provides a live preview */}
                  <div className="transform scale-[1.5] origin-center">
                      <LabelComponent item={qrItem} includeQR={includeQR} labelSize={labelSize} />
                  </div>
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {/* Paper Size Selector for Single Label */}
                    <div className="mb-3 flex items-center justify-center gap-4">
                      <label className="flex items-center space-x-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={includeQR} onChange={(e) => setIncludeQR(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                          <span className="text-gray-700 dark:text-gray-300">Sertakan QR Code</span>
                      </label>
                      {renderLabelSizeSelector()}
                      {renderPaperSizeSelector(singleLabelPaperSize, setSingleLabelPaperSize)}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                      <button onClick={handlePrintSingleToSheet} className="px-4 py-2 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-lg flex items-center shadow-md">
                          <Printer className="w-4 h-4 mr-2" /> Cetak ke Kertas ({singleLabelPaperSize})
                      </button>
                      <Button onClick={handlePrintSingle} variant="primary">
                          <Download className="w-4 h-4 mr-2" /> Download PNG
                      </Button>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
