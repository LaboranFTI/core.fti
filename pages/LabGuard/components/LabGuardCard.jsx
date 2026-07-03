import PageCard from '../../../components/PageCard';

export default function LabGuardCard({ className = '', padding = 'sm', ...props }) {
  return <PageCard padding={padding} className={`rounded-lg ${className}`} {...props} />;
}
