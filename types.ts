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

export enum BookingStatus {
  PENDING = 'Pending',
  APPROVED = 'Disetujui',
  REJECTED = 'Ditolak',
}

export interface Room {
  id: string;
  name: string;
  category?: string;
  description: string;
  capacity: number;
  pic_id?: string; // PIC Staff ID (foreign key to staff table)
  pic: string;
  image: string;
  facilities: string[];
  floor?: string;
  googleCalendarUrl?: string; // Public Embed URL
  computerCount?: number;
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  responsiblePerson: string; // New: Nama Penanggung Jawab
  contactPerson: string; // New: No HP / WA
  purpose: string;
  date: string; // YYYY-MM-DD (kept for backward compatibility)
  startTime: string; // HH:mm (kept for backward compatibility)
  endTime: string; // HH:mm (kept for backward compatibility)
  schedules?: { date: string; startTime: string; endTime: string }[]; // Multiple schedules support
  proposalFile?: string; // New: URL/Name of uploaded PDF
  status: BookingStatus;
  rejectionReason?: string; // Alasan penolakan
}

export interface Equipment {
  id: string;
  ukswCode: string;
  name: string;
  category: string;
  condition: 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
  isAvailable: boolean;
  serialNumber?: string;
  location?: string;
  vendor?: string;
}

export interface Loan {
  id: string;
  transactionId: string; // Grouping ID
  equipmentId: string;
  equipmentName: string;
  borrowerName: string;
  borrowOfficer: string; // Petugas Peminjaman
  returnOfficer?: string; // Petugas Pengembalian
  guarantee: string; // KTM / KTP
  borrowDate: string;
  borrowTime?: string; // Jam Peminjaman
  actualReturnDate?: string;
  actualReturnTime?: string; // Jam realisasi kembali
  status: 'Dipinjam' | 'Dikembalikan' | 'Terlambat';
  location?: string; // Lokasi peminjaman
  originalLocation?: string; // Lokasi asal sebelum dipinjam
  returnLocation?: string; // Lokasi pengembalian
  condition?: 'Baik' | 'Rusak Ringan' | 'Rusak Berat'; // Kondisi saat pengembalian
  actualReturnOfficer?: string;
  nim?: string;
}

export interface ItemMovement {
  id: string;
  inventoryId: string;
  inventoryName?: string;
  movementDate: string;
  movementType: 'Peminjaman' | 'Manual' | 'Pengembalian';
  fromPerson: string;
  toPerson: string;
  movedBy: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  notes?: string;
  loanId?: string;
  createdAt?: string;
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

export interface StaffPositionPeriod {
  id: string;
  periodNumber: number;
  jabatan: string;
  startDate: string;
  endDate: string | null;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  username?: string; // New Field
  role: string;
  identifier: string; // NIM or NIDN
  department: string; // Prodi / Unit
  status: 'Aktif' | 'Non-Aktif' | 'Reset';
  lastLogin?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  isRead: boolean;
}

export interface ToastMessage {
  id: string;
  message: any;
  type: 'success' | 'error' | 'info' | 'warning';
  sticky?: boolean;
}

export interface RoomComputer {
  id: string;
  roomId: string;
  pcNumber: string;
  cpu: string;
  gpuType: 'Integrated' | 'Dedicated';
  gpuModel: string;
  vram: string;
  ram: string;
  storage: string;
  os: string;
  keyboard: string;
  mouse: string;
  monitor: string;
  condition: 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
}

export interface PKLStudent {
  id: string;
  nama: string;
  sekolah: string;
  Jurusan: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  status: 'Aktif' | 'Selesai' | 'Dibatalkan';
  suratPengajuan?: string; // Base64 encoded PDF
  pembimbingId?: string;
  pembimbingNama?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Software {
  id: string;
  name: string;
  version: string;
  licenseType: 'Free' | 'Commercial' | 'Open Source';
  licenseKey?: string;
  vendor?: string;
  installDate?: string;
  roomId?: string;
  notes?: string;
  category?: string; // e.g., Operating System, Development Tool, Antivirus, etc.
}

export interface ObservationData {
  recipientName: string;
  companyName: string;
  companyAddress: string;
  courseName: string;
  lecturerName: string;
  headOfProgramName: string;
  studyProgramId?: string;
  studyProgramName?: string;
  studyProgramLevel?: string;
  students: { name: string; nim: string }[];
}
