/**
 * ICS-220 (FEMA v3 Air Operations Summary), filled from the IAP plan's air
 * operations section when the OP chooses it (ADR-005). The FEMA form has no
 * UAS table: helicopters and UAS share block 10 (7 rows), fixed-wing go on
 * block 9's "Other Fixed-Wing Aircraft" lines (3, one line per aircraft);
 * more continue on repeat page 1s. The aviation briefing goes into block 4
 * Remarks. Page 2 (block 12 tasks) prints once with its header filled.
 * Personnel, frequencies, ready alert aircraft, the air tactical group
 * supervisor aircraft and the task table are left for hand entry.
 */

import type { FilledForm } from './iapPdf.ts';
import type { IapAircraftRow, IapPlan } from './iapPlanPersistence.ts';
import { aircraftClasses } from './ics220wf.ts';

export const ICS220FEMA_AIRCRAFT_ROWS = 7;
export const ICS220FEMA_FIXED_WING_LINES = 3;

export interface Ics220FemaContext {
    incidentName: string;
}

/** Block 10 rows: helicopters first, then UAS. */
function block10(plan: IapPlan): IapAircraftRow[] {
    const c = aircraftClasses(plan);
    return [...c.helicopters, ...c.uas];
}

/** Number of page-1 copies for the plan (at least one): the fuller block decides. */
export function ics220femaPageCount(plan: IapPlan): number {
    return Math.max(
        1,
        Math.ceil(block10(plan).length / ICS220FEMA_AIRCRAFT_ROWS),
        Math.ceil(aircraftClasses(plan).fixed.length / ICS220FEMA_FIXED_WING_LINES),
    );
}

/** Block 9 line: "category/kind/type, make/model, N#, base". */
function fixedWingLine(a: IapAircraftRow): string {
    return [a.category, a.makeModel, a.faaId, a.baseOwner].map((v) => v.trim()).filter(Boolean).join(', ');
}

export function ics220fema(plan: IapPlan, ctx: Ics220FemaContext, chunk = 0): FilledForm {
    const uas = plan.uas;
    const page = <T>(rows: T[], per: number): T[] => rows.slice(chunk * per, (chunk + 1) * per);
    const rows = page(block10(plan), ICS220FEMA_AIRCRAFT_ROWS);
    const fixed = page(aircraftClasses(plan).fixed, ICS220FEMA_FIXED_WING_LINES);

    const briefing = [uas.briefingTime.trim(), uas.briefingLocation.trim()].filter(Boolean).join(', ');
    const remarks = [
        briefing ? `Aviation briefing: ${briefing}` : '',
        chunk > 0 ? `Continuation page ${chunk + 1} of the aircraft lists.` : '',
    ].filter(Boolean).join('\n');
    const preparer = plan.preparers?.ics220?.trim() || plan.preparedBy;
    const stamp = [plan.dateFrom, plan.timeFrom].filter(Boolean).join(' ');

    const text: Record<string, string> = {
        // Header fields share one name on both pages.
        '1 Incident Name_23': ctx.incidentName,
        'Date From': plan.dateFrom,
        'Date To': plan.dateTo,
        'Time From': plan.timeFrom,
        'Time To': plan.timeTo,
        '3 Sunrise': uas.sunrise,
        '3 Sunset': uas.sunset,
        '4 Remarks safety notes hazards air operations special equipment etc': remarks,
        '6 Temporary Flight Restriction Number: Altitude': uas.tfrAltitude,
        '6 Temporary Flight Restriction Number: Center Point': uas.tfrCenter,
        '11 Prepared by Name': preparer,
        DateTime_18: stamp,
        '11 Prepared by Name_2': preparer,
        DateTime_19: stamp,
    };
    fixed.forEach((a, i) => {
        text[`Other Fixed Wing Aircraft ${i + 1}`] = fixedWingLine(a);
    });
    // Block 10 Helicopters (and UAS): rows 1-7.
    rows.forEach((a, i) => {
        const n = i + 1;
        text[`FAA NRow${n}`] = a.faaId;
        text[`CategoryKindTypeRow${n}`] = a.category;
        text[`MakeModelRow${n}`] = a.makeModel;
        text[`BaseRow${n}`] = a.baseOwner;
        text[`AvailableRow${n}`] = a.available;
        text[`StartRow${n}`] = a.start;
        text[`RemarksRow${n}_2`] = a.remarks;
    });
    // Pages 3-4 are instructions; the task page only once.
    return { text, pages: chunk === 0 ? [0, 1] : [0] };
}
