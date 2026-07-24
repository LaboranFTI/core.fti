import {
  Archive,
  ArrowsLeftRight,
  Backpack,
  BookOpen,
  Books,
  CalendarBlank,
  CalendarCheck,
  CalendarDots,
  ClipboardText,
  Cpu,
  Cube,
  DoorOpen,
  FileText,
  Gauge,
  GearSix,
  GraduationCap,
  Info,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  UserGear,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";

import { Role } from "../types";

export interface NavigationItem {
  id: string;
  label: string;
  icon: Icon;
  roles: Role[];
  url?: string;
}

export interface NavigationGroup {
  id: string;
  title: string;
  icon: Icon;
  items: NavigationItem[];
}

const hasRoleMatch = (currentRole: Role, targetRole: Role) =>
  currentRole.toString().toUpperCase() === targetRole.toString().toUpperCase();

export const mainNavigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
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
    icon: CalendarCheck,
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
    icon: ClipboardText,
    roles: [Role.LEMBAGA_KEMAHASISWAAN, Role.ADMIN_TU],
  },
  {
    id: "layanan-tu",
    label: "Layanan Surat",
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
  {
    id: "labguard",
    label: "LabGuard",
    icon: ShieldCheck,
    roles: [
      Role.ADMIN,
      Role.LABORAN,
      Role.SUPERVISOR,
    ],
  },
];

export const navigationGroups: NavigationGroup[] = [
  {
    id: "jadwal",
    title: "Jadwal",
    icon: CalendarBlank,
    items: [
      {
        id: "jadwal-ruang",
        label: "Ruang",
        icon: CalendarBlank,
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
        label: "Kuliah",
        icon: BookOpen,
        roles: [Role.ADMIN, Role.LABORAN, Role.DOSEN, Role.SUPERVISOR],
      },
      {
        id: "acara",
        label: "Acara",
        icon: CalendarDots,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
    ],
  },
  {
    id: "manajemen",
    title: "Manajemen",
    icon: SlidersHorizontal,
    items: [
      {
        id: "manajemen-user",
        label: "User",
        icon: UsersThree,
        roles: [Role.ADMIN],
      },
      {
        id: 'manajemen-dosen',
        label: 'Dosen',
        icon: GraduationCap,
        roles: [Role.ADMIN, Role.ADMIN_TU] // Restriksi Role
      },
      {
        id: "manajemen-program-studi",
        label: "Program Studi",
        icon: Books,
        roles: [Role.ADMIN, Role.ADMIN_TU],
      },
      {
        id: "manajemen-laboran",
        label: "Laboran",
        icon: UserGear,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
      {
        id: "manajemen-pkl",
        label: "PKL",
        icon: Backpack,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
      {
        id: "manajemen-spesifikasi",
        label: "Spesifikasi Lab",
        icon: Cpu,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },

    ],
  },
  {
    id: "transaksi",
    title: "Transaksi",
    icon: Cube,
    items: [
      {
        id: "peminjaman-barang",
        label: "Peminjaman Barang",
        icon: Cube,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
      {
        id: "perpindahan-barang",
        label: "Perpindahan Barang",
        icon: ArrowsLeftRight,
        roles: [Role.ADMIN, Role.LABORAN, Role.SUPERVISOR],
      },
    ],
  },
  {
    id: "pengaturan",
    title: "Pengaturan",
    icon: GearSix,
    items: [
      {
        id: "pengaturan",
        label: "Pengaturan",
        icon: GearSix,
        roles: [Role.ADMIN],
      },
      {
        id: "profil",
        label: "Profile",
        icon: UserCircle,
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
        item != null && isNavigationItemVisible(currentRole, item),
    );

  return visibleItems;
};
