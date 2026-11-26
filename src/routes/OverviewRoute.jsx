import { useOutletContext } from 'react-router-dom';
import { ModusWcTypography } from '@trimble-oss/moduswebcomponents-react';
import TwoColumnOwners from '../components/TwoColumnOwners';

export default function OverviewRoute() {
  const { ownerStats, onSelectControl, onRunChecklist, showToast, onSendIncompleteMail } =
    useOutletContext();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ModusWcTypography
        hierarchy="h1"
        size="2xl"
        weight="semibold"
        label="Overview"
      />
      <TwoColumnOwners
        ownerStats={ownerStats}
        onSelectControl={onSelectControl}
        onRunChecklist={onRunChecklist}
        showToast={showToast}
        onSendIncompleteMail={onSendIncompleteMail}
      />
    </div>
  );
}
