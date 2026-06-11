import React, { useState, useEffect, useRef, useMemo } from "react";
import { Booking, BookingStatus, Room, Role } from "../types";
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  MapPin,
  User,
  AlertCircle,
  FileText,
  Download,
  X,
  Phone,
  Shield,
  Loader2,
  Wrench,
  Edit,
  Save,
  Share2,
  FileSpreadsheet,
  AlertTriangle,
  Trash2,
  Plus,
  ChevronDown,
  Layers,
} from "lucide-react";
import { api } from "../services/api";
import BookingForm from "../components/BookingForm";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";
import { useRooms } from "../hooks/useRooms";
import ApprovalModal from "../components/ApprovalModal";
import RejectionModal from "../components/RejectionModal";
import DeleteBookingModal from "../components/DeleteBookingModal";
import BookingDetailModal from "../components/BookingDetailModal";
import { formatDateID } from "../src/utils/formatters";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface ManageBookingsProps {
  role: Role;
  addNotification: (
    title: string,
    message: string,
    type: "info" | "success" | "warning" | "error",
  ) => void;
  showToast: (
    message: string,
    type: "success" | "error" | "info" | "warning",
  ) => void;
}

interface BookingWithTech extends Booking {
  techSupportPic?: string[];
  techSupportPicName?: string;
  techSupportNeeds?: string;
}

interface LabStaff {
  id: string;
  name: string;
  jabatan: string;
  status: string;
}

interface BookingGroup {
  key: string;
  master: BookingWithTech;
  entries: BookingWithTech[];
  roomCount: number;
  totalSchedules: number;
  status: BookingStatus;
}

interface GroupDetailRow {
  booking: BookingWithTech;
  date: string;
  startTime: string;
  endTime: string;
  isFirst: boolean;
  schedCount: number;
}

const PesananRuang: React.FC<ManageBookingsProps> = ({
  role,
  addNotification,
  showToast,
}) => {
  const canEditBooking = [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR].includes(role);
  const [bookings, setBookings] = useState<BookingWithTech[]>([]);
  const { rooms } = useRooms({ excludeImage: true });
  const [staffList, setStaffList] = useState<LabStaff[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | BookingStatus>(
    "All",
  );
  const [filterDate, setFilterDate] = useState("");
  const [filterRoom, setFilterRoom] = useState<string>("All");
  const [selectedBooking, setSelectedBooking] =
    useState<BookingWithTech | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<BookingWithTech | null>(
    null,
  );

  const googleApi = useGoogleCalendar(Role.ADMIN, showToast);

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [bookingsToApprove, setBookingsToApprove] =
    useState<BookingWithTech[]>([]);
  const [approvalData, setApprovalData] = useState<{
    pic: string[];
    needs: string;
  }>({ pic: [], needs: "" });

  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [bookingsToReject, setBookingsToReject] =
    useState<BookingWithTech[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");

  const [isEditingTech, setIsEditingTech] = useState(false);
  const [editTechData, setEditTechData] = useState<{
    pic: string[];
    needs: string;
  }>({ pic: [], needs: "" });

  const [deleteOption, setDeleteOption] = useState<
    "single" | "thisAndFollowing" | "all"
  >("single");
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete Booking State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] =
    useState<BookingWithTech | null>(null);

  // Handle delete booking click
  const handleDeleteClick = (booking: BookingWithTech) => {
    setBookingToDelete(booking);
    setIsDeleteModalOpen(true);
  };

  // Handle confirm delete booking (both from database and Google Calendar)
  const handleConfirmDelete = async () => {
    if (!bookingToDelete) return;
    setIsDeleting(true);

    // Try to delete from Google Calendar first (if approved)
    if (
      bookingToDelete.status === BookingStatus.APPROVED &&
      googleApi.isGapiInitialized
    ) {
      const gapiResult: any = await deleteFromGoogleCalendar(
        bookingToDelete,
        deleteOption,
      );
      if (
        !gapiResult.success &&
        gapiResult.message !== "Dilewati: Tidak ada URL Kalender" &&
        gapiResult.message !== "Event tidak ditemukan di Google Calendar"
      ) {
        showToast(
          `Peringatan: Gagal hapus dari Calendar (${gapiResult.message}), namun data tetap dihapus.`,
          "warning",
        );
      }
    }

    // Delete from database
    try {
      const response = await api(`/api/bookings/${bookingToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast(
          "Booking berhasil dihapus dari database dan Google Calendar!",
          "success",
        );
        // Refresh data
        fetchData();
        setSelectedBooking(null);
      } else {
        showToast("Gagal menghapus booking dari database", "error");
      }
    } catch (e) {
      showToast("Gagal menghapus booking", "error");
    }

    setIsDeleting(false);
    setIsDeleteModalOpen(false);
    setBookingToDelete(null);
  };

  const ticketRef = useRef<HTMLDivElement>(null);

  const deleteFromGoogleCalendar = async (
    booking: Booking,
    option: "single" | "thisAndFollowing" | "all",
  ) => {
    const room = rooms.find((r) => r.id === booking.roomId);
    if (!room?.googleCalendarUrl)
      return { success: true, message: "Dilewati: Tidak ada URL Kalender" };
    const calendarId = getCalendarId(room.googleCalendarUrl);
    if (!calendarId)
      return { success: false, message: "ID Kalender Tidak Valid" };
    if (!googleApi.isAuthenticated) {
      googleApi.login();
      return {
        success: false,
        message: "Harap otorisasi Google Calendar lalu coba lagi.",
      };
    }
    return await performDelete(calendarId, booking, room.name, option);
  };

  const performDelete = async (
    calendarId: string,
    booking: Booking,
    roomName: string,
    option: "single" | "thisAndFollowing" | "all",
  ) => {
    try {
      const timeMin = new Date(`${booking.date}T00:00:00Z`).toISOString();
      const timeMax = new Date(`${booking.date}T23:59:59Z`).toISOString();
      const response = await window.gapi.client.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        q: `[BOOKED] ${booking.purpose}`,
      });
      const events = response.result.items;
      if (!events || events.length === 0)
        return {
          success: true,
          message: "Event tidak ditemukan di Google Calendar",
        };
      if (option === "all") {
        for (const event of events) {
          await window.gapi.client.calendar.events.delete({
            calendarId,
            eventId: event.id,
          });
        }
        return {
          success: true,
          message: `Menghapus ${events.length} event dari Google Calendar`,
        };
      } else if (option === "thisAndFollowing") {
        const allEvents = await window.gapi.client.calendar.events.list({
          calendarId,
          timeMin,
          q: `[BOOKED] ${booking.purpose}`,
        });
        for (const event of allEvents.result.items) {
          await window.gapi.client.calendar.events.delete({
            calendarId,
            eventId: event.id,
          });
        }
        return {
          success: true,
          message: "Menghapus event ini dan event selanjutnya",
        };
      } else {
        await window.gapi.client.calendar.events.delete({
          calendarId,
          eventId: events[0].id,
        });
        return { success: true, message: "Event dihapus dari Google Calendar" };
      }
    } catch (error: any) {
      console.error("GAPI Delete Error:", error);
      return {
        success: false,
        message: error.result?.error?.message || "Kesalahan GAPI",
      };
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bkRes, stRes] = await Promise.all([
        api("/api/bookings?exclude_file=true"),
        api("/api/staff"),
      ]);
      if (bkRes.ok) setBookings(await bkRes.json());
      if (stRes.ok) {
        const staffData = await stRes.json();
        setStaffList(
          staffData
            .map((s: any) => ({
              id: s.id,
              name: s.nama,
              jabatan: s.jabatan,
              status: s.status,
            }))
            .filter((s: LabStaff) => s.status === "Aktif"),
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getRoomName = (roomId: string) =>
    rooms.find((r) => r.id === roomId)?.name || "Ruangan Tidak Diketahui";

  const getCalendarId = (input: string) => {
    if (!input) return null;
    if (!input.startsWith("http")) return input;
    try {
      return new URL(input).searchParams.get("src") || null;
    } catch (e) {
      return null;
    }
  };

  const addToGoogleCalendar = async (booking: Booking) => {
    const room = rooms.find((r) => r.id === booking.roomId);
    if (!room?.googleCalendarUrl)
      return { success: true, message: "Dilewati: Tidak ada URL Kalender" };
    const calendarId = getCalendarId(room.googleCalendarUrl);
    if (!calendarId)
      return { success: false, message: "ID Kalender Tidak Valid" };
    if (!googleApi.isAuthenticated) {
      googleApi.login();
      return {
        success: false,
        message: "Harap otorisasi Google Calendar lalu coba lagi.",
      };
    }
    return await insertEvent(calendarId, booking, room.name);
  };

  const insertEvent = async (
    calendarId: string,
    booking: Booking,
    roomName: string,
  ) => {
    try {
      const startDateTime = new Date(`${booking.date}T${booking.startTime}:00`);
      const endDateTime = new Date(`${booking.date}T${booking.endTime}:00`);
      await window.gapi.client.calendar.events.insert({
        calendarId,
        resource: {
          summary: `[BOOKED] ${booking.purpose}`,
          location: roomName,
          description: `Peminjam: ${booking.userName}\nPJ: ${booking.responsiblePerson}\nKontak: ${booking.contactPerson}\n\nDisetujui via CORE.FTI.`,
          start: { dateTime: startDateTime.toISOString() },
          end: { dateTime: endDateTime.toISOString() },
        },
      });
      return { success: true, message: "Disinkronkan ke Google Calendar" };
    } catch (error: any) {
      console.error("GAPI Error:", error);
      return {
        success: false,
        message: error.result?.error?.message || "Kesalahan GAPI",
      };
    }
  };

  const handleUpdateStatus = async (
    id: string,
    newStatus: BookingStatus,
    techData?: { pic: string[]; needs: string },
    reason?: string,
    skipFetch?: boolean
  ) => {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    setProcessingId(id);
    if (newStatus === BookingStatus.APPROVED && googleApi.isGapiInitialized) {
      const gapiResult: any = await addToGoogleCalendar(booking);
      if (
        !gapiResult.success &&
        gapiResult.message !== "Dilewati: Tidak ada URL Kalender"
      ) {
        showToast(
          `Peringatan: Gagal sinkron ke Calendar (${gapiResult.message}), namun status tetap diupdate.`,
          "warning",
        );
      } else if (gapiResult.success) {
        showToast("Berhasil sinkronisasi ke Google Calendar!", "success");
      }
    }
    await api(`/api/bookings/${id}/status`, {
      method: "PUT",
      data: {
        status: newStatus,
        techSupportPic: techData?.pic || [],
        techSupportNeeds: techData?.needs || "",
        rejectionReason: reason,
      },
    });
    if (!skipFetch) {
      fetchData();
    }
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking({
        ...selectedBooking,
        status: newStatus,
        techSupportPic: techData?.pic || [],
        techSupportPicName: staffList
          .filter((s) => techData?.pic.includes(s.id))
          .map((s) => s.name)
          .join(", "),
        techSupportNeeds: techData?.needs,
        rejectionReason: reason,
      });
    }
    const isCancellation =
      booking.status === BookingStatus.APPROVED &&
      newStatus === BookingStatus.REJECTED;
    const message =
      newStatus === BookingStatus.APPROVED
        ? `Peminjaman ${booking.userName} berhasil disetujui.`
        : isCancellation
          ? `Peminjaman ${booking.userName} berhasil dibatalkan.`
          : `Peminjaman ${booking.userName} telah ditolak.`;
    const type = newStatus === BookingStatus.APPROVED ? "success" : "warning";
    showToast(message, type);
    addNotification(
      newStatus === BookingStatus.APPROVED
        ? "Peminjaman Disetujui"
        : isCancellation
          ? "Peminjaman Dibatalkan"
          : "Peminjaman Ditolak",
      isCancellation
        ? `Admin membatalkan peminjaman ${booking.userName} karena keadaan darurat.`
        : `Admin telah memverifikasi permintaan dari ${booking.userName}.`,
      type,
    );
    setProcessingId(null);
  };

  const handleApproveClick = (bookingsTarget: BookingWithTech | BookingWithTech[]) => {
    setBookingsToApprove(Array.isArray(bookingsTarget) ? bookingsTarget : [bookingsTarget]);
    setApprovalData({ pic: [], needs: "" });
    setIsApprovalModalOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (bookingsToApprove.length > 0) {
      setIsApprovalModalOpen(false);
      for (const booking of bookingsToApprove) {
        await handleUpdateStatus(
          booking.id,
          BookingStatus.APPROVED,
          approvalData,
          undefined,
          true
        );
      }
      fetchData();
      setBookingsToApprove([]);
    }
  };

  const handleRejectClick = (bookingsTarget: BookingWithTech | BookingWithTech[]) => {
    setBookingsToReject(Array.isArray(bookingsTarget) ? bookingsTarget : [bookingsTarget]);
    setDeleteOption("all");
    setRejectionReason("");
    setIsRejectionModalOpen(true);
  };

  const handleConfirmRejection = async () => {
    if (bookingsToReject.length > 0) {
      setIsRejectionModalOpen(false);
      for (const booking of bookingsToReject) {
        const isCancellation = booking.status === BookingStatus.APPROVED;
        if (isCancellation && googleApi.isGapiInitialized) {
          const gapiResult: any = await deleteFromGoogleCalendar(
            booking,
            deleteOption,
          );
          if (
            !gapiResult.success &&
            gapiResult.message !== "Dilewati: Tidak ada URL Kalender" &&
            gapiResult.message !== "Event tidak ditemukan di Google Calendar"
          ) {
            showToast(
              `Peringatan: Gagal hapus dari Calendar (${gapiResult.message}), namun status tetap diupdate.`,
              "warning",
            );
          } else if (gapiResult.success) {
            showToast("Event dihapus dari Google Calendar!", "success");
          }
        }
        await handleUpdateStatus(
          booking.id,
          BookingStatus.REJECTED,
          undefined,
          rejectionReason,
          true
        );
      }
      fetchData();
      setBookingsToReject([]);
    }
  };

  const handleSaveTechData = async () => {
    if (!selectedBooking) return;
    try {
      await api(`/api/bookings/${selectedBooking.id}/tech-support`, {
        method: "PUT",
        data: {
          techSupportPic: editTechData.pic,
          techSupportNeeds: editTechData.needs,
        },
      });
      const staffName = staffList
        .filter((s) => editTechData.pic.includes(s.id))
        .map((s) => s.name)
        .join(", ");
      const updatedBooking = {
        ...selectedBooking,
        techSupportPic: editTechData.pic,
        techSupportPicName: staffName,
        techSupportNeeds: editTechData.needs,
      };
      setSelectedBooking(updatedBooking);
      setBookings((prev) =>
        prev.map((b) => (b.id === selectedBooking.id ? updatedBooking : b)),
      );
      setIsEditingTech(false);
      showToast("Data teknis berhasil diperbarui", "success");
    } catch (e) {
      showToast("Gagal menyimpan data teknis", "error");
    }
  };

  const handleViewFile = async (e: React.MouseEvent, fileDataOrId: string) => {
    e.stopPropagation();
    try {
      if (fileDataOrId.startsWith("data:application/pdf")) {
        const res = await fetch(fileDataOrId);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
        return;
      }
      
      showToast("Sedang memuat file...", "info");
      const res = await api(`/api/bookings/${fileDataOrId}/file`);
      if (res.ok) {
        const data = await res.json();
        const fetchRes = await fetch(data.file);
        const blob = await fetchRes.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        showToast("File tidak ditemukan.", "error");
      }
    } catch (err) {
      showToast("Gagal membuka file proposal.", "error");
    }
  };

  const handlePrintProof = () => {
    if (!ticketRef.current || !selectedBooking) return;
    showToast("Menyiapkan dokumen PDF...", "info");
    setTimeout(() => {
      if (ticketRef.current) {
        const printContents = ticketRef.current.innerHTML;
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
        const printWindow = window.open('', '_blank', 'width=900,height=1000');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bukti Peminjaman - ${selectedBooking.id}</title>
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
                        }, 800);
                    };
                </script>
            </body>
            </html>
          `);
          printWindow.document.close();
        }
      }
    }, 800);
  };

  const handleExportExcel = async () => {
    try {
      showToast("Mendownload laporan...", "info");
      const response = await api("/api/bookings/export");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan_Jadwal_Lab_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("Laporan berhasil didownload", "success");
    } catch (e) {
      showToast("Gagal mendownload laporan", "error");
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        b.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.purpose.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "All" || b.status === filterStatus;
      const matchesRoom = filterRoom === "All" || b.roomId === filterRoom;

      // Cek tanggal di semua jadwal (schedules)
      const matchesDate =
        !filterDate ||
        (b.schedules &&
          b.schedules.some(
            (s: any) =>
              new Date(s.date).toLocaleDateString("en-CA") === filterDate,
          )) ||
        b.date === filterDate;
      return matchesSearch && matchesStatus && matchesRoom && matchesDate;
    });
  }, [bookings, searchTerm, filterStatus, filterRoom, filterDate]);

  const pendingCount = useMemo(() => {
    return bookings.filter((b) => b.status === BookingStatus.PENDING).length;
  }, [bookings]);

  // ── Expandable row state ──────────────────────────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  /**
   * Groups bookings that originate from the same request letter.
   *
   * Key  =  userId  +  purpose  +  first 80 chars of proposalFile
   *
   * Bookings that share a key were all submitted from the same letter
   * (one letter can contain multiple room-schedule blocks, producing one
   * booking record per room via the BookingForm's flatMap submit logic).
   *
   * Status precedence:  PENDING  >  REJECTED  >  APPROVED
   */
  const groupedBookings = useMemo(() => {
    const map = new Map<string, BookingWithTech[]>();
    filteredBookings.forEach((b) => {
      const k = `${b.userId}§${b.purpose}§${(b.proposalFile ?? "").slice(0, 80)}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    });
    return Array.from(map.entries()).map(([key, entries]) => ({
      key,
      master: entries[0],
      entries,
      roomCount: entries.length,
      totalSchedules: entries.reduce(
        (s, b) => s + (b.schedules?.length ?? 1),
        0,
      ),
      status: entries.some((e) => e.status === BookingStatus.PENDING)
        ? BookingStatus.PENDING
        : entries.some((e) => e.status === BookingStatus.REJECTED)
          ? BookingStatus.REJECTED
          : BookingStatus.APPROVED,
    }));
  }, [filteredBookings]);

  /**
   * Groups every booking (unfiltered) by the same key used in groupedBookings.
   * This is intentionally derived from the raw `bookings` array — not from
   * `filteredBookings` — so the detail modal always shows the full set of rooms
   * from a request letter even when the table is filtered down to a single room.
   */
  const allGroupedBookings = useMemo(() => {
    const map = new Map<string, BookingWithTech[]>();
    bookings.forEach((b) => {
      const k = `${b.userId}§${b.purpose}§${(b.proposalFile ?? "").slice(0, 80)}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    });
    return Array.from(map.values());
  }, [bookings]);

  /**
   * The sibling bookings that belong to the same request letter as
   * `selectedBooking`.  Passed to BookingDetailModal as `bookingGroup` so the
   * "Daftar Ruangan & Jadwal" section can render all rooms, not just the one
   * room carried by the single selected booking record.
   */
  const selectedBookingGroup = useMemo(() => {
    if (!selectedBooking) return [];
    const grp = allGroupedBookings.find((g) =>
      g.some((b) => b.id === selectedBooking.id),
    );
    return grp ?? [selectedBooking];
  }, [selectedBooking, allGroupedBookings]);

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    paginatedData: currentGroups,
    totalPages,
  } = usePagination(groupedBookings, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterRoom, filterDate, itemsPerPage, setCurrentPage]);

  const openBookingDetail = (booking: BookingWithTech) => {
    setSelectedBooking({
      ...booking,
      proposalFile: (booking as any).hasFile ? booking.id : undefined,
    });
    setIsEditingTech(false);
    setEditTechData({
      pic: booking.techSupportPic || [],
      needs: booking.techSupportNeeds || "",
    });
  };

  const handleCreateBooking = () => {
    setEditingBooking(null);
    setIsBookingModalOpen(true);
  };

  const handleEditBooking = (booking: BookingWithTech) => {
    setEditingBooking({
      ...booking,
      proposalFile: (booking as any).hasFile ? booking.id : undefined,
    });
    setSelectedBooking(null);
    setIsBookingModalOpen(true);
  };

  const closeBookingModal = () => {
    setIsBookingModalOpen(false);
    setEditingBooking(null);
  };

  const getGroupDetailRows = (group: any): GroupDetailRow[] =>
    group.entries.flatMap((booking: BookingWithTech) => {
      const scheds = booking.schedules?.length
        ? booking.schedules
        : [
            {
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
            },
          ];

      return scheds.map((schedule: any, idx: number) => ({
        booking,
        date: schedule.date || "",
        startTime: schedule.startTime || "",
        endTime: schedule.endTime || "",
        isFirst: idx === 0,
        schedCount: scheds.length,
      }));
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pesanan Ruang
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Kelola persetujuan peminjaman ruangan
          </p>
        </div>
        <div className="flex w-full flex-col sm:w-auto sm:flex-row sm:items-center gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center justify-center bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg text-sm font-medium animate-pulse">
              <AlertCircle className="w-4 h-4 mr-2" />
              {pendingCount} Permintaan Menunggu Konfirmasi
            </div>
          )}
          <button
            onClick={handleCreateBooking}
            className="w-full sm:w-auto justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-sm font-medium shadow-sm transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" /> Buat Pesanan
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama peminjam atau keperluan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm w-full dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-end gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              title="Filter Tanggal"
            />
            <select
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer sm:max-w-35 truncate"
              title="Filter Ruangan"
            >
              <option value="All">Semua Ruang</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <Filter className="w-4 h-4 text-gray-400 hidden lg:block" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full sm:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="All">Semua Status</option>
              <option value={BookingStatus.PENDING}>Pending</option>
              <option value={BookingStatus.APPROVED}>Disetujui</option>
              <option value={BookingStatus.REJECTED}>Ditolak</option>
            </select>
            <button
              onClick={handleExportExcel}
              className="w-full sm:w-auto justify-center flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors shadow-sm"
              title="Download Laporan Excel"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
            </button>
          </div>
        </div>

        {/* Desktop Table — Expandable Master-Detail */}
        <div className="md:hidden space-y-3 p-3">
          {currentGroups.length > 0 ? (
            currentGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const detailRows = getGroupDetailRows(group);

              return (
                <div
                  key={group.key}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                        {group.master.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">
                          {group.master.userName}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {group.master.userId}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        group.status === BookingStatus.APPROVED
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : group.status === BookingStatus.REJECTED
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {group.status}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openBookingDetail(group.master)}
                    className="mt-3 block w-full text-left"
                  >
                    <p className="text-base font-semibold leading-snug text-gray-900 dark:text-white">
                      {group.master.purpose}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      PJ: {group.master.responsiblePerson}
                    </p>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {group.roomCount === 1
                        ? getRoomName(group.master.roomId)
                        : `${group.roomCount} Ruangan`}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {group.totalSchedules} Jadwal
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                        Ringkasan Jadwal
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400"
                      >
                        {isExpanded ? "Sembunyikan" : "Lihat Semua"}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {(isExpanded ? detailRows : detailRows.slice(0, 2)).map(
                        (row: GroupDetailRow, idx: number) => (
                          <div
                            key={`${row.booking.id}-mobile-${idx}`}
                            className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {getRoomName(row.booking.roomId)}
                                </p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {formatDateID(row.date)}
                                </p>
                              </div>
                              {row.isFirst && (
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    row.booking.status === BookingStatus.APPROVED
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      : row.booking.status === BookingStatus.REJECTED
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  }`}
                                >
                                  {row.booking.status}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-gray-400" />
                                {row.startTime?.slice(0, 5)}
                              </span>
                              <span>-</span>
                              <span>{row.endTime?.slice(0, 5)}</span>
                            </div>
                          </div>
                        ),
                      )}
                    </div>

                    {!isExpanded && detailRows.length > 2 && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        +{detailRows.length - 2} jadwal lainnya
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {(group.master as any).hasFile ? (
                      <button
                        type="button"
                        onClick={(e) => handleViewFile(e, group.master.id)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400"
                      >
                        <FileText className="h-4 w-4" />
                        Lihat Surat
                      </button>
                    ) : (
                      <p className="text-sm text-gray-400">Surat belum diunggah.</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => openBookingDetail(group.master)}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Buka Detail Lengkap
                    </button>

                    {group.status === BookingStatus.PENDING && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleApproveClick(group.entries)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectClick(group.entries)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                          Tolak
                        </button>
                      </div>
                    )}

                    {group.status === BookingStatus.APPROVED && (
                      <button
                        type="button"
                        onClick={() => handleRejectClick(group.entries)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Batalkan Peminjaman
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
              <FileText className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p>Tidak ada data peminjaman yang sesuai filter.</p>
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            {/* ── Table Head ── */}
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <tr>
                {/* chevron column — no label */}
                <th className="pl-4 pr-2 py-3 w-10" />
                <th className="px-4 py-3">Peminjam</th>
                <th className="px-4 py-3">Keperluan</th>
                <th className="px-4 py-3">Ringkasan</th>
                <th className="px-4 py-3">Dokumen</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>

            {/* ── Table Body ── */}
            <tbody>
              {currentGroups.length > 0 ? (
                currentGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.key);
                  // A row is expandable if it represents more than one unique (room, schedule) cell
                  const hasDetails =
                    group.roomCount > 1 || group.totalSchedules > 1;

                  // Flatten every booking in the group to individual (room × schedule) rows
                  // so the sub-table shows one atomic slot per line.
                  const detailRows = getGroupDetailRows(group);

                  return (
                    <React.Fragment key={group.key}>
                      {/* ══════════════════════════════════════════════════════
                        MASTER ROW
                        Shows the shared "letter-level" data: who submitted,
                        what activity, how many rooms/slots, document, and
                        the dominant status across all child bookings.
                    ══════════════════════════════════════════════════════ */}
                      <tr
                        onClick={() => openBookingDetail(group.master)}
                        className={`
                        border-t border-gray-200 dark:border-gray-700
                        cursor-pointer transition-colors duration-150
                        group/master
                        hover:bg-gray-50 dark:hover:bg-gray-700/40
                        ${isExpanded ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}
                      `}
                      >
                        {/* ── Expand / Collapse Chevron ── */}
                        <td className="pl-4 pr-2 py-4 w-10">
                          <button
                            type="button"
                            title={
                              isExpanded
                                ? "Tutup detail"
                                : "Lihat detail ruangan & jadwal"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasDetails) toggleGroup(group.key);
                            }}
                            className={`
                            p-1 rounded-md transition-all duration-150
                            ${
                              hasDetails
                                ? "text-gray-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 dark:hover:text-blue-400"
                                : "text-gray-200 dark:text-gray-600 cursor-default"
                            }
                          `}
                          >
                            <ChevronDown
                              className={`
                              w-4 h-4 transition-transform duration-300 ease-in-out
                              ${isExpanded ? "rotate-180 text-blue-500 dark:text-blue-400" : ""}
                            `}
                            />
                          </button>
                        </td>

                        {/* ── Peminjam ── */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {group.master.userName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white group-hover/master:text-blue-600 transition-colors">
                                {group.master.userName}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {group.master.userId}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* ── Keperluan ── */}
                        <td className="px-4 py-4 max-w-45">
                          <p
                            className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug"
                            title={group.master.purpose}
                          >
                            {group.master.purpose}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {group.master.responsiblePerson}
                          </p>
                        </td>

                        {/* ── Ringkasan: Room + Schedule count pills ── */}
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {/* Room pill: show name if only one, else count */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {group.roomCount === 1
                                ? getRoomName(group.master.roomId)
                                : `${group.roomCount} Ruangan`}
                            </span>
                            {/* Schedule pill */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 whitespace-nowrap">
                              <Calendar className="w-3 h-3 shrink-0" />
                              {group.totalSchedules} Jadwal
                            </span>
                          </div>
                        </td>

                        {/* ── Dokumen ── */}
                        <td className="px-4 py-4">
                          {(group.master as any).hasFile ? (
                            <button
                              onClick={(e) =>
                                handleViewFile(e, group.master.id)
                              }
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                            >
                              <FileText className="w-3 h-3" /> Lihat Surat
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs italic">
                              —
                            </span>
                          )}
                        </td>

                        {/* ── Status (dominant across group) ── */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              group.status === BookingStatus.APPROVED
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : group.status === BookingStatus.REJECTED
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            }`}
                          >
                            {group.status}
                          </span>
                        </td>

                        {/* ── Master-level Actions ── */}
                        <td className="px-4 py-4 text-right">
                          {group.status === BookingStatus.PENDING && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveClick(group.entries);
                                }}
                                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                title="Setuju"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRejectClick(group.entries);
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Tolak"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                          {group.status === BookingStatus.APPROVED && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRejectClick(group.entries);
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Batalkan (Darurat)"
                              >
                                <AlertTriangle className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* ══════════════════════════════════════════════════════
                        DETAIL EXPANSION ROW
                        Always rendered but height-animated via the CSS
                        grid-template-rows trick:
                          grid-rows-[0fr]  →  collapsed (zero height)
                          grid-rows-[1fr]  →  expanded  (natural height)
                        The inner wrapper must have overflow-hidden so
                        content is clipped during the transition.
                    ══════════════════════════════════════════════════════ */}
                      <tr className={`${isExpanded ? "border-t-0" : ""}`}>
                        <td colSpan={7} className="p-0 border-t-0">
                          <div
                            className={`
                            grid transition-[grid-template-rows] duration-300 ease-in-out
                            ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}
                          `}
                          >
                            {/* overflow-hidden clips the content to 0 height when collapsed */}
                            <div className="overflow-hidden">
                              <div className="mx-3 md:mx-6 mb-4 mt-1 rounded-xl border border-blue-200 dark:border-blue-800/60 overflow-hidden shadow-sm">
                                {/* Sub-table header bar */}
                                <div className="flex items-center justify-between px-4 py-2.5 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b border-blue-100 dark:border-blue-800/60">
                                  <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">
                                    <Layers className="w-3.5 h-3.5" />
                                    Detail Ruangan &amp; Jadwal
                                  </h4>
                                  <span className="text-[11px] font-medium text-blue-500 dark:text-blue-400">
                                    {group.roomCount} ruangan &bull;{" "}
                                    {group.totalSchedules} jadwal
                                  </span>
                                </div>

                                {/* Sub-table */}
                                <div className="mobile-table-scroll">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-gray-50/70 dark:bg-gray-800/50 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                      <th className="px-4 py-2 text-left">
                                        Ruangan
                                      </th>
                                      <th className="px-4 py-2 text-left">
                                        Tanggal
                                      </th>
                                      <th className="px-4 py-2 text-left">
                                        Jam Mulai
                                      </th>
                                      <th className="px-4 py-2 text-left">
                                        Jam Selesai
                                      </th>
                                      <th className="px-4 py-2 text-left">
                                        Status
                                      </th>
                                      <th className="px-4 py-2 text-right">
                                        Aksi
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40 bg-white dark:bg-gray-900/40">
                                    {detailRows.map((row: GroupDetailRow, idx: number) => (
                                      <tr
                                        key={`${row.booking.id}-${idx}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openBookingDetail(row.booking);
                                        }}
                                        className={`
                                        text-xs cursor-pointer transition-colors duration-100
                                        hover:bg-blue-50/60 dark:hover:bg-blue-900/10
                                        ${row.isFirst && idx > 0 ? "border-t-2 border-t-blue-100 dark:border-t-blue-800/40" : ""}
                                      `}
                                      >
                                        {/* Room name — shown only on the first schedule row of
                                          each booking so multi-schedule rooms don't repeat */}
                                        <td className="px-4 py-2.5">
                                          {row.isFirst ? (
                                            <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
                                              <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                                              {getRoomName(row.booking.roomId)}
                                              {row.schedCount > 1 && (
                                                <span className="ml-0.5 font-normal text-gray-400">
                                                  ({row.schedCount}×)
                                                </span>
                                              )}
                                            </span>
                                          ) : (
                                            /* Indent continuation rows to signal they belong to the room above */
                                            <span className="pl-5 text-gray-300 dark:text-gray-600 select-none">
                                              ↳
                                            </span>
                                          )}
                                        </td>

                                        {/* Date */}
                                        <td className="px-4 py-2.5">
                                          <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                                            <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                                            {formatDateID(row.date)}
                                          </span>
                                        </td>

                                        {/* Start time */}
                                        <td className="px-4 py-2.5">
                                          <span className="inline-flex items-center gap-1 font-mono text-gray-700 dark:text-gray-300">
                                            <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                                            {row.startTime?.slice(0, 5)}
                                          </span>
                                        </td>

                                        {/* End time */}
                                        <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">
                                          {row.endTime?.slice(0, 5)}
                                        </td>

                                        {/* Per-booking status badge — only on first row of that booking */}
                                        <td className="px-4 py-2.5">
                                          {row.isFirst && (
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                                row.booking.status ===
                                                BookingStatus.APPROVED
                                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                  : row.booking.status ===
                                                      BookingStatus.REJECTED
                                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                              }`}
                                            >
                                              {row.booking.status}
                                            </span>
                                          )}
                                        </td>

                                        {/* Per-booking action buttons — only on first row */}
                                        <td className="px-4 py-2.5 text-right">
                                          {row.isFirst && (
                                            <div className="flex items-center justify-end gap-1">
                                              {row.booking.status ===
                                                BookingStatus.PENDING && (
                                                <>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleApproveClick(
                                                        row.booking,
                                                      );
                                                    }}
                                                    className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                                                    title="Setuju"
                                                  >
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleRejectClick(
                                                        row.booking,
                                                      );
                                                    }}
                                                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                                    title="Tolak"
                                                  >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                  </button>
                                                </>
                                              )}
                                              {row.booking.status ===
                                                BookingStatus.APPROVED && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRejectClick(
                                                      row.booking,
                                                    );
                                                  }}
                                                  className="p-1 text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded transition-colors"
                                                  title="Batalkan"
                                                >
                                                  <AlertTriangle className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                      <p>Tidak ada data peminjaman yang sesuai filter.</p>
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
            totalItems={groupedBookings.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </div>

      {/* Detail Modal */}
      <BookingDetailModal
        isOpen={selectedBooking !== null}
        selectedBooking={selectedBooking}
        setSelectedBooking={setSelectedBooking}
        rooms={rooms}
        staffList={staffList}
        isEditingTech={isEditingTech}
        setIsEditingTech={setIsEditingTech}
        editTechData={editTechData}
        setEditTechData={setEditTechData}
        handleSaveTechData={handleSaveTechData}
        handleViewFile={handleViewFile}
        handlePrintProof={handlePrintProof}
        handleRejectClick={handleRejectClick}
        handleDeleteClick={handleDeleteClick}
        handleApproveClick={handleApproveClick}
        processingId={processingId}
        ticketRef={ticketRef}
        bookingGroup={selectedBookingGroup}
        canEditBooking={canEditBooking}
        handleEditBooking={handleEditBooking}
      />

      {/* Approval Confirmation Modal */}
      <ApprovalModal
        isOpen={isApprovalModalOpen}
        booking={bookingsToApprove.length > 0 ? bookingsToApprove[0] : null}
        rooms={rooms}
        staffList={staffList}
        approvalData={approvalData}
        setApprovalData={setApprovalData}
        onClose={() => setIsApprovalModalOpen(false)}
        onConfirm={handleConfirmApproval}
      />

      {/* Rejection Confirmation Modal */}
      <RejectionModal
        isOpen={isRejectionModalOpen}
        booking={bookingsToReject.length > 0 ? bookingsToReject[0] : null}
        rooms={rooms}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        deleteOption={deleteOption}
        setDeleteOption={setDeleteOption}
        onClose={() => setIsRejectionModalOpen(false)}
        onConfirm={handleConfirmRejection}
      />

      {/* Delete Booking Confirmation Modal */}
      <DeleteBookingModal
        isOpen={isDeleteModalOpen}
        booking={bookingToDelete}
        rooms={rooms}
        isDeleting={isDeleting}
        deleteOption={deleteOption}
        setDeleteOption={setDeleteOption}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      {isBookingModalOpen && (
        <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center text-base">
                {editingBooking ? (
                  <Edit className="w-5 h-5 mr-2 text-blue-600" />
                ) : (
                  <Plus className="w-5 h-5 mr-2 text-blue-600" />
                )}
                {editingBooking ? "Edit Pesanan Ruangan" : "Buat Pesanan Ruangan"}
              </h3>
              <button
                onClick={closeBookingModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mobile-modal-body p-0">
              <BookingForm
                rooms={rooms}
                showToast={showToast}
                initialData={editingBooking}
                onSuccess={() => {
                  closeBookingModal();
                  fetchData();
                }}
                onCancel={closeBookingModal}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PesananRuang;
