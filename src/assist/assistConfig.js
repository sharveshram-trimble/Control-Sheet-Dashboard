/**
 * Trimble Assist (Agent Studio) embed settings.
 * Agent UUID comes from the agent details page in Agent Studio.
 * Packages install from Trimble Artifactory via .npmrc (see .npmrc.example).
 */

function trim(value) {
  return String(value || '').trim();
}

export function getAssistConfig() {
  const agentId = trim(import.meta.env.VITE_ASSIST_AGENT_ID);
  const environmentRaw = trim(
    import.meta.env.VITE_ASSIST_ENVIRONMENT || 'stage'
  ).toLowerCase();
  const environment =
    environmentRaw === 'prod' || environmentRaw === 'production'
      ? 'prod'
      : 'stage';
  const runtimeRaw = trim(
    import.meta.env.VITE_AGENT_RUNTIME || 'api'
  ).toLowerCase();
  // `api` = Agents API with SPA user token; `assist` = Assist iframe embed.
  const runtime = runtimeRaw === 'assist' ? 'assist' : 'api';

  return {
    agentId,
    environment,
    runtime,
    configured: Boolean(agentId),
  };
}

/** Calendar quarter → Drive Link Qn column on the control sheet. */
export function currentCalendarQuarter(date = new Date()) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q}`;
}

export function driveLinkForQuarter(control, quarter) {
  if (!control || !quarter) return '';
  const key = `Drive Link ${quarter}`;
  return String(control[key] || '')
    .replace(/\u200b/g, '')
    .trim();
}

/**
 * CHECKLIST column value, or '' when blank / placeholder (—, -, N/A).
 */
export function checklistLabel(control) {
  const value = String(control?.CHECKLIST || '')
    .replace(/\u200b/g, '')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!value || value === '-' || value === '—' || /^n\/?a$/i.test(value)) {
    return '';
  }
  return value;
}

export function hasChecklistSheet(control) {
  return Boolean(checklistLabel(control));
}

function firstField(control, keys) {
  if (!control) return '';
  for (const key of keys) {
    const value = String(control[key] || '')
      .replace(/\u200b/g, '')
      .replace(/\u00a0/g, ' ')
      .trim();
    if (value && value !== '-' && value !== '—' && !/^n\/?a$/i.test(value)) {
      return value;
    }
  }
  return '';
}

/**
 * Target evidence sheet/folder for the selected quarter.
 * Prefers an explicit TARGET SHEET column; falls back to Drive Link Qn.
 */
export function targetSheetForQuarter(control, quarter) {
  const explicit = firstField(control, [
    'TARGET SHEET',
    'Target Sheet',
    'Target sheet',
    `TARGET SHEET ${quarter || ''}`.trim(),
    `Target Sheet ${quarter || ''}`.trim(),
  ]);
  if (explicit) return explicit;
  return driveLinkForQuarter(control, quarter);
}

/**
 * Normalize agent / sheet OUTPUT values to success | failed | null.
 * Accepts success/passed and failed/false/fail.
 */
export function normalizeChecklistOutput(value) {
  const raw = String(value || '')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return null;

  if (
    /^(success|passed|pass|ok|true)$/i.test(raw) ||
    /^all\s+passed$/i.test(raw)
  ) {
    return 'success';
  }
  if (/^(failed|fail|failure|false)$/i.test(raw)) {
    return 'failed';
  }

  const hasFailed = /\b(fail(ed|ure)?|false)\b/i.test(raw);
  const hasPassed = /\b(pass(ed)?|success|true)\b/i.test(raw);
  if (hasFailed) return 'failed';
  if (hasPassed) return 'success';
  return null;
}

/**
 * Overall checklist result for the Output column.
 * @returns {'success' | 'failed' | null}
 */
export function checklistOutputStatus(control) {
  return normalizeChecklistOutput(
    firstField(control, [
      'OUTPUT',
      'Output',
      'Checklist Output',
      'CHECKLIST OUTPUT',
      'Checklist Result',
      'CHECKLIST RESULT',
      'Audit Result',
      'Audit Status',
    ])
  );
}

export function isGoogleSheetUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return (
      (url.hostname === 'docs.google.com' ||
        url.hostname.endsWith('.google.com')) &&
      url.pathname.includes('/spreadsheets/')
    );
  } catch {
    return false;
  }
}

/**
 * Prompt + runContext facts the Agent Studio checklist skill should use.
 *
 * Drive Link Qn is a folder that contains exactly one Google Sheet — that
 * sheet is the target URL for validation.
 */
export function buildAuditPayload(control, quarter) {
  const checklist = checklistLabel(control);
  const driveFolderUrl = driveLinkForQuarter(control, quarter);
  const knownTargetSheet = targetSheetForQuarter(control, quarter);
  const controlId = String(control?.['Control ID'] || '')
    .replace(/\u200b/g, '')
    .trim();
  const application = String(control?.['Application Name'] || '')
    .replace(/\u200b/g, '')
    .trim();

  const context = [
    { description: 'product', value: 'Control Sheet Dashboard' },
    { description: 'controlId', value: controlId },
    { description: 'applicationName', value: application },
    { description: 'checklistName', value: checklist },
    { description: 'auditQuarter', value: quarter },
    { description: 'driveFolderUrl', value: driveFolderUrl },
    {
      description: 'knownTargetSheetUrl',
      value: isGoogleSheetUrl(knownTargetSheet) ? knownTargetSheet : '',
    },
    {
      description: 'driveLinkQ1',
      value: driveLinkForQuarter(control, 'Q1'),
    },
    {
      description: 'driveLinkQ2',
      value: driveLinkForQuarter(control, 'Q2'),
    },
    {
      description: 'driveLinkQ3',
      value: driveLinkForQuarter(control, 'Q3'),
    },
    {
      description: 'driveLinkQ4',
      value: driveLinkForQuarter(control, 'Q4'),
    },
  ].filter((entry) => entry.value);

  const message = [
    `Run the checklist validation skill for control ${controlId || '(unknown)'}.`,
    `Application: ${application || '—'}.`,
    `Checklist name / URL from the control sheet CHECKLIST column: ${checklist || '—'}.`,
    `Audit quarter: ${quarter}.`,
    `Quarter Drive folder URL (open this folder): ${driveFolderUrl || '—'}.`,
    'Inside that Drive folder there is exactly ONE Google Sheet. Open that Google Sheets URL and use it as the TARGET sheet for validation.',
    isGoogleSheetUrl(knownTargetSheet)
      ? `If already known, prefer this target sheet URL: ${knownTargetSheet}.`
      : 'Do not treat the Drive folder URL itself as the target sheet — resolve the single spreadsheet file inside it first.',
    'Resolve the CHECKLIST Google Sheet from the CHECKLIST name/URL, validate every checkpoint against the target Google Sheet, and write PASSED/FAILED on each checklist checkpoint.',
    'When finished, call the host tool report_checklist_result exactly once with:',
    '- status: "success" if every checkpoint PASSED, or "failed" if any checkpoint FAILED (also accept false as failed)',
    '- targetSheetUrl: the Google Sheets URL you used as the target',
    '- summary: brief pass/fail counts',
    'Also end your reply with a single line: CHECKLIST_OUTPUT: success   OR   CHECKLIST_OUTPUT: failed',
  ].join('\n');

  return {
    context,
    message,
    checklist,
    driveFolderUrl,
    targetSheet: knownTargetSheet,
    controlId,
  };
}

/** Host tool the Agent Studio agent must call when the run finishes. */
export const REPORT_CHECKLIST_RESULT_TOOL = {
  name: 'report_checklist_result',
  description:
    'Report the overall checklist result to the Control Sheet Dashboard. Call exactly once after all checkpoints are evaluated. status must be success or failed; include the Google Sheets target URL found in the Drive folder.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'success if all checkpoints PASSED; failed (or false) if any FAILED',
      },
      targetSheetUrl: {
        type: 'string',
        description:
          'Google Sheets URL of the single spreadsheet found inside the quarter Drive folder',
      },
      summary: {
        type: 'string',
        description: 'Short summary, e.g. 12 passed, 1 failed',
      },
    },
    required: ['status'],
  },
};
