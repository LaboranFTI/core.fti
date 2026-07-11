import { Role } from '../../types';

export const isRoleMatch = (role: Role | string, target: Role) =>
  role.toString().toUpperCase() === target.toString().toUpperCase();

export const isTuRole = (role: Role | string) =>
  isRoleMatch(role, Role.USER_TU) || isRoleMatch(role, Role.ADMIN_TU);

export const getDefaultRouteForRole = (role: Role | string) => {
  if (isTuRole(role)) return '/layanan-tu';
  if (isRoleMatch(role, Role.MAHASISWA)) return '/ruangan';
  return '/dashboard';
};

export const canBypassMaintenance = (role: Role | string) =>
  isRoleMatch(role, Role.ADMIN) ||
  isRoleMatch(role, Role.LABORAN) ||
  role.toString().toUpperCase() === Role.SUPERVISOR.toString().toUpperCase() ||
  isRoleMatch(role, Role.ADMIN_TU);
