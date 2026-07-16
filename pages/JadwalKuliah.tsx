import React, { useState, useEffect, useMemo } from 'react';
import { Role, Room, Software } from '../types';
import {
  ArrowClockwise as RefreshCw,
  BookOpen,
  CalendarCheck as Calendar,
  CaretDown as ChevronDown,
  Check,
  Clock,
  DownloadSimple as Download,
  FileXls as FileSpreadsheet,
  Funnel as Filter,
  MapPin,
  PencilSimpleLine as Edit,
  Plus,
  SpinnerGap as Loader2,
  Trash,
  UsersThree as Users,
  WarningCircle as AlertTriangle,
  X,
} from '@phosphor-icons/react';
import { api } from '../services/api';
import { TableSkeleton } from '../components/Skeleton';
import SearchableSelect, { SelectOption } from '../components/SearchableSelect';
import SearchBar from '../components/SearchBar';
import { useLecturers } from '../hooks/useLecturers';
import { Button, buttonVariants } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import { cn } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import PageCard from '../components/PageCard';

interface ClassSchedule {
  id: string;
  courseCode: string;
  courseName: string;
  classGroup: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: string;
  academicYear: string;
  roomId: string;
  roomName: string;
  roomCategory?: string;
  lecturerId?: string;
  lecturerName: string;
  startDate: string;
  endDate: string;
  software?: Software[];
  softwareIds?: string[];
}

interface SemesterPeriod {
  id: string;
  semester: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  notes?: string;
  isActive: boolean;
}

interface ConflictInfo {
  newCourseName: string;
  newCourseCode: string;
  existingCourseName: string;
  existingCourseCode: string;
  dayOfWeek: string;
  time: string;
}

interface ClassScheduleManagementProps {
  role: Role;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const JadwalKuliah: React.FC<ClassScheduleManagementProps> = ({ role, showToast }) => {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDay, setFilterDay] = useState<string>('All');
  const [filterSemester, setFilterSemester] = useState<string>('');
  const [filterLecturer, setFilterLecturer] = useState<string>('');
  const [filterRoom, setFilterRoom] = useState<string>('All');
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  const [formData, setFormData] = useState({
    courseCode: '',
    courseName: '',
    classGroup: '-',
    dayOfWeek: 'Senin',
    startTime: '08:00',
    endTime: '10:00',
    semester: 'Ganjil',
    academicYear: '',
    roomId: '',
    lecturerId: '',
    lecturerName: '',
    startDate: '', // Tanggal mulai periode semester
    endDate: '',   // Tanggal selesai periode semester
    softwareIds: [] as string[]
  });

  const [semesterPeriods, setSemesterPeriods] = useState<SemesterPeriod[]>([]);
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [editingSemesterPeriod, setEditingSemesterPeriod] = useState<SemesterPeriod | null>(null);
  const [semesterPeriodForm, setSemesterPeriodForm] = useState({
    semester: 'Ganjil',
    academicYear: '',
    startDate: '',
    endDate: '',
    notes: '',
    isActive: true
  });
  const [roomSoftware, setRoomSoftware] = useState<Software[]>([]);
  const [semesterLabUsage, setSemesterLabUsage] = useState<ClassSchedule[]>([]);

  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    conflicts: ConflictInfo[];
    onConfirm: () => void;
    onCancel: () => void;
    pendingSchedules?: any[]; // Added for bulk flow
  }>({ isOpen: false, conflicts: [], onConfirm: () => {}, onCancel: () => {}, pendingSchedules: [] });

  // Bulk fields modal state
  const [bulkModal, setBulkModal] = useState<{
    isOpen: boolean;
    pendingSchedules: any[];
    unmatchedRooms: Set<string>;
    unmatchedLecturers: Set<string>;
    unmatchedSoftware: Set<string>;
  }>({ isOpen: false, pendingSchedules: [], unmatchedRooms: new Set(), unmatchedLecturers: new Set(), unmatchedSoftware: new Set() });

  const [bulkFormData, setBulkFormData] = useState({
    semester: 'Ganjil' as 'Ganjil' | 'Antara' | 'Genap',
    academicYear: '',
    startDate: '',
    endDate: ''
  });

  // Bulk Delete Modal State
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{
    isOpen: boolean;
    semester: string;
    academicYear: string;
  }>({ isOpen: false, semester: 'Ganjil', academicYear: '' });

  const canManage = role.toString().toUpperCase() === 'ADMIN' ||
                    role.toString().toUpperCase() === 'LABORAN' ||
                    role.toString().toUpperCase() === 'SUPERVISOR';

  // Days options
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Semester options
  const semesters = ['Ganjil', 'Antara', 'Genap'];

  // Academic years
  const [academicYears, setAcademicYears] = useState<string[]>([]);

  // Memoized select items for Base UI Select
  const roomFilterSelectItems = useMemo(() => {
    return [
      { label: 'Semua', value: 'All' },
      ...rooms.map(r => ({ label: r.name, value: r.id }))
    ];
  }, [rooms]);

  const semesterFilterSelectItems = useMemo(() => {
    return [
      { label: 'Semua Semester', value: '' },
      ...semesters.map(s => ({ label: s, value: s }))
    ];
  }, [semesters]);

  const academicYearFilterSelectItems = useMemo(() => {
    return [
      { label: 'Semua Tahun', value: '' },
      ...academicYears.map(ay => ({ label: ay, value: ay }))
    ];
  }, [academicYears]);

  const dayFilterSelectItems = useMemo(() => {
    return [
      { label: 'Semua Hari', value: 'All' },
      ...days.map(d => ({ label: d, value: d }))
    ];
  }, [days]);

  const dayFormItems = useMemo(() => {
    return days.map(d => ({ label: d, value: d }));
  }, [days]);

  const semesterFormItems = useMemo(() => {
    return semesters.map(s => ({ label: s, value: s }));
  }, [semesters]);

  const academicYearFormItems = useMemo(() => {
    return academicYears.map(ay => ({ label: ay, value: ay }));
  }, [academicYears]);

  const { lecturers } = useLecturers();
  const lecturerOptions: SelectOption[] = lecturers.map(l => ({
    value: l.id,
    label: l.nama,
    subLabel: l.id
  }));

  const findSemesterPeriod = (semester: string, academicYear: string) => {
    return semesterPeriods.find(period =>
      period.isActive &&
      period.semester === semester &&
      period.academicYear === academicYear
    );
  };

  const applySemesterPeriodDates = <T extends { semester: string; academicYear: string; startDate: string; endDate: string }>(
    data: T,
    preserveExistingDates = false
  ): T => {
    const period = findSemesterPeriod(data.semester, data.academicYear);
    if (!period) return data;
    return {
      ...data,
      startDate: preserveExistingDates && data.startDate ? data.startDate : period.startDate,
      endDate: preserveExistingDates && data.endDate ? data.endDate : period.endDate,
    };
  };

  const setFormDataWithPeriod = (partial: Partial<typeof formData>, preserveExistingDates = false) => {
    setFormData(prev => applySemesterPeriodDates({ ...prev, ...partial }, preserveExistingDates));
  };

  const setBulkFormDataWithPeriod = (partial: Partial<typeof bulkFormData>, preserveExistingDates = false) => {
    setBulkFormData(prev => applySemesterPeriodDates({ ...prev, ...partial }, preserveExistingDates));
  };

  const selectedRoom = useMemo(() => rooms.find(room => room.id === formData.roomId) || null, [rooms, formData.roomId]);
  const isSelectedRoomComputerLab = selectedRoom?.category === 'Laboratorium Komputer';

  const normalizeImportText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

  const splitImportedSoftware = (value: string) => {
    return value
      .split(/[,;\n]/)
      .map(item => item.trim())
      .filter(Boolean);
  };

  const resolveImportedSoftwareIds = (
    softwareValue: string,
    roomId: string,
    roomName: string,
    allSoftware: Software[],
    unmatchedSoftware: Set<string>
  ) => {
    const requestedSoftware = splitImportedSoftware(softwareValue);
    if (requestedSoftware.length === 0) return [];

    const room = rooms.find(item => item.id === roomId);
    if (!roomId || !room) {
      unmatchedSoftware.add(`${roomName || 'Tanpa ruangan'}: ${requestedSoftware.join(', ')}`);
      return [];
    }
    if (room.category !== 'Laboratorium Komputer') {
      unmatchedSoftware.add(`${room.name}: software diabaikan karena bukan Laboratorium Komputer`);
      return [];
    }

    const softwareForRoom = allSoftware.filter(software => software.roomId === roomId);
    const matchedIds = new Set<string>();
    for (const softwareName of requestedSoftware) {
      const normalizedName = normalizeImportText(softwareName);
      const match = softwareForRoom.find(software => {
        const candidates = [
          software.name,
          software.version ? `${software.name} ${software.version}` : '',
          software.version ? `${software.name} v${software.version}` : '',
        ];
        return candidates.some(candidate => normalizeImportText(candidate) === normalizedName);
      });

      if (match) {
        matchedIds.add(match.id);
      } else {
        unmatchedSoftware.add(`${room.name}: ${softwareName}`);
      }
    }

    return Array.from(matchedIds);
  };


  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSemester) params.append('semester', filterSemester);
      if (filterAcademicYear) params.append('academicYear', filterAcademicYear);

      const response = await api(`/api/class-schedules?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSchedules(data);

        setAcademicYears(prev => {
          const fetchedYears = data.map((s: ClassSchedule) => s.academicYear).filter(Boolean);
          return Array.from(new Set([...prev, ...fetchedYears])).sort((a, b) => b.localeCompare(a));
        });
      }
    } catch (error) {
      console.error("Error fetching class schedules:", error);
      showToast("Gagal memuat jadwal kelas", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await api('/api/rooms?exclude_image=true');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchSemesterPeriods = async () => {
    try {
      const res = await api('/api/semester-periods');
      if (res.ok) {
        const data = await res.json();
        setSemesterPeriods(data);
        setAcademicYears(prev => {
          const periodYears = data.map((period: SemesterPeriod) => period.academicYear).filter(Boolean);
          return Array.from(new Set([...prev, ...periodYears])).sort((a, b) => b.localeCompare(a));
        });
      }
    } catch (error) {
      console.error("Error fetching semester periods:", error);
    }
  };

  const fetchRoomSoftware = async (roomId: string) => {
    if (!roomId) {
      setRoomSoftware([]);
      return;
    }

    try {
      const res = await api(`/api/software?roomId=${encodeURIComponent(roomId)}`);
      if (res.ok) {
        setRoomSoftware(await res.json());
      }
    } catch (error) {
      console.error("Error fetching room software:", error);
      setRoomSoftware([]);
    }
  };

  const fetchSemesterLabUsage = async () => {
    if (!filterSemester || !filterAcademicYear) {
      setSemesterLabUsage([]);
      return;
    }

    try {
      const params = new URLSearchParams({
        semester: filterSemester,
        academicYear: filterAcademicYear,
      });
      const res = await api(`/api/semester-lab-usage?${params.toString()}`);
      if (res.ok) {
        setSemesterLabUsage(await res.json());
      }
    } catch (error) {
      console.error("Error fetching semester lab usage:", error);
      setSemesterLabUsage([]);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [filterSemester, filterAcademicYear]);

  useEffect(() => {
    fetchRooms();
    fetchSemesterPeriods();
  }, []);

  useEffect(() => {
    if (isModalOpen && isSelectedRoomComputerLab && formData.roomId) {
      fetchRoomSoftware(formData.roomId);
    } else {
      setRoomSoftware([]);
    }
  }, [isModalOpen, isSelectedRoomComputerLab, formData.roomId]);

  useEffect(() => {
    fetchSemesterLabUsage();
  }, [filterSemester, filterAcademicYear]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const matchesSearch =
        schedule.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.courseName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDay = filterDay === 'All' || schedule.dayOfWeek === filterDay;
      const matchesLecturer = !filterLecturer || (schedule.lecturerName && schedule.lecturerName.toLowerCase().includes(filterLecturer.toLowerCase()));
      const matchesRoom = filterRoom === 'All' || schedule.roomId === filterRoom;
      return matchesSearch && matchesDay && matchesLecturer && matchesRoom;
    });
  }, [schedules, searchTerm, filterDay, filterLecturer, filterRoom]);

  const handleOpenModal = (schedule?: ClassSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData(applySemesterPeriodDates({
        courseCode: schedule.courseCode,
        courseName: schedule.courseName,
        classGroup: schedule.classGroup || '-',
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        semester: schedule.semester,
        academicYear: schedule.academicYear,
        roomId: schedule.roomId || '',
        lecturerId: schedule.lecturerId || '',
        lecturerName: schedule.lecturerName || '',
        startDate: schedule.startDate || '',
        endDate: schedule.endDate || '',
        softwareIds: schedule.softwareIds || schedule.software?.map(software => software.id) || []
      }, true));
    } else {
      setEditingSchedule(null);
      setFormData(applySemesterPeriodDates({
        courseCode: '',
        courseName: '',
        classGroup: '-',
        dayOfWeek: 'Senin',
        startTime: '08:00',
        endTime: '10:00',
        semester: filterSemester || 'Ganjil',
        academicYear: filterAcademicYear || (academicYears.length > 0 ? academicYears[0] : ''),
        roomId: '',
        lecturerId: '',
        lecturerName: '',
        startDate: '',
        endDate: '',
        softwareIds: []
      }, false));
    }
    setIsModalOpen(true);
  };

  const checkConflict = (newSchedule: any, existingSchedules: any[], currentEditId?: string | null) => {
    return existingSchedules.find(existing => {
      if (currentEditId && currentEditId === existing.id) return false;

      if (existing.roomId === newSchedule.roomId &&
          existing.dayOfWeek === newSchedule.dayOfWeek &&
          existing.semester === newSchedule.semester &&
          existing.academicYear === newSchedule.academicYear) {

        const newStart = newSchedule.startTime;
        const newEnd = newSchedule.endTime;
        const existStart = existing.startTime;
        const existEnd = existing.endTime;

        if (newStart < existEnd && newEnd > existStart) {
          return true;
        }
      }
      return false;
    });
  };

// Helper to parse legacy Jam format to startTime/endTime (used in handleExcelUpload)
  const parseJamToTimes = (jamStr: string): { startTime: string; endTime: string } | null => {
    if (!jamStr || typeof jamStr !== 'string') return null;

    const cleaned = jamStr.trim().replace(/\s+/g, '');
    let times: string[];

    // Handle : separator (07:00:09:00)
    if (cleaned.includes(':')) {
      const parts = cleaned.split(':');
      if (parts.length >= 4) {
        const start = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        const end = `${parts[2].padStart(2, '0')}:${parts[3].padStart(2, '0')}`;
        return { startTime: start, endTime: end };
      }
    }

    // Handle - separator (07:00-09:00)
    if (cleaned.includes('-')) {
      times = cleaned.split('-');
      if (times.length === 2) {
        const start = times[0].trim().slice(0, 5);
        const end = times[1].trim().slice(0, 5);
        if (start.length === 5 && end.length === 5 && start.match(/^[\d]{2}:[\d]{2}$/) && end.match(/^[\d]{2}:[\d]{2}$/)) {
          return { startTime: start, endTime: end };
        }
      }
    }

    return null;
  };

const handleDownloadTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template Jadwal Kuliah');

    // New headers matching legacy system exactly
    worksheet.columns = [
      { header: 'Kode', key: 'Kode', width: 15 },
      { header: 'Nama Matakuliah', key: 'Nama Matakuliah', width: 35 },
      { header: 'Hari', key: 'Hari', width: 12 },
      { header: 'Jam', key: 'Jam', width: 18 }, // Format: 07:00:09:00 atau 07:00-09:00
      { header: 'Pengajar', key: 'Pengajar', width: 30 },
      { header: 'Ruang', key: 'Ruang', width: 25 },
      { header: 'Semester', key: 'Semester', width: 14 },
      { header: 'Tahun Ajaran', key: 'Tahun Ajaran', width: 16 },
      { header: 'Tanggal Mulai', key: 'Tanggal Mulai', width: 16 },
      { header: 'Tanggal Selesai', key: 'Tanggal Selesai', width: 16 },
      { header: 'Software', key: 'Software', width: 35 }
    ];

    worksheet.addRow({
      Kode: "TI401",
      'Nama Matakuliah': "Jaringan Komputer",
      Hari: "Senin",
      Jam: "07:00:09:00", // Legacy format: start:end atau start-end
      Pengajar: "John Doe, M.Kom",
      Ruang: rooms[0]?.name || "FTI 227 (exact nama ruangan dari sistem)",
      Semester: "Ganjil",
      'Tahun Ajaran': "2025/2026",
      'Tanggal Mulai': "",
      'Tanggal Selesai': "",
      Software: "Visual Studio Code, PostgreSQL"
    });

    // Add note row for guidance
    worksheet.addRow([
      'Contoh: Jam = "07:00:09:00" atau "07:00-09:00" (format legacy sistem)',
      '',
      '',
      'Pastikan nama Ruang persis sama dengan di sistem (case-sensitive)',
      '',
      '',
      'Software opsional dan hanya dipakai untuk ruangan Laboratorium Komputer; pisahkan dengan koma',
      '',
      'Tanggal boleh kosong jika konfigurasi semester aktif sudah dibuat',
      '',
      ''
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_jadwal_kuliah.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  };


  const performImport = async (
    newSchedules: any[],
    unmatchedRooms: Set<string>,
    unmatchedLecturers: Set<string>,
    unmatchedSoftware: Set<string>
  ) => {
    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const schedule of newSchedules) {
      try {
        const res = await api('/api/class-schedules', { method: 'POST', data: schedule });
        if (res.ok) {
          successCount++;
          if (schedule.academicYear && !academicYears.includes(schedule.academicYear)) {
            setAcademicYears(prev => {
              return Array.from(new Set([...prev, schedule.academicYear])).sort((a, b) => b.localeCompare(a));
            });
          }
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    await fetchSchedules();
    await fetchSemesterLabUsage();
    if (successCount > 0 && errorCount === 0) {
      showToast(`Berhasil mengimport ${successCount} jadwal kelas ke CORE Calendar.`, "success");
    } else if (successCount > 0 && errorCount > 0) {
      showToast(`Berhasil ${successCount} jadwal. Gagal ${errorCount} jadwal karena validasi atau konflik CORE Calendar.`, "warning");
    } else {
      showToast("Gagal mengimport data.", "error");
    }

    if (unmatchedRooms.size > 0) {
      setTimeout(() => {
        showToast(`Peringatan: Beberapa jadwal ditolak karena ruangan (${Array.from(unmatchedRooms).join(', ')}) tidak ditemukan di sistem.`, "warning");
      }, 500);
    }
    if (unmatchedLecturers.size > 0) {
      setTimeout(() => {
        showToast(`Peringatan: Dosen pengampu (${Array.from(unmatchedLecturers).join(', ')}) tidak ditemukan, jadwal tetap diimport tanpa relasi dosen.`, "warning");
      }, 2000);
    }
    if (unmatchedSoftware.size > 0) {
      setTimeout(() => {
        showToast(`Peringatan: Beberapa software tidak cocok atau diabaikan (${Array.from(unmatchedSoftware).join('; ')}).`, "warning");
      }, 3000);
    }
    setIsLoading(false);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
          showToast("File Excel kosong atau format salah.", "error");
          return;
        }

        const newSchedules: any[] = [];
        const unmatchedLecturers = new Set<string>();
        const unmatchedRooms = new Set<string>();
        const unmatchedSoftware = new Set<string>();
        const headers: {[key: number]: string} = {};
        let allSoftware: Software[] = [];

        try {
          const softwareRes = await api('/api/software');
          if (softwareRes.ok) {
            allSoftware = await softwareRes.json();
          }
        } catch (error) {
          console.error("Error fetching software for import:", error);
        }

        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = cell.value ? cell.value.toString() : '';
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowData: any = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
              let cellValue = cell.value;
              if (cellValue instanceof Date) {
                // ExcelJS already converts Excel dates to JS Date objects
                // But users may have DD/MM/YYYY text - handle both
                const yyyy = cellValue.getFullYear();
                const mm = String(cellValue.getMonth() + 1).padStart(2, '0');
                const dd = String(cellValue.getDate()).padStart(2, '0');
                cellValue = `${yyyy}-${mm}-${dd}`;
              } else if (typeof cellValue === 'string') {
                // Handle common DD/MM/YYYY or DD-MM-YYYY formats
                const dateMatch = cellValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                if (dateMatch) {
                  const [, day, month, year] = dateMatch;
                  const dd = day.padStart(2, '0');
                  const mm = month.padStart(2, '0');
                  cellValue = `${year}-${mm}-${dd}`;
                }
              } else if (cellValue && typeof cellValue === 'object' && 'result' in cellValue) {
                cellValue = (cellValue as any).result;
              }
              rowData[header] = cellValue ? String(cellValue).trim() : '';
            }
          });

          // Map Indonesian headers to internal fields (legacy format)
          const courseCode = rowData['Kode'] || rowData['kode'] || '';
          const courseName = rowData['Nama Matakuliah'] || rowData['nama matakuliah'] || '';
          const dayOfWeek = rowData['Hari'] || rowData['hari'] || '';
          const jam = rowData['Jam'] || rowData['jam'] || '';
          const lecturerName = rowData['Pengajar'] || rowData['pengajar'] || '';
          const roomName = rowData['Ruang'] || rowData['ruang'] || '';
          const semester = rowData['Semester'] || rowData['semester'] || '';
          const academicYear = rowData['Tahun Ajaran'] || rowData['tahun ajaran'] || '';
          const startDate = rowData['Tanggal Mulai'] || rowData['tanggal mulai'] || '';
          const endDate = rowData['Tanggal Selesai'] || rowData['tanggal selesai'] || '';
          const softwareValue = rowData['Software'] || rowData['software'] || '';

          if (courseCode && courseName) {
            // Parse Jam column
            const times = parseJamToTimes(jam);
            if (!times) {
              console.warn(`Invalid Jam format in row ${rowNumber}: "${jam}"`);
              return;
            }

            // Pencocokan otomatis nama ruangan ke ID Ruangan
            let matchedRoomId = '';

            if (roomName) {
              const searchName = String(roomName).toLowerCase().trim();
              const foundRoom = rooms.find(r => r.name.toLowerCase().trim() === searchName);
              if (foundRoom) {
                matchedRoomId = foundRoom.id;
              } else {
                unmatchedRooms.add(String(roomName).trim());
              }
            }
                        let matchedLecturerId = '';
            if (lecturerName) {
              const searchName = String(lecturerName).toLowerCase().trim();
              const foundLecturer = lecturers.find(l => l.nama.toLowerCase().trim() === searchName);
              if (foundLecturer) {
                matchedLecturerId = foundLecturer.id;
              } else {
                unmatchedLecturers.add(String(lecturerName).trim());
              }
            }
            const softwareIds = resolveImportedSoftwareIds(String(softwareValue || ''), matchedRoomId, String(roomName || ''), allSoftware, unmatchedSoftware);

            newSchedules.push({
              courseCode,
              courseName,
              classGroup: '-',
              dayOfWeek: dayOfWeek || 'Senin',
              startTime: times.startTime || '08:00',
              endTime: times.endTime || '10:00',
              semester: semester || 'Ganjil',
              academicYear: academicYear || '',
              roomId: matchedRoomId,
              lecturerId: matchedLecturerId,
              lecturerName,
              startDate,
              endDate,
              softwareIds
            });
          }
        });

        if (newSchedules.length > 0) {
          const conflicts: ConflictInfo[] = [];
          const virtualSchedules = [...schedules];

          for (const ns of newSchedules) {
            const conflict = checkConflict(ns, virtualSchedules, null); // Ignore semester/year for core conflict check
            if (conflict) {
              conflicts.push({
                newCourseName: ns.courseName,
                newCourseCode: ns.courseCode,
                existingCourseName: conflict.courseName,
                existingCourseCode: conflict.courseCode,
                dayOfWeek: ns.dayOfWeek,
                time: `${ns.startTime} - ${ns.endTime}`
              });
            }
            virtualSchedules.push(ns);
          }

          if (conflicts.length > 0) {
            setConflictModal({
              isOpen: true,
              conflicts,
              onConfirm: () => {
                setConflictModal(prev => ({ ...prev, isOpen: false }));
                // Go to bulk modal instead of direct import
                setBulkModal({
                  isOpen: true,
                  pendingSchedules: newSchedules,
                  unmatchedRooms,
                  unmatchedLecturers,
                  unmatchedSoftware
                });
              },
              onCancel: () => {
                setConflictModal(prev => ({ ...prev, isOpen: false }));
              },
              pendingSchedules: newSchedules // Pass for reference
            });
          } else {
              setBulkModal({
                isOpen: true,
                pendingSchedules: newSchedules,
                unmatchedRooms,
                unmatchedLecturers,
                unmatchedSoftware
              });
          }
        } else {
          showToast("Tidak ada data valid yang diimport.", "warning");
        }
      } catch (error) {
        console.error(error);
        showToast("Gagal memproses file Excel.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const roomOptions: SelectOption[] = rooms.map(r => ({
    value: r.id,
    label: r.name,
    subLabel: r.category
  }));

  const performSave = async () => {
    // Simpan tahun akademik baru ke state jika belum ada
    if (formData.academicYear && !academicYears.includes(formData.academicYear)) {
      const updatedYears = Array.from(new Set([...academicYears, formData.academicYear])).sort((a, b) => b.localeCompare(a));
      setAcademicYears(updatedYears);
    }

    try {
      const res = editingSchedule
        ? await api(`/api/class-schedules/${editingSchedule.id}`, { method: 'PUT', data: formData })
        : await api('/api/class-schedules', { method: 'POST', data: formData });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || 'Gagal menyimpan jadwal kelas.', res.status === 409 ? 'warning' : 'error');
        return;
      }

      showToast(
        editingSchedule
          ? 'Jadwal kelas berhasil diperbarui dan disinkronkan ke CORE Calendar.'
          : 'Jadwal kelas berhasil ditambahkan ke CORE Calendar.',
        'success'
      );
      await fetchSchedules();
      await fetchSemesterLabUsage();
      setIsModalOpen(false);
    } catch (error) {
      showToast("Gagal menyimpan jadwal kelas.", "error");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi Format Tahun Akademik
    if (!/^\d{4}\/\d{4}$/.test(formData.academicYear)) {
      showToast('Format Tahun Akademik harus YYYY/YYYY (contoh: 2024/2025).', 'warning');
      return;
    }

    // Validasi Waktu
    if (formData.endTime <= formData.startTime) {
      showToast('Jam selesai harus lebih besar dari jam mulai.', 'warning');
      return;
    }

    const configuredPeriod = findSemesterPeriod(formData.semester, formData.academicYear);
    if (formData.roomId && !configuredPeriod && (!formData.startDate || !formData.endDate)) {
      showToast('Tanggal periode wajib diisi atau buat konfigurasi semester aktif terlebih dahulu.', 'warning');
      return;
    }

    const conflict = checkConflict(formData, schedules, editingSchedule?.id);
    if (conflict) {
      setConflictModal({
        isOpen: true,
        conflicts: [{
          newCourseName: formData.courseName,
          newCourseCode: formData.courseCode,
          existingCourseName: conflict.courseName,
          existingCourseCode: conflict.courseCode,
          dayOfWeek: formData.dayOfWeek,
          time: `${formData.startTime} - ${formData.endTime}`
        }],
        onConfirm: () => { setConflictModal(prev => ({ ...prev, isOpen: false })); performSave(); },
        onCancel: () => { setConflictModal(prev => ({ ...prev, isOpen: false })); }
      });
      return;
    }

    performSave();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus jadwal kelas ini?")) {
      try {
        const res = await api(`/api/class-schedules/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          showToast(errorData.error || "Gagal menghapus jadwal kelas.", "error");
          return;
        }

        showToast("Jadwal kelas dan event CORE Calendar terkait berhasil dihapus!", "success");
        fetchSchedules();
        fetchSemesterLabUsage();
      } catch (error) {
        showToast("Gagal menghapus jadwal kelas.", "error");
      }
    }
  };

  const resetSemesterPeriodForm = () => {
    setEditingSemesterPeriod(null);
    setSemesterPeriodForm({
      semester: filterSemester || 'Ganjil',
      academicYear: filterAcademicYear || (academicYears.length > 0 ? academicYears[0] : ''),
      startDate: '',
      endDate: '',
      notes: '',
      isActive: true
    });
  };

  const handleOpenSemesterModal = () => {
    resetSemesterPeriodForm();
    setIsSemesterModalOpen(true);
  };

  const handleEditSemesterPeriod = (period: SemesterPeriod) => {
    setEditingSemesterPeriod(period);
    setSemesterPeriodForm({
      semester: period.semester,
      academicYear: period.academicYear,
      startDate: period.startDate,
      endDate: period.endDate,
      notes: period.notes || '',
      isActive: period.isActive
    });
  };

  const handleSaveSemesterPeriod = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{4}\/\d{4}$/.test(semesterPeriodForm.academicYear)) {
      showToast('Format Tahun Akademik harus YYYY/YYYY (contoh: 2025/2026).', 'warning');
      return;
    }
    if (!semesterPeriodForm.startDate || !semesterPeriodForm.endDate || semesterPeriodForm.endDate < semesterPeriodForm.startDate) {
      showToast('Tanggal periode semester tidak valid.', 'warning');
      return;
    }

    try {
      const res = editingSemesterPeriod
        ? await api(`/api/semester-periods/${editingSemesterPeriod.id}`, { method: 'PUT', data: semesterPeriodForm })
        : await api('/api/semester-periods', { method: 'POST', data: semesterPeriodForm });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || 'Gagal menyimpan konfigurasi semester.', res.status === 409 ? 'warning' : 'error');
        return;
      }

      const result = await res.json().catch(() => ({}));
      const syncText = result.schedulesUpdated ? ` ${result.schedulesUpdated} jadwal ruangan ikut diperbarui.` : '';
      showToast(`Konfigurasi semester berhasil disimpan.${syncText}`, 'success');
      await fetchSemesterPeriods();
      resetSemesterPeriodForm();
    } catch (error) {
      showToast('Gagal menyimpan konfigurasi semester.', 'error');
    }
  };

  const handleDeleteSemesterPeriod = async (period: SemesterPeriod) => {
    if (!window.confirm(`Nonaktifkan konfigurasi ${period.semester} ${period.academicYear}? Jadwal yang sudah ada tidak akan dihapus.`)) return;

    try {
      const res = await api(`/api/semester-periods/${period.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || 'Gagal menonaktifkan konfigurasi semester.', 'error');
        return;
      }
      showToast('Konfigurasi semester berhasil dinonaktifkan.', 'success');
      await fetchSemesterPeriods();
      if (editingSemesterPeriod?.id === period.id) resetSemesterPeriodForm();
    } catch (error) {
      showToast('Gagal menonaktifkan konfigurasi semester.', 'error');
    }
  };

  const toggleSoftwareSelection = (softwareId: string) => {
    setFormData(prev => {
      const selected = new Set(prev.softwareIds);
      if (selected.has(softwareId)) {
        selected.delete(softwareId);
      } else {
        selected.add(softwareId);
      }
      return { ...prev, softwareIds: Array.from(selected) };
    });
  };

  const handleBulkDelete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bulkDeleteModal.semester || !bulkDeleteModal.academicYear) {
      showToast('Semester dan Tahun Akademik harus diisi.', 'warning');
      return;
    }

    if (!window.confirm(`Yakin ingin menghapus SEMUA jadwal untuk Semester ${bulkDeleteModal.semester} Tahun Akademik ${bulkDeleteModal.academicYear}?\n\nEvent CORE Calendar terkait akan dibatalkan otomatis.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('semester', bulkDeleteModal.semester);
      params.append('academicYear', bulkDeleteModal.academicYear);

      const res = await api(`/api/class-schedules?${params.toString()}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        showToast('Semua jadwal dan event CORE Calendar terkait berhasil dihapus!', 'success');
        setBulkDeleteModal(prev => ({ ...prev, isOpen: false }));
        fetchSchedules();
        fetchSemesterLabUsage();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || 'Gagal menghapus jadwal.', 'error');
      }
    } catch (error) {
      showToast('Terjadi kesalahan saat menghapus jadwal.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Group schedules by day for display
  const groupedByDay = useMemo(() => {
    return days.reduce((acc, day) => {
      acc[day] = filteredSchedules.filter(s => s.dayOfWeek === day);
      return acc;
    }, {} as Record<string, ClassSchedule[]>);
  }, [filteredSchedules]);

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-6">
      <datalist id="academic-years-list">
        {academicYears.map(ay => (
          <option key={ay} value={ay} />
        ))}
      </datalist>

      <PageHeader
        title="Jadwal Kuliah"
        description="Kelola jadwal mata kuliah per semester"
        actionsClassName="w-full md:w-auto"
        actions={
          <div className="grid w-full grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70 sm:grid-cols-2 lg:flex lg:w-auto lg:items-center">
            {canManage && (
              <Button onClick={handleOpenSemesterModal} variant="secondary" size="sm" className="justify-center">
                <Calendar className="w-4 h-4 mr-2" /> Periode
              </Button>
            )}
            <Button onClick={handleDownloadTemplate} variant="secondary" size="sm" className="justify-center">
              <Download className="w-4 h-4 mr-2" /> Template
            </Button>
            <label className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'cursor-pointer flex items-center justify-center')}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Import
              <input type="file" accept=".xlsx" className="hidden" onChange={handleExcelUpload} />
            </label>
            {canManage && (
              <Button
                onClick={() => setBulkDeleteModal({
                  isOpen: true,
                  semester: filterSemester || 'Ganjil',
                  academicYear: filterAcademicYear || (academicYears.length > 0 ? academicYears[0] : '')
                })}
                variant="destructive"
                size="sm"
                className="justify-center"
              >
                <Trash className="w-4 h-4 mr-2" /> Hapus Semua
              </Button>
            )}
            <Button onClick={() => handleOpenModal()} variant="primary" size="sm" className="justify-center">
              <Plus className="w-4 h-4 mr-2" /> Tambah Jadwal
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <PageCard className="print:hidden" padding="md">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Cari kode/nama matakuliah..."
              className="w-full"
            />
            <SearchBar
              value={filterLecturer}
              onChange={setFilterLecturer}
              placeholder="Cari nama dosen..."
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
            <button
              type="button"
              onClick={fetchSchedules}
              disabled={isLoading}
              className="flex h-11 w-full lg:w-11 items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            </button>

            <div className="relative w-full lg:w-40">
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-300"
              >
                <option value="All">Semua Ruangan</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            <div className="relative w-full lg:w-40">
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-300"
              >
                <option value="">Semua Semester</option>
                {semesters.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            <div className="relative w-full lg:w-40 col-span-2 sm:col-span-1">
              <select
                value={filterAcademicYear}
                onChange={(e) => setFilterAcademicYear(e.target.value)}
                className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-300"
              >
                <option value="">Semua Tahun</option>
                {academicYears.map(ay => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            <div className="relative w-full lg:w-40 col-span-2 sm:col-span-1">
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-300"
              >
                <option value="All">Semua Hari</option>
                {days.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>
      </PageCard>

      {filterSemester && filterAcademicYear && (
        <PageCard padding="md">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pemakaian Software Laboratorium</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {filterSemester} {filterAcademicYear} - {semesterLabUsage.length} jadwal di Laboratorium Komputer
              </p>
            </div>
          </div>
          {semesterLabUsage.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-2 py-2">Matakuliah</th>
                    <th className="px-2 py-2">Ruang</th>
                    <th className="px-2 py-2">Waktu</th>
                    <th className="px-2 py-2">Software</th>
                  </tr>
                </thead>
                <tbody>
                  {semesterLabUsage.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-2 py-2">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.courseCode}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{item.courseName}</div>
                      </td>
                      <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{item.roomName || '-'}</td>
                      <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{item.dayOfWeek}, {item.startTime} - {item.endTime}</td>
                      <td className="px-2 py-2">
                        {item.software?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {item.software.map(software => (
                              <span key={software.id} className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                                {software.name}{software.version ? ` ${software.version}` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Belum ditentukan</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada jadwal lab komputer pada semester dan tahun ajaran ini.</p>
          )}
        </PageCard>
      )}

      {/* Schedule Cards by Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {days.map(day => {
          const daySchedules = groupedByDay[day] || [];
          if (filterDay !== 'All' && filterDay !== day) return null;

          return (
            <div key={day} className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col min-h-64">
              <div className="bg-slate-100/80 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" weight="duotone" />
                  {day}
                </h3>
                <span className="rounded-full bg-sky-100 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-900/60 px-2 py-0.5 text-xs font-bold text-sky-800 dark:text-sky-300">
                  {daySchedules.length} MK
                </span>
              </div>
              <div className="p-3.5 space-y-3 overflow-y-auto max-h-120 flex-1">
                {daySchedules.length > 0 ? daySchedules.map(schedule => (
                  <div
                    key={schedule.id}
                    className="group/card bg-white dark:bg-slate-900 rounded-lg p-3.5 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-md transition-all duration-200 relative overflow-hidden"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-transparent group-hover/card:bg-sky-500 transition-colors" />

                    <div className="flex justify-between items-start mb-2">
                      <span className="inline-flex rounded-md border border-sky-100 bg-sky-50 dark:border-sky-950/50 dark:bg-sky-950/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400">
                        {schedule.courseCode}
                      </span>
                      {canManage && (
                        <div className="flex items-center gap-1 opacity-60 group-hover/card:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(schedule)}
                            className="p-1 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(schedule.id)}
                            className="p-1 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="Hapus"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="font-bold text-sm text-slate-950 dark:text-white mb-2 line-clamp-2 leading-snug">
                      {schedule.courseName}
                    </p>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" weight="duotone" />
                        <span className="font-medium text-slate-800 dark:text-slate-300">{schedule.startTime} - {schedule.endTime}</span>
                      </div>
                      {schedule.roomName && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" weight="duotone" />
                          <span className="truncate">{schedule.roomName}</span>
                        </div>
                      )}
                      {schedule.lecturerName && (
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-400" weight="duotone" />
                          <span className="truncate">{schedule.lecturerName}</span>
                        </div>
                      )}
                      {schedule.software && schedule.software.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {schedule.software.slice(0, 4).map(software => (
                            <span key={software.id} className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                              {software.name}{software.version ? ` ${software.version}` : ''}
                            </span>
                          ))}
                          {schedule.software.length > 4 && (
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              +{schedule.software.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" weight="duotone" />
                    <p className="text-sm">Tidak ada jadwal</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isSemesterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
              <h3 className="font-bold text-gray-900 dark:text-white">Konfigurasi Periode Semester</h3>
              <button onClick={() => setIsSemesterModalOpen(false)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1fr_1.2fr]">
              <form onSubmit={handleSaveSemesterPeriod} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
                    <Select value={semesterPeriodForm.semester} onValueChange={val => setSemesterPeriodForm(prev => ({ ...prev, semester: val }))} items={semesterFormItems}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {semesters.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tahun Akademik</label>
                    <Input
                      type="text"
                      required
                      value={semesterPeriodForm.academicYear}
                      onChange={e => setSemesterPeriodForm(prev => ({ ...prev, academicYear: e.target.value }))}
                      placeholder="2025/2026"
                      pattern="\d{4}/\d{4}"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Mulai</label>
                    <Input
                      type="date"
                      required
                      value={semesterPeriodForm.startDate}
                      onChange={e => setSemesterPeriodForm(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Selesai</label>
                    <Input
                      type="date"
                      required
                      value={semesterPeriodForm.endDate}
                      onChange={e => setSemesterPeriodForm(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Catatan</label>
                  <Input
                    type="text"
                    value={semesterPeriodForm.notes}
                    onChange={e => setSemesterPeriodForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Opsional"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={semesterPeriodForm.isActive}
                    onChange={e => setSemesterPeriodForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Aktif
                </label>
                <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  {editingSemesterPeriod && (
                    <Button type="button" variant="secondary" onClick={resetSemesterPeriodForm}>Baru</Button>
                  )}
                  <Button type="submit" variant="primary">
                    <Check className="mr-2 h-4 w-4" /> Simpan
                  </Button>
                </div>
              </form>

              <div className="min-h-0 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Semester</th>
                      <th className="px-3 py-2">Periode</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {semesterPeriods.length > 0 ? semesterPeriods.map(period => (
                      <tr key={period.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900 dark:text-white">{period.semester}</div>
                          <div className="text-xs text-slate-500">{period.academicYear}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                          {period.startDate} - {period.endDate}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'rounded-md px-2 py-1 text-xs font-semibold',
                            period.isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          )}>
                            {period.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => handleEditSemesterPeriod(period)} className="mr-2 text-sky-600 hover:text-sky-800 dark:text-sky-400">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => handleDeleteSemesterPeriod(period)} title="Nonaktifkan" className="text-red-600 hover:text-red-800 dark:text-red-400">
                            <Trash className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                          Belum ada konfigurasi semester.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-full sm:max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up max-h-[90vh] flex flex-col">
              <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 shrink-0">
                 <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                    {editingSchedule ? 'Edit Jadwal Kuliah' : 'Tambah Jadwal Kuliah'}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <form onSubmit={handleSave} className="p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                 <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode Matakuliah</label>
                     <Input
                         type="text" required
                         value={formData.courseCode}
                         onChange={e => setFormData({...formData, courseCode: e.target.value.toUpperCase()})}
                         className="font-mono"
                         placeholder="Contoh: DC502"
                     />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Matakuliah</label>
                    <Input
                        type="text" required
                        value={formData.courseName}
                        onChange={e => setFormData({...formData, courseName: e.target.value})}
                        placeholder="Jaringan Komputer"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruangan</label>
                    <SearchableSelect
                        options={roomOptions}
                        value={formData.roomId}
                        onChange={val => setFormData(prev => ({...prev, roomId: val, softwareIds: []}))}
                        placeholder="-- Pilih Ruangan --"
                        searchPlaceholder="Cari ruangan..."
                    />
                 </div>

                 {isSelectedRoomComputerLab && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Software yang Digunakan</label>
                     {roomSoftware.length > 0 ? (
                       <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2">
                         {roomSoftware.map(software => (
                           <label key={software.id} className="flex cursor-pointer items-start gap-2 rounded-md bg-white p-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:ring-emerald-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                             <input
                               type="checkbox"
                               checked={formData.softwareIds.includes(software.id)}
                               onChange={() => toggleSoftwareSelection(software.id)}
                               className="mt-1"
                             />
                             <span className="min-w-0">
                               <span className="block truncate font-semibold">{software.name}</span>
                               <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                 {[software.version, software.category].filter(Boolean).join(' - ') || 'Software lab'}
                               </span>
                             </span>
                           </label>
                         ))}
                       </div>
                     ) : (
                       <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                         Belum ada data software untuk laboratorium ini.
                       </p>
                     )}
                   </div>
                 )}

                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari</label>
                        <Select value={formData.dayOfWeek || ''} onValueChange={val => setFormData({...formData, dayOfWeek: val})} items={dayFormItems}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih Hari" />
                          </SelectTrigger>
                          <SelectContent>
                            {days.map(d => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>
                        <Input
                            type="time" required
                            value={formData.startTime}
                            onChange={e => setFormData({...formData, startTime: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>
                        <Input
                            type="time" required
                            value={formData.endTime}
                            onChange={e => setFormData({...formData, endTime: e.target.value})}
                        />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                        <Select value={formData.semester || ''} onValueChange={val => setFormDataWithPeriod({ semester: val })} items={semesterFormItems}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih Semester" />
                          </SelectTrigger>
                          <SelectContent>
                            {semesters.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tahun Akademik</label>
                     <Input
                         type="text"
                         list="academic-years-list"
                         required
                         value={formData.academicYear}
                         onChange={e => setFormDataWithPeriod({ academicYear: e.target.value })}
                         pattern="\d{4}/\d{4}"
                         title="Format harus YYYY/YYYY (contoh: 2024/2025)"
                         placeholder="Contoh: 2024/2025"
                     />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Mulai Periode</label>
                        <Input
                            type="date"
                            required={!!formData.roomId && !findSemesterPeriod(formData.semester, formData.academicYear)}
                            value={formData.startDate}
                            onChange={e => setFormData({...formData, startDate: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Selesai Periode</label>
                        <Input
                            type="date"
                            required={!!formData.roomId && !findSemesterPeriod(formData.semester, formData.academicYear)}
                            value={formData.endDate}
                            onChange={e => setFormData({...formData, endDate: e.target.value})}
                        />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dosen Pengampu <span className="text-xs font-normal text-gray-400">(Opsional)</span></label>
                    <SearchableSelect
                        options={lecturerOptions}
                        value={formData.lecturerId || ''}
                        onChange={val => {
                          const lecturer = lecturers.find(l => l.id === val);
                          setFormData({...formData, lecturerId: val, lecturerName: lecturer ? lecturer.nama : ''});
                        }}
                        placeholder="-- Pilih Dosen --"
                        searchPlaceholder="Cari nama atau kode dosen..."
                    />
                 </div>

                 <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                    <Button type="button" onClick={() => setIsModalOpen(false)} variant="secondary">Batal</Button>
                    <Button type="submit" variant="primary">
                       <Check className="w-4 h-4 mr-2" /> Simpan
                    </Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {bulkModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white">Lengkapi Data Import</h3>
              <button onClick={() => setBulkModal(prev => ({ ...prev, isOpen: false }))} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();

              if (!/^\d{4}\/\d{4}$/.test(bulkFormData.academicYear)) {
                showToast('Format Tahun Akademik Default harus YYYY/YYYY (contoh: 2024/2025).', 'warning');
                return;
              }

              const finalSchedules = bulkModal.pendingSchedules.map(s => ({
                ...s,
                semester: s.semester || bulkFormData.semester,
                academicYear: s.academicYear || bulkFormData.academicYear,
                startDate: s.startDate || bulkFormData.startDate,
                endDate: s.endDate || bulkFormData.endDate
              }));
              setBulkModal(prev => ({ ...prev, isOpen: false }));
              performImport(finalSchedules, bulkModal.unmatchedRooms, bulkModal.unmatchedLecturers, bulkModal.unmatchedSoftware);
            }} className="p-6 space-y-4">
              {bulkModal.unmatchedRooms.size > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium">Beberapa ruangan tidak ditemukan:</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">{Array.from(bulkModal.unmatchedRooms).join(', ')}</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">Jadwal ini akan tetap diimport tanpa ruangan.</p>
                </div>
              )}
              {bulkModal.unmatchedLecturers.size > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium">Beberapa dosen tidak ditemukan di sistem:</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">{Array.from(bulkModal.unmatchedLecturers).join(', ')}</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">Jadwal akan tetap diimport tanpa relasi data dosen.</p>
                </div>
              )}
              {bulkModal.unmatchedSoftware.size > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium">Beberapa software tidak cocok atau diabaikan:</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">{Array.from(bulkModal.unmatchedSoftware).join('; ')}</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">Import tetap bisa dilanjutkan; software bersifat opsional.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester Default</label>
                  <Select value={bulkFormData.semester} onValueChange={(val: any) => setBulkFormDataWithPeriod({ semester: val })} items={semesterFormItems}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {semesters.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tahun Akademik Default</label>
                  <Input
                      type="text"
                      list="academic-years-list"
                      required
                      value={bulkFormData.academicYear}
                      onChange={e => setBulkFormDataWithPeriod({ academicYear: e.target.value })}
                      pattern="\d{4}/\d{4}"
                      title="Format harus YYYY/YYYY (contoh: 2024/2025)"
                      placeholder="Contoh: 2024/2025"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Mulai Periode Default</label>
                  <Input
                      type="date" required
                      value={bulkFormData.startDate}
                      onChange={e => setBulkFormData({...bulkFormData, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Selesai Periode Default</label>
                  <Input
                      type="date" required
                      value={bulkFormData.endDate}
                      onChange={e => setBulkFormData({...bulkFormData, endDate: e.target.value})}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 italic mt-2">
                *Nilai default ini hanya digunakan jika kolom di Excel kosong.
              </p>
              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 mt-4">
                <Button type="button" onClick={() => setBulkModal(prev => ({ ...prev, isOpen: false }))} variant="secondary">Batal</Button>
                <Button type="submit" variant="primary">
                  Import {bulkModal.pendingSchedules.length} Jadwal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {conflictModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
              <h3 className="font-bold text-yellow-800 dark:text-yellow-400 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" /> Konflik Jadwal Terdeteksi
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Ditemukan {conflictModal.conflicts.length} jadwal yang berbenturan waktu dan ruangan:
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {conflictModal.conflicts.map((c, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 text-sm">
                    <p className="font-medium text-gray-900 dark:text-white mb-1"><span className="text-blue-600 dark:text-blue-400">{c.newCourseCode}</span> {c.newCourseName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Bentrok dengan: <span className="font-medium text-red-500">{c.existingCourseCode} {c.existingCourseName}</span></p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Waktu: {c.dayOfWeek}, {c.time}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 pt-2">Apakah Anda ingin tetap menyimpan jadwal ini?</p>
              <div className="flex justify-end gap-3 pt-2">
                <Button onClick={conflictModal.onCancel} variant="secondary">Batal</Button>
                <Button onClick={conflictModal.onConfirm} variant="primary">Ya, Lanjutkan</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 flex justify-between items-center">
              <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center">
                <Trash className="w-5 h-5 mr-2" /> Hapus Jadwal Massal
              </h3>
              <button onClick={() => setBulkDeleteModal(prev => ({ ...prev, isOpen: false }))} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBulkDelete} className="p-6 space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 text-sm text-yellow-800 dark:text-yellow-400">
                <p className="font-bold mb-1">Perhatian</p>
                <p className="text-yellow-700 dark:text-yellow-500">Tindakan ini akan menghapus permanen <b>seluruh</b> data jadwal kelas di database pada semester dan tahun akademik yang dipilih.</p>
                <p className="mt-2 text-xs italic text-yellow-700 dark:text-yellow-500">Event CORE Calendar terkait akan dibatalkan otomatis. Google Calendar legacy tidak disentuh.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                <Select value={bulkDeleteModal.semester || ''} onValueChange={val => setBulkDeleteModal({...bulkDeleteModal, semester: val})} items={semesterFormItems}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {semesters.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tahun Akademik</label>
                <Select value={bulkDeleteModal.academicYear || ''} onValueChange={val => setBulkDeleteModal({...bulkDeleteModal, academicYear: val})} items={academicYearFormItems}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Pilih Tahun --" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map(ay => (
                      <SelectItem key={ay} value={ay}>{ay}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 mt-4">
                <Button type="button" onClick={() => setBulkDeleteModal(prev => ({ ...prev, isOpen: false }))} variant="secondary">Batal</Button>
                <Button type="submit" disabled={isLoading} variant="destructive">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash className="w-4 h-4 mr-2" />} Hapus Semua
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JadwalKuliah;
