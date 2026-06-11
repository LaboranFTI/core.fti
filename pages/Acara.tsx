
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Booking, BookingStatus, Room } from '../types';
import { Calendar, Clock, MapPin, User, Share2, Download, X, Wrench, Info, CalendarDays, Layers } from 'lucide-react';
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

            const now = new Date().getTime();
            const lastSchedule = group.uniqueSchedules[group.uniqueSchedules.length - 1];
            const isPast = lastSchedule ? new Date(`${lastSchedule.date}T${lastSchedule.endTime}`).getTime() < now : false;
            const isOngoing = group.uniqueSchedules.some((sch) => {
                const start = new Date(`${sch.date}T${sch.startTime}`).getTime();
                const end = new Date(`${sch.date}T${sch.endTime}`).getTime();
                return now >= start && now <= end;
            });

            const currentStatus = isPast ? 'Selesai' : isOngoing ? 'Berlangsung' : 'Mendatang';
            return currentStatus === filterStatus;
        });
    }, [groupedEvents, filterStatus, filterRoom]);

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
                            className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-auto"
                        >
                            <option value="All">Semua Status</option>
                            <option value="Mendatang">Mendatang</option>
                            <option value="Berlangsung">Berlangsung</option>
                            <option value="Selesai">Selesai</option>
                        </select>
                        <select
                            value={filterRoom}
                            onChange={(e) => setFilterRoom(e.target.value)}
                            className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-auto"
                        >
                            <option value="All">Semua Ruangan</option>
                            {rooms.map(room => (
                                <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                        </select>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedEvents.map(group => {
                    const now = new Date().getTime();
                    const lastSchedule = group.uniqueSchedules[group.uniqueSchedules.length - 1];
                    const isPast = lastSchedule ? new Date(`${lastSchedule.date}T${lastSchedule.endTime}`).getTime() < now : false;
                    const activeSchedule = getActiveSchedule(group);
                    const activeScheduleNeeds = getScheduleNeeds(activeSchedule, group.master.techSupportNeeds);

                    const isOngoing = group.uniqueSchedules.some((sch) => {
                        const start = new Date(`${sch.date}T${sch.startTime}`).getTime();
                        const end = new Date(`${sch.date}T${sch.endTime}`).getTime();
                        return now >= start && now <= end;
                    });

                    return (
                        <div
                            key={group.key}
                            onClick={() => setSelectedGroup(group)}
                            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-all cursor-pointer group ${isPast ? 'opacity-75' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className={`p-2 rounded-lg ${isPast ? 'bg-gray-100 dark:bg-gray-700 text-gray-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                    <CalendarDays className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {isPast ? (
                                        <span className="text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600">
                                            Selesai
                                        </span>
                                    ) : isOngoing ? (
                                        <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-full flex items-center border border-blue-200 dark:border-blue-800 shadow-sm">
                                            <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mr-1.5 animate-pulse"></span>
                                            Berlangsung
                                        </span>
                                    ) : (
                                        <span className="text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                                            Confirmed
                                        </span>
                                    )}
                                    {group.roomIds.length > 1 && (
                                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full flex items-center">
                                            <Layers className="w-3 h-3 mr-1" /> {group.roomIds.length} Ruangan
                                        </span>
                                    )}
                                </div>
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                {group.master.purpose}
                            </h3>
                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                {group.uniqueSchedules.length > 1 && (
                                    <div
                                        className="rounded-lg border border-blue-100 bg-blue-50/70 p-2 dark:border-blue-900/40 dark:bg-blue-900/10"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <label className="mb-1 flex items-center text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                            <Calendar className="mr-1.5 h-3.5 w-3.5" />
                                            Pilih Hari Ditampilkan
                                        </label>
                                        <select
                                            value={activeSchedule?.key ?? ''}
                                            onChange={(e) => handleScheduleSelection(group.key, e.target.value)}
                                            className="w-full cursor-pointer rounded-md border border-blue-200 bg-white px-2.5 py-2 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-900/50 dark:bg-gray-800 dark:text-gray-200"
                                        >
                                            {group.uniqueSchedules.map((schedule) => (
                                                <option key={schedule.key} value={schedule.key}>
                                                    {`${formatDateID(schedule.date)} | ${schedule.startTime.slice(0, 5)} - ${schedule.endTime.slice(0, 5)} | ${schedule.roomIds.map(getRoomName).join(', ')}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="flex items-center">
                                    <Clock className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                                    {activeSchedule ? (
                                        <span>{getScheduleLabel(activeSchedule)}</span>
                                    ) : (
                                        <span>Jadwal belum tersedia</span>
                                    )}
                                </div>
                                <div className="flex items-center">
                                    <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                                    <span className="line-clamp-1">
                                        {activeSchedule ? activeSchedule.roomIds.map(getRoomName).join(', ') : group.roomIds.map(getRoomName).join(', ')}
                                    </span>
                                </div>
                                <div className="flex items-center">
                                    <User className="w-4 h-4 mr-2 text-gray-400" />
                                    <span>{group.master.responsiblePerson}</span>
                                </div>
                                {activeScheduleNeeds.length > 0 && (
                                    <div className="flex items-start rounded-lg bg-amber-50 px-2.5 py-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                        <Wrench className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-wide">Kebutuhan Acara</p>
                                            <p className="line-clamp-2 text-xs">{activeScheduleNeeds.join(' • ')}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {displayedEvents.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-full mb-4">
                            <CalendarDays className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Belum ada acara</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-4">
                            Belum ada kegiatan yang dijadwalkan atau sesuai dengan filter Anda saat ini.
                        </p>
                        {(searchTerm !== '' || filterStatus !== 'All' || filterRoom !== 'All') && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterStatus('All');
                                    setFilterRoom('All');
                                }}
                                className="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-medium text-sm"
                            >
                                Reset Filter
                            </button>
                        )}
                    </div>
                )}
            </div>

            {selectedGroup && (
                <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up flex flex-col md:flex-row max-h-[90vh]">
                        <div className="mobile-modal-body w-full md:w-1/2 p-4 sm:p-6 overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-xl text-gray-900 dark:text-white">Detail Acara</h3>
                                <button onClick={() => setSelectedGroup(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {selectedGroup.uniqueSchedules.length > 1 && (
                                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-900/10">
                                        <label className="mb-2 block text-sm font-semibold text-blue-700 dark:text-blue-300">
                                            Pilih jadwal yang ingin ditampilkan
                                        </label>
                                        <select
                                            value={activeSelectedSchedule?.key ?? ''}
                                            onChange={(e) => handleScheduleSelection(selectedGroup.key, e.target.value)}
                                            className="w-full cursor-pointer rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-900/50 dark:bg-gray-800 dark:text-gray-200"
                                        >
                                            {selectedGroup.uniqueSchedules.map((schedule) => (
                                                <option key={schedule.key} value={schedule.key}>
                                                    {`${formatDateID(schedule.date)} | ${schedule.startTime.slice(0, 5)} - ${schedule.endTime.slice(0, 5)} | ${schedule.roomIds.map(getRoomName).join(', ')}`}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-2 text-xs text-blue-700/80 dark:text-blue-200/80">
                                            Pilihan ini akan dipakai untuk tampilan preview dan file PNG yang didownload.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Informasi Utama</h4>
                                    <p className="font-bold text-lg text-gray-900 dark:text-white mb-1">{selectedGroup.master.purpose}</p>

                                    <div className="mt-3 space-y-2">
                                        {activeSelectedSchedule ? (
                                            <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                <div className="flex items-center">
                                                    <Calendar className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                                                    <span>{formatDateID(activeSelectedSchedule.date)}</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <Clock className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                                                    <span>{activeSelectedSchedule.startTime.slice(0, 5)} - {activeSelectedSchedule.endTime.slice(0, 5)} WIB</span>
                                                </div>
                                                <div className="flex items-start">
                                                    <MapPin className="w-4 h-4 mr-2 mt-0.5 text-gray-400 shrink-0" />
                                                    <span className="line-clamp-3">{activeSelectedSchedule.roomIds.map(getRoomName).join(', ')}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Jadwal belum tersedia.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
                                    <h4 className="mb-2 flex items-center text-sm font-semibold uppercase text-amber-800 dark:text-amber-300">
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
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Kontak & Penanggung Jawab</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">PJ:</span> {selectedGroup.master.responsiblePerson}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">Kontak:</span> {selectedGroup.master.contactPerson}</p>
                                </div>

                                {selectedGroup.master.techSupportPicName && (
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">PIC Teknis:</span> {selectedGroup.master.techSupportPicName}</p>
                                    </div>
                                )}

                                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                                    <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
                                        <Share2 className="w-4 h-4 mr-2" /> Bagikan Informasi (PNG)
                                    </h4>
                                    <p className="text-xs text-gray-500 mb-3">Pilih informasi yang ingin ditampilkan pada gambar:</p>

                                    <div className="mb-4 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={showAllShareFields}
                                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
                                        >
                                            Tampilkan Semua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={useCompactShareFields}
                                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                        >
                                            Tampilan Ringkas
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={shareConfig.title} onChange={() => toggleConfig('title')} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-gray-700 dark:text-gray-300">Nama Acara</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={shareConfig.time} onChange={() => toggleConfig('time')} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-gray-700 dark:text-gray-300">Waktu</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={shareConfig.location} onChange={() => toggleConfig('location')} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-gray-700 dark:text-gray-300">Lokasi</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={shareConfig.pic} onChange={() => toggleConfig('pic')} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-gray-700 dark:text-gray-300">Penanggung Jawab</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={shareConfig.contact} onChange={() => toggleConfig('contact')} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-gray-700 dark:text-gray-300">Kontak Person</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={shareConfig.tech} onChange={() => toggleConfig('tech')} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-gray-700 dark:text-gray-300">Info PIC Laboran</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={shareConfig.needs} onChange={() => toggleConfig('needs')} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-gray-700 dark:text-gray-300">Kebutuhan Alat</span>
                                        </label>
                                    </div>

                                    <button
                                        onClick={handleDownloadImage}
                                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center shadow-sm"
                                    >
                                        <Download className="w-4 h-4 mr-2" /> Download PNG
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-1/2 bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 flex items-center justify-center overflow-hidden relative min-h-100">
                            <div className="absolute top-4 left-4 bg-white/80 dark:bg-black/50 px-2 py-1 rounded text-xs font-bold text-white backdrop-blur-sm z-10">
                                Preview Gambar
                            </div>

                            <div ref={ticketRef} className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-lg w-full max-w-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-blue-500 to-purple-600"></div>

                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <img src={nocLogo} alt="Logo" className="w-10 h-10 object-contain" crossOrigin="anonymous" />
                                        <div>
                                            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">CORE.FTI</h1>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Event Card</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {shareConfig.title && (
                                        <div>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-bold mb-1">Nama Acara</p>
                                            <h2 className="text-xl font-bold text-gray-800 dark:text-white leading-snug">{selectedGroup.master.purpose}</h2>
                                        </div>
                                    )}

                                    {(shareConfig.time || shareConfig.location) && (
                                        <div className="grid grid-cols-1 gap-4">
                                            {shareConfig.time && (
                                                <div className="flex items-start">
                                                    <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg mr-3 shrink-0">
                                                        <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div className="w-full mt-0.5">
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Waktu Pelaksanaan</p>
                                                        {activeSelectedSchedule ? (
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                                    {formatDateID(activeSelectedSchedule.date)}
                                                                </p>
                                                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                                                    {activeSelectedSchedule.startTime.slice(0, 5)} - {activeSelectedSchedule.endTime.slice(0, 5)} WIB
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">Jadwal belum tersedia</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {shareConfig.location && (
                                                <div className="flex items-start">
                                                    <div className="bg-purple-50 dark:bg-purple-900/30 p-2 rounded-lg mr-3 shrink-0">
                                                        <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                    </div>
                                                    <div className="w-full mt-0.5">
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5">Lokasi</p>
                                                        {activeSelectedSchedule ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {activeSelectedSchedule.roomIds.map(id => (
                                                                    <div key={id} className="inline-flex items-center justify-center text-sm font-bold leading-none text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700">
                                                                        {getRoomName(id)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">Lokasi belum tersedia</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(shareConfig.pic || shareConfig.contact) && (
                                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {shareConfig.pic && (
                                                <div>
                                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-1">Penanggung Jawab</p>
                                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{selectedGroup.master.responsiblePerson}</p>
                                                </div>
                                            )}
                                            {shareConfig.contact && (
                                                <div>
                                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-1">Kontak</p>
                                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{selectedGroup.master.contactPerson}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(shareConfig.tech || shareConfig.needs) && (
                                        <div className="pt-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 -mx-8 px-8 pb-4 -mb-8 mt-4">
                                            <div className="space-y-3">
                                                {shareConfig.tech && selectedGroup.master.techSupportPicName && (
                                                    <div>
                                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-1 flex items-center"><Wrench className="w-3 h-3 mr-1" /> PIC Teknis Laboran</p>
                                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{selectedGroup.master.techSupportPicName}</p>
                                                    </div>
                                                )}
                                                {shareConfig.needs && (
                                                    <div>
                                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-1 flex items-center"><Info className="w-3 h-3 mr-1" /> Kebutuhan</p>
                                                        {activeSelectedScheduleNeeds.length > 0 ? (
                                                            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                                                {activeSelectedScheduleNeeds.map((need) => (
                                                                    <li key={need} className="flex items-start gap-2">
                                                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                                                                        <span>{need}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p className="text-sm italic text-gray-500 dark:text-gray-400">Tidak ada kebutuhan khusus</p>
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
