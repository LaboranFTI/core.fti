import { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface Announcement {
  active: boolean;
  message: string;
  type: string;
}

export const useSystemStatus = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const [maintenanceResponse, announcementResponse] = await Promise.all([
          api('/api/settings/maintenance'),
          api('/api/settings/announcement')
        ]);

        if (maintenanceResponse.ok) {
          setIsMaintenanceMode((await maintenanceResponse.json()).enabled);
        }
        if (announcementResponse.ok) {
          setAnnouncement(await announcementResponse.json());
        }
      } catch {
        setIsMaintenanceMode(false);
      }
    };

    checkSystemStatus();

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return {
    isLoading,
    setIsLoading,
    isMaintenanceMode,
    announcement
  };
};
