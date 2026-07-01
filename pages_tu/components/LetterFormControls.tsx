import React from 'react';
import { ChevronDown, Download, FileText, Loader2, Mail, QrCode } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { CardDescription, CardTitle } from '../../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../components/ui/dropdown-menu';
import { PageTabs } from '../../components/ui/page-tabs';
import { Tabs } from '../../components/ui/tabs';
import { cn } from '../../lib/utils';

interface LetterFormHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function LetterFormHeader({ title, description, action }: LetterFormHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <CardTitle className="text-balance text-xl font-bold text-slate-800 dark:text-white">
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-pretty text-slate-500 dark:text-gray-400">
            {description}
          </CardDescription>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface LetterModeTabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ElementType;
  disabled?: boolean;
}

interface LetterModeTabsProps<T extends string> {
  value: T;
  items: LetterModeTabItem<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function LetterModeTabs<T extends string>({ value, items, onChange, className }: LetterModeTabsProps<T>) {
  return (
    <Tabs value={value} onValueChange={(nextValue) => onChange(nextValue as T)} className={cn('shrink-0', className)}>
      <PageTabs
        items={items}
        className="w-fit max-w-full"
        triggerClassName="flex-none justify-center px-3"
      />
    </Tabs>
  );
}

interface LetterActionMenuProps {
  disabled?: boolean;
  isDownloadingPdf?: boolean;
  isGeneratingQr?: boolean;
  isSendingEmail?: boolean;
  onDownloadPdf: () => void;
  onGenerateQr: () => void;
  onSendEmail: () => void;
  className?: string;
  emailDescription?: string;
}

export function LetterActionMenu({
  disabled = false,
  isDownloadingPdf = false,
  isGeneratingQr = false,
  isSendingEmail = false,
  onDownloadPdf,
  onGenerateQr,
  onSendEmail,
  className,
  emailDescription
}: LetterActionMenuProps) {
  const isBusy = isDownloadingPdf || isGeneratingQr || isSendingEmail;
  const label = isDownloadingPdf
    ? 'Mengunduh PDF...'
    : isGeneratingQr
      ? 'Membuat QR...'
      : isSendingEmail
        ? 'Mengirim Email...'
        : 'Aksi Surat';

  return (
    <div className={cn('w-full sm:w-auto', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            disabled={disabled || isBusy}
            className="h-11 w-full bg-blue-600 px-5 text-base text-white shadow-sm hover:bg-blue-700 sm:w-auto sm:min-w-44"
          >
            {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {label}
            {!isBusy && <ChevronDown className="ml-2 h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuItem onSelect={onDownloadPdf} className="gap-3 py-3">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">Unduh PDF</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onGenerateQr} className="gap-3 py-3">
            <QrCode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">Buat QR Validasi</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSendEmail} className="gap-3 py-3">
            <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
            <div>
              <span className="font-medium">Kirim via Email</span>
              {emailDescription && <p className="text-xs text-slate-400 dark:text-slate-500">{emailDescription}</p>}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
