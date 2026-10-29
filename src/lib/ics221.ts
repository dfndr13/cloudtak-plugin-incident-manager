/**
 * ICS-221 Demobilization Check-Out (ADR-005), filled on the official FEMA v3.1
 * template: one form per demobilized resource. The release time comes from the
 * trail's demob entry; a resource marked demobilized without one still gets a
 * form, with the time left blank. The unit sign-off checklist, planned release
 * and travel blocks are left for hand entry.
 */

import type { FilledForm } from './iapPdf.ts';
import { icsDateTime } from './ics211.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';
import type { ResourceLogEntry } from './resourceLogs.ts';

export interface Ics221Release {
    resourceId: string;
    /** "UAS 1 (Drone, Agency A)". */
    released: string;
    /** "MM/DD/YYYY HHMM", '' when unknown. */
    releasedAt: string;
    note: string;
}

/** "UAS 1 (Drone, Agency A)"; parts left out when blank. */
export function describeResource(r: ResourceAssignment | undefined, fallback: string): string {
    if (!r) return fallback;
    const name = r.resourceIdentifier.trim() || r.resource.trim() || fallback;
    const detail = [r.resource.trim(), r.agency.trim()].filter((v) => v && v !== name);
    return detail.length ? `${name} (${detail.join(', ')})` : name;
}

/**
 * Releases for one OP (null = initial response) or 'all', in release order:
 * the latest demob entry per resource, then demobilized resources with none.
 */
export function ics221Releases(
    trail: ResourceLogEntry[],
    resources: ResourceAssignment[],
    op: number | null | 'all',
): Ics221Release[] {
    const byId = new Map(resources.map((r) => [r.id, r]));
    const latest = new Map<string, ResourceLogEntry>();
    for (const e of trail) {
        if (e.action === 'demob') latest.set(e.resourceId, e);
    }
    const releases: Ics221Release[] = [];
    for (const e of [...latest.values()].sort((a, b) => Date.parse(a.dtg) - Date.parse(b.dtg))) {
        if (op !== 'all' && e.opNumber !== op) continue;
        const when = icsDateTime(e.dtg);
        releases.push({
            resourceId: e.resourceId,
            released: describeResource(byId.get(e.resourceId), e.resourceId),
            releasedAt: [when.date, when.time].filter(Boolean).join(' '),
            note: e.content.split('\n').slice(1).join(' ').trim(),
        });
    }
    for (const r of resources) {
        if (r.status !== 'demobilized' || latest.has(r.id)) continue;
        if (op !== 'all' && (r.opNumber ?? null) !== op) continue;
        releases.push({ resourceId: r.id, released: describeResource(r, r.id), releasedAt: '', note: '' });
    }
    return releases;
}

export interface Ics221Input {
    incidentName: string;
    incidentNumber: string;
    preparedBy: string;
    preparedAt: Date;
    releases: Ics221Release[];
}

/** One filled ICS-221 per release (one blank form when none). */
export function buildIcs221Forms(input: Ics221Input): FilledForm[] {
    const prepared = icsDateTime(input.preparedAt);
    const header: Record<string, string> = {
        '1 Incident Name_25': input.incidentName,
        '2 Incident Number_12': input.incidentNumber,
        '10 Prepared by Name': input.preparedBy,
        DateTime_20: [prepared.date, prepared.time].filter(Boolean).join(' '),
    };
    if (!input.releases.length) return [{ text: { ...header }, pages: [0] }];
    return input.releases.map((r) => ({
        text: {
            ...header,
            '4 Resource or Personnel Released': r.released,
            'Actual Release DateTime': r.releasedAt,
            '7 Remarks': r.note,
        },
        pages: [0],
    }));
}
