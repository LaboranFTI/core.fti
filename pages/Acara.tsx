
import {
  CalendarBlank as Calendar,
  CalendarDots as CalendarDays,
  Clock,
  DownloadSimple as Download,
  Info,
  Stack as Layers,
  MapPin,
  ShareNetwork as Share2,
  User,
  Wrench,
  X
} from '@phosphor-icons/react';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Booking, BookingStatus, Room } from '../types';
import { api } from '../services/api';
import * as htmlToImage from 'html-to-image';
import nocLogo from "../src/assets/noc.png";
import { formatDateID } from '../src/utils/formatters';
import SearchBar from '../components/SearchBar';
import PageHeader from '../components/PageHeader';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface EventsProps {
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    isDarkMode: boolean;
}

interface BookingWithTech extends Booking {
    techSupportPic?: string[];
    techSupportPicName?: string;
    techSupportNeeds?: string;
}

interface EventScheduleOption {
    key: string;
    date: string;
    startTime: string;
    endTime: string;
    roomIds: string[];
    needs: string[];
}

interface EventGroup {
    key: string;
    master: BookingWithTech;
    entries: BookingWithTech[];
    roomIds: string[];
    uniqueSchedules: EventScheduleOption[];
}

const getGroupTimingState = (group: EventGroup): 'Mendatang' | 'Berlangsung' | 'Selesai' => {
    const now = new Date().getTime();
    const lastSchedule = group.uniqueSchedules[group.uniqueSchedules.length - 1];
    const isPast = lastSchedule ? new Date(`${lastSchedule.date}T${lastSchedule.endTime}`).getTime() < now : false;
    const isOngoing = group.uniqueSchedules.some((sch) => {
        const start = new Date(`${sch.date}T${sch.startTime}`).getTime();
        const end = new Date(`${sch.date}T${sch.endTime}`).getTime();
        return now >= start && now <= end;
    });

    return isPast ? 'Selesai' : isOngoing ? 'Berlangsung' : 'Mendatang';
};

const getStatusClasses = (status: 'Mendatang' | 'Berlangsung' | 'Selesai') => {
    if (status === 'Berlangsung') {
        return {
            card: 'border-sky-300 dark:border-sky-700',
            strip: 'bg-sky-600',
            badge: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
            icon: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
        };
    }

    if (status === 'Selesai') {
        return {
            card: 'border-slate-200 dark:border-slate-700 opacity-75',
            strip: 'bg-slate-400 dark:bg-slate-500',
            badge: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
            icon: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
        };
    }

    return {
        card: 'border-slate-200 dark:border-slate-700',
        strip: 'bg-emerald-600',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
        icon: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
    };
};

const Acara: React.FC<EventsProps> = ({ showToast, isDarkMode }) => {
    const [events, setEvents] = useState<BookingWithTech[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
    const [selectedGroup, setSelectedGroup] = useState<EventGroup | null>(null);
    const [selectedScheduleKeys, setSelectedScheduleKeys] = useState<Record<string, string>>({});
    const [filterStatus, setFilterStatus] = useState<'All' | 'Mendatang' | 'Berlangsung' | 'Selesai'>('All');
    const [filterRoom, setFilterRoom] = useState<string>('All');

    const [shareConfig, setShareConfig] = useState({
        title: true,
        time: true,
        location: true,
        pic: true,
        contact: false,
        tech: false,
        needs: true
    });

    const ticketRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [bkRes, rmRes] = await Promise.all([
                    api('/api/bookings?exclude_file=true'),
                    api('/api/rooms?exclude_image=true')
                ]);

                if (bkRes.ok) {
                    const allBookings: BookingWithTech[] = await bkRes.json();
                    setEvents(allBookings.filter(b => b.status === BookingStatus.APPROVED));
                }
                if (rmRes.ok) setRooms(await rmRes.json());
            } catch (e) {
                console.error(e);
                showToast("Gagal memuat data acara", "error");
            }
        };
        fetchData();
    }, []);

    const getRoomName = (roomId: string) => {
        return rooms.find(r => r.id === roomId)?.name || 'Unknown Room';
    };

    const getScheduleLabel = (schedule: EventScheduleOption) => {
        return `${formatDateID(schedule.date)}, ${schedule.startTime.slice(0, 5)} - ${schedule.endTime.slice(0, 5)} WIB`;
    };

    const getActiveSchedule = (group: EventGroup) => {
        const selectedKey = selectedScheduleKeys[group.key];
        return group.uniqueSchedules.find(schedule => schedule.key === selectedKey) ?? group.uniqueSchedules[0] ?? null;
    };

    const getScheduleNeeds = (schedule: EventScheduleOption | null, fallbackNeeds = '') => {
        if (schedule?.needs.length) return schedule.needs;

        const fallback = (fallbackNeeds ?? '').trim();
        return fallback ? [fallback] : [];
    };

    const handleScheduleSelection = (groupKey: string, scheduleKey: string) => {
        setSelectedScheduleKeys(prev => ({
            ...prev,
            [groupKey]: scheduleKey
        }));
    };

    const groupedEvents = useMemo(() => {
        const map = new Map<string, BookingWithTech[]>();
        events.forEach(b => {
            const matches = b.purpose.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                b.userName.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
            if (!matches) return;

            // Group berdasarkan User dan Keperluan acara
            const key = `${b.userId}::${b.purpose}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(b);
        });

        return Array.from(map.entries()).map(([key, entries]) => {
            const roomIds = Array.from(new Set(entries.map(e => e.roomId)));

            // Satukan jadwal berdasarkan tanggal/jam, sambil tetap menempelkan lokasi untuk setiap opsi jadwal.
            const uniqueSchedulesMap = new Map<string, EventScheduleOption>();
            entries.forEach((entry: BookingWithTech) => {
                const schedules = entry.schedules?.length
                    ? entry.schedules
                    : [{
                        date: entry.date ?? '',
                        startTime: entry.startTime ?? '',
                        endTime: entry.endTime ?? '',
                        kebutuhan: entry.techSupportNeeds ?? ''
                    }];

                schedules.forEach(schedule => {
                    if (!schedule?.date || !schedule?.startTime || !schedule?.endTime) return;

                    const scheduleKey = `${schedule.date}_${schedule.startTime}_${schedule.endTime}`;
                    const existingSchedule = uniqueSchedulesMap.get(scheduleKey);
                    const scheduleNeeds = schedule.kebutuhan?.trim() || entry.techSupportNeeds?.trim() || '';

                    if (existingSchedule) {
                        if (entry.roomId && !existingSchedule.roomIds.includes(entry.roomId)) {
                            existingSchedule.roomIds.push(entry.roomId);
                        }
                        if (scheduleNeeds && !existingSchedule.needs.includes(scheduleNeeds)) {
                            existingSchedule.needs.push(scheduleNeeds);
                        }
                        return;
                    }

                    uniqueSchedulesMap.set(scheduleKey, {
                        key: scheduleKey,
                        date: schedule.date,
                        startTime: schedule.startTime,
                        endTime: schedule.endTime,
                        roomIds: entry.roomId ? [entry.roomId] : [],
                        needs: scheduleNeeds ? [scheduleNeeds] : []
                    });
                });
            });

            const uniqueSchedules = Array.from(uniqueSchedulesMap.values()).sort((a, b) => {
                return new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime();
            });

            return { key, master: entries[0], entries, roomIds, uniqueSchedules };
        }).sort((a, b) => {
            const now = new Date().getTime();

            // Waktu mulai adalah jadwal pertama, waktu selesai adalah jadwal terakhir (karena uniqueSchedules sudah di-sort)
            const startA = a.uniqueSchedules.length > 0 ? new Date(`${a.uniqueSchedules[0].date}T${a.uniqueSchedules[0].startTime}`).getTime() : 0;
            const endA = a.uniqueSchedules.length > 0 ? new Date(`${a.uniqueSchedules[a.uniqueSchedules.length - 1].date}T${a.uniqueSchedules[a.uniqueSchedules.length - 1].endTime}`).getTime() : 0;

            const startB = b.uniqueSchedules.length > 0 ? new Date(`${b.uniqueSchedules[0].date}T${b.uniqueSchedules[0].startTime}`).getTime() : 0;
            const endB = b.uniqueSchedules.length > 0 ? new Date(`${b.uniqueSchedules[b.uniqueSchedules.length - 1].date}T${b.uniqueSchedules[b.uniqueSchedules.length - 1].endTime}`).getTime() : 0;

            // Status apakah event sudah berakhir
            const isPastA = endA < now;
            const isPastB = endB < now;

            // Jika A sudah lewat dan B belum, prioritaskan B (B di atas)
            if (isPastA && !isPastB) return 1;
            // Jika A belum lewat dan B sudah lewat, prioritaskan A (A di atas)
            if (!isPastA && isPastB) return -1;

            // Jika keduanya sudah lewat, urutkan dari yang paling baru saja selesai
            if (isPastA && isPastB) {
                return endB - endA;
            }

            // Jika keduanya belum lewat (mendatang/berlangsung), urutkan dari yang waktu mulainya paling dekat dengan saat ini
            return startA - startB;
        });
    }, [events, debouncedSearchTerm]);

    const handleDownloadImage = async () => {
        const element = ticketRef.current;
        if (!element) return;

        try {
            showToast("Sedang membuat gambar...", "info");
            // Tambahkan kelas 'dark' sementara jika mode gelap aktif agar html-to-image dapat mengambil gayanya
            if (isDarkMode) {
                element.classList.add('dark');
            }
            const image = await htmlToImage.toPng(element, {
                pixelRatio: 2,
                backgroundColor: isDarkMode ? '#111827' : '#ffffff'
            });

            const link = document.createElement('a');
            link.href = image;
            // Menghapus karakter yang tidak diizinkan oleh OS untuk nama file
            const safeName = selectedGroup?.master.purpose.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_') || 'Acara';
            const selectedDate = activeSelectedSchedule?.date?.replace(/[^0-9-]/g, '') || 'jadwal';
            link.download = `Event_${safeName}_${selectedDate}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Gambar berhasil didownload!", "success");
        } catch (error) {
            console.error("Gagal membuat gambar", error);
            showToast("Gagal membuat gambar.", "error");
        } finally {
            // Bersihkan kelas setelah selesai
            if (isDarkMode) {
                element.classList.remove('dark');
            }
        }
    };

    const toggleConfig = (key: keyof typeof shareConfig) => {
        setShareConfig(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const showAllShareFields = () => {
        setShareConfig({
            title: true,
            time: true,
            location: true,
            pic: true,
            contact: true,
            tech: true,
            needs: true
        });
    };

    const useCompactShareFields = () => {
        setShareConfig({
            title: true,
            time: true,
            location: true,
            pic: false,
            contact: false,
            tech: false,
            needs: false
        });
    };

    const displayedEvents = useMemo(() => {
        return groupedEvents.filter(group => {
            if (filterRoom !== 'All' && !group.roomIds.includes(filterRoom)) return false;
            if (filterStatus === 'All') return true;

            return getGroupTimingState(group) === filterStatus;
        });
    }, [groupedEvents, filterStatus, filterRoom]);

    const eventStats = useMemo(() => {
        return groupedEvents.reduce(
            (acc, group) => {
                const status = getGroupTimingState(group);
                acc.total += 1;
                acc[status] += 1;
                return acc;
            },
            { total: 0, Mendatang: 0, Berlangsung: 0, Selesai: 0 }
        );
    }, [groupedEvents]);

    const activeSelectedSchedule = selectedGroup ? getActiveSchedule(selectedGroup) : null;
    const activeSelectedScheduleNeeds = getScheduleNeeds(
        activeSelectedSchedule,
        selectedGroup?.master.techSupportNeeds
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Daftar Acara"
                description="Jadwal kegiatan dan acara di Fakultas Teknologi Informasi"
                actionsClassName="w-full md:w-auto"
                actions={
                    <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
                        <SearchBar
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Cari acara..."
                            className="w-full sm:w-64"
                        />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-300 sm:w-auto"
                        >
                            <option value="All">Semua Status</option>
                            <option value="Mendatang">Mendatang</option>
                            <option value="Berlangsung">Berlangsung</option>
                            <option value="Selesai">Selesai</option>
                        </select>
                        <select
                            value={filterRoom}
                            onChange={(e) => setFilterRoom(e.target.value)}
                            className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-300 sm:w-auto"
                        >
                            <option value="All">Semua Ruangan</option>
                            {rooms.map(room => (
                                <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                        </select>
                    </div>
                }
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: 'Total Acara', value: eventStats.total },
                    { label: 'Berlangsung', value: eventStats.Berlangsung },
                    { label: 'Mendatang', value: eventStats.Mendatang },
                    { label: 'Selesai', value: eventStats.Selesai }
                ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950 dark:text-white">{item.value.toLocaleString('id-ID')}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {displayedEvents.map(group => {
                    const status = getGroupTimingState(group);
                    const statusClass = getStatusClasses(status);
                    const activeSchedule = getActiveSchedule(group);
                    const activeScheduleNeeds = getScheduleNeeds(activeSchedule, group.master.techSupportNeeds);

                    return (
                        <div
                            key={group.key}
                            onClick={() => setSelectedGroup(group)}
                            className={`group relative flex min-h-80 cursor-pointer flex-col overflow-hidden rounded-lg border bg-white p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md dark:bg-slate-900 dark:hover:border-slate-500 ${statusClass.card}`}
                        >
                            <div className={`absolute inset-x-0 top-0 h-1 ${statusClass.strip}`} />
                            <div className="mb-4 flex items-start justify-between gap-3 pt-1">
                                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${statusClass.icon}`}>
                                    <CalendarDays className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold ${statusClass.badge}`}>
                                        {status}
                                    </span>
                                    {group.roomIds.length > 1 && (
                                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            <Layers className="w-3 h-3 mr-1" /> {group.roomIds.length} Ruangan
                                        </span>
                                    )}
                                </div>
                            </div>
                            <h3 className="mb-3 line-clamp-2 text-lg font-bold text-slate-950 transition-colors group-hover:text-slate-700 dark:text-white dark:group-hover:text-slate-200">
                                {group.master.purpose}
                            </h3>
                            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                {group.uniqueSchedules.length > 1 && (
                                    <div
                                        className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <label className="mb-1 flex items-center text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                                            <Calendar className="mr-1.5 h-3.5 w-3.5" />
                                            Pilih Hari Ditampilkan
                                        </label>
                                        <select
                                            value={activeSchedule?.key ?? ''}
                                            onChange={(e) => handleScheduleSelection(group.key, e.target.value)}
                                            className="w-full cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-400/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            {group.uniqueSchedules.map((schedule) => (
                                                <option key={schedule.key} value={schedule.key}>
                                                    {`${formatDateID(schedule.date)} | ${schedule.startTime.slice(0, 5)} - ${schedule.endTime.slice(0, 5)} | ${schedule.roomIds.map(getRoomName).join(', ')}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                    {activeSchedule ? (
                                        <span>{getScheduleLabel(activeSchedule)}</span>
                                    ) : (
                                        <span>Jadwal belum tersedia</span>
                                    )}
                                </div>
                                <div className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                    <span className="line-clamp-1">
                                        {activeSchedule ? activeSchedule.roomIds.map(getRoomName).join(', ') : group.roomIds.map(getRoomName).join(', ')}
                                    </span>
                                </div>
                                <div className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                                    <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                    <span>{group.master.responsiblePerson}</span>
                                </div>
                                {activeScheduleNeeds.length > 0 && (
                                    <div className="flex items-start rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                                        <Wrench className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-wide">Kebutuhan Acara</p>
                                            <p className="line-clamp-2 text-xs">{activeScheduleNeeds.join(', ')}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="mt-auto border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Klik untuk detail dan preview PNG
                            </div>
                        </div>
                    );
                })}
                {displayedEvents.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="mb-4 flex size-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                            <CalendarDays className="h-9 w-9 text-slate-400" />
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-slate-950 dark:text-white">Belum ada acara</h3>
                        <p className="mb-4 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                            Belum ada kegiatan yang dijadwalkan atau sesuai dengan filter Anda saat ini.
                        </p>
                        {(searchTerm !== '' || filterStatus !== 'All' || filterRoom !== 'All') && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterStatus('All');
                                    setFilterRoom('All');
                                }}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Reset Filter
                            </button>
                        )}
                    </div>
                )}
            </div>

            {selectedGroup && (
                <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
                    <div className="mobile-modal-panel flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in-up dark:border-slate-700 dark:bg-slate-900 md:flex-row">
                        <div className="mobile-modal-body w-full overflow-y-auto border-b border-slate-200 p-4 dark:border-slate-700 md:w-1/2 md:border-b-0 md:border-r sm:p-6">
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Detail Acara</p>
                                    <h3 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{selectedGroup.master.purpose}</h3>
                                </div>
                                <button onClick={() => setSelectedGroup(null)} className="flex size-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {selectedGroup.uniqueSchedules.length > 1 && (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            Pilih jadwal yang ingin ditampilkan
                                        </label>
                                        <select
                                            value={activeSelectedSchedule?.key ?? ''}
                                            onChange={(e) => handleScheduleSelection(selectedGroup.key, e.target.value)}
                                            className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-400/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            {selectedGroup.uniqueSchedules.map((schedule) => (
                                                <option key={schedule.key} value={schedule.key}>
                                                    {`${formatDateID(schedule.date)} | ${schedule.startTime.slice(0, 5)} - ${schedule.endTime.slice(0, 5)} | ${schedule.roomIds.map(getRoomName).join(', ')}`}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            Pilihan ini akan dipakai untuk tampilan preview dan file PNG yang didownload.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <h4 className="mb-2 text-sm font-bold uppercase text-slate-500 dark:text-slate-400">Informasi Utama</h4>

                                    <div className="mt-3 space-y-2">
                                        {activeSelectedSchedule ? (
                                            <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <div className="flex items-center rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                                                    <Calendar className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                                                    <span>{formatDateID(activeSelectedSchedule.date)}</span>
                                                </div>
                                                <div className="flex items-center rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                                                    <Clock className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                                                    <span>{activeSelectedSchedule.startTime.slice(0, 5)} - {activeSelectedSchedule.endTime.slice(0, 5)} WIB</span>
                                                </div>
                                                <div className="flex items-start rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                                                    <MapPin className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                                    <span className="line-clamp-3">{activeSelectedSchedule.roomIds.map(getRoomName).join(', ')}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Jadwal belum tersedia.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                                    <h4 className="mb-2 flex items-center text-sm font-bold uppercase text-amber-800 dark:text-amber-200">
                                        <Wrench className="mr-2 h-4 w-4" /> Kebutuhan Acara
                                    </h4>
                                    {activeSelectedScheduleNeeds.length > 0 ? (
                                        <ul className="space-y-1.5 text-sm text-amber-900 dark:text-amber-200">
                                            {activeSelectedScheduleNeeds.map((need) => (
                                                <li key={need} className="flex items-start gap-2">
                                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                                    <span>{need}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-amber-800/70 dark:text-amber-300/70">Tidak ada kebutuhan khusus.</p>
                                    )}
                                </div>

                                <div>
                                    <h4 className="mb-2 text-sm font-bold uppercase text-slate-500 dark:text-slate-400">Kontak & Penanggung Jawab</h4>
                                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                        <p className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70"><span className="font-semibold text-slate-800 dark:text-slate-100">PJ:</span> {selectedGroup.master.responsiblePerson}</p>
                                        <p className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70"><span className="font-semibold text-slate-800 dark:text-slate-100">Kontak:</span> {selectedGroup.master.contactPerson}</p>
                                    </div>
                                </div>

                                {selectedGroup.master.techSupportPicName && (
                                    <div>
                                        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/70 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">PIC Teknis:</span> {selectedGroup.master.techSupportPicName}</p>
                                    </div>
                                )}

                                <div className="border-t border-slate-200 pt-6 dark:border-slate-700">
                                    <h4 className="mb-3 flex items-center text-sm font-bold text-slate-800 dark:text-slate-100">
                                        <Share2 className="w-4 h-4 mr-2" /> Bagikan Informasi (PNG)
                                    </h4>
                                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Pilih informasi yang ingin ditampilkan pada gambar:</p>

                                    <div className="mb-4 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={showAllShareFields}
                                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            Tampilkan Semua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={useCompactShareFields}
                                            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                        >
                                            Tampilan Ringkas
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                                            <input type="checkbox" checked={shareConfig.title} onChange={() => toggleConfig('title')} className="rounded text-slate-900 focus:ring-slate-500" />
                                            <span className="text-slate-700 dark:text-slate-300">Nama Acara</span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                                            <input type="checkbox" checked={shareConfig.time} onChange={() => toggleConfig('time')} className="rounded text-slate-900 focus:ring-slate-500" />
                                            <span className="text-slate-700 dark:text-slate-300">Waktu</span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                                            <input type="checkbox" checked={shareConfig.location} onChange={() => toggleConfig('location')} className="rounded text-slate-900 focus:ring-slate-500" />
                                            <span className="text-slate-700 dark:text-slate-300">Lokasi</span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                                            <input type="checkbox" checked={shareConfig.pic} onChange={() => toggleConfig('pic')} className="rounded text-slate-900 focus:ring-slate-500" />
                                            <span className="text-slate-700 dark:text-slate-300">Penanggung Jawab</span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                                            <input type="checkbox" checked={shareConfig.contact} onChange={() => toggleConfig('contact')} className="rounded text-slate-900 focus:ring-slate-500" />
                                            <span className="text-slate-700 dark:text-slate-300">Kontak Person</span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                                            <input type="checkbox" checked={shareConfig.tech} onChange={() => toggleConfig('tech')} className="rounded text-slate-900 focus:ring-slate-500" />
                                            <span className="text-slate-700 dark:text-slate-300">Info PIC Laboran</span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                                            <input type="checkbox" checked={shareConfig.needs} onChange={() => toggleConfig('needs')} className="rounded text-slate-900 focus:ring-slate-500" />
                                            <span className="text-slate-700 dark:text-slate-300">Kebutuhan Alat</span>
                                        </label>
                                    </div>

                                    <button
                                        onClick={handleDownloadImage}
                                        className="flex w-full items-center justify-center rounded-lg bg-slate-950 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                                    >
                                        <Download className="w-4 h-4 mr-2" /> Download PNG
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="relative flex min-h-100 w-full items-center justify-center overflow-hidden bg-slate-100 p-4 dark:bg-slate-800 sm:p-6 md:w-1/2">
                            <div className="absolute left-4 top-4 z-10 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs font-bold text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
                                Preview Gambar
                            </div>

                            <div ref={ticketRef} className="relative w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                <div className="absolute left-0 top-0 h-1.5 w-full bg-slate-950 dark:bg-slate-100"></div>

                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <img src={nocLogo} alt="Logo" className="w-10 h-10 object-contain" crossOrigin="anonymous" />
                                        <div>
                                            <h1 className="text-lg font-bold leading-tight text-slate-950 dark:text-gray-100">CORE.FTI</h1>
                                            <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Kartu Informasi Acara</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {shareConfig.title && (
                                        <div>
                                            <p className="mb-1 text-xs font-bold uppercase text-slate-400 dark:text-slate-500">Nama Acara</p>
                                            <h2 className="text-xl font-bold leading-snug text-slate-900 dark:text-white">{selectedGroup.master.purpose}</h2>
                                        </div>
                                    )}

                                    {(shareConfig.time || shareConfig.location) && (
                                        <div className="grid grid-cols-1 gap-4">
                                            {shareConfig.time && (
                                                <div className="flex items-start">
                                                    <div className="mr-3 shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                                                        <Calendar className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                                                    </div>
                                                    <div className="w-full mt-0.5">
                                                        <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Waktu Pelaksanaan</p>
                                                        {activeSelectedSchedule ? (
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                                    {formatDateID(activeSelectedSchedule.date)}
                                                                </p>
                                                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                                                    {activeSelectedSchedule.startTime.slice(0, 5)} - {activeSelectedSchedule.endTime.slice(0, 5)} WIB
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">Jadwal belum tersedia</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {shareConfig.location && (
                                                <div className="flex items-start">
                                                    <div className="mr-3 shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                                                        <MapPin className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                                                    </div>
                                                    <div className="w-full mt-0.5">
                                                        <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Lokasi</p>
                                                        {activeSelectedSchedule ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {activeSelectedSchedule.roomIds.map(id => (
                                                                    <div key={id} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold leading-none text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                                                        {getRoomName(id)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">Lokasi belum tersedia</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(shareConfig.pic || shareConfig.contact) && (
                                        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 dark:border-slate-700 sm:grid-cols-2">
                                            {shareConfig.pic && (
                                                <div>
                                                    <p className="mb-1 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Penanggung Jawab</p>
                                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedGroup.master.responsiblePerson}</p>
                                                </div>
                                            )}
                                            {shareConfig.contact && (
                                                <div>
                                                    <p className="mb-1 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Kontak</p>
                                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedGroup.master.contactPerson}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(shareConfig.tech || shareConfig.needs) && (
                                        <div className="-mx-8 -mb-8 mt-4 border-t border-slate-100 bg-slate-50 px-8 pb-4 pt-5 dark:border-slate-700 dark:bg-slate-800">
                                            <div className="space-y-3">
                                                {shareConfig.tech && selectedGroup.master.techSupportPicName && (
                                                    <div>
                                                        <p className="mb-1 flex items-center text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500"><Wrench className="mr-1 h-3 w-3" /> PIC Teknis Laboran</p>
                                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedGroup.master.techSupportPicName}</p>
                                                    </div>
                                                )}
                                                {shareConfig.needs && (
                                                    <div>
                                                        <p className="mb-1 flex items-center text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500"><Info className="mr-1 h-3 w-3" /> Kebutuhan</p>
                                                        {activeSelectedScheduleNeeds.length > 0 ? (
                                                            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                                                                {activeSelectedScheduleNeeds.map((need) => (
                                                                    <li key={need} className="flex items-start gap-2">
                                                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                                                                        <span>{need}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p className="text-sm italic text-slate-500 dark:text-slate-400">Tidak ada kebutuhan khusus</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="absolute bottom-2 right-4 opacity-10">
                                    <img src={nocLogo} className="w-24 h-24" crossOrigin="anonymous" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Acara;
