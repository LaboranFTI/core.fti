import React, { useState, useEffect, useMemo } from 'react';
import { Role, Room } from '../types';
import { Search, Plus, Filter, Edit, Trash2, X, Check, RefreshCw, Loader2, Users, BookOpen, Calendar, Clock, MapPin, Download, FileSpreadsheet, AlertTriangle, LogIn, LogOut } from 'lucide-react';
import { api } from '../services/api';
import { TableSkeleton } from '../components/Skeleton';
import SearchableSelect, { SelectOption } from '../components/SearchableSelect';
import SearchBar from '../components/SearchBar';
import { useLecturers } from '../hooks/useLecturers';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

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
  lecturerId?: string;
  lecturerName: string;
  startDate: string;
  endDate: string;
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
    endDate: ''    // Tanggal selesai periode semester
  });

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
  }>({ isOpen: false, pendingSchedules: [], unmatchedRooms: new Set(), unmatchedLecturers: new Set() });

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

  // Google Calendar API
  const googleApi = useGoogleCalendar(role, showToast);

  const canManage = role.toString().toUpperCase() === 'ADMIN' || 
                    role.toString().toUpperCase() === 'LABORAN' || 
                    role.toString().toUpperCase() === 'SUPERVISOR';

  const getCalendarId = (input: string) => {
    if (!input) return null;
    if (!input.startsWith('http')) return input;
    try { return new URL(input).searchParams.get('src') || null; } catch (e) { return null; }
  };

  // Days options
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  
  // Semester options
  const semesters = ['Ganjil', 'Antara', 'Genap'];
  
  // Academic years
  const [academicYears, setAcademicYears] = useState<string[]>([]);

  const { lecturers } = useLecturers();
  const lecturerOptions: SelectOption[] = lecturers.map(l => ({
    value: l.id,
    label: l.nama,
    subLabel: l.id
  }));


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

  useEffect(() => {
    fetchSchedules();
  }, [filterSemester, filterAcademicYear]);

  useEffect(() => {
    fetchRooms();
  }, []);

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
      setFormData({
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
        endDate: schedule.endDate || ''
      });
    } else {
      setEditingSchedule(null);
      setFormData({
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
        endDate: ''
      });
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
      { header: 'Ruang', key: 'Ruang', width: 25 }
    ];

    worksheet.addRow({
      Kode: "TI401",
      'Nama Matakuliah': "Jaringan Komputer", 
      Hari: "Senin",
      Jam: "07:00:09:00", // Legacy format: start:end atau start-end
      Pengajar: "John Doe, M.Kom",
      Ruang: rooms[0]?.name || "FTI 227 (exact nama ruangan dari sistem)"
    });

    // Add note row for guidance
    worksheet.addRow([
      'Contoh: Jam = "07:00:09:00" atau "07:00-09:00" (format legacy sistem)',
      '',
      '',
      'Pastikan nama Ruang persis sama dengan di sistem (case-sensitive)',
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


  const performImport = async (newSchedules: any[], unmatchedRooms: Set<string>, unmatchedLecturers: Set<string>) => {
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
          const room = rooms.find(r => r.id === schedule.roomId);
          if (room && room.googleCalendarUrl && schedule.startDate && schedule.endDate) {
            const calendarId = getCalendarId(room.googleCalendarUrl);
            if (calendarId && googleApi.isGapiInitialized && googleApi.isAuthenticated) {
              const dayMap: Record<string, number> = { 'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
              const targetDay = dayMap[schedule.dayOfWeek] ?? 1;
              const semesterStart = new Date(schedule.startDate);
              let distance = targetDay - semesterStart.getDay();
              if (distance < 0) distance += 7;
              const firstClassDate = new Date(semesterStart);
              firstClassDate.setDate(semesterStart.getDate() + distance);
              const dateStr = firstClassDate.toISOString().split('T')[0];
              const startDateTime = new Date(`${dateStr}T${schedule.startTime}:00`);
              const endDateTime = new Date(`${dateStr}T${schedule.endTime}:00`);
              const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              const semesterEnd = new Date(schedule.endDate);
              semesterEnd.setUTCHours(23, 59, 59, 999);
              const untilStr = semesterEnd.toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';
              const eventResource = { summary: `${schedule.courseCode} ${schedule.courseName}-${schedule.lecturerName || ''}`, location: room.name, description: `Mata Kuliah: ${schedule.courseName}\nKode: ${schedule.courseCode}\nDosen: ${schedule.lecturerName || '-'}\nSemester: ${schedule.semester} ${schedule.academicYear}\n\nDiinput via CORE.FTI`, start: { dateTime: startDateTime.toISOString(), timeZone: userTimeZone }, end: { dateTime: endDateTime.toISOString(), timeZone: userTimeZone }, recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`] };
              await googleApi.createEvent(calendarId, eventResource);
            }
          }
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    await fetchSchedules();
    if (successCount > 0 && errorCount === 0) {
      showToast(`Berhasil mengimport ${successCount} jadwal kelas.`, "success");
    } else if (successCount > 0 && errorCount > 0) {
      showToast(`Berhasil ${successCount} jadwal. Gagal ${errorCount} jadwal.`, "warning");
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
              endDate
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
                  unmatchedLecturers
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
                unmatchedLecturers
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
      if (editingSchedule) {
        // Update
        const res = await api(`/api/class-schedules/${editingSchedule.id}`, {
          method: 'PUT',
          data: formData
        });
        if (res.ok) {
          showToast("Jadwal kelas berhasil diperbarui!", "success");
          fetchSchedules();
          
          // Update integrasi Google Calendar
          if (!googleApi.isGapiInitialized) {
            showToast('Google API belum siap, jadwal tersimpan namun sinkronisasi Calendar gagal.', 'warning');
          } else if (!googleApi.isAuthenticated) {
            googleApi.login();
            showToast('Mohon login ke Google untuk mensinkronkan perubahan ini ke Calendar.', 'info');
          } else {
            if (!formData.startDate || !formData.endDate) {
              showToast('Tanggal periode mulai & selesai wajib diisi untuk sinkronisasi Calendar!', 'warning');
            } else {
              // 1. Hapus event lama dari ruangan lama
              const oldRoom = rooms.find(r => r.id === editingSchedule.roomId);
              if (oldRoom && oldRoom.googleCalendarUrl) {
                const oldCalendarId = getCalendarId(oldRoom.googleCalendarUrl);
                if (oldCalendarId) {
                  try {
                    const q = `${editingSchedule.courseCode} ${editingSchedule.courseName}-${editingSchedule.lecturerName || ''}`;
                    const response = await window.gapi.client.calendar.events.list({ calendarId: oldCalendarId, q });
                    if (response.result.items && response.result.items.length > 0) {
                      await googleApi.deleteEvent(oldCalendarId, response.result.items[0].id);
                    }
                  } catch (e) {
                    console.error("Gagal hapus event lama di Google Calendar", e);
                  }
                }
              }

              // 2. Buat event baru di ruangan baru (atau ruangan yang sama tapi jam/hari berubah)
              const newRoom = rooms.find(r => r.id === formData.roomId);
              if (newRoom && newRoom.googleCalendarUrl) {
                const newCalendarId = getCalendarId(newRoom.googleCalendarUrl);
                if (newCalendarId) {
                  try {
                    const dayMap: Record<string, number> = { 'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
                    const targetDay = dayMap[formData.dayOfWeek] ?? 1;
                    const semesterStart = new Date(formData.startDate);
                    let distance = targetDay - semesterStart.getDay();
                    if (distance < 0) distance += 7;
                    const firstClassDate = new Date(semesterStart);
                    firstClassDate.setDate(semesterStart.getDate() + distance);
                    const dateStr = firstClassDate.toISOString().split('T')[0];
                    const startDateTime = new Date(`${dateStr}T${formData.startTime}:00`);
                    const endDateTime = new Date(`${dateStr}T${formData.endTime}:00`);
                    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    
                    const semesterEnd = new Date(formData.endDate);
                    semesterEnd.setUTCHours(23, 59, 59, 999);
                    const untilStr = semesterEnd.toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';

                    const eventResource = { summary: `${formData.courseCode} ${formData.courseName}-${formData.lecturerName || ''}`, location: newRoom.name, description: `Mata Kuliah: ${formData.courseName}\nKode: ${formData.courseCode}\nDosen: ${formData.lecturerName || '-'}\nSemester: ${formData.semester} ${formData.academicYear}\n\nDiinput via CORE.FTI`, start: { dateTime: startDateTime.toISOString(), timeZone: userTimeZone }, end: { dateTime: endDateTime.toISOString(), timeZone: userTimeZone }, recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`] };
                    await googleApi.createEvent(newCalendarId, eventResource);
                    showToast('Jadwal di Google Calendar telah disinkronkan.', 'info');
                  } catch (e) {
                    console.error("Gagal buat event baru di Google Calendar", e);
                    showToast('Gagal membuat jadwal di Google Calendar ruangan.', 'error');
                  }
                }
              }
            }
          }
        }
      } else {
        // Create
        const res = await api('/api/class-schedules', {
          method: 'POST',
          data: formData
        });
        if (res.ok) {
          showToast("Jadwal kelas berhasil ditambahkan!", "success");
          fetchSchedules();
          
          // Tambah ke Google Calendar
          const room = rooms.find(r => r.id === formData.roomId);
          if (room && room.googleCalendarUrl) {
            if (!formData.startDate || !formData.endDate) {
              showToast('Tanggal periode mulai & selesai wajib diisi untuk sinkronisasi Calendar!', 'warning');
            } else {
              const calendarId = getCalendarId(room.googleCalendarUrl);
              if (calendarId) {
                if (!googleApi.isGapiInitialized) {
                  showToast('Google API belum siap, gagal sinkronisasi ke Calendar.', 'warning');
                } else if (!googleApi.isAuthenticated) {
                  googleApi.login();
                  showToast('Mohon login ke Google untuk sinkronisasi Calendar.', 'info');
                } else {
                  const dayMap: Record<string, number> = { 'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
                  const targetDay = dayMap[formData.dayOfWeek] ?? 1;
                  const semesterStart = new Date(formData.startDate);
                  let distance = targetDay - semesterStart.getDay();
                  if (distance < 0) distance += 7;
                  const firstClassDate = new Date(semesterStart);
                  firstClassDate.setDate(semesterStart.getDate() + distance);
                  const dateStr = firstClassDate.toISOString().split('T')[0];
                  const startDateTime = new Date(`${dateStr}T${formData.startTime}:00`);
                  const endDateTime = new Date(`${dateStr}T${formData.endTime}:00`);
                  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                  const semesterEnd = new Date(formData.endDate);
                  semesterEnd.setUTCHours(23, 59, 59, 999);
                  const untilStr = semesterEnd.toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';
                  const eventResource = { summary: `${formData.courseCode} ${formData.courseName}-${formData.lecturerName || ''}`, location: room.name, description: `Mata Kuliah: ${formData.courseName}\nKode: ${formData.courseCode}\nDosen: ${formData.lecturerName || '-'}\nSemester: ${formData.semester} ${formData.academicYear}\n\nDiinput via CORE.FTI`, start: { dateTime: startDateTime.toISOString(), timeZone: userTimeZone }, end: { dateTime: endDateTime.toISOString(), timeZone: userTimeZone }, recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`] };
                  const success = await googleApi.createEvent(calendarId, eventResource);
                  if (success) showToast('Berhasil disinkronkan ke Google Calendar ruangan!', 'success');
                }
              }
            }
          }
        }
      }
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
    const scheduleToDelete = schedules.find(s => s.id === id);
    if (window.confirm("Apakah Anda yakin ingin menghapus jadwal kelas ini?")) {
      try {
        await api(`/api/class-schedules/${id}`, { method: 'DELETE' });
        showToast("Jadwal kelas berhasil dihapus!", "success");
        fetchSchedules();
        
        // Hapus dari Google Calendar
        if (scheduleToDelete) {
          const room = rooms.find(r => r.id === scheduleToDelete.roomId);
          if (room && room.googleCalendarUrl && googleApi.isGapiInitialized && googleApi.isAuthenticated) {
            const calendarId = getCalendarId(room.googleCalendarUrl);
            if (calendarId) {
              try {
                const q = `${scheduleToDelete.courseCode} ${scheduleToDelete.courseName}-${scheduleToDelete.lecturerName || ''}`;
                const response = await window.gapi.client.calendar.events.list({ calendarId, q });
                const events = response.result.items;
                if (events && events.length > 0) {
                  await googleApi.deleteEvent(calendarId, events[0].id);
                  showToast('Jadwal terkait di Google Calendar juga telah dihapus.', 'info');
                }
              } catch (e) {
                console.error("Gagal hapus dari Google Calendar", e);
                showToast('Gagal menghapus jadwal dari Google Calendar.', 'error');
              }
            }
          }
        }
      } catch (error) {
        showToast("Gagal menghapus jadwal kelas.", "error");
      }
    }
  };

  const handleBulkDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check Google admin auth
    if (!googleApi.isAuthenticated) {
      googleApi.login();
      showToast('Login akun Google admin terlebih dahulu untuk melakukan hapus semua jadwal.', 'warning');
      return;
    }
    
    if (!bulkDeleteModal.semester || !bulkDeleteModal.academicYear) {
      showToast('Semester dan Tahun Akademik harus diisi.', 'warning');
      return;
    }

    if (!window.confirm(`Yakin ingin menghapus SEMUA jadwal untuk Semester ${bulkDeleteModal.semester} Tahun Akademik ${bulkDeleteModal.academicYear}?

⚠️  Pastikan sudah login akun Google admin!`)) {
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
        showToast('Semua jadwal berhasil dihapus!', 'success');
        setBulkDeleteModal(prev => ({ ...prev, isOpen: false }));
        fetchSchedules();
      } else {
        showToast('Gagal menghapus jadwal.', 'error');
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jadwal Kuliah</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Kelola jadwal mata kuliah per semester</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && googleApi.isGapiInitialized && !googleApi.isAuthenticated && (
            <button onClick={() => googleApi.login()} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm">
              <LogIn className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Login Google</span>
            </button>
          )}
          {canManage && googleApi.isAuthenticated && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow-sm">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300 max-w-37.5 truncate">
                {googleApi.googleUserEmail || "Terhubung"}
              </span>
              <button onClick={() => googleApi.logout()} className="p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors" title="Logout Google Calendar">
                <LogOut className="w-4 h-4 text-green-600 dark:text-green-400" />
              </button>
            </div>
          )}
          <Button onClick={handleDownloadTemplate} variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-2" /> Template
          </Button>
          <label className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'cursor-pointer')}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Import
            <input type="file" accept=".xlsx" className="hidden" onChange={handleExcelUpload} />
          </label>
{canManage && (
            <button 
              onClick={() => setBulkDeleteModal({ isOpen: true, semester: filterSemester || 'Ganjil', academicYear: filterAcademicYear || (academicYears.length > 0 ? academicYears[0] : '') })} 
              disabled={!googleApi.isAuthenticated}
              className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }), 'disabled:hover:scale-100')}
              title={!googleApi.isAuthenticated ? "Login Google admin terlebih dahulu" : ""}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Hapus Semua
            </button>
          )}
          <Button onClick={() => handleOpenModal()} variant="primary" size="sm">
             <Plus className="w-4 h-4 mr-2" /> Tambah Jadwal
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
         <SearchBar 
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Cari kode/nama matakuliah..."
         />
         <SearchBar 
            value={filterLecturer}
            onChange={setFilterLecturer}
            placeholder="Cari nama dosen..."
         />
         <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
             <button 
                onClick={fetchSchedules} 
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh Data"
             >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
             </button>
             
             <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Ruangan:</span>
                <select 
                    value={filterRoom}
                    onChange={(e) => setFilterRoom(e.target.value)}
                    className="px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer w-24 sm:w-auto"
                >
                    <option value="All">Semua</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
             </div>
             
             <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Semester:</span>
                <select 
                    value={filterSemester}
                    onChange={(e) => setFilterSemester(e.target.value)}
                    className="px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                    <option value="">Semua Semester</option>
                    {semesters.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                </select>
             </div>
             
             <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Thn Akademik:</span>
                <select 
                    value={filterAcademicYear}
                    onChange={(e) => setFilterAcademicYear(e.target.value)}
                    className="px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                    <option value="">Semua Tahun</option>
                    {academicYears.map(ay => (
                      <option key={ay} value={ay}>{ay}</option>
                    ))}
                </select>
             </div>
             
             <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Hari:</span>
                <select 
                    value={filterDay}
                    onChange={(e) => setFilterDay(e.target.value)}
                    className="px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                    <option value="All">Semua Hari</option>
                    {days.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                </select>
             </div>
         </div>
      </div>

      {/* Schedule Cards by Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {days.map(day => {
          const daySchedules = groupedByDay[day] || [];
          if (filterDay !== 'All' && filterDay !== day) return null;
          
          return (
            <div key={day} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-blue-600 dark:bg-blue-700 px-4 py-3">
                <h3 className="font-bold text-white">{day}</h3>
                <p className="text-blue-100 text-xs">{daySchedules.length} matakuliah</p>
              </div>
              <div className="p-2 space-y-2 max-h-100 overflow-y-auto">
                {daySchedules.length > 0 ? daySchedules.map(schedule => (
                  <div key={schedule.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 hover:shadow-md hover:bg-blue-50 dark:hover:bg-gray-600 transition-all duration-200 border border-transparent hover:border-blue-200 dark:hover:border-gray-500">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{schedule.courseCode}</span>
                      </div>
                      <div className="flex space-x-1">
                        <button onClick={() => handleOpenModal(schedule)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-blue-600 dark:text-blue-400')}>
                          <Edit className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(schedule.id)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-red-600 dark:text-red-400')}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1 line-clamp-2">{schedule.courseName}</p>
                    <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {schedule.startTime} - {schedule.endTime}
                      </div>
                      {schedule.roomName && (
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1" />
                          {schedule.roomName}
                        </div>
                      )}
                      {schedule.lecturerName && (
                        <div className="flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {schedule.lecturerName}
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Tidak ada jadwal</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
                     <input 
                         type="text" required 
                         value={formData.courseCode} 
                         onChange={e => setFormData({...formData, courseCode: e.target.value.toUpperCase()})}
                         className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                         placeholder="Contoh: DC502"
                     />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Matakuliah</label>
                    <input 
                        type="text" required 
                        value={formData.courseName} 
                        onChange={e => setFormData({...formData, courseName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Jaringan Komputer"
                    />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruangan</label>
                    <SearchableSelect
                        options={roomOptions}
                        value={formData.roomId}
                        onChange={val => setFormData({...formData, roomId: val})}
                        placeholder="-- Pilih Ruangan --"
                        searchPlaceholder="Cari ruangan..."
                    />
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari</label>
                        <select 
                            value={formData.dayOfWeek}
                            onChange={e => setFormData({...formData, dayOfWeek: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                            {days.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>
                        <input 
                            type="time" required 
                            value={formData.startTime} 
                            onChange={e => setFormData({...formData, startTime: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>
                        <input 
                            type="time" required 
                            value={formData.endTime} 
                            onChange={e => setFormData({...formData, endTime: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                        <select 
                            value={formData.semester}
                            onChange={e => setFormData({...formData, semester: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                            {semesters.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tahun Akademik</label>
                     <input 
                         type="text"
                         list="academic-years-list"
                         required 
                         value={formData.academicYear}
                         onChange={e => setFormData({...formData, academicYear: e.target.value})}
                         pattern="\d{4}/\d{4}"
                         title="Format harus YYYY/YYYY (contoh: 2024/2025)"
                         className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                         placeholder="Contoh: 2024/2025"
                     />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Mulai Periode</label>
                        <input 
                            type="date" 
                            value={formData.startDate} 
                            onChange={e => setFormData({...formData, startDate: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Selesai Periode</label>
                        <input 
                            type="date" 
                            value={formData.endDate} 
                            onChange={e => setFormData({...formData, endDate: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
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
              
              if (canManage && googleApi.isGapiInitialized && !googleApi.isAuthenticated) {
                googleApi.login();
                showToast("Silakan login ke Google Calendar terlebih dahulu sebelum mengeksekusi import data.", "info");
                return;
              }

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
              performImport(finalSchedules, bulkModal.unmatchedRooms, bulkModal.unmatchedLecturers);
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester Default</label>
                  <select 
                      value={bulkFormData.semester}
                      onChange={e => setBulkFormData({...bulkFormData, semester: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                      {semesters.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tahun Akademik Default</label>
                  <input 
                      type="text"
                      list="academic-years-list"
                      required 
                      value={bulkFormData.academicYear}
                      onChange={e => setBulkFormData({...bulkFormData, academicYear: e.target.value})}
                      pattern="\d{4}/\d{4}"
                      title="Format harus YYYY/YYYY (contoh: 2024/2025)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Contoh: 2024/2025"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Mulai Periode Default</label>
                  <input 
                      type="date" required 
                      value={bulkFormData.startDate} 
                      onChange={e => setBulkFormData({...bulkFormData, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Selesai Periode Default</label>
                  <input 
                      type="date" required 
                      value={bulkFormData.endDate} 
                      onChange={e => setBulkFormData({...bulkFormData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
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
                <Trash2 className="w-5 h-5 mr-2" /> Hapus Jadwal Massal
              </h3>
              <button onClick={() => setBulkDeleteModal(prev => ({ ...prev, isOpen: false }))} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBulkDelete} className="p-6 space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 text-sm text-yellow-800 dark:text-yellow-400">
                <p className="font-bold mb-1">⚠️ Perhatian!</p>
                <p className="text-yellow-700 dark:text-yellow-500">Tindakan ini akan menghapus permanen <b>seluruh</b> data jadwal kelas di database pada semester dan tahun akademik yang dipilih.</p>
                <p className="text-yellow-700 dark:text-yellow-500 mt-1">
                  {googleApi.isAuthenticated ? (
                    '✅ Sudah login akun Google admin.'
                  ) : (
                    '❌ Login akun Google admin diperlukan sebelum hapus semua jadwal.'
                  )}
                </p>
                <p className="mt-2 text-xs italic text-yellow-700 dark:text-yellow-500">* Event di Google Calendar tidak akan terhapus otomatis.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                <select 
                    value={bulkDeleteModal.semester}
                    onChange={e => setBulkDeleteModal({...bulkDeleteModal, semester: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    required
                >
                    {semesters.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tahun Akademik</label>
                <select 
                    required 
                    value={bulkDeleteModal.academicYear}
                    onChange={e => setBulkDeleteModal({...bulkDeleteModal, academicYear: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">-- Pilih Tahun --</option>
                    {academicYears.map(ay => (
                      <option key={ay} value={ay}>{ay}</option>
                    ))}
                </select>
              </div>
              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 mt-4">
                <Button type="button" onClick={() => setBulkDeleteModal(prev => ({ ...prev, isOpen: false }))} variant="secondary">Batal</Button>
                <Button type="submit" disabled={isLoading} variant="destructive">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} Hapus Semua
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
