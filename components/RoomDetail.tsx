import {
  CalendarBlank as Calendar,
  Check,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  Clock,
  Cpu,
  PencilSimpleLine as Edit2,
  Eye,
  HardDrive,
  Keyboard,
  MapPin,
  Monitor,
  Package,
  ArrowClockwise as RefreshCw,
  Trash as Trash2,
  Users,
  X
} from '@phosphor-icons/react';
import React from 'react';
import { Room, RoomComputer, Software, LabStaff as StaffType } from '../types';
const getConditionColor = (condition?: string) => {
  switch (condition) {
    case 'Baik': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'Rusak Ringan': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'Rusak Berat': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};
import SoftwareForm from './SoftwareForm';
import { Skeleton } from './Skeleton';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
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


interface RoomDetailProps {
  room: Room;
  calendarEvents: GoogleEvent[];
  isCalendarLoading: boolean;
  dominantSpec: any;
  roomSoftware: Software[];
  labStaff: StaffType[];
  isGapiReady: boolean;
  tokenClient: any;
  isGoogleAuthenticated: boolean;
  onAuthClick: () => void;
  onFetchEvents: () => void;
  onBackToList: () => void;
  onBooking: () => void;
  onManageComputers: () => void;
  canManage: boolean;
  editingSoftware: Partial<Software> | null;
  onSaveSoftware: (data: Partial<Software>) => void;
  onSetEditingSoftware: (data: Partial<Software> | null) => void;
  isSavingSoftware: boolean;
}

const RoomDetail: React.FC<RoomDetailProps> = ({
  room,
  calendarEvents,
  isCalendarLoading,
  dominantSpec,
  roomSoftware,
  labStaff,
  isGapiReady,
  tokenClient,
  isGoogleAuthenticated,
  onAuthClick,
  onFetchEvents,
  onBackToList,
  onBooking,
  onManageComputers,
  canManage,
  editingSoftware,
  onSaveSoftware,
  onSetEditingSoftware,
  isSavingSoftware
}) => {
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

  const handleDeleteSoftware = async (id: string) => {
    if (confirm("Hapus data software ini?")) {
      // This would trigger parent to handle delete via prop
      console.log('Delete software:', id); // Placeholder
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBackToList} className="text-sm text-blue-500 hover:underline mb-4 flex items-center">
        <ChevronLeft className="w-4 h-4 mr-1" /> Kembali ke daftar
      </button>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700">
        {/* 360 Viewer Container */}
        <div className="relative h-96 w-full bg-black group">
          <div id={`panorama-${room.id}`} className="w-full h-full"></div>
          <div className="absolute top-4 left-10 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center backdrop-blur-sm pointer-events-none z-10">
            <Eye className="w-4 h-4 mr-2" /> Tampilan Interaktif 360°
          </div>
        </div>
        
        <div className="p-8">
          <div className="flex flex-col md:flex-row justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{room.name}</h2>
              <div className="mb-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getConditionColor(room.category)}`}>
                  {room.category || 'Umum'}
                </span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 flex items-center flex-wrap gap-2 mb-4">
                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1"/> {room.floor || 'Lantai 4'}</span>
                <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
                <span className="flex items-center"><Users className="w-4 h-4 mr-1"/> Kapasitas: {room.capacity} Orang</span>
                {(room.computerCount && room.computerCount > 0) && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
                    <span className="flex items-center"><Monitor className="w-4 h-4 mr-1"/> {room.computerCount} Unit PC</span>
                  </>
                )}
                <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
                <span>PIC: {room.pic}</span>
              </p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
              {canManage && (
                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium flex items-center">
                  <Calendar className="w-4 h-4 mr-2"/> Atur Jadwal
                </button>
              )}
              <button 
                onClick={onBooking}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-md transition-colors"
              >
                Ajukan Peminjaman
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
            <div className="lg:col-span-2">
              <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">Deskripsi</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">{room.description}</p>
              
              <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">Fasilitas</h3>
              <div className="flex flex-wrap gap-2 mb-8">
                {room.facilities?.map((fac, idx) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                    {fac}
                  </span>
                ))}
              </div>

              {/* Dominant Spec */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
                    <Monitor className="w-5 h-5 mr-2 text-blue-500"/> Spesifikasi Komputer
                  </h3>
                  {canManage && (
                    <button 
                      onClick={onManageComputers}
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

              <div className="flex items-center text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <Check className="w-4 h-4 mr-2" />
                <span>Jadwal tersedia via CORE Calendar</span>
              </div>

              {/* Software Section */}
              {room.category === 'Laboratorium Komputer' && (
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
                      <Package className="w-5 h-5 mr-2 text-purple-500"/> Software Instalasi
                    </h3>
                    {canManage && (
                      <button 
                        onClick={() => onSetEditingSoftware({ name: '', version: '', licenseType: 'Free', category: '', notes: '' })}
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
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                                  sw.licenseType === 'Free' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 
                                  sw.licenseType === 'Commercial' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 
                                  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>
                                  {sw.licenseType}
                                </span>
                              )}
                            </div>
                            {canManage && (
                              <div className="flex space-x-1">
                                <button onClick={() => onSetEditingSoftware(sw)} className="text-blue-600 hover:text-blue-800 p-1">
                                  <Edit2 className="w-3 h-3"/>
                                </button>
                                <button onClick={() => handleDeleteSoftware(sw.id)} className="text-red-600 hover:text-red-800 p-1">
                                  <Trash2 className="w-3 h-3"/>
                                </button>
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
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white flex items-center justify-between shrink-0">
                <span className="flex items-center"><Calendar className="w-5 h-5 mr-2 text-blue-500"/> Jadwal Ruangan</span>
                {isGapiReady && (
                  <button onClick={onFetchEvents} className="text-gray-500 hover:text-blue-500" title="Refresh">
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

      <SoftwareForm
        isOpen={!!editingSoftware}
        onClose={() => onSetEditingSoftware(null)}
        onSave={onSaveSoftware}
        initialData={editingSoftware}
        isSaving={isSavingSoftware}
      />
    </div>
  );
};

export default RoomDetail;

