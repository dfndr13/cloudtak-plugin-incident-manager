/**
 * ICS-211 WF (NWCG Incident Check-In Form), the wildland fire version of the
 * check-in list: one form per checked-in resource, on the official NWCG
 * template (ADR-005). Fills the fields the resource record has; the card's
 * other blocks (IROC request, contacts, travel, crew, contract) are left for
 * hand entry.
 */

import { isUasLabel } from '../domain/iap.ts';
import type { FilledForm } from './iapPdf.ts';
import { icsDateTime } from './ics211.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';

/** "UAS: YES / NO" radio group on the template; option '0' is YES. */
export const ICS211WF_UAS_GROUP = 'Group19';
export const ICS211WF_YES = '0';

export interface Ics211WfInput {
    incidentName: string;
    incidentNumber: string;
    resources: ResourceAssignment[];
    /** Assignment name for a resource; defaults to its assignment callsign. */
    assignmentName?: (resource: ResourceAssignment) => string;
}

/** One filled ICS-211 WF per resource (one blank form when none). */
export function buildIcs211WfForms(input: Ics211WfInput): FilledForm[] {
    const name = input.assignmentName ?? ((r: ResourceAssignment) => r.assignmentCallsign?.trim() ?? '');
    const header: Record<string, string> = {
        'Incident Name': input.incidentName,
        'Incident Number': input.incidentNumber,
    };
    if (!input.resources.length) return [{ text: { ...header }, pages: [0] }];
    return input.resources.map((r): FilledForm => ({
        text: {
            ...header,
            'Resource Name': r.resourceIdentifier.trim() || r.resource.trim(),
            'Incident Assignment': name(r),
            Agency: r.agency.trim(),
            'Resource TypeKind': r.resource.trim(),
            // Check-in date, on the Resource Unit's review line.
            Date: icsDateTime(r.timeArrived || undefined).date,
        },
        radio: isUasLabel(r.resource, r.resourceIdentifier) ? { [ICS211WF_UAS_GROUP]: ICS211WF_YES } : {},
        pages: [0],
    }));
}
