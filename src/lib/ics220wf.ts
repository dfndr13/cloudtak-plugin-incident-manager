/**
 * ICS-220 WF (NWCG Air Operations Summary), filled from the IAP plan's UAS
 * section and used instead of the plugin's ICS-220 UAS page when the OP uses
 * WF forms (ADR-005). The aircraft list goes into block 18 (Unmanned Aircraft
 * Systems), four rows per page, continuing on repeat pages. TFR center and the
 * aviation briefing have no box on the WF form, so they go into block 9
 * General Remarks. Helicopter, air attack, medevac, frequency and helibase
 * blocks are left for hand entry.
 */

import type { FilledForm } from './iapPdf.ts';
import type { IapPlan } from './iapPlanPersistence.ts';

export const ICS220WF_UAS_ROWS = 4;

export interface Ics220WfContext {
    incidentName: string;
    incidentNumber: string;
}

/** Number of ICS-220 WF pages for the plan (at least one). */
export function ics220wfPageCount(plan: IapPlan): number {
    return Math.max(1, Math.ceil(plan.uas.aircraft.length / ICS220WF_UAS_ROWS));
}

export function ics220wf(plan: IapPlan, ctx: Ics220WfContext, chunk = 0): FilledForm {
    const uas = plan.uas;
    const range = (from: string, to: string, sep: string): string =>
        [from.trim(), to.trim()].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(sep);
    const slice = uas.aircraft.slice(chunk * ICS220WF_UAS_ROWS, (chunk + 1) * ICS220WF_UAS_ROWS);

    const briefing = [uas.briefingTime.trim(), uas.briefingLocation.trim()].filter(Boolean).join(', ');
    const remarks = [
        uas.tfrCenter.trim() ? `TFR center point: ${uas.tfrCenter.trim()}` : '',
        briefing ? `Aviation briefing: ${briefing}` : '',
        chunk > 0
            ? `Continuation page ${chunk + 1}: UAS ${chunk * ICS220WF_UAS_ROWS + 1}-${chunk * ICS220WF_UAS_ROWS + slice.length}.`
            : '',
    ].filter(Boolean).join('\n');

    const text: Record<string, string> = {
        'Incident Name  Number': [ctx.incidentName.trim(), ctx.incidentNumber.trim()].filter(Boolean).join(' / '),
        // "Prepared" stamp, as on the other IAP forms: the OP start.
        'Date Prepared': plan.dateFrom,
        'Time Prepared': plan.timeFrom,
        'Prepared By': plan.preparers?.ics220?.trim() || plan.preparedBy,
        Sunrise: uas.sunrise,
        Sunset: uas.sunset,
        'Operational Period Date': range(plan.dateFrom, plan.dateTo, ' - '),
        'Operational Period  Time': range(plan.timeFrom, plan.timeTo, '-'),
        Altitude: uas.tfrAltitude,
        'General Remarks': remarks,
    };
    slice.forEach((a, i) => {
        const n = i + 1;
        text[`IdentifierRow${n}`] = a.faaId;
        text[`Cat TypeRow${n}`] = a.category;
        // The template numbers this column 13-16.
        text[`Make ModelRow${12 + n}`] = a.makeModel;
        text[`LocationRow${n}`] = a.baseOwner;
        text[`StartRow${n}`] = a.start;
        text[`AvailRow${n}`] = a.available;
        text[`RemarksRow${n}`] = a.remarks;
    });
    return { text, pages: [0] };
}
