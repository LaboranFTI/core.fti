import React, { useState, useEffect, useRef } from 'react';
import { Booking, BookingStatus, Room } from '../types';
import {
  CalendarBlank,
  CheckCircle,
  Clock,
  DownloadSimple,
  FileText,
  Hourglass,
  MapPin,
  PencilSimpleLine,
  Plus,
  Trash,
  X,
  XCircle,
} from '@phosphor-icons/react';
import { api } from '../services/api';
import QRCode from "react-qr-code";
import nocLogo from "../src/assets/noc.png";
import BookingForm from '../components/BookingForm';
import ConfirmModal from '../components/ConfirmModal';
import { useRooms } from '../hooks/useRooms';
import { formatDateID } from '../src/utils/formatters';
import PageHeader from '../components/PageHeader';
import PageCard from '../components/PageCard';
import SearchBar from '../components/SearchBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import MetricCard from '../components/MetricCard';

interface PemesananSayaProps {
  userId: string;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const PemesananSaya: React.FC<PemesananSayaProps> = ({ userId, showToast }) => {
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const { rooms } = useRooms({ excludeImage: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [proofBooking, setProofBooking] = useState<Booking | null>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', targetId: '', actionType: ''
  });
  const [isConfirming, setIsConfirming] = useState(false);

  const fetchData = async () => {
      try {
          const bkRes = await api('/api/bookings?exclude_file=true');
          if (bkRes.ok) {
              const allBookings: Booking[] = await bkRes.json();
              setMyBookings(allBookings.filter(b => b.userId === userId));
          }
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const handleCreateBooking = () => {
    setEditingBooking(null);
    setIsBookingModalOpen(true);
  };

  const handleEditBooking = (booking: Booking) => {
    // Menyisipkan nilai properti file agar BookingForm mendeteksi keberadaan surat
    // dan tidak memaksa pengguna (mahasiswa) untuk mengunggah ulang file PDF.
    setEditingBooking({
      ...booking,
      proposalFile: (booking as any).hasFile ? booking.id : undefined
    });
    setIsBookingModalOpen(true);
  };

  const closeBookingModal = () => {
    setIsBookingModalOpen(false);
    setEditingBooking(null);
  };

  const getRoomName = (roomId: string) => {
    return rooms.find(r => r.id === roomId)?.name || 'Unknown Room';
  };

  const getStatusConfig = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.APPROVED:
        return { color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300', icon: CheckCircle };
      case BookingStatus.REJECTED:
        return { color: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300', icon: XCircle };
      default:
        return { color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300', icon: Hourglass };
    }
  };

  const handleCancelClick = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Batalkan Permohonan',
      message: 'Apakah Anda yakin ingin membatalkan permohonan peminjaman ini?',
      targetId: id,
      actionType: 'cancel'
    });
  };

  const handleDeleteClick = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Riwayat',
      message: 'Hapus riwayat peminjaman ini? Data tidak dapat dikembalikan.',
      targetId: id,
      actionType: 'delete'
    });
  };

  const executeConfirmAction = async () => {
    setIsConfirming(true);
    try {
      const res = await api(`/api/bookings/${confirmModal.targetId}`, { method: 'DELETE' });
      if (res.ok) {
        setMyBookings(prev => prev.filter(b => b.id !== confirmModal.targetId));
        showToast(confirmModal.actionType === 'cancel' ? "Permohonan dibatalkan." : "Riwayat dihapus.", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal membatalkan permohonan.", "error");
      }
    } catch (e) {
      showToast("Tindakan gagal dilakukan.", "error");
    } finally {
      setIsConfirming(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleViewFile = async (bookingId: string) => {
      try {
          showToast("Sedang memuat file...", "info");
          const res = await api(`/api/bookings/${bookingId}/file`);
          if (res.ok) {
              const data = await res.json();
              const fetchRes = await fetch(data.file);
              const blob = await fetchRes.blob();
              const url = window.URL.createObjectURL(blob);
              window.open(url, '_blank');
          } else {
              showToast("File tidak ditemukan.", "error");
          }
      } catch (err) {
          showToast("Gagal membuka file.", "error");
      }
  };

  const handleDownloadProof = async (booking: Booking) => {
      setProofBooking(booking);
      showToast("Menyiapkan dokumen PDF...", "info");
      
      setTimeout(async () => {
          if (proofRef.current) {
              const printContents = proofRef.current.innerHTML;
              const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
              const printWindow = window.open('', '_blank', 'width=900,height=1000');
              if (printWindow) {
                  printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                      <head>
                          <title>Bukti Peminjaman - ${booking.id}</title>
                          ${styles}
                          <style>
                              @page { size: A4 portrait; margin: 0; }
                              body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
                          </style>
                      </head>
                      <body class="bg-white text-black font-sans">
                          <div style="width: 210mm; min-height: 297mm; padding: 20mm; margin: 0 auto; position: relative;">
                              ${printContents}
                          </div>
                          <script>
                              window.onload = function() {
                                  setTimeout(function() {
                                      window.print();
                                      window.close();
                                  }, 800); // Tunggu tailwind & font selesai dirender
                              };
                          </script>
                      </body>
                      </html>
                  `);
                  printWindow.document.close();
              }
              setProofBooking(null);
          }
      }, 800); // Beri waktu sebentar agar render React (termasuk QRCode) selesai
  };

  const filteredBookings = myBookings.filter(b => 
    b.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getRoomName(b.roomId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pemesanan Saya"
        description="Status pengajuan ruangan, bukti persetujuan, dan revisi permohonan."
        actions={
          <button onClick={handleCreateBooking} className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
            <Plus className="mr-2 h-4 w-4" weight="bold" /> Buat Pesanan Baru
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            label="Total Pengajuan"
            value={myBookings.length}
            icon={FileText}
            tone="blue"
            description="Seluruh riwayat pemesanan ruang"
          />
          <MetricCard
            label="Menunggu"
            value={myBookings.filter(b => b.status === BookingStatus.PENDING).length}
            icon={Hourglass}
            tone="amber"
            description="Masih perlu diverifikasi admin"
          />
          <MetricCard
            label="Disetujui"
            value={myBookings.filter(b => b.status === BookingStatus.APPROVED).length}
            icon={CheckCircle}
            tone="emerald"
            description="Siap digunakan sebagai bukti"
          />
      </div>

      <PageCard padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40 print:hidden">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Cari kegiatan atau ruangan..."
              className="w-full md:w-96"
            />
        </div>

        <div className="overflow-x-auto">
          <Table className="whitespace-nowrap text-left text-sm">
            <TableHeader className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-6 py-4">Detail Kegiatan</TableHead>
                <TableHead className="px-6 py-4">Ruangan & Waktu</TableHead>
                <TableHead className="px-6 py-4">Dokumen</TableHead>
                <TableHead className="px-6 py-4">Status</TableHead>
                <TableHead className="px-6 py-4 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredBookings.length > 0 ? filteredBookings.map((booking) => {
                const statusConfig = getStatusConfig(booking.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow key={booking.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                     <TableCell className="px-6 py-4">
                        <div className="mb-1 text-base font-bold text-slate-950 dark:text-white">{booking.purpose}</div>
                        <div className="flex flex-col gap-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            <span>PJ: {booking.responsiblePerson}</span>
                            <span>Kontak: {booking.contactPerson}</span>
                            {booking.status === BookingStatus.REJECTED && booking.rejectionReason && (
                                <span className="mt-1 rounded-md border border-red-200 bg-red-50 p-2 font-semibold text-red-700 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300">
                                    Alasan: {booking.rejectionReason}
                                </span>
                            )}
                        </div>
                     </TableCell>
                     <TableCell className="px-6 py-4">
                        <div className="mb-1 flex items-center font-semibold text-slate-900 dark:text-white">
                           <MapPin className="mr-1.5 h-3.5 w-3.5 text-slate-500" weight="bold" /> {getRoomName(booking.roomId)}
                        </div>
                        <div className="flex flex-col space-y-1 text-xs text-slate-500 dark:text-slate-400">
                           <span className="flex items-center"><CalendarBlank className="mr-1.5 h-3.5 w-3.5" weight="bold"/> {formatDateID(booking.date)}</span>
                           <span className="flex items-center"><Clock className="mr-1.5 h-3.5 w-3.5" weight="bold"/> {booking.startTime} - {booking.endTime}</span>
                        </div>
                     </TableCell>
                     <TableCell className="px-6 py-4">
                     {(booking as any).hasFile ? (
                           <button
                           onClick={() => handleViewFile(booking.id)}
                              className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-300"
                           >
                              <FileText className="mr-1 h-3.5 w-3.5" weight="bold" /> Lihat File
                           </button>
                        ) : (
                           <span className="text-xs italic text-slate-400">Tidak ada file</span>
                        )}
                     </TableCell>
                     <TableCell className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold ${statusConfig.color}`}>
                           <StatusIcon className="mr-1.5 h-3.5 w-3.5" weight="duotone" />
                           {booking.status}
                        </span>
                     </TableCell>
                     <TableCell className="px-6 py-4 text-right">
                        {booking.status === BookingStatus.PENDING ? (
                           <div className="flex items-center justify-end space-x-2">
                             <button
                                onClick={() => handleEditBooking(booking)}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                             >
                                <PencilSimpleLine className="mr-1.5 h-3.5 w-3.5" weight="bold" /> Edit
                             </button>
                             <button
                                onClick={() => handleCancelClick(booking.id)}
                                className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300"
                             >
                                <Trash className="mr-1.5 h-3.5 w-3.5" weight="bold" /> Batalkan
                             </button>
                           </div>
                        ) : booking.status === BookingStatus.APPROVED ? (
                           <button
                              onClick={() => handleDownloadProof(booking)}
                              className="ml-auto inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                           >
                              <DownloadSimple className="mr-1.5 h-3.5 w-3.5" weight="bold" /> Download Bukti
                           </button>
                        ) : booking.status === BookingStatus.REJECTED ? (
                           <button
                              onClick={() => handleDeleteClick(booking.id)}
                              className="ml-auto inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
                           >
                              <Trash className="mr-1.5 h-3.5 w-3.5" weight="bold" /> Hapus
                           </button>
                        ) : (
                           <span className="text-xs italic text-slate-400">Tidak dapat diubah</span>
                        )}
                     </TableCell>
                  </TableRow>
                );
              }) : (
                 <TableRow>
                    <TableCell colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                       <div className="flex flex-col items-center justify-center">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                             <FileText className="h-7 w-7 text-slate-400" weight="duotone" />
                          </div>
                          <p className="font-semibold">Belum ada riwayat pemesanan.</p>
                       </div>
                    </TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </PageCard>

      <div className="absolute -left-2499.75 top-0 opacity-0 invisible pointer-events-none">
        <div ref={proofRef} className="w-full text-black">
            {proofBooking && (
                <div className="relative z-10">
                    {/* Kop Surat */}
                    <div className="flex items-center border-b-4 border-double border-gray-900 pb-6 mb-8">
                        <img src={nocLogo} alt="Logo" className="w-24 h-24 object-contain mr-6" />
                        <div className="flex-1 text-center">
                            <h2 className="text-xl font-bold uppercase tracking-wider text-gray-800">Universitas Kristen Satya Wacana</h2>
                            <h1 className="text-2xl font-extrabold uppercase tracking-widest text-blue-900 mt-1">Fakultas Teknologi Informasi</h1>
                            <p className="text-sm text-gray-600 mt-2">Jl. Dr. O. Notohamidjojo No.1-10, Blotongan, Salatiga 50715</p>
                            <p className="text-sm text-gray-600">Email: fti.laboran@adm.uksw.edu | Telp: (0298) 321212</p>
                        </div>
                        <div className="w-24 h-24 flex items-center justify-center">
                            <QRCode value={proofBooking.id} size={80} level="M" />
                        </div>
                    </div>

                    <div className="text-center mb-10">
                        <h3 className="text-xl font-bold text-black underline underline-offset-4 mb-2">SURAT PERSETUJUAN PEMINJAMAN FASILITAS</h3>
                        <p className="text-sm text-gray-600 font-mono">No. Reg: {proofBooking.id}</p>
                    </div>

                    <div className="mb-6">
                        <p className="text-gray-800 leading-relaxed text-justify mb-4">
                            Berdasarkan permohonan peminjaman fasilitas yang diajukan pada sistem CORE.FTI, dengan ini Laboratorium Fakultas Teknologi Informasi UKSW menerangkan bahwa:
                        </p>
                    </div>

                    {/* Data Peminjam */}
                    <div className="mb-8">
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr>
                                    <td className="py-2 w-1/3 font-semibold text-gray-700">Nama Peminjam</td>
                                    <td className="py-2 w-4 text-center">:</td>
                                    <td className="py-2 font-bold text-gray-900">{proofBooking.userName}</td>
                                </tr>
                                <tr>
                                    <td className="py-2 font-semibold text-gray-700">NIM / NIDN</td>
                                    <td className="py-2 text-center">:</td>
                                    <td className="py-2 text-gray-800">{proofBooking.userId}</td>
                                </tr>
                                <tr>
                                    <td className="py-2 font-semibold text-gray-700">Penanggung Jawab</td>
                                    <td className="py-2 text-center">:</td>
                                    <td className="py-2 text-gray-800">{proofBooking.responsiblePerson}</td>
                                </tr>
                                <tr>
                                    <td className="py-2 font-semibold text-gray-700">Kontak Person</td>
                                    <td className="py-2 text-center">:</td>
                                    <td className="py-2 text-gray-800">{proofBooking.contactPerson}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mb-6">
                        <p className="text-gray-800 leading-relaxed text-justify mb-4">
                            Telah <strong className="text-green-700">DISETUJUI</strong> untuk menggunakan fasilitas ruangan sebagai berikut:
                        </p>
                    </div>

                    {/* Data Kegiatan & Ruangan */}
                    <div className="mb-8">
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr>
                                    <td className="py-2 w-1/3 font-semibold text-gray-700">Nama Kegiatan</td>
                                    <td className="py-2 w-4 text-center">:</td>
                                    <td className="py-2 font-bold text-gray-900">{proofBooking.purpose}</td>
                                </tr>
                                <tr>
                                    <td className="py-2 font-semibold text-gray-700">Ruangan</td>
                                    <td className="py-2 text-center">:</td>
                                    <td className="py-2 font-bold text-blue-800">{getRoomName(proofBooking.roomId)}</td>
                                </tr>
                                <tr>
                                    <td className="py-2 font-semibold text-gray-700 items-start align-top">Waktu Pelaksanaan</td>
                                    <td className="py-2 text-center align-top">:</td>
                                    <td className="py-2 text-gray-800">
                                        {(proofBooking as any).schedules && (proofBooking as any).schedules.length > 0 ? (
                                            <ul className="list-disc ml-4 space-y-1">
                                                {(proofBooking as any).schedules.map((sch: any, idx: number) => (
                                                    <li key={idx}>
                                                        <span className="font-semibold">{new Date(sch.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span> — Pukul {sch.startTime?.slice(0,5)} s.d {sch.endTime?.slice(0,5)} WIB
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <>
                                                <span className="font-bold">{new Date(proofBooking.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><br/>
                                                Pukul {proofBooking.startTime?.slice(0,5)} s.d {proofBooking.endTime?.slice(0,5)} WIB
                                            </>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mb-12">
                        <p className="text-gray-800 leading-relaxed text-justify">
                            Demikian surat persetujuan ini diterbitkan secara otomatis oleh sistem untuk dapat digunakan sebagaimana mestinya. Peminjam wajib menjaga kebersihan dan keamanan fasilitas yang digunakan.
                        </p>
                    </div>

                    {/* Tanda Tangan */}
                    <div className="flex justify-between items-end pt-8">
                        <div className="text-xs text-gray-400">
                            <p>Dokumen sah dicetak dari sistem CORE.FTI.</p>
                            <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <div className="text-center w-64">
                            <p className="text-sm text-gray-800 mb-2">Salatiga, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="text-sm font-bold text-gray-800 mb-16">Admin Laboratorium</p>
                            <div className="border-b border-gray-400 w-full mb-2"></div>
                            <p className="text-xs text-gray-500">Fakultas Teknologi Informasi</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 animate-fade-in-up dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                 <h3 className="flex items-center text-base font-bold text-slate-950 dark:text-white">
                    <Plus className="mr-2 h-5 w-5 text-slate-600 dark:text-slate-300" weight="duotone" />
                    {editingBooking ? 'Edit Pesanan Ruangan' : 'Buat Pesanan Ruangan'}
                 </h3>
                 <button onClick={closeBookingModal} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Tutup modal">
                    <X className="h-5 w-5" weight="bold" />
                 </button>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                <BookingForm
                  rooms={rooms}
                  initialData={editingBooking}
                  showToast={showToast}
                  onSuccess={() => { closeBookingModal(); fetchData(); }}
                  onCancel={closeBookingModal}
                />
              </div>
           </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.actionType === 'cancel' ? 'Ya, Batalkan' : 'Ya, Hapus'}
        type={confirmModal.actionType === 'cancel' ? 'warning' : 'danger'}
        isLoading={isConfirming}
      />
    </div>
  );
};

export default PemesananSaya;
