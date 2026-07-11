import { CheckCircle, Clock as Clock3, EnvelopeSimple as Mail } from '@phosphor-icons/react';
import { Badge } from '../../../components/ui/badge';

interface ArchiveStatusBadgeProps {
  status: string;
}

export function ArchiveStatusBadge({ status }: ArchiveStatusBadgeProps) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Clock3 className="mr-1 h-3 w-3" /> Menunggu
        </Badge>
      );
    case 'verified':
      return (
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
          <CheckCircle className="mr-1 h-3 w-3" /> Terverifikasi
        </Badge>
      );
    case 'sent':
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Mail className="mr-1 h-3 w-3" /> Terkirim
        </Badge>
      );
    default:
      return <Badge variant="outline" className="dark:border-gray-700 dark:text-gray-300">{status}</Badge>;
  }
}
