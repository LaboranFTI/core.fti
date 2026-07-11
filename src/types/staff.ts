export interface StaffPositionPeriod {
  id: string;
  periodNumber: number;
  jabatan: string;
  startDate: string;
  endDate: string | null;
}

export interface LabStaff {
  id: string;
  name: string;
  nim: string;
  email: string;
  phone: string;
  type: 'Teknisi' | 'Admin';
  jabatan?: 'Admin' | 'Teknisi' | 'Supervisor' | 'Kepala Sarpras';
  keterangan?: string;
  assignedLabIds?: string[];
  assignedLabNames?: string[];
  positionStartDate?: string;
  positionEndDate?: string | null;
  positionPeriods?: StaffPositionPeriod[];
  status: 'Aktif' | 'Non-Aktif';
}

export interface PKLStudent {
  id: string;
  nama: string;
  sekolah: string;
  Jurusan: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  status: 'Aktif' | 'Selesai' | 'Dibatalkan';
  suratPengajuan?: string;
  hasSurat?: boolean;
  pembimbingId?: string;
  pembimbingNama?: string;
  createdAt?: string;
  updatedAt?: string;
}
