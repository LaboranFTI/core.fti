import { CheckCircle as CheckCircle2, UploadSimple as Upload } from '@phosphor-icons/react';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { api } from '../../services/api';

export function MobileUpload({ sessionId }: { sessionId: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await api(`/api/upload-session/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: reader.result,
            fileName: file.name
          })
        });
        if (res.ok) {
          setIsSuccess(true);
        }
      } catch (error) {
        console.error('Upload failed', error);
        alert('Gagal mengupload file');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-8 shadow-lg border-0 ring-1 ring-slate-900/5 dark:ring-gray-700">
          <CardContent>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Upload Berhasil!</h2>
            <p className="text-slate-500 dark:text-gray-400 mt-2">File transkrip Anda telah berhasil dikirim ke layar komputer. Anda boleh menutup halaman ini.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-0 ring-1 ring-slate-900/5 dark:ring-gray-700">
        <CardHeader className="text-center bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <CardTitle className="text-xl text-slate-800 dark:text-white">Upload Transkrip</CardTitle>
          <CardDescription className="dark:text-gray-400">Pilih file PDF transkrip nilai dari HP Anda</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mt-2 flex justify-center rounded-lg border border-dashed border-slate-300 dark:border-gray-600 px-6 py-12 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
              <div className="mt-4 flex text-sm leading-6 text-slate-600 justify-center">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md bg-transparent font-semibold text-indigo-600 dark:text-indigo-400 focus-within:outline-none hover:text-indigo-500"
                >
                  <span>{isUploading ? 'Mengupload...' : 'Pilih file PDF'}</span>
                  <input id="file-upload" type="file" accept=".pdf" className="sr-only" onChange={handleFileChange} disabled={isUploading} />
                </label>
              </div>
              <p className="text-xs leading-5 text-slate-500 dark:text-gray-400 mt-2">PDF up to 10MB</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
