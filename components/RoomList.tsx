import React from 'react';
import { Room } from '../types';
import {
  Buildings,
  CalendarCheck,
  CaretRight,
  Check,
  DesktopTower,
  DoorOpen,
  MapPin,
  PencilSimpleLine,
  Stack,
  Trash,
  Users,
} from '@phosphor-icons/react';

interface FloorGroup {
  floor: string;
  rooms: Room[];
}

interface RoomListProps {
  filteredRooms: Room[];
  collapsedFloors: Record<string, boolean>;
  toggleFloor: (floor: string) => void;
  canManage: boolean;
  onRoomSelect: (room: Room) => void;
  onEdit: (room: Room) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
}

const categoryClasses: Record<string, string> = {
  'Laboratorium Komputer': 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-200',
  Teori: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200',
  Praktek: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200',
  Rekreasi: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200',
  Meeting: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/50 dark:text-violet-200',
  Lounge: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-200',
  'Open Space': 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-200',
  'Auditorium/Ruang Kuliah Umum': 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200',
};

const getCategoryClass = (category?: string) => categoryClasses[category || ''] || 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

const RoomList: React.FC<RoomListProps> = ({
  filteredRooms,
  collapsedFloors,
  toggleFloor,
  canManage,
  onRoomSelect,
  onEdit,
  onDelete,
}) => {
  const groupedRooms: FloorGroup[] = React.useMemo(() => {
    const groups: Record<string, Room[]> = {};
    filteredRooms.forEach(room => {
      const floor = room.floor || 'Lantai 4';
      if (!groups[floor]) {
        groups[floor] = [];
      }
      groups[floor].push(room);
    });
    return Object.keys(groups).sort().map(floor => ({
      floor,
      rooms: groups[floor],
    }));
  }, [filteredRooms]);

  if (filteredRooms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-slate-600 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <MapPin className="h-7 w-7" weight="duotone" />
        </div>
        <h3 className="text-lg font-bold text-slate-950 dark:text-white">Tidak ada ruangan ditemukan</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
          Coba ubah kata kunci, status, kategori, atau urutan data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groupedRooms.map((group) => {
        const isExpanded = collapsedFloors[group.floor] === false;

        return (
          <section key={group.floor} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              className="group flex w-full items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800"
              onClick={() => toggleFloor(group.floor)}
            >
              <span className="flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                <CaretRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} weight="bold" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
                  <Buildings className="h-4 w-4 text-slate-500" weight="duotone" />
                  {group.floor}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {group.rooms.length} ruangan terdaftar
                </span>
              </span>
              <span className="ml-auto hidden rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex">
                Asset Register
              </span>
            </button>

            {isExpanded && (
              <div className="grid grid-cols-1 gap-4 bg-slate-50/70 p-4 dark:bg-slate-900/35 md:grid-cols-2 2xl:grid-cols-3">
                {group.rooms.map((room) => {
                  const category = room.category || 'Umum';
                  const hasComputers = !!room.computerCount && room.computerCount > 0;

                  return (
                    <article
                      key={room.id}
                      onClick={() => onRoomSelect(room)}
                      className="group flex min-h-72 cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-bold uppercase ${getCategoryClass(category)}`}>
                            {category}
                          </span>
                          <h3 className="mt-3 line-clamp-1 text-xl font-bold text-slate-950 dark:text-white">{room.name}</h3>
                        </div>
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors group-hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <DoorOpen className="h-5 w-5" weight="duotone" />
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-2 min-h-11 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {room.description || 'Deskripsi ruangan belum tersedia.'}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                          <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                            <Users className="h-3.5 w-3.5" weight="duotone" />
                            Kapasitas
                          </span>
                          <span className="mt-1 block text-base font-bold text-slate-950 dark:text-white">{room.capacity} orang</span>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                          <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                            {hasComputers ? <DesktopTower className="h-3.5 w-3.5" weight="duotone" /> : <CalendarCheck className="h-3.5 w-3.5" weight="duotone" />}
                            {hasComputers ? 'Komputer' : 'Kalender'}
                          </span>
                          <span className="mt-1 block text-base font-bold text-slate-950 dark:text-white">
                            {hasComputers ? `${room.computerCount} unit` : room.googleCalendarUrl ? 'Sinkron' : 'Belum ada'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {room.facilities?.slice(0, 3).map((facility, index) => (
                          <span key={`${facility}-${index}`} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-300" weight="bold" />
                            {facility}
                          </span>
                        ))}
                        {(room.facilities?.length || 0) > 3 && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            <Stack className="h-3 w-3" weight="duotone" />
                            +{room.facilities!.length - 3}
                          </span>
                        )}
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
                        {canManage ? (
                          <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onEdit(room)}
                              className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-slate-400 hover:bg-white hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white"
                              title="Edit"
                            >
                              <PencilSimpleLine className="h-4 w-4" weight="duotone" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(room.id)}
                              className="flex size-9 items-center justify-center rounded-lg border border-red-200 text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/50"
                              title="Delete"
                            >
                              <Trash className="h-4 w-4" weight="duotone" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Akses baca</span>
                        )}

                        <span className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:group-hover:bg-slate-200">
                          Detail
                          <CaretRight className="h-4 w-4" weight="bold" />
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default RoomList;
