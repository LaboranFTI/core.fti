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
  pic_id?: string;
  pic: string;
  image: string;
  facilities: string[];
  floor?: string;
  googleCalendarUrl?: string;
  computerCount?: number;
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  responsiblePerson: string;
  contactPerson: string;
  purpose: string;
  date: string;
  startTime: string;
  endTime: string;
  schedules?: { date: string; startTime: string; endTime: string; kebutuhan?: string }[];
  proposalFile?: string;
  status: BookingStatus;
  rejectionReason?: string;
}
