import React, { useState, useEffect } from 'react';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import SearchableSelect, { SelectOption } from '../../components/SearchableSelect';
import { api } from '../../services/api';

interface WilayahAddressInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const WilayahAddressInput: React.FC<WilayahAddressInputProps> = ({ id, value, onChange, disabled }) => {
  const [provinces, setProvinces] = useState<SelectOption[]>([]);
  const [regencies, setRegencies] = useState<SelectOption[]>([]);
  const [districts, setDistricts] = useState<SelectOption[]>([]);
  const [villages, setVillages] = useState<SelectOption[]>([]);

  const [selectedProv, setSelectedProv] = useState<SelectOption | null>(null);
  const [selectedReg, setSelectedReg] = useState<SelectOption | null>(null);
  const [selectedDist, setSelectedDist] = useState<SelectOption | null>(null);
  const [selectedVill, setSelectedVill] = useState<SelectOption | null>(null);

  const [streetAddress, setStreetAddress] = useState('');
  
  // This helps prevent infinite loops when setting value from outside
  const [isInternalChange, setIsInternalChange] = useState(false);

  // Parse external value on mount or when it changes externally
  // But wait, it's very hard to parse a free-text string back into 4 IDs.
  // We'll just let the user reset it if they edit, or we only use this for new submissions.
  // Actually, since these are just creation forms for students, we don't need to pre-fill regions perfectly from a single string.
  // If `value` is provided from outside and it doesn't match our built string, we can just put it in `streetAddress`
  // so the user doesn't lose data.
  useEffect(() => {
    if (!isInternalChange && value) {
       // if we haven't selected everything, just put the whole value in street address
       if (!selectedProv && !streetAddress) {
           setStreetAddress(value);
       }
    }
  }, [value]);

  // Initial fetch provinces
  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const res = await api('/api/wilayah/provinces');
        const json = await res.json();
        setProvinces(json.map((item: any) => ({ value: item.kode, label: item.nama })));
      } catch (err) {
        console.error('Failed to fetch provinces', err);
      }
    };
    fetchProvinces();
  }, []);

  // Effect to generate final address string whenever components change
  useEffect(() => {
    let combined = streetAddress;
    
    if (selectedProv && selectedReg && selectedDist && selectedVill) {
      const parts = [];
      if (streetAddress.trim()) parts.push(streetAddress.trim());
      parts.push(`Kel. ${selectedVill.label}`);
      parts.push(`Kec. ${selectedDist.label}`);
      parts.push(`${selectedReg.label}`);
      parts.push(`Provinsi ${selectedProv.label}`);
      
      combined = parts.join(', ');
    }
    
    // Only call onChange if it differs
    if (combined !== value) {
      setIsInternalChange(true);
      onChange(combined);
      setTimeout(() => setIsInternalChange(false), 50);
    }
  }, [selectedProv, selectedReg, selectedDist, selectedVill, streetAddress]);

  // Handle Province Change
  const handleProvChange = async (val: string) => {
    const opt = provinces.find(p => p.value === val) || null;
    setSelectedProv(opt);
    setSelectedReg(null);
    setSelectedDist(null);
    setSelectedVill(null);
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
    
    if (val) {
      try {
        const res = await api(`/api/wilayah/regencies/${val}`);
        const json = await res.json();
        setRegencies(json.map((item: any) => ({ value: item.kode, label: item.nama })));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Handle Regency Change
  const handleRegChange = async (val: string) => {
    const opt = regencies.find(p => p.value === val) || null;
    setSelectedReg(opt);
    setSelectedDist(null);
    setSelectedVill(null);
    setDistricts([]);
    setVillages([]);
    
    if (val) {
      try {
        const res = await api(`/api/wilayah/districts/${val}`);
        const json = await res.json();
        setDistricts(json.map((item: any) => ({ value: item.kode, label: item.nama })));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Handle District Change
  const handleDistChange = async (val: string) => {
    const opt = districts.find(p => p.value === val) || null;
    setSelectedDist(opt);
    setSelectedVill(null);
    setVillages([]);
    
    if (val) {
      try {
        const res = await api(`/api/wilayah/villages/${val}`);
        const json = await res.json();
        setVillages(json.map((item: any) => ({ value: item.kode, label: item.nama })));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleVillChange = (val: string) => {
    const opt = villages.find(p => p.value === val) || null;
    setSelectedVill(opt);
  };

  return (
    <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-500">Provinsi</Label>
          <SearchableSelect
            options={provinces}
            value={selectedProv?.value || ''}
            onChange={handleProvChange}
            placeholder="Pilih Provinsi..."
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-500">Kabupaten/Kota</Label>
          <SearchableSelect
            options={regencies}
            value={selectedReg?.value || ''}
            onChange={handleRegChange}
            placeholder="Pilih Kabupaten/Kota..."
            disabled={disabled || !selectedProv}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-500">Kecamatan</Label>
          <SearchableSelect
            options={districts}
            value={selectedDist?.value || ''}
            onChange={handleDistChange}
            placeholder="Pilih Kecamatan..."
            disabled={disabled || !selectedReg}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-500">Kelurahan/Desa</Label>
          <SearchableSelect
            options={villages}
            value={selectedVill?.value || ''}
            onChange={handleVillChange}
            placeholder="Pilih Kelurahan..."
            disabled={disabled || !selectedDist}
          />
        </div>
      </div>
      
      <div className="space-y-1.5 pt-2">
        <Label htmlFor={id} className="text-xs font-semibold text-slate-500">Nama Jalan / Detail Gedung</Label>
        <Textarea
          id={id}
          placeholder="Contoh: Jl. Sudirman No. 123, Gedung A Lantai 2"
          className="resize-y bg-white dark:bg-gray-800 text-sm"
          disabled={disabled}
          value={streetAddress}
          onChange={(e) => setStreetAddress(e.target.value)}
          rows={2}
        />
        {/* Hidden input to store the final combined value for react-hook-form or parent state */}
        <input type="hidden" value={value || ''} readOnly />
      </div>
      
      {selectedProv && selectedReg && selectedDist && selectedVill && (
        <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-900 p-2 rounded">
          <span className="font-semibold block mb-1">Pratinjau Alamat Lengkap:</span>
          {streetAddress ? `${streetAddress}, ` : ''}Kel. {selectedVill.label}, Kec. {selectedDist.label}, {selectedReg.label}, Provinsi {selectedProv.label}
        </div>
      )}
    </div>
  );
};
