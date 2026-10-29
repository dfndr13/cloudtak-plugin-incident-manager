/**
 * ICS-220 WF (NWCG Air Operations Summary), filled from the IAP plan's air
 * operations section (ADR-005). Used instead of the plugin's ICS-220 UAS page
 * when the OP uses WF forms or chooses the ICS-220 WF: every class of aircraft
 * on one form, each in its own block. Helicopters go into block 16 (8 rows),
 * fixed-wing into block 17 (3 rows, the form's only fixed-wing table) and UAS
 * into block 18 (4 rows); more continue on repeat pages. TFR center and the
 * aviation briefing have no box on the WF form, so they go into block 9
 * General Remarks. Medevac, frequency, helibase and position blocks are left
 * for hand entry.
 */

import { isUasLabel } from '../domain/iap.ts';
import type { FilledForm } from './iapPdf.ts';
import type { IapAircraftRow, IapPlan } from './iapPlanPersistence.ts';

export const ICS220WF_UAS_ROWS = 4;
export const ICS220WF_HELICOPTER_ROWS = 8;
export const ICS220WF_FIXED_WING_ROWS = 3;

export function isUasAircraft(a: IapAircraftRow): boolean {
    return isUasLabel(a.category, a.faaId);
}

export function isFixedWing(a: IapAircraftRow): boolean {
    return !isUasAircraft(a) && /fixed[\s-]*wing/i.test(a.category);
}

/** Aircraft by class: UAS, fixed-wing, and everything else as helicopters. */
export function aircraftClasses(plan: IapPlan): { uas: IapAircraftRow[]; fixed: IapAircraftRow[]; helicopters: IapAircraftRow[] } {
    const all = plan.uas.aircraft;
    return {
        uas: all.filter(isUasAircraft),
        fixed: all.filter(isFixedWing),
        helicopters: all.filter((a) => !isUasAircraft(a) && !isFixedWing(a)),
    };
}

export interface Ics220WfContext {
    incidentName: string;
    incidentNumber: string;
}

/** Number of ICS-220 WF pages for the plan (at least one): the fullest block decides. */
export function ics220wfPageCount(plan: IapPlan): number {
    const c = aircraftClasses(plan);
    return Math.max(
        1,
        Math.ceil(c.uas.length / ICS220WF_UAS_ROWS),
        Math.ceil(c.helicopters.length / ICS220WF_HELICOPTER_ROWS),
        Math.ceil(c.fixed.length / ICS220WF_FIXED_WING_ROWS),
    );
}

export function ics220wf(plan: IapPlan, ctx: Ics220WfContext, chunk = 0): FilledForm {
    const uas = plan.uas;
    const range = (from: string, to: string, sep: string): string =>
        [from.trim(), to.trim()].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(sep);
    const classes = aircraftClasses(plan);
    const page = <T>(rows: T[], per: number): T[] => rows.slice(chunk * per, (chunk + 1) * per);
    const uasRows = page(classes.uas, ICS220WF_UAS_ROWS);
    const helicopterRows = page(classes.helicopters, ICS220WF_HELICOPTER_ROWS);
    const fixedRows = page(classes.fixed, ICS220WF_FIXED_WING_ROWS);

    const briefing = [uas.briefingTime.trim(), uas.briefingLocation.trim()].filter(Boolean).join(', ');
    const remarks = [
        uas.tfrCenter.trim() ? `TFR center point: ${uas.tfrCenter.trim()}` : '',
        briefing ? `Aviation briefing: ${briefing}` : '',
        chunk > 0 ? `Continuation page ${chunk + 1} of the aircraft lists.` : '',
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
    // Block 16 Helicopters: rows 1-8.
    helicopterRows.forEach((a, i) => {
        const n = i + 1;
        text[`FAA#${n}`] = a.faaId;
        text[`Type${n}`] = a.category;
        text[`Make/Model${n}`] = a.makeModel;
        text[`Helibase${n}`] = a.baseOwner;
        text[`Start${n}`] = a.start;
        text[`Avail.${n}`] = a.available;
        text[`Remarks${n}`] = a.remarks;
    });
    // Block 17 (aerial supervision, fixed-wing): the template numbers these
    // rows on from block 16 (FAA# 12-14, Make/Model 10-12, Start/Remarks 9-11).
    fixedRows.forEach((a, i) => {
        const n = i + 1;
        text[`FAA#${11 + n}`] = a.faaId;
        text[`Make/Model${9 + n}`] = [a.category, a.makeModel].map((v) => v.trim()).filter(Boolean).join(' ');
        text[`Base${n}`] = a.baseOwner;
        text[`Start${8 + n}`] = a.start;
        text[n === 3 ? 'Avail11' : `Avail.${8 + n}`] = a.available;
        text[`Remarks${8 + n}`] = a.remarks;
    });
    // Block 18 UAS: rows 1-4.
    uasRows.forEach((a, i) => {
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
