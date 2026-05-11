import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';

// Anda bisa memindahkan interface ini ke file types.ts jika diperlukan
export interface Lecturer {
  id: string;
  nama: string;
  jabatan?: string;
  study_program_id?: string;
  study_program_name?: string;
  study_program_level?: string;
  created_at?: string;
  updated_at?: string;
}

interface UseLecturersOptions {
  autoFetch?: boolean;
}

export const useLecturers = (options?: UseLecturersOptions) => {
  const { autoFetch = true } = options || {};

  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchLecturers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api('/api/lecturers');

      if (!response.ok) {
        throw new Error('Gagal mengambil data dosen');
      }

      const data = await response.json();
      setLecturers(data);
      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Terjadi kesalahan saat memuat data dosen';
      setError(errorMessage);
      console.error('Error fetching lecturers:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchLecturers();
    } else {
      setIsLoading(false);
    }
  }, [fetchLecturers, autoFetch]);

  return { lecturers, isLoading, error, fetchLecturers, setLecturers };
};