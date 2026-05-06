import React, { useState, useEffect } from 'react';
import { Role, Room } from '../types';
import { 
  Filter, ExternalLink
} from 'lucide-react';
import RoomCalendar from '../components/RoomCalendar';
import { useGoogleCalendar, GoogleEvent } from '../hooks/useGoogleCalendar';
import { useRooms } from '../hooks/useRooms';

// Declare global types for Google API
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface ScheduleProps {
  role: Role;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  isDarkMode: boolean;
}

const JadwalRuang: React.FC<ScheduleProps> = ({ role, showToast, isDarkMode }) => {
  const { rooms, isLoading, error } = useRooms({ excludeImage: true });
  const [filterRoom, setFilterRoom] = useState<string>(''); 
  const selectedRoom = rooms.find(r => r.id === filterRoom);


  useEffect(() => {
    if (rooms.length > 0 && !filterRoom) {
      setFilterRoom(rooms[0].id);
    }
  }, [rooms, filterRoom]);

  useEffect(() => {
    if (error) {
      showToast(error, "error");
    }
  }, [error, showToast]);

  // Helper: Extract Calendar ID from Embed URL
  const getCalendarId = (input: string) => {
    if (!input) return null;
    const cleanInput = input.trim();
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
  const googleApi = useGoogleCalendar(role, showToast);

  return (
    <div className="space-y-6">
      {/* Header Section - Room Selection */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jadwal Ruang</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Jadwal Resmi Ruangan: <span className="font-bold text-blue-600 dark:text-blue-400">
              {selectedRoom?.name || 'Pilih Ruangan'}
            </span>
          </p>
        </div>
      </div>

      {/* Room Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full md:w-72">
                <Filter className="w-4 h-4 text-gray-400" />
                <select 
                    value={filterRoom}
                    onChange={(e) => setFilterRoom(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    disabled={isLoading}
                >
                    {isLoading && <option value="">Memuat ruangan...</option>}
                    {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
            </div>
            {selectedRoom?.googleCalendarUrl && role !== Role.MAHASISWA && role !== Role.LEMBAGA_KEMAHASISWAAN && role !== Role.DOSEN && (
                <a 
                    href={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(getCalendarId(selectedRoom.googleCalendarUrl) || '')}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center"
                >
                    Buka jadwal di Google Calendar <ExternalLink className="w-4 h-4 ml-1" />
                </a>
            )}
        </div>
      </div>

      {/* RoomCalendar Component - handles all calendar rendering and modals */}
      <RoomCalendar
        selectedRoom={selectedRoom}
        googleApi={googleApi}
        role={role}
        showToast={showToast}
        getCalendarId={getCalendarId}
      />
    </div>
  );
};

export default JadwalRuang;
