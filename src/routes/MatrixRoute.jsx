import { useOutletContext } from 'react-router-dom';
import { ModusWcTypography } from '@trimble-oss/moduswebcomponents-react';
import ControlSheetTable from '../components/ControlSheetTable';

export default function MatrixRoute() {
  const { items, onSelectControl, showToast } = useOutletContext();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ModusWcTypography
        hierarchy="h1"
        size="2xl"
        weight="semibold"
        label="Matrix"
      />
      <ControlSheetTable
        items={items}
        onSelectControl={onSelectControl}
        showToast={showToast}
      />
    </div>
  );
}
