import {
  Buildings as Building2,
  CalendarDots as CalendarDays,
  Check,
  CaretDown as ChevronDown,
  FileText,
  SpinnerGap as Loader2,
  Plus,
  MagnifyingGlass as Search,
  Trash as Trash2,
  User,
  Wrench,
  X
} from '@phosphor-icons/react';
import React, { useState, useRef, useEffect } from "react";
import { Room, Booking, Role } from "../types";
import { api } from "../services/api";

interface ScheduleEntry {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  kebutuhan: string;
  sameAsPrevious: boolean;
}

interface RoomScheduleBlock {
  id: string;
  roomIds: string[];
  schedules: ScheduleEntry[];
}

const genId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const emptySchedule = (): ScheduleEntry => ({
  id: genId(),
  date: "",
  startTime: "",
  endTime: "",
  kebutuhan: "",
  sameAsPrevious: false,
});

const emptyBlock = (): RoomScheduleBlock => ({
  id: genId(),
  roomIds: [],
  schedules: [emptySchedule()],
});

interface MultiRoomSelectProps {
  rooms: Room[];
  selectedIds: string[];
  onToggle: (roomId: string) => void;
}

const MultiRoomSelect: React.FC<MultiRoomSelectProps> = ({
  rooms,
  selectedIds,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Hidden input — triggers browser "please fill in this field" if empty */}
      <input
        type="text"
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        value={selectedIds.join(",")}
        onChange={() => {}}
        required
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* ── Trigger ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setIsOpen((v) => !v)}
        className={`
          w-full min-h-10.5 px-3 py-2 flex flex-wrap gap-1.5 items-center
          bg-white dark:bg-gray-900
          border border-gray-300 dark:border-gray-600 rounded-lg
          cursor-pointer shadow-sm
          focus-within:ring-2 focus-within:ring-blue-500
          ${isOpen ? "ring-2 ring-blue-500" : ""}
        `}
      >
        {selectedIds.length === 0 ? (
          <span className="text-gray-400 dark:text-gray-500 text-sm select-none">
            — Pilih ruangan (boleh lebih dari satu) —
          </span>
        ) : (
          selectedIds.map((id) => {
            const room = rooms.find((r) => r.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full"
              >
                {room?.name ?? id}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(id);
                  }}
                  className="hover:text-blue-600 dark:hover:text-blue-200 rounded-full p-0.5 transition-colors"
                  aria-label={`Hapus ${room?.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })
        )}
        <ChevronDown
        className={`w-4 h-4 text-gray-400 ml-auto shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl max-h-64 flex flex-col overflow-hidden">
          {/* Search bar */}
        <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama ruangan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Room list */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">
                Ruangan tidak ditemukan
              </p>
            ) : (
              filtered.map((room) => {
                const checked = selectedIds.includes(room.id);
                return (
                  <div
                    key={room.id}
                    onClick={() => onToggle(room.id)}
                    className={`
                      flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                      hover:bg-blue-50 dark:hover:bg-gray-700
                      ${checked ? "bg-blue-50/70 dark:bg-blue-900/20" : ""}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      tabIndex={-1}
                      className="w-4 h-4 accent-blue-600shrink-0 pointer-events-none"
                    />
                    <span
                      className={`flex-1 text-sm truncate ${checked ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-700 dark:text-gray-200"}`}
                    >
                      {room.name}
                    </span>
                  <span className="text-xs text-gray-400 shrink-0">
                      Kap.&nbsp;{room.capacity}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Selection summary footer */}
          {selectedIds.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 shrink-0">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {selectedIds.length} ruangan dipilih
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BookingForm  (main component)
// ─────────────────────────────────────────────────────────────────────────────

interface BookingFormProps {
  rooms: Room[];
  initialRoomId?: string;
  initialData?: Partial<Booking> | null;
  onSuccess: () => void;
  onCancel: () => void;
  showToast: (
    message: string,
    type: "success" | "error" | "info" | "warning",
  ) => void;
}

const BookingForm: React.FC<BookingFormProps> = ({
  rooms,
  initialRoomId,
  initialData,
  onSuccess,
  onCancel,
  showToast,
}) => {
  const userRole = (
    sessionStorage.getItem("currentRole") ||
    localStorage.getItem("currentRole")
  ) as Role;
  const canManage =
    userRole === Role.ADMIN ||
    userRole === Role.LABORAN ||
    userRole === Role.SUPERVISOR;

  // ── Common fields ──────────────────────────────────────────────────────────
  const [purpose, setPurpose] = useState(initialData?.purpose ?? "");
  const [responsiblePerson, setResponsiblePerson] = useState(
    initialData?.responsiblePerson ?? "",
  );
  const [contactPerson, setContactPerson] = useState(
    initialData?.contactPerson ?? "",
  );
  const [proposalFileBase64, setProposalFileBase64] = useState(
    initialData?.proposalFile ?? "",
  );
  const [bookingFile, setBookingFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);
  
  const [techSupportPic, setTechSupportPic] = useState<string[]>((initialData as any)?.techSupportPic ?? []);

  const [staffList, setStaffList] = useState<{id: string, name: string, jabatan: string}[]>([]);

  useEffect(() => {
    if (canManage) {
      api('/api/staff').then(res => res.json()).then(data => {
        if (Array.isArray(data)) {
          setStaffList(data.filter((s: any) => s.status === 'Aktif').map((s: any) => ({ id: s.id, name: s.nama, jabatan: s.jabatan })));
        }
      }).catch(console.error);
    }
  }, [canManage]);

  const [blocks, setBlocks] = useState<RoomScheduleBlock[]>(() => {
    // Edit mode — rebuild a single block from the saved booking
    if (initialData?.roomId) {
      const savedSchedules =
        initialData.schedules && initialData.schedules.length > 0
          ? initialData.schedules.map((s) => ({
              id: genId(),
              date: s.date ? new Date(s.date).toLocaleDateString("en-CA") : "",
              startTime: s.startTime?.slice(0, 5) ?? "",
              endTime: s.endTime?.slice(0, 5) ?? "",
              kebutuhan: s.kebutuhan ?? "",
              sameAsPrevious: false,
            }))
          : [emptySchedule()];
      return [
        {
          id: genId(),
          roomIds: [initialData.roomId],
          schedules: savedSchedules,
        },
      ];
    }

    // Pre-selected room (e.g. opened from the room detail page)
    if (initialRoomId) {
      return [
        { id: genId(), roomIds: [initialRoomId], schedules: [emptySchedule()] },
      ];
    }

    return [emptyBlock()];
  });

  // ── Block-level CRUD ───────────────────────────────────────────────────────

  /** Append a fresh empty block at the bottom of the list. */
  const addBlock = () => setBlocks((prev) => [...prev, emptyBlock()]);

  /** Remove a block entirely (disabled when only one remains). */
  const removeBlock = (blockId: string) =>
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));

  // ── Room selection within a block ──────────────────────────────────────────
  const toggleRoom = (blockId: string, roomId: string) =>
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : {
              ...b,
              roomIds: b.roomIds.includes(roomId)
                ? b.roomIds.filter((id) => id !== roomId)
                : [...b.roomIds, roomId],
            },
      ),
    );

  // ── Schedule CRUD within a block ───────────────────────────────────────────

  /** Append a new empty schedule row to the given block. */
  const addSchedule = (blockId: string) =>
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : { ...b, schedules: [...b.schedules, emptySchedule()] },
      ),
    );

  /** Remove one schedule row from a block (disabled when only one remains). */
  const removeSchedule = (blockId: string, scheduleId: string) =>
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : {
              ...b,
              schedules: b.schedules
                .filter((s) => s.id !== scheduleId)
                .map((s, index, schedules) => ({
                  ...s,
                  sameAsPrevious: index > 0 && s.sameAsPrevious,
                  kebutuhan:
                    index > 0 && s.sameAsPrevious
                      ? schedules[index - 1].kebutuhan
                      : s.kebutuhan,
                })),
            },
      ),
    );

  const updateSchedule = (
    blockId: string,
    scheduleId: string,
    field: "date" | "startTime" | "endTime" | "kebutuhan",
    value: string,
  ) =>
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : {
              ...b,
              schedules: (() => {
                const schedules = b.schedules.map((s) => ({ ...s }));
                const index = schedules.findIndex((s) => s.id === scheduleId);
                if (index === -1) return schedules;

                schedules[index] = { ...schedules[index], [field]: value };
                if (field === "kebutuhan") {
                  for (let i = index + 1; i < schedules.length; i++) {
                    if (!schedules[i].sameAsPrevious) break;
                    schedules[i].kebutuhan = schedules[i - 1].kebutuhan;
                  }
                }
                return schedules;
              })(),
            },
      ),
    );

  const copyPreviousScheduleNeeds = (
    blockId: string,
    scheduleId: string,
    checked: boolean,
  ) =>
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;

        const schedules = b.schedules.map((s) => ({ ...s }));
        const index = schedules.findIndex((s) => s.id === scheduleId);
        if (index <= 0) return b;

        schedules[index].sameAsPrevious = checked;
        if (checked) {
          schedules[index].kebutuhan = schedules[index - 1].kebutuhan;
          for (let i = index + 1; i < schedules.length; i++) {
            if (!schedules[i].sameAsPrevious) break;
            schedules[i].kebutuhan = schedules[i - 1].kebutuhan;
          }
        }

        return { ...b, schedules };
      }),
    );

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      showToast("File harus berformat PDF!", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran file maksimal 5 MB!", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBookingFile(file);
      setProposalFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    const hasExistingFile = (initialData as any)?.hasFile || initialData?.proposalFile;
    const isUploadRequired = !canManage;
    if (isUploadRequired && !bookingFile && !proposalFileBase64 && !hasExistingFile)
      return "Mohon upload surat permohonan (PDF).";
    if (blocks.length === 0)
      return "Tambahkan minimal satu blok ruangan & jadwal.";

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const num = i + 1;

      if (b.roomIds.length === 0)
        return `Blok #${num}: pilih minimal satu ruangan.`;
      if (b.schedules.length === 0)
        return `Blok #${num}: tambahkan minimal satu baris jadwal.`;

      for (const s of b.schedules) {
        if (!s.date || !s.startTime || !s.endTime)
          return `Blok #${num}: lengkapi semua kolom tanggal dan jam.`;
        if (s.endTime <= s.startTime)
          return `Blok #${num}: jam selesai harus lebih dari jam mulai.`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validate();
    if (error) {
      showToast(error, "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = sessionStorage.getItem("userId") || localStorage.getItem("userId") || "GUEST";

      let finalFilePayload: string | undefined = undefined;
      if (proposalFileBase64 && proposalFileBase64.startsWith("data:")) {
        finalFilePayload = proposalFileBase64;
      }

      // ── Edit mode (single booking update) ─────────────────────────────────
      if (initialData?.id) {
        const firstBlock = blocks[0];
        const payload: any = {
          roomId: firstBlock.roomIds[0],
          userId,
          purpose,
          responsiblePerson,
          contactPerson,
          schedules: firstBlock.schedules.map(
            ({ date, startTime, endTime, kebutuhan }) => ({
              date,
              startTime,
              endTime,
              kebutuhan,
            }),
          ),
          autoApprove: canManage ? autoApprove : false,
        techSupportPic: canManage ? techSupportPic : [],
        };

        if (finalFilePayload) {
          payload.proposalFile = finalFilePayload;
          payload.file = finalFilePayload;
          payload.file_proposal = finalFilePayload;
          payload.fileProposal = finalFilePayload;
        }

        const res = await api(`/api/bookings/${initialData.id}`, {
          method: "PUT",
          data: payload,
        });

        if (!res.ok) {
          const err = await res.json();
          showToast(err.error ?? "Gagal memperbarui pemesanan.", "error");
          return;
        }
      } else {
        // ── Create mode (one request per room per block) ───────────────────
        const bookingPayloads = blocks.flatMap((block) => {
          return block.roomIds.map((roomId) => {
            const payload: any = {
              roomId,
              userId,
              purpose,
              responsiblePerson,
              contactPerson,
              schedules: block.schedules.map(({ date, startTime, endTime, kebutuhan }) => ({
                date,
                startTime,
                endTime,
                kebutuhan,
              })),
              autoApprove: canManage ? autoApprove : false,
              techSupportPic: canManage ? techSupportPic : [],
            };

            if (finalFilePayload) {
              payload.proposalFile = finalFilePayload;
              payload.file = finalFilePayload;
              payload.file_proposal = finalFilePayload;
              payload.fileProposal = finalFilePayload;
            }
            return payload;
          });
        });

        for (const payload of bookingPayloads) {
          const res = await api("/api/bookings", {
            method: "POST",
            data: payload,
          });
          if (!res.ok) {
            const err = await res.json();
            showToast(
              err.error ??
                `Gagal mengirim pemesanan untuk ruangan ${payload.roomId}.`,
              "error",
            );
            return;
          }
        }
      }

      showToast(
        initialData?.id
          ? "Permohonan peminjaman berhasil diperbarui!"
          : "Permohonan peminjaman berhasil dikirim!",
        "success",
      );
      onSuccess();
    } catch (err) {
      console.error(err);
      showToast("Terjadi kesalahan koneksi.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 1 — Common Fields
            These fields appear once per submission letter.
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

        {/* Nama Kegiatan */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Kegiatan
          </label>
          <input
            type="text"
            required
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Contoh: Rapat Koordinasi Panitia Tech Days"
            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* Nama Penanggung Jawab + Kontak Person */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Penanggung Jawab
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                required
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                placeholder="Nama Lengkap"
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Kontak Person (HP / WA)
            </label>
            <input
              type="tel"
              required
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="08123xxxxxxx"
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 2 — Dynamic Room & Schedule Blocks
            Each block = one or more rooms  +  one or more schedule rows.
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

        <div className="space-y-4">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Ruangan &amp; Jadwal
            </h3>
            <button
              type="button"
              onClick={addBlock}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tambah Blok
            </button>
          </div>

          {/* ── Block list ── */}
          {blocks.map((block, blockIdx) => (
            <div
              key={block.id}
              className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10 p-4 space-y-4 animate-fade-in-up"
            >
              {/* Block header row */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  Blok #{blockIdx + 1}
                </span>
                {blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Blok
                  </button>
                )}
              </div>

              {/* ── Multi-room selector ── */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Ruangan
                  <span className="ml-1 text-gray-400 font-normal">
                    (boleh pilih lebih dari satu)
                  </span>
                </label>
                <MultiRoomSelect
                  rooms={rooms}
                  selectedIds={block.roomIds}
                  onToggle={(roomId) => toggleRoom(block.id, roomId)}
                />
              </div>

              {/* ── Schedule rows ── */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Jadwal Pemakaian
                  </label>
                  <button
                    type="button"
                    onClick={() => addSchedule(block.id)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Hari
                  </button>
                </div>

                {block.schedules.map((schedule, scheduleIndex) => (
                  <div
                    key={schedule.id}
                    className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:flex-row sm:flex-wrap sm:items-end dark:border-gray-700 dark:bg-gray-800/40"
                  >
                    {/* Date */}
                    <div className="flex-1 w-full">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Tanggal
                      </label>
                      <input
                        type="date"
                        required
                        min={new Date().toLocaleDateString("en-CA")}
                        value={schedule.date}
                        onChange={(e) =>
                          updateSchedule(
                            block.id,
                            schedule.id,
                            "date",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    {/* Start time */}
                    <div className="w-full sm:w-32">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Jam Mulai
                      </label>
                      <input
                        type="time"
                        required
                        value={schedule.startTime}
                        onChange={(e) =>
                          updateSchedule(
                            block.id,
                            schedule.id,
                            "startTime",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    {/* End time */}
                    <div className="w-full sm:w-32">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Jam Selesai
                      </label>
                      <input
                        type="time"
                        required
                        value={schedule.endTime}
                        onChange={(e) =>
                          updateSchedule(
                            block.id,
                            schedule.id,
                            "endTime",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    {/* Remove schedule row button — hidden when only one row remains */}
                    {block.schedules.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSchedule(block.id, schedule.id)}
                        title="Hapus baris jadwal ini"
                        className="shrink-0 p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mb-px"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      /* Spacer to keep alignment consistent */
                      <div className="shrink-0 w-10 sm:mb-px hidden sm:block" />
                    )}

                    <div className="w-full sm:basis-full">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400">
                          Kebutuhan Alat/Teknis
                        </label>
                        {scheduleIndex > 0 && (
                          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={schedule.sameAsPrevious}
                              onChange={(e) =>
                                copyPreviousScheduleNeeds(
                                  block.id,
                                  schedule.id,
                                  e.target.checked,
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
                            />
                            Kebutuhan sama dengan jadwal sebelumnya
                          </label>
                        )}
                      </div>
                      <textarea
                        value={schedule.kebutuhan}
                        onChange={(e) =>
                          updateSchedule(
                            block.id,
                            schedule.id,
                            "kebutuhan",
                            e.target.value,
                          )
                        }
                        disabled={schedule.sameAsPrevious}
                        rows={2}
                        placeholder="Contoh: 2 mic wireless, kabel HDMI, operator audio"
                        className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 3 — Auto-Approve toggle  (admin / laboran only)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

    {canManage && (
      <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        {!initialData?.id && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoApprove"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
              />
              <label
                htmlFor="autoApprove"
                className="text-sm font-medium text-blue-900 dark:text-blue-300 cursor-pointer select-none"
              >
                Setujui Otomatis (Auto-Accept)
              </label>
            </div>
            {autoApprove && (
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-2 ml-6">
                Semua pemesanan dalam surat ini akan langsung berstatus{" "}
                <strong>Disetujui</strong>.
              </p>
            )}
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
            <Wrench className="w-4 h-4 text-blue-500" />
            Technical Support (Opsional)
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PIC Laboran / Teknisi</label>
              {techSupportPic.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {techSupportPic.map(picId => {
                    const staff = staffList.find(s => s.id === picId);
                    return (
                      <span key={picId} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {staff?.name || picId}
                        <button type="button" onClick={() => setTechSupportPic(prev => prev.filter(id => id !== picId))} className="ml-1 text-blue-600 hover:text-blue-800">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <select
                value=""
                onChange={e => { if (e.target.value) setTechSupportPic(prev => [...prev, e.target.value]) }}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">+ Tambah PIC</option>
                {staffList.filter(s => !techSupportPic.includes(s.id)).map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.name} ({staff.jabatan})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 4 — Proposal file upload
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Upload Surat Permohonan{" "}
            <span className="text-gray-400 font-normal">
              ({canManage ? "Opsional" : "Wajib"} · PDF, Maks. 5 MB)
            </span>
          </label>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <input
              type="file"
              id="file-upload-component"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload-component"
              className="cursor-pointer flex flex-col items-center"
            >
              <FileText
                className={`w-8 h-8 mb-2 ${
                  bookingFile || proposalFileBase64
                    ? "text-blue-600"
                    : "text-gray-400"
                }`}
              />
              {bookingFile ? (
                <span className="text-sm font-medium text-blue-600">
                  {bookingFile.name}
                </span>
          ) : (proposalFileBase64 || (initialData as any)?.hasFile) ? (
                <span className="text-sm font-medium text-blue-600">
                  Surat sudah diupload — Klik untuk mengganti
                </span>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Klik untuk upload surat
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    Format .pdf, Maksimal 5 MB
                  </span>
                </>
              )}
            </label>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 5 — Action buttons
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {initialData?.id ? "Simpan Perubahan" : "Kirim Permohonan"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookingForm;
