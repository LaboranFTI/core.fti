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
  category?: string;
  /** @deprecated gunakan installDate sebagai gantinya */
  lastLogin?: string;
}
