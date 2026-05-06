import {
  Archive,
  ArrowRightLeft,
  BookOpen,
  Box,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  DoorOpen,
  FileText,
  GraduationCap,
  Info,
  LayoutDashboard,
  LucideIcon,
  Settings,
  Users,
  Wrench,
} from "lucide-react";

import { Role } from "../types";

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

export interface NavigationGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavigationItem[];
}

const hasRoleMatch = (currentRole: Role, targetRole: Role) =>
  currentRole.toString().toUpperCase() === targetRole.toString().toUpperCase();

export const mainNavigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [
      Role.ADMIN,
      Role.LABORAN,
      Role.LEMBAGA_KEMAHASISWAAN,
      Role.DOSEN,
      Role.SUPERVISOR,
      Role.ADMIN_TU,
    ],
  },
  {
    id: "ruangan",
    label: "Daftar Ruangan",
    icon: DoorOpen,
    roles: [
      Role.MAHASISWA,
      Role.ADMIN,
      Role.LABORAN,
      Role.LEMBAGA_KEMAHASISWAAN,
      Role.DOSEN,
      Role.SUPERVISOR,
      Role.ADMIN_TU,
    ],
  },
  {
    id: "pesanan-ruang",
    label: "Pesanan Ruang",
    icon: ClipboardCheck,
    roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
  },
  {
    id: "inventaris",
    label: "Inventaris",
    icon: Archive,
    roles: [Role.MAHASISWA, Role.ADMIN, Role.LABORAN, Role.LEMBAGA_KEMAHASISWAAN, Role.DOSEN, Role.SUPERVISOR],
  },
  {
    id: "pemesanan-saya",
    label: "Pemesanan Saya",
    icon: ClipboardList,
    roles: [Role.LEMBAGA_KEMAHASISWAAN, Role.ADMIN_TU],
  },
  {
    id: "layanan-tu",
    label: "Layanan TU",
    icon: FileText,
    roles: [
      Role.ADMIN,
      Role.LABORAN,
      Role.DOSEN,
      Role.SUPERVISOR,
      Role.USER_TU,
      Role.ADMIN_TU,
    ],
  },
];

export const navigationGroups: NavigationGroup[] = [
  {
    id: "jadwal",
    title: "Jadwal",
    icon: CalendarRange,
    items: [
      {
        id: "jadwal-ruang",
        label: "Jadwal Ruang",
        icon: CalendarRange,
        roles: [
          Role.MAHASISWA,
          Role.ADMIN,
          Role.LABORAN,
          Role.LEMBAGA_KEMAHASISWAAN,
          Role.DOSEN,
          Role.SUPERVISOR,
          Role.ADMIN_TU,
        ],
      },
      {
        id: "jadwal-kuliah",
        label: "Jadwal Kuliah",
        icon: BookOpen,
        roles: [Role.ADMIN, Role.LABORAN, Role.DOSEN, Role.SUPERVISOR],
      },
      {
        id: "acara",
        label: "Acara",
        icon: CalendarDays,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
    ],
  },
  {
    id: "manajemen",
    title: "Manajemen",
    icon: Users,
    items: [
      {
        id: "manajemen-user",
        label: "Manajemen User",
        icon: Users,
        roles: [Role.ADMIN],
      },
      {
        id: "manajemen-laboran",
        label: "Manajemen Laboran",
        icon: Wrench,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
      {
        id: "manajemen-pkl",
        label: "Manajemen PKL",
        icon: GraduationCap,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
      {
        id: "manajemen-spesifikasi",
        label: "Spesifikasi & Software",
        icon: Cpu,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
    ],
  },
  {
    id: "transaksi",
    title: "Transaksi",
    icon: Box,
    items: [
      {
        id: "peminjaman-barang",
        label: "Peminjaman Barang",
        icon: Box,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
      {
        id: "perpindahan-barang",
        label: "Perpindahan Barang",
        icon: ArrowRightLeft,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
    ],
  },
  {
    id: "pengaturan",
    title: "Pengaturan",
    icon: Settings,
    items: [
      {
        id: "pengaturan",
        label: "Pengaturan",
        icon: Settings,
        roles: [Role.ADMIN],
      },
      {
        id: "profil",
        label: "Profile",
        icon: Users,
        roles: [
          Role.MAHASISWA,
          Role.ADMIN,
          Role.LABORAN,
          Role.LEMBAGA_KEMAHASISWAAN,
          Role.DOSEN,
          Role.SUPERVISOR,
          Role.USER_TU,
          Role.ADMIN_TU,
        ],
      },
      {
        id: "tentang",
        label: "Tentang",
        icon: Info,
        roles: [
          Role.MAHASISWA,
          Role.ADMIN,
          Role.LABORAN,
          Role.LEMBAGA_KEMAHASISWAAN,
          Role.DOSEN,
          Role.SUPERVISOR,
          Role.USER_TU,
          Role.ADMIN_TU,
        ],
      },
    ],
  },
];

const allNavigationItems = [
  ...mainNavigationItems,
  ...navigationGroups.flatMap((group) => group.items),
];

export const isNavigationItemVisible = (
  currentRole: Role,
  item: NavigationItem,
) => item.roles.some((role) => hasRoleMatch(currentRole, role));

export const getVisibleMainItems = (currentRole: Role) =>
  mainNavigationItems.filter((item) =>
    isNavigationItemVisible(currentRole, item),
  );

export const getVisibleNavigationGroups = (currentRole: Role) =>
  navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        isNavigationItemVisible(currentRole, item),
      ),
    }))
    .filter((group) => group.items.length > 0);

export const getNavigationItemById = (id: string) =>
  allNavigationItems.find((item) => item.id === id);

export const getNavigationLabel = (id: string) =>
  getNavigationItemById(id)?.label || "CORE.FTI";

export const getMobilePrimaryItems = (currentRole: Role) => {
  const preferredOrder = [
    "ruangan",
    "pesanan-ruang",
    "inventaris",
    "pemesanan-saya",
    "layanan-tu",
    "profil",
    "tentang",
  ];

  const visibleItems = preferredOrder
    .map((id) => getNavigationItemById(id))
    .filter(
      (item): item is NavigationItem =>
        Boolean(item) && isNavigationItemVisible(currentRole, item),
    );

  return visibleItems;
};
