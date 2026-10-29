/**
 * ICS-210 Resource Status Change (ADR-005), filled on the official FEMA v3
 * template from the resource trail: one row per ICS-210 status entry and one
 * per demobilization, 28 rows per page. "From" and "To" show the resource's
 * assignment and status before and after, replayed from the trail's assign,
 * release and status entries.
 */

import type { FilledForm } from './iapPdf.ts';
import { icsDateTime } from './ics211.ts';
import type { ResourceLogEntry } from './resourceLogs.ts';

export const ICS210_ROWS_PER_PAGE = 28;

export interface Ics210Row {
    resource: string;
    status: string;
    from: string;
    to: string;
    time: string;
    date: string;
    /** Free-text remark from the entry, for block 8 Comments. */
    note: string;
}

interface ResourceState {
    assignment: string;
    status: string;
}

/** "Division A, Assigned"; blank parts left out. */
function describe(state: ResourceState): string {
    return [state.assignment, state.status].filter(Boolean).join(', ');
}

function noteOf(entry: ResourceLogEntry): string {
    return entry.content.split('\n').slice(1).join(' ').trim();
}

/**
 * Rows for the ICS-210 from a trail (oldest first). `op` limits rows to one
 * OP (null = initial response) or 'all'; the replay always uses the whole
 * trail so From/To are right across OP boundaries.
 */
export function ics210Rows(
    trail: ResourceLogEntry[],
    op: number | null | 'all',
    nameFor: (resourceId: string) => string = (id) => id,
): Ics210Row[] {
    const states = new Map<string, ResourceState>();
    const rows: Ics210Row[] = [];
    for (const e of trail) {
        const before = states.get(e.resourceId) ?? { assignment: '', status: '' };
        let after: ResourceState = before;
        let row: { status: string; to: string } | null = null;
        switch (e.action) {
            case 'assign':
                after = { ...before, assignment: e.to };
                break;
            case 'unassign':
                after = { ...before, assignment: '' };
                break;
            case 'status':
                after = { ...before, status: e.status };
                row = { status: e.status, to: describe(after) };
                break;
            case 'demob':
                after = { assignment: '', status: 'O/S' };
                row = { status: 'O/S', to: 'Demobilized' };
                break;
            default:
                break;
        }
        states.set(e.resourceId, after);
        if (!row || (op !== 'all' && e.opNumber !== op)) continue;
        const when = icsDateTime(e.dtg);
        rows.push({
            resource: nameFor(e.resourceId),
            status: row.status,
            from: describe(before),
            to: row.to,
            time: when.time,
            date: when.date,
            note: noteOf(e),
        });
    }
    return rows;
}

export interface Ics210Input {
    incidentName: string;
    /** Operational period start / end, ISO or datetime-local; blank for all OPs. */
    opFrom?: string;
    opTo?: string;
    preparedBy: string;
    preparedAt: Date;
    rows: Ics210Row[];
}

/** One filled ICS-210 page per 28 rows (one empty page when none). */
export function buildIcs210Forms(input: Ics210Input): FilledForm[] {
    const from = icsDateTime(input.opFrom);
    const to = icsDateTime(input.opTo);
    const prepared = icsDateTime(input.preparedAt);
    const header: Record<string, string> = {
        '1 Incident Name_17': input.incidentName,
        'Date From': from.date,
        'Time From': from.time,
        'Date To': to.date,
        'Time To': to.time,
        '9 Prepared by Name_3': input.preparedBy,
        DateTime_13: [prepared.date, prepared.time].filter(Boolean).join(' '),
    };

    const pages: FilledForm[] = [];
    for (let i = 0; i === 0 || i < input.rows.length; i += ICS210_ROWS_PER_PAGE) {
        const text = { ...header };
        const slice = input.rows.slice(i, i + ICS210_ROWS_PER_PAGE);
        slice.forEach((r, idx) => {
            const n = idx + 1;
            text[`3 Resource NumberRow${n}`] = r.resource;
            text[`4 New Status Available Assigned OSRow${n}`] = r.status;
            text[`5 From Assignment and StatusRow${n}`] = r.from;
            text[`6 To Assignment and StatusRow${n}`] = r.to;
            text[`7 Time and Date of ChangeRow${n}`] = r.time;
            text[`7 Time and Date of ChangeRow${n}_2`] = r.date;
        });
        const comments = slice.filter((r) => r.note).map((r) => `${r.resource} (${r.time}): ${r.note}`);
        if (comments.length) text['8 Comments'] = comments.join('\n');
        pages.push({ text, pages: [0] });
    }
    return pages;
}
