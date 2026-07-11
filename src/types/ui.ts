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
