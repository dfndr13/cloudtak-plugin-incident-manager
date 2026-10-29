/**
 * ICS-211 Incident Check-In List (ADR-005), filled on the official FEMA v3.1
 * template from the resource records: one row per checked-in resource, eight
 * rows per page. Only fields the record already has are filled; the rest of
 * the row (leader, personnel, home unit, travel…) is left for hand entry.
 */

import type { FilledForm } from './iapPdf.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';

export const ICS211_ROWS_PER_PAGE = 8;

export interface Ics211Input {
    incidentName: string;
    incidentNumber: string;
    /** Check-in list start (the OP's open time), ISO or datetime-local. */
    start?: string;
    preparedBy: string;
    preparedAt: Date;
    resources: ResourceAssignment[];
    /** Assignment name for a resource; defaults to its assignment callsign. */
    assignmentName?: (resource: ResourceAssignment) => string;
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** "MM/DD/YYYY" and "HHMM" in local time, as on the other ICS forms. */
export function icsDateTime(value: string | Date | undefined): { date: string; time: string } {
    if (!value) return { date: '', time: '' };
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return { date: '', time: '' };
    return {
        date: `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`,
        time: `${pad2(d.getHours())}${pad2(d.getMinutes())}`,
    };
}

function stamp(value: string | Date | undefined): string {
    const { date, time } = icsDateTime(value);
    return [date, time].filter(Boolean).join(' ');
}

function arrivedMs(r: ResourceAssignment): number {
    const ms = r.timeArrived ? Date.parse(r.timeArrived) : NaN;
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/**
 * Resources on the check-in list: checked in (Have, or Demobilized after
 * arriving, or any arrival time), in check-in order. `op` is an OP number,
 * null for the initial response (no OP), or 'all'.
 */
export function ics211Resources(
    resources: ResourceAssignment[],
    op: number | null | 'all',
): ResourceAssignment[] {
    return resources
        .filter((r) => op === 'all' || (r.opNumber ?? null) === op)
        .filter((r) => r.status === 'have' || r.status === 'demobilized' || Boolean(r.timeArrived.trim()))
        .filter((r) => r.status !== 'cancelled')
        .sort((a, b) => arrivedMs(a) - arrivedMs(b));
}

/** One filled ICS-211 page per eight resources (one blank-rowed page when none). */
export function buildIcs211Forms(input: Ics211Input): FilledForm[] {
    const name = input.assignmentName ?? ((r: ResourceAssignment) => r.assignmentCallsign?.trim() ?? '');
    const start = icsDateTime(input.start);
    const header: Record<string, string> = {
        '1 Incident Name': input.incidentName,
        '2 Incident Number': input.incidentNumber,
        'Start Date': start.date,
        'Start Time': start.time,
        Name: input.preparedBy,
        'Date/Time': stamp(input.preparedAt),
    };

    const pages: FilledForm[] = [];
    for (let i = 0; i === 0 || i < input.resources.length; i += ICS211_ROWS_PER_PAGE) {
        const text = { ...header };
        input.resources.slice(i, i + ICS211_ROWS_PER_PAGE).forEach((r, idx) => {
            const n = idx + 1;
            text[`R${n} Agency ${n}`] = r.agency.trim();
            text[`R${n} Kind ${n}`] = r.resource.trim();
            text[`R${n} Resource Name or ID ${n}`] = r.resourceIdentifier.trim();
            const arrived = icsDateTime(r.timeArrived || undefined);
            // Two-line box: date over time.
            text[`R${n} Date/Time Check In ${n}`] = [arrived.date, arrived.time].filter(Boolean).join('\n');
            text[`R${n} Incident Assignment ${n}`] = name(r);
        });
        pages.push({ text, pages: [0] });
    }
    return pages;
}
