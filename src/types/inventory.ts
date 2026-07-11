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
  transactionId: string;
  equipmentId: string;
  equipmentName: string;
  borrowerName: string;
  borrowOfficer: string;
  returnOfficer?: string;
  guarantee: string;
  borrowDate: string;
  borrowTime?: string;
  actualReturnDate?: string;
  actualReturnTime?: string;
  status: 'Dipinjam' | 'Dikembalikan' | 'Terlambat';
  location?: string;
  originalLocation?: string;
  returnLocation?: string;
  condition?: 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
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
