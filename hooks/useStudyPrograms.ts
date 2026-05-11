import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';

export interface StudyProgram {
  id: string;
  name: string;
  level: string;
  created_at?: string;
  updated_at?: string;
}

export interface KaprodiInfo {
  id: string;
  nama: string;
  jabatan: string;
  study_program_id: string;
}

interface UseStudyProgramsOptions {
  autoFetch?: boolean;
}

export const useStudyPrograms = (options?: UseStudyProgramsOptions) => {
  const { autoFetch = true } = options || {};

  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchStudyPrograms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api('/api/study-programs');

      if (!response.ok) {
        throw new Error('Gagal mengambil data program studi');
      }

      const data = await response.json();
      setStudyPrograms(data);
      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Terjadi kesalahan saat memuat data program studi';
      setError(errorMessage);
      console.error('Error fetching study programs:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchKaprodi = useCallback(async (studyProgramId: string): Promise<KaprodiInfo | null> => {
    try {
      const response = await api(`/api/study-programs/${studyProgramId}/kaprodi`);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.found ? data.kaprodi : null;
    } catch (err) {
      console.error('Error fetching kaprodi:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchStudyPrograms();
    } else {
      setIsLoading(false);
    }
  }, [fetchStudyPrograms, autoFetch]);

  return { studyPrograms, isLoading, error, fetchStudyPrograms, fetchKaprodi };
};
