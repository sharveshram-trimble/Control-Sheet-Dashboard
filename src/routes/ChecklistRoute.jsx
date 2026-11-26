import { useOutletContext } from 'react-router-dom';
import { ModusWcTypography } from '@trimble-oss/moduswebcomponents-react';
import ChecklistView from '../components/ChecklistView';

export default function ChecklistRoute() {
  const {
    items,
    onSelectControl,
    checklistFocusControl,
    onChecklistFocusHandled,
    onChecklistResult,
  } = useOutletContext();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ModusWcTypography
        hierarchy="h1"
        size="2xl"
        weight="semibold"
        label="Checklist"
      />
      <ChecklistView
        items={items}
        onSelectControl={onSelectControl}
        focusControl={checklistFocusControl}
        onFocusControlHandled={onChecklistFocusHandled}
        onChecklistResult={onChecklistResult}
      />
    </div>
  );
}
