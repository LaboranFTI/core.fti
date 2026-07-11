export enum Role {
  ADMIN = 'Admin',
  LABORAN = 'Laboran',
  MAHASISWA = 'Mahasiswa',
  LEMBAGA_KEMAHASISWAAN = 'Lembaga Kemahasiswaan',
  DOSEN = 'Dosen',
  SUPERVISOR = 'Supervisor',
  USER_TU = 'User TU',
  ADMIN_TU = 'Admin TU',
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  identifier: string;
  department: string;
  status: 'Aktif' | 'Non-Aktif' | 'Reset';
  lastLogin?: string;
}
