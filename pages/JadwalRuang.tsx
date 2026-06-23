import React, { useState, useEffect } from 'react';
import { Role } from '../types';
import { Funnel as Filter } from '@phosphor-icons/react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import RoomCalendar from '../components/RoomCalendar';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useRooms } from '../hooks/useRooms';
import PageHeader from '../components/PageHeader';

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

  const roomSelectItems = React.useMemo(() => {
    return rooms.map(r => ({ label: r.name, value: r.id }));
  }, [rooms]);

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
      <PageHeader
        title="Jadwal Ruangan"
        description={
          <span>
            Jadwal Resmi Ruangan:{' '}
            <span className="font-bold text-sky-600 dark:text-sky-400">
              {selectedRoom?.name || 'Pilih Ruangan'}
            </span>
          </span>
        }
      />

      {/* RoomCalendar Component - handles all calendar rendering and modals */}
      <RoomCalendar
        selectedRoom={selectedRoom}
        googleApi={googleApi}
        role={role}
        showToast={showToast}
        getCalendarId={getCalendarId}
        filterComponent={
          <div className="w-full sm:w-64 md:w-72">
            <Select
              value={filterRoom || null}
              onValueChange={(val) => setFilterRoom(val ?? '')}
              disabled={isLoading}
              items={roomSelectItems}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500 shrink-0" />
                  <SelectValue placeholder={isLoading ? "Memuat ruangan..." : "Pilih Ruangan"} />
                </div>
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
};

export default JadwalRuang;
