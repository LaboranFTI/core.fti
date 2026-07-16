import {
  ArrowsDownUp as ArrowUpDown,
  CalendarBlank as Calendar,
  Check,
  CaretDown as ChevronDown,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  Clock,
  Cpu,
  PencilSimpleLine as Edit2,
  ArrowSquareOut as ExternalLink,
  Eye,
  FileText,
  Funnel as Filter,
  HardDrive,
  Info,
  Keyboard,
  SpinnerGap as Loader2,
  SignIn as LogIn,
  MapPin,
  Monitor,
  Mouse,
  Package,
  Plus,
  ArrowClockwise as RefreshCw,
  Trash as Trash2,
  UploadSimple as Upload,
  User,
  Users,
  WifiHigh as Wifi,
  X
} from '@phosphor-icons/react';
import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { Room, Role, BookingStatus, Booking, Software } from '../types';
import { api } from '../services/api';
import SoftwareForm from '../components/SoftwareForm';
import RoomForm from '../components/RoomForm';
import BookingForm from '../components/BookingForm';
import { Skeleton } from '../components/Skeleton';
import { useRooms } from '../hooks/useRooms';
import RoomList from '../components/RoomList';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import SearchBar from '../components/SearchBar';
import PageHeader from '../components/PageHeader';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

// Declare Pannellum for TypeScript
declare global {
  interface Window {
    pannellum: any;
    gapi: any;
    google: any;
  }
}

interface RoomsProps {
  role: Role;
  isDarkMode: boolean;
  onNavigate?: (page: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface GoogleEvent {
  id: string;
  eventId?: string;
  occurrenceId?: string;
  sourceId?: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink: string;
}

interface LabStaff {
  id: string;
  name: string;
  nim: string;
  email: string;
  phone: string;
  jabatan: 'Admin' | 'Teknisi' | 'Supervisor' | 'Kepala Sarpras';
  status: 'Aktif' | 'Non-Aktif';
}

const getCategoryColor = (category?: string) => {
  switch (category) {
    case 'Laboratorium Komputer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'Teori': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'Praktek': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'Rekreasi': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400';
    case 'Meeting': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'Lounge': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'Open Space': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400';
    case 'Auditorium/Ruang Kuliah Umum': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};
const getConditionColor = (condition?: string) => {
  switch (condition) {
    case 'Baik': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'Rusak Ringan': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'Rusak Berat': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};
const Ruangan: React.FC<RoomsProps> = ({ role, isDarkMode, onNavigate, showToast }) => {
  // Helper: Cek admin case-insensitive
  const isAdmin = role.toString().toUpperCase() === Role.ADMIN.toString().toUpperCase();
  const isMahasiswa = role.toString().toUpperCase() === Role.MAHASISWA.toString().toUpperCase();
  const isLaboran = role.toString().toUpperCase() === Role.LABORAN.toString().toUpperCase();
  const isSupervisor = role.toString().toUpperCase() === 'SUPERVISOR';
  const canManage = isAdmin || isLaboran || isSupervisor;
  const canRequestBooking = !isMahasiswa;

  // Menggunakan custom hook useRooms (autoFetch dimatikan agar kontrol loading awal tetap dipegang Promise.all)
  const { rooms, fetchRooms: fetchRoomsApi } = useRooms({ autoFetch: false, excludeImage: true });
  const [availableFacilities, setAvailableFacilities] = useState<string[]>([]);
  const [newFacilityInput, setNewFacilityInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  const [filterCategory, setFilterCategory] = useState<string>('All');
  const debouncedFilterCategory = useDebouncedValue(filterCategory, 500);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Tersedia' | 'Digunakan'>('All');
  const debouncedFilterStatus = useDebouncedValue(filterStatus, 500);
  const [sortBy, setSortBy] = useState<'name' | 'capacity'>('name');
  const debouncedSortBy = useDebouncedValue(sortBy, 200);
  
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'booking' | 'form'>('list');

  // CRUD & Form State
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Room>>({});
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  
  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [labStaff, setLabStaff] = useState<LabStaff[]>([]);

  // Expand/Collapse state untuk lantai
  const [collapsedFloors, setCollapsedFloors] = useState<Record<string, boolean>>(() => {
    // Coba baca dari Local Storage saat komponen pertama kali dirender
    const saved = localStorage.getItem('collapsedFloors_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Simpan ke Local Storage setiap kali state collapsedFloors berubah
  useEffect(() => {
    localStorage.setItem('collapsedFloors_state', JSON.stringify(collapsedFloors));
  }, [collapsedFloors]);
  
  const [highResCache, setHighResCache] = useState<Record<string, string>>({});

  // Pannellum Ref
  const panoramaRef = useRef<HTMLDivElement>(null);

  const viewerRef = useRef<any>(null); // Untuk menyimpan instance Pannellum
  const [isPanoramaLoading, setIsPanoramaLoading] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<GoogleEvent[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const googleApi = useGoogleCalendar(role, showToast);

  // Computer Specs State (Summary Only)
  const [dominantSpec, setDominantSpec] = useState<any>(null);

  // Software State
  const [roomSoftware, setRoomSoftware] = useState<Software[]>([]);
  const [editingSoftware, setEditingSoftware] = useState<Partial<Software> | null>(null);

  // Loading States for CRUD operations
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [isSavingSoftware, setIsSavingSoftware] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Filter Active Technicians for PIC Dropdown
  const activeTechnicians = labStaff; // API /api/staff already filters Active

  const toggleFloor = async (floor: string) => {
    const isCurrentlyCollapsed = collapsedFloors[floor] !== false; // Default true jika undefined
    
    if (isCurrentlyCollapsed) {
      setCollapsedFloors(prev => ({ ...prev, [floor]: false }));
    } else {
      setCollapsedFloors(prev => ({ ...prev, [floor]: true }));
    }
  };

  // Ekstrak daftar kategori unik dari data ruangan
  const categories = Array.from(new Set(rooms.map(room => room.category || 'Umum'))).sort();

  // Filter & Sort Logic - Using DEBOUNCED values
  const filteredRooms = useMemo(() => rooms
    .filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                            (room.description || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesCategory = debouncedFilterCategory === 'All' || (room.category || 'Umum') === debouncedFilterCategory;
      const matchesStatus = debouncedFilterStatus === 'All' || (room as any).currentStatus === debouncedFilterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      if (debouncedSortBy === 'name') return a.name.localeCompare(b.name);
      return b.capacity - a.capacity;
    }), [rooms, debouncedSearchTerm, debouncedFilterCategory, debouncedFilterStatus, debouncedSortBy]);

  // Mengelompokkan daftar ruangan yang sudah difilter berdasarkan Lantai
  const groupedRooms = useMemo(() => {
    const groups: Record<string, Room[]> = {};
    filteredRooms.forEach(room => {
      // Kelompokkan berdasarkan lantai, beri default jika kosong
      const floor = room.floor || 'Lantai 4';
      if (!groups[floor]) {
        groups[floor] = [];
      }
      groups[floor].push(room);
    });

    // Urutkan nama lantai secara abjad (Lantai 1, Lantai 2, dst)
    return Object.keys(groups).sort().map(floor => ({
      floor,
      rooms: groups[floor]
    }));
  }, [filteredRooms]);

  // Initialize Pannellum when viewing details
useEffect(() => {
    if (viewMode === 'detail' && selectedRoom && panoramaRef.current) {
      const roomId = selectedRoom.id;

      const initViewer = (imgUrl: string) => {
        if (panoramaRef.current && window.pannellum) {
          viewerRef.current = window.pannellum.viewer(panoramaRef.current, {
            type: 'equirectangular',
            panorama: imgUrl,
            autoLoad: true,
            autoRotate: -2,
            compass: true,
            listeners: { 'load': () => setIsPanoramaLoading(false) }
          });
        }
      };

      if (highResCache[roomId]) {
        setIsPanoramaLoading(true);
        initViewer(highResCache[roomId]);
      } else {
        setIsPanoramaLoading(true);
        api(`/api/room/${roomId}`)
          .then(res => res.ok ? res.json() : Promise.reject())
          .then(data => {
            if (data.image) {
              setHighResCache(prev => ({ ...prev, [roomId]: data.image }));
              initViewer(data.image);
            } else {
              setIsPanoramaLoading(false);
            }
          })
          .catch(() => {
            showToast("Gagal memuat gambar 360 resolusi tinggi.", "error");
            setIsPanoramaLoading(false);
          });
      }

      return () => {
        if (viewerRef.current) {
          try { viewerRef.current.destroy(); } catch (e) { /* silent */ }
          viewerRef.current = null;
        }
      };
    }
  }, [viewMode, selectedRoom]);

  // Fetch Initial Data & Setup Auto-Refresh
  useEffect(() => {
  const loadInitialData = async () => {
      setIsLoadingRooms(true);
      await fetchStaff();
      await fetchRooms();
      setIsLoadingRooms(false);
    };

    loadInitialData();

    // Auto-refresh data ruangan setiap 1 menit (60000 ms) untuk memperbarui status Tersedia/Digunakan
    const intervalId = setInterval(() => {
      fetchRooms();
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  // Mengecek apakah ada instruksi navigasi ke detail ruangan tertentu dari halaman lain
  useEffect(() => {
    const targetId = localStorage.getItem('targetRoomId');
    if (targetId && rooms.length > 0) {
      const targetRoom = rooms.find(r => r.id === targetId);
      if (targetRoom) {
        setSelectedRoom(targetRoom);
        setViewMode('detail');
      }
      localStorage.removeItem('targetRoomId');
    }
  }, [rooms]);

  const fetchRooms = async () => {
    const data = await fetchRoomsApi();
    
    if (data) {
      // Create a dynamic list of unique facilities from all rooms + a base list
      const allFacs = new Set<string>();
      const baseFacilities = ["AC", "CCTV", "Komputer", "Meja", "Kursi", "Stop Kontak", "Proyektor", "Smart TV", "Interactive TV", "TV", "Console Cisco", "Videowall", "Sound/Speaker", "Mic", "Podium", "Green Screen", "Peralatan Fotografi & Videografi", "Internet LAN"];
      baseFacilities.forEach(f => allFacs.add(f));

      data.forEach((room: Room) => {
          if (room.facilities) {
room.facilities.forEach((fac: string) => allFacs.add(fac));
          }
      });
      setAvailableFacilities(Array.from(allFacs).sort());

      // Jika sedang membuka detail ruangan, update state selectedRoom agar status ketersediaannya ikut akurat
      setSelectedRoom(prev => {
          if (prev) {
              const updatedRoom = data.find((r: Room) => r.id === prev.id);
              return updatedRoom || prev;
          }
          return prev;
      });
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await api('/api/staff');
      if (res.ok) {
          const data = await res.json();
          // Pastikan mapping sesuai dengan yang diharapkan komponen
          const mappedStaff = data.map((s: any) => ({
              id: s.id,
              name: s.nama,
              jabatan: s.jabatan,
              status: s.status
          }));
          setLabStaff(mappedStaff);
      }
    } catch (e) { console.error(e); }
  };

  const handleAuthClick = () => {
    googleApi.connectCalendar();
  };



  const fetchDominantSpec = async () => {
      if (!selectedRoom) return;
      try {
          const res = await api(`/api/rooms/${selectedRoom.id}/specs-summary`);
          if (res.ok) setDominantSpec(await res.json());
      } catch (e) { console.error(e); }
  };

  const fetchRoomSoftware = async () => {
      if (!selectedRoom) return;
      try {
          const res = await api(`/api/software?roomId=${selectedRoom.id}`);
          if (res.ok) {
              const data = await res.json();
              setRoomSoftware(data);
          }
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
      if (viewMode === 'detail' && selectedRoom) {
          fetchStaff();
          fetchDominantSpec();
          // Fetch software only for this room in detail
          if (selectedRoom.category === 'Laboratorium Komputer') {
              fetchRoomSoftware();
          }
      }
  }, [viewMode, selectedRoom]);

  const getCalendarId = (input: string) => {
    if (!input) return null;
    const cleanInput = input.trim();
    // Jika input bukan URL (tidak ada http), asumsikan itu adalah Calendar ID langsung
    if (!cleanInput.startsWith('http')) {
        return cleanInput;
    }
    try {
      const urlObj = new URL(input);
      const src = urlObj.searchParams.get('src');
      return src ? decodeURIComponent(src) : null;
    } catch (e) {
      return null;
    }
  };

  const fetchRoomEvents = async () => {
      if (!selectedRoom?.id) return;

      setIsCalendarLoading(true);
      try {
          const query = new URLSearchParams({
              roomId: selectedRoom.id,
              timeMin: (new Date()).toISOString(),
              maxResults: '5'
          });
          const res = await api(`/api/core-calendar/events?${query.toString()}`);
          if (res.ok) {
              const data = await res.json();
              setCalendarEvents(data.data?.items || data.items || []);
          } else {
              const err = await res.json().catch(() => ({}));
              console.error("Gagal mengambil event CORE Calendar:", err);
              setCalendarEvents([]);
          }
      } catch (e) {
          console.error(e);
          setCalendarEvents([]);
      } finally {
          setIsCalendarLoading(false);
      }
  };

  // Fetch events when dependencies change
  useEffect(() => {
      if (viewMode === 'detail' && selectedRoom && googleApi.isGapiInitialized) {
          fetchRoomEvents();
      }
  }, [viewMode, selectedRoom, googleApi.isGapiInitialized]);

  const formatEventTime = (dateTime?: string, date?: string) => {
    if (dateTime) {
      return new Date(dateTime).toLocaleString('id-ID', { 
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
      });
    }
    if (date) {
      return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + " (All Day)";
    }
    return "-";
  };

  // CRUD Handlers
  const handleAddNew = () => {
    // Restrict Access
    if (!canManage) {
        showToast("Akses Ditolak. Hanya Admin dan Laboran yang bisa menambah ruangan.", "error");
        return;
    }

    setFormData({
      name: '', category: 'Laboratorium Komputer', description: '', capacity: 0, pic: activeTechnicians[0]?.name || '', image: '', facilities: [], googleCalendarUrl: '', floor: 'Lantai 4'
    });
    setIsEditing(false);
    setViewMode('form');
  };

  const handleOpenBooking = () => {
    if (!canRequestBooking) {
      showToast("Role Mahasiswa hanya memiliki akses baca pada halaman ruangan.", "info");
      return;
    }

    setViewMode('booking');
  };

const handleEdit = async (room: Room) => {
    setFormData({ ...room, image: highResCache[room.id] || '' });
    setIsEditing(true);
    setViewMode('form');

    if (!highResCache[room.id]) {
      try {
        const res = await api(`/api/room/${room.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.image) {
            setHighResCache(prev => ({ ...prev, [room.id]: data.image }));
            setFormData(prev => ({ ...prev, image: data.image }));
          }
        }
      } catch (error) {
        // Silent - Abaikan jika gagal memuat gambar, agar tidak mengganggu proses edit data
      }
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      try {
        await api(`/api/rooms/${deleteTargetId}`, { method: 'DELETE' });
        fetchRooms();
        showToast("Ruangan berhasil dihapus.", "success");
      } catch (e) { showToast("Gagal menghapus", "error"); }
      setShowDeleteModal(false);
      setDeleteTargetId(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsImageProcessing(true);
      
      // Convert to Base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
          setFormData(prev => ({ ...prev, image: reader.result as string }));
          setIsImageProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveRoom = async (submittedData: Partial<Room>) => {
    // Validasi Kapasitas (double check, sudah ada di form)
    if (!submittedData.capacity || submittedData.capacity <= 0) {
      showToast("Kapasitas ruangan harus lebih dari 0.", "warning");
      return;
    }

    // Set loading state
    setIsSavingRoom(true);

    // Bersihkan fasilitas dari string kosong sebelum kirim
    const { pic_id, imageChanged, ...cleanData } = submittedData as any;

    const payload = {
        ...cleanData,
    };

    // Jangan kirim image & thumbnail jika tidak ada perubahan agar tidak menimpa di database
    if (!imageChanged && isEditing) {
      delete payload.image;
    }

    try {
      let response;
      if (isEditing && formData.id) {
         response = await api(`/api/rooms/${formData.id}`, {
            method: 'PUT',
            data: payload
         });
      } else {
         const newId = `ROOM-${Date.now()}`;
         response = await api('/api/rooms', {
            method: 'POST',
            data: { ...payload, id: newId }
         });
      }
      
      if (response.ok) {
        fetchRooms();
        setViewMode('list');
        showToast("Data ruangan berhasil disimpan.", "success");
      } else {
        let errorMessage = 'Terjadi kesalahan di server';
        try {
            const err = await response.json();
            errorMessage = err.error || errorMessage;
        } catch {
            errorMessage = `Status: ${response.status} ${response.statusText}`;
        }
        showToast(`Gagal menyimpan data: ${errorMessage}`, "error");
      }
    } catch (e: any) {
      console.error("Save Room Error:", e);
      showToast(`Gagal menyimpan data. Detail: ${e.message || "Cek koneksi internet"}`, "error");
    } finally {
      setIsSavingRoom(false);
    }
  };



  // Software management functions
  const handleDeleteSoftware = async (id: string) => {
    if (!selectedRoom) return;
    if (confirm("Hapus data software ini?")) {
      try {
        await api(`/api/software/${id}`, { method: 'DELETE' });
        fetchRoomSoftware();
        showToast("Data software berhasil dihapus.", "success");
      } catch (e) {
        showToast("Gagal menghapus data software", "error");
      }
    }
  };

  const handleSaveSoftware = async (softwareData: Partial<Software>) => {
    if (!selectedRoom) return;

    try {
      let response;
      const payload = {
        ...softwareData,
        roomId: selectedRoom.id
      };
      
      if (softwareData.id) {
        response = await api(`/api/software/${softwareData.id}`, {
          method: 'PUT',
          data: payload
        });
      } else {
        response = await api('/api/software', {
          method: 'POST',
          data: payload
        });
      }

      if (response.ok) {
        setEditingSoftware(null);
        fetchRoomSoftware();
        showToast("Data software berhasil disimpan.", "success");
      }
    } catch (e) { console.error(e); showToast("Gagal menyimpan data software", "error"); }
  };

  // Calendar Visual Logic
  const getDaysInMonth = () => Array.from({length: 30}, (_, i) => i + 1);
  const isBooked = (day: number) => day % 3 === 0; // Mock

  const handleBackToList = () => {
    const returnToLaboran = localStorage.getItem('returnToLaboranId');
    if (returnToLaboran && onNavigate) {
        onNavigate('manajemen-laboran');
    } else {
        setViewMode('list');
    }
  };

  // --- RENDERERS ---

  if (isLoadingRooms) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-64 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
            {canManage && <Skeleton className="h-10 w-24 rounded-lg" />}
          </div>
        </div>
        <div className="space-y-10 mt-4">
          <div>
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-100">
                  <Skeleton className="h-48 w-full rounded-none" />
                  <div className="p-5 flex-1 flex flex-col">
                    <Skeleton className="h-6 w-3/4 mb-3" />
                    <Skeleton className="h-4 w-1/4 mb-4" />
                    <div className="flex gap-2 mb-4">
                      <Skeleton className="h-6 w-16 rounded" />
                      <Skeleton className="h-6 w-16 rounded" />
                    </div>
                    <Skeleton className="h-12 w-full mb-4" />
                    <div className="mt-auto flex justify-end">
                      <Skeleton className="h-9 w-28 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'form') {
    return (
      <RoomForm
        initialData={formData}
        isEditing={isEditing}
        onSave={handleSaveRoom}
        onCancel={() => setViewMode('list')}
        staffList={labStaff.filter(s => s.status === 'Aktif')}
        availableFacilities={availableFacilities}
        isSaving={isSavingRoom}
      />
    );
  }

  if (viewMode === 'detail' && selectedRoom) {
      return (
          <div className="space-y-6">
              <button onClick={handleBackToList} className="text-sm text-blue-500 hover:underline mb-4 flex items-center">
                <ChevronLeft className="w-4 h-4 mr-1" /> Kembali ke daftar
              </button>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700">
                  {/* 360 Viewer Container */}
                  <div className="relative h-96 w-full bg-black group">
                      <div ref={panoramaRef} className="w-full h-full"></div>
                      {!isPanoramaLoading && !highResCache[selectedRoom.id] && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 text-gray-400 z-20">
                          <Info className="w-10 h-10 mb-3" />
                          <p className="font-medium">Gambar 360° tidak tersedia.</p>
                        </div>
                      )}
                      <div className="absolute top-4 left-10 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center backdrop-blur-sm pointer-events-none z-10">
                          <Eye className="w-4 h-4 mr-2" /> Tampilan Interaktif 360°
                      </div>
                  </div>
                  
                  <div className="p-8">
                      <div className="flex flex-col md:flex-row justify-between items-start">
                          <div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{selectedRoom.name}</h2>
                            <div className="mb-3">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(selectedRoom.category)}`}>{selectedRoom.category || 'Umum'}</span>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 flex items-center flex-wrap gap-2 mb-4">
                                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1"/> {selectedRoom.floor || 'Lantai 4'}</span>
                                <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
                                <span className="flex items-center"><Users className="w-4 h-4 mr-1"/> Kapasitas: {selectedRoom.capacity} Orang</span>
                                {(selectedRoom.computerCount && selectedRoom.computerCount > 0) ? (
                                    <>
                                        <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
                                        <span className="flex items-center"><Monitor className="w-4 h-4 mr-1"/> {selectedRoom.computerCount} Unit PC</span>
                                    </>
                                ) : null}
                                <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
                                <span>PIC: {selectedRoom.pic}</span>
                            </p>
                          </div>
                      <div className="flex w-full flex-col sm:flex-row gap-2 mt-4 md:mt-0 md:w-auto">
                             {(canManage) && (
                                <button className="justify-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium flex items-center">
                                    <Calendar className="w-4 h-4 mr-2"/> Atur Jadwal
                                </button>
                             )}
                             {canRequestBooking && (
                                <button 
                                   onClick={handleOpenBooking}
                                   className="justify-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-md transition-colors inline-flex"
                                >
                                   Ajukan Peminjaman
                                </button>
                             )}
                          </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                          <div className="lg:col-span-2">
                              <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">Deskripsi</h3>
                              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">{selectedRoom.description}</p>
                              
                              <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">Fasilitas</h3>
                              <div className="flex flex-wrap gap-2 mb-8">
                                  {selectedRoom.facilities?.map((fac, idx) => (
                                      <span key={idx} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                          {fac}
                                      </span>
                                  ))}
                              </div>

                              {/* Spesifikasi Komputer (Dominan) */}
                              <div className="mb-8">
                                  <div className="flex justify-between items-center mb-3">
                                      <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
                                          <Monitor className="w-5 h-5 mr-2 text-blue-500"/> Spesifikasi Komputer
                                      </h3>
                                      {(canManage) && (
                                          <button 
                                              onClick={() => {
                                                  localStorage.setItem('targetSpecRoomId', selectedRoom.id);
                                                  if (onNavigate) onNavigate('manajemen-spesifikasi');
                                              }}
                                              className="text-sm text-blue-600 hover:underline font-medium"
                                          >
                                              Kelola Unit
                                          </button>
                                      )}
                                  </div>
                                  
                                  {dominantSpec ? (
                                      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                                          <div className="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                                              <span className="text-sm font-bold text-gray-500 uppercase">Standar Lab ({dominantSpec.dominantCount} dari {dominantSpec.totalUnits} Unit)</span>
                                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-mono">{dominantSpec.os}</span>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                              <div className="flex items-start">
                                                  <Cpu className="w-4 h-4 mr-2 text-gray-400 mt-0.5"/>
                                                  <div>
                                                      <span className="block font-medium text-gray-900 dark:text-white">{dominantSpec.cpu}</span>
                                                      <span className="text-xs text-gray-500">Processor</span>
                                                  </div>
                                              </div>
                                              <div className="flex items-start">
                                                  <div className="w-4 h-4 mr-2 text-gray-400 mt-0.5 font-bold text-[10px] border border-gray-400 rounded flex items-center justify-center">G</div>
                                                  <div>
                                                      <span className="block font-medium text-gray-900 dark:text-white">{dominantSpec.gpu_model}</span>
                                                      <span className="text-xs text-gray-500">{dominantSpec.gpu_type} ({dominantSpec.vram})</span>
                                                  </div>
                                              </div>
                                              <div className="flex items-start">
                                                  <div className="w-4 h-4 mr-2 text-gray-400 mt-0.5 font-bold text-[10px] border border-gray-400 rounded flex items-center justify-center">R</div>
                                                  <div>
                                                      <span className="block font-medium text-gray-900 dark:text-white">{dominantSpec.ram}</span>
                                                      <span className="text-xs text-gray-500">RAM</span>
                                                  </div>
                                              </div>
                                              <div className="flex items-start">
                                                  <HardDrive className="w-4 h-4 mr-2 text-gray-400 mt-0.5"/>
                                                  <div>
                                                      <span className="block font-medium text-gray-900 dark:text-white">{dominantSpec.storage}</span>
                                                      <span className="text-xs text-gray-500">Storage</span>
                                                  </div>
                                              </div>
                                              <div className="flex items-start">
                                                  <Monitor className="w-4 h-4 mr-2 text-gray-400 mt-0.5"/>
                                                  <div>
                                                      <span className="block font-medium text-gray-900 dark:text-white">{dominantSpec.monitor}</span>
                                                      <span className="text-xs text-gray-500">Monitor</span>
                                                  </div>
                                              </div>
                                              <div className="flex items-start">
                                                  <Keyboard className="w-4 h-4 mr-2 text-gray-400 mt-0.5"/>
                                                  <div>
                                                      <span className="block font-medium text-gray-900 dark:text-white">{dominantSpec.keyboard} & {dominantSpec.mouse}</span>
                                                      <span className="text-xs text-gray-500">Peripherals</span>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center text-gray-500 text-sm italic">
                                          Belum ada data spesifikasi komputer.
                                      </div>
                                  )}
                              </div>

                              <div className="flex items-center justify-between gap-3 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                                 <div className="flex items-center">
                                    <Check className="w-4 h-4 mr-2" />
                                    <span>Jadwal tersedia via CORE Calendar</span>
                                 </div>
                                 {selectedRoom.googleCalendarUrl && (
                                    <a
                                      href={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(getCalendarId(selectedRoom.googleCalendarUrl) || "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      Google legacy <ExternalLink className="w-3 h-3" />
                                    </a>
                                 )}
                              </div>

                              {/* Software Section - Only for Laboratorium Komputer */}
                              {selectedRoom.category === 'Laboratorium Komputer' && (
                              <div className="mb-8">
                                  <div className="flex justify-between items-center mb-3">
                                      <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
                                          <Package className="w-5 h-5 mr-2 text-purple-500"/> Software Instalasi
                                      </h3>
                                      {(canManage) && (
                                          <button 
                                              onClick={() => setEditingSoftware({ name: '', version: '', licenseType: 'Free', category: '', notes: '' })}
                                              className="text-sm text-blue-600 hover:underline font-medium"
                                          >
                                              + Tambah Software
                                          </button>
                                      )}
                                  </div>
                                  
                                  {roomSoftware.length > 0 ? (
                                      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                                          <div className="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                                              <span className="text-sm font-bold text-gray-500 uppercase">Daftar Software ({roomSoftware.length} aplikasi)</span>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              {roomSoftware.map((sw) => (
                                                  <div key={sw.id} className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                                                      <div>
                                                          <span className="block font-medium text-gray-900 dark:text-white">{sw.name}</span>
                                                          <span className="text-xs text-gray-500">v{sw.version} • {sw.category || 'General'}</span>
                                                          {sw.licenseType && (
                                                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${sw.licenseType === 'Free' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : sw.licenseType === 'Commercial' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                                  {sw.licenseType}
                                                              </span>
                                                          )}
                                                      </div>
                                                      {(canManage) && (
                                                          <div className="flex space-x-1">
                                                              <button onClick={() => setEditingSoftware(sw)} className="text-blue-600 hover:text-blue-800 p-1"><Edit2 className="w-3 h-3"/></button>
                                                              <button onClick={() => handleDeleteSoftware(sw.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 className="w-3 h-3"/></button>
                                                          </div>
                                                      )}
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center text-gray-500 text-sm italic">
                                          Belum ada data software. Klik "+ Tambah Software" untuk menambahkan.
                                      </div>
                                  )}
                              </div>
                              )}

                              <SoftwareForm
                                isOpen={!!editingSoftware}
                                onClose={() => setEditingSoftware(null)}
                                onSave={handleSaveSoftware}
                                initialData={editingSoftware}
                                isSaving={isSavingSoftware}
                              />
                          </div>

                          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white flex items-center justify-between shrink-0">
                                  <span className="flex items-center"><Calendar className="w-5 h-5 mr-2 text-blue-500"/> Jadwal Ruangan</span>
                                  {googleApi.isGapiInitialized && (
                                     <button onClick={fetchRoomEvents} className="text-gray-500 hover:text-blue-500" title="Refresh">
                                        <RefreshCw className={`w-4 h-4 ${isCalendarLoading ? 'animate-spin' : ''}`}/>
                                     </button>
                                  )}
                              </h3>
                              
                              <div className="min-h-62.5 max-h-100 overflow-y-auto pr-1">
                                  {calendarEvents.length > 0 ? (
                                      <div className="space-y-3">
                                          {calendarEvents.map(event => {
                                              const content = (
                                                  <>
                                                      <div className="flex justify-between items-start">
                                                          <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">{event.summary}</h4>
                                                          {event.htmlLink && <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />}
                                                      </div>
                                                      <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                                                          <Clock className="w-3 h-3 mr-1" /> {formatEventTime(event.start.dateTime, event.start.date)}
                                                      </div>
                                                  </>
                                              );
                                              const className = "block bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors group";
                                              return event.htmlLink ? (
                                                  <a key={event.id} href={event.htmlLink} target="_blank" rel="noopener noreferrer" className={className}>
                                                      {content}
                                                  </a>
                                              ) : (
                                                  <div key={event.id} className={className}>
                                                      {content}
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  ) : (
                                      <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
                                          <p className="text-sm">Tidak ada agenda mendatang.</p>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )
  }



  if (viewMode === 'booking' && selectedRoom) {
      return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 dark:text-white text-center">Formulir Peminjaman Ruangan</h2>
            <BookingForm
                rooms={rooms}
                initialRoomId={selectedRoom.id}
                showToast={showToast}
                onSuccess={() => {
                    showToast("Permohonan berhasil dikirim!", "success");
                    if (canManage && onNavigate) {
                    onNavigate('pesanan-ruang');
                    } else {
                        setViewMode('detail');
                    }
                }}
                onCancel={() => setViewMode('detail')}
            />
        </div>
      )
  }

  // LIST VIEW - Replaced with RoomList component
  return (
        <div className="space-y-6">
      <PageHeader
        title="Daftar Ruangan"
        description="Ruang Laboratorium/Praktek dan Teori FTI UKSW"
        actionsClassName="w-full md:w-auto"
        actions={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:w-auto">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Cari Ruangan..."
              className="w-full sm:w-64"
            />

            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'All' | 'Tersedia' | 'Digunakan')}
                className="cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="All">Semua Status</option>
                <option value="Tersedia">Tersedia</option>
                <option value="Digunakan">Digunakan</option>
              </select>
              <Filter className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="All">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <Filter className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'capacity')}
                className="cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="name">Nama (A-Z)</option>
                <option value="capacity">Kapasitas</option>
              </select>
              <ArrowUpDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            {canManage && (
              <button onClick={handleAddNew} className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" /> Tambah
              </button>
            )}
          </div>
        }
      />

      <RoomList
        filteredRooms={filteredRooms}
        collapsedFloors={collapsedFloors}
        toggleFloor={toggleFloor}
        canManage={canManage}
onRoomSelect={(room: Room) => {
          setSelectedRoom(room);
          setViewMode('detail');
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isDarkMode={isDarkMode}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up flex flex-col">
              <div className="p-6 text-center">
                 <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                 </div>
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Hapus Ruangan?</h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Apakah Anda yakin ingin menghapus ruangan ini? Data yang dihapus tidak dapat dikembalikan.
                 </p>
                 <div className="mobile-modal-actions flex justify-center gap-3">
                    <button 
                       onClick={() => setShowDeleteModal(false)} 
                       className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                       Batal
                    </button>
                    <button 
                       onClick={confirmDelete} 
                       className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                       Ya, Hapus
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
export default Ruangan;
