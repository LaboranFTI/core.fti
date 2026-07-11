export const getStorageItem = (key: string) =>
  sessionStorage.getItem(key) || localStorage.getItem(key);

export const hasRememberedSession = () =>
  Boolean(localStorage.getItem('refreshToken') && localStorage.getItem('deviceId'));

export const clearAuthStorage = () => {
  const keys = ['isAuthenticated', 'currentRole', 'userName', 'userEmail', 'authToken', 'userId', 'refreshToken'];

  keys.forEach((key) => {
    localStorage.removeItem(key);
  });
  localStorage.removeItem('lastActivity');
  sessionStorage.clear();
};

export const getActiveAuthStorage = () =>
  sessionStorage.getItem('authToken') ? sessionStorage : localStorage;
