import { useOutletContext } from 'react-router-dom';
import { ModusWcTypography } from '@trimble-oss/moduswebcomponents-react';
import ProcessAnalytics from '../components/ProcessAnalytics';

export default function ProgressRoute() {
  const { items, stats, ownerStats } = useOutletContext();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ModusWcTypography
        hierarchy="h1"
        size="2xl"
        weight="semibold"
        label="Progress"
      />
      <ProcessAnalytics items={items} stats={stats} ownerStats={ownerStats} />
    </div>
  );
}
