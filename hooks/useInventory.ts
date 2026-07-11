import { useState, useCallback, useEffect } from 'react';
import { inventoryApi } from '../services/inventoryService';
import { Equipment } from '../types';

interface UseInventoryOptions {
  autoFetch?: boolean;
}

export const useInventory = (options?: UseInventoryOptions) => {
  const { autoFetch = true } = options || {};

  const [items, setItems] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await inventoryApi.list();

      if (!response.ok) {
        throw new Error('Gagal mengambil data inventaris');
      }

      const data = await response.json();
      setItems(data);
      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Terjadi kesalahan saat memuat data inventaris';
      setError(errorMessage);
      console.error('Error fetching inventory:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchItems();
    }
  }, [fetchItems, autoFetch]);

  return { items, isLoading, error, fetchItems, setItems };
};
