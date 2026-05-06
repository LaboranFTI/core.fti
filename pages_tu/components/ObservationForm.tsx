import React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { ObservationData } from '../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, Trash2, Printer, Download, Building2, GraduationCap, Users, Loader2 } from 'lucide-react';

interface ObservationFormProps {
  onDataChange: (data: ObservationData) => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  isDownloadingPdf?: boolean;
  readOnly?: boolean;
  feedback?: {
    type: 'success' | 'error' | 'info';
    message: string;
  } | null;
}

export function ObservationForm({ onDataChange, onPrint, onDownloadPdf, isDownloadingPdf = false, readOnly = false, feedback = null }: ObservationFormProps) {
  const { register, control, watch, getValues } = useForm<ObservationData>({
    defaultValues: {
      recipientName: '',
      companyName: '',
      companyAddress: '',
      courseName: '',
      lecturerName: '',
      headOfProgramName: '',
      students: [{ name: '', nim: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "students"
  });

  // Watch for changes and pass them up
  React.useEffect(() => {
    onDataChange(getValues());
    const subscription = watch((value: any) => {
      onDataChange(value as ObservationData);
    });
    return () => subscription.unsubscribe();
  }, [getValues, watch, onDataChange]);

  return (
    <Card className="w-full shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden">
      <CardHeader className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
        <CardTitle className="text-xl text-slate-800 dark:text-white font-bold">Formulir Pengisian</CardTitle>
        <CardDescription className="text-slate-500 dark:text-gray-400">Lengkapi data di bawah ini. Preview surat di sebelah kanan akan diperbarui otomatis.</CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          <div className="px-6 py-4 bg-blue-50/80 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
            {readOnly
              ? 'Role Mahasiswa hanya memiliki akses baca pada tab surat ijin observasi. Form, download PDF, dan cetak dinonaktifkan.'
              : 'Surat observasi ini dibuat langsung oleh mahasiswa tanpa menunggu proses admin. Isi data secara bertahap lalu unduh PDF saat preview sudah sesuai.'}
          </div>

          {feedback && (
            <div className={`mx-6 my-5 rounded-2xl border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                : feedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
                  : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300'
            }`}>
              {feedback.message}
            </div>
          )}
          
          {/* Company Details */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 space-y-5">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
              <Building2 className="w-5 h-5" />
              <h3 className="font-semibold text-lg">Data Perusahaan Tujuan</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
            <Label htmlFor="recipientName" className="text-slate-700 dark:text-slate-300 font-medium">Nama Penerima / Jabatan</Label>
            <Input id="recipientName" placeholder="Contoh: HRD Manager" className="bg-white dark:bg-gray-800" disabled={readOnly} {...register("recipientName")} />
              </div>
              
              <div className="space-y-1.5">
            <Label htmlFor="companyName" className="text-slate-700 dark:text-slate-300 font-medium">Nama Perusahaan / Instansi</Label>
            <Input id="companyName" placeholder="Contoh: PT. Teknologi Nusantara" className="bg-white dark:bg-gray-800" disabled={readOnly} {...register("companyName")} />
              </div>
              
              <div className="space-y-1.5">
            <Label htmlFor="companyAddress" className="text-slate-700 dark:text-slate-300 font-medium">Alamat Perusahaan</Label>
            <Textarea
              id="companyAddress"
              placeholder="Contoh: Jl. Sudirman No. 123, Jakarta"
              className="resize-y bg-white dark:bg-gray-800"
              size="sm"
              disabled={readOnly}
              {...register("companyAddress")}
            />
              </div>
            </div>
          </div>

          {/* Academic Details */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 space-y-5">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
              <GraduationCap className="w-5 h-5" />
              <h3 className="font-semibold text-lg">Data Akademik & Pengesahan</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
            <Label htmlFor="courseName" className="text-slate-700 dark:text-slate-300 font-medium">Nama Mata Kuliah</Label>
                <Input id="courseName" placeholder="Contoh: Rekayasa Perangkat Lunak" disabled={readOnly} {...register("courseName")} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
              <Label htmlFor="lecturerName" className="text-slate-700 dark:text-slate-300 font-medium">Nama Dosen Pengampu</Label>
                  <Input id="lecturerName" placeholder="Nama lengkap beserta gelar" disabled={readOnly} {...register("lecturerName")} />
                </div>
                <div className="space-y-1.5">
              <Label htmlFor="headOfProgramName" className="text-slate-700 dark:text-slate-300 font-medium">Nama Kaprodi</Label>
                  <Input id="headOfProgramName" placeholder="Nama lengkap beserta gelar" disabled={readOnly} {...register("headOfProgramName")} />
                </div>
              </div>
            </div>
          </div>

          {/* Student Details */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Users className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Anggota Kelompok</h3>
              </div>
          <span className="text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">
                {fields.length} / 10
              </span>
            </div>
            
            <div className="space-y-3">
              {fields.map((field: { id: string }, index: number) => (
                <div key={field.id} className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold mt-2.5">
                    {index + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Lengkap</Label>
                      <Input placeholder="Nama Mahasiswa" disabled={readOnly} {...register(`students.${index}.name` as const)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">NIM</Label>
                      <Input placeholder="672019000" disabled={readOnly} {...register(`students.${index}.nim` as const)} />
                    </div>
                  </div>
                  {fields.length > 1 && !readOnly && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 mt-6"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button 
              type="button" 
              variant="outline" 
          className="w-full border-dashed border-2 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 text-slate-500 dark:text-slate-400 dark:border-slate-700"
              onClick={() => {
                if (fields.length < 10) append({ name: '', nim: '' });
              }}
              disabled={readOnly || fields.length >= 10}
            >
              <Plus className="w-4 h-4 mr-2" /> Tambah Anggota Kelompok
            </Button>
          </div>

          {/* Actions */}
      <div className="p-6 bg-white dark:bg-gray-800 flex flex-col sm:flex-row gap-3">
        <Button onClick={onDownloadPdf} disabled={readOnly || isDownloadingPdf} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-11 text-base">
              {isDownloadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {isDownloadingPdf ? 'Menyiapkan PDF...' : 'Download PDF'}
            </Button>
        <Button onClick={onPrint} disabled={readOnly} variant="outline" className="flex-1 h-11 text-base border-slate-300 dark:border-slate-600">
              <Printer className="w-4 h-4 mr-2" /> Cetak Langsung
            </Button>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
