/**
 * ICS-214 Activity Log (ADR-005), filled on the official FEMA v3.1 template:
 * one log for the person keeping the resource trail, its entries in time order
 * as Notable Activities. Page 1 carries the header blocks and 24 activity
 * rows; page 2 (the continuation page) carries 36, and is repeated for longer
 * logs. Block 6 (Resources Assigned) is left for hand entry.
 */

import type { FilledForm } from './iapPdf.ts';
import { icsDateTime } from './ics211.ts';
import type { ResourceLogEntry } from './resourceLogs.ts';

export const ICS214_FIRST_PAGE_ROWS = 24;
export const ICS214_CONTINUATION_ROWS = 36;

export interface Ics214Row {
    dateTime: string;
    activity: string;
}

/** Activity rows from the trail (oldest first) for one OP (null = initial response) or 'all'. */
export function ics214Rows(trail: ResourceLogEntry[], op: number | null | 'all'): Ics214Row[] {
    return trail
        .filter((e) => op === 'all' || e.opNumber === op)
        .map((e) => {
            const when = icsDateTime(e.dtg);
            const [first, ...rest] = e.content.split('\n');
            const note = rest.join(' ').trim();
            return {
                dateTime: [when.date, when.time].filter(Boolean).join(' '),
                activity: note ? `${first.trim()} — ${note}` : first.trim(),
            };
        });
}

export interface Ics214Input {
    incidentName: string;
    /** Operational period start / end, ISO or datetime-local; blank for all OPs. */
    opFrom?: string;
    opTo?: string;
    name: string;
    icsPosition: string;
    homeAgency: string;
    preparedAt: Date;
    rows: Ics214Row[];
}

/** Continuation-page row n (1-36) field names; the template switches naming at row 25. */
function continuationField(kind: 'DateTime' | 'Notable Activities', n: number): string {
    return n <= 24 ? `${kind}Row${n}_2` : `${kind}Row${n}`;
}

/**
 * Filled template copies: the first uses page 1 (and page 2 when more than 24
 * rows); each further copy uses page 2 only.
 */
export function buildIcs214Forms(input: Ics214Input): FilledForm[] {
    const from = icsDateTime(input.opFrom);
    const to = icsDateTime(input.opTo);
    const prepared = icsDateTime(input.preparedAt);
    const stamp = [prepared.date, prepared.time].filter(Boolean).join(' ');
    const period: Record<string, string> = {
        'Date From': from.date,
        'Time From': from.time,
        'Date To': to.date,
        'Time To': to.time,
    };
    const page1Header: Record<string, string> = {
        ...period,
        '1 Incident Name_19': input.incidentName,
        '3 Name': input.name,
        '4 ICS Position': input.icsPosition,
        '5 Home Agency and Unit': input.homeAgency,
        '8 Prepared by Name': input.name,
        PositionTitle_15: input.icsPosition,
        DateTime_15: stamp,
    };
    const page2Header: Record<string, string> = {
        ...period,
        '1 Incident Name_20': input.incidentName,
        '8 Prepared by Name_2': input.name,
        PositionTitle_16: input.icsPosition,
        DateTime_16: stamp,
    };

    const first = input.rows.slice(0, ICS214_FIRST_PAGE_ROWS);
    const rest = input.rows.slice(ICS214_FIRST_PAGE_ROWS);
    const chunks: Ics214Row[][] = [];
    for (let i = 0; i < rest.length; i += ICS214_CONTINUATION_ROWS) {
        chunks.push(rest.slice(i, i + ICS214_CONTINUATION_ROWS));
    }

    const firstText: Record<string, string> = { ...page1Header };
    first.forEach((r, idx) => {
        firstText[`DateTimeRow${idx + 1}`] = r.dateTime;
        firstText[`Notable ActivitiesRow${idx + 1}`] = r.activity;
    });

    const fillContinuation = (text: Record<string, string>, rows: Ics214Row[]): void => {
        rows.forEach((r, idx) => {
            text[continuationField('DateTime', idx + 1)] = r.dateTime;
            text[continuationField('Notable Activities', idx + 1)] = r.activity;
        });
    };

    if (!chunks.length) return [{ text: firstText, pages: [0] }];
    // Page 1 and the first continuation page come from the same template copy.
    fillContinuation(firstText, chunks[0]);
    Object.assign(firstText, page2Header);
    const forms: FilledForm[] = [{ text: firstText, pages: [0, 1] }];
    for (const rows of chunks.slice(1)) {
        const text = { ...page2Header };
        fillContinuation(text, rows);
        forms.push({ text, pages: [1] });
    }
    return forms;
}
