/**
 * Explicit Resources-tab actions that place a resource on the ICS forms
 * (ADR-005). Each action is a patch of fields the resource record already has;
 * nothing here adds a field.
 *
 *   Check in      status → have, timeArrived → given time (ICS-211)
 *   Assign to     assignmentUid → OP assignment segment uid,
 *                 assignmentCallsign → its label, opNumber → its OP (ICS-204)
 *   Unassign      clears that link
 *   Demobilize    status → demobilized (ICS-221)
 */

import type { OpAssignment } from '../domain/entities.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';

export type ResourcePatch = Partial<Omit<ResourceAssignment, 'id'>>;

export function checkInPatch(timeArrived: string): ResourcePatch {
    return { status: 'have', timeArrived };
}

export function assignPatch(assignment: OpAssignment): ResourcePatch {
    return {
        assignmentUid: assignment.segmentUid,
        assignmentCallsign: assignment.label,
        opNumber: assignment.opNumber,
    };
}

export function unassignPatch(): ResourcePatch {
    return { assignmentUid: undefined, assignmentCallsign: undefined };
}

export function demobilizePatch(): ResourcePatch {
    return { status: 'demobilized' };
}

/** True when the resource was explicitly assigned to this OP assignment. */
export function isAssignedTo(resource: ResourceAssignment, assignment: OpAssignment): boolean {
    if (!resource.assignmentUid || resource.assignmentUid !== assignment.segmentUid) return false;
    return resource.opNumber == null || resource.opNumber === assignment.opNumber;
}

/**
 * Resources for one OP assignment's ICS-204: the explicitly assigned ones;
 * when there are none, the original team-name match, leaving out resources
 * explicitly assigned elsewhere.
 */
export function resourcesForAssignment(
    resources: ResourceAssignment[],
    assignment: OpAssignment,
): ResourceAssignment[] {
    const explicit = resources.filter((r) => isAssignedTo(r, assignment));
    if (explicit.length) return explicit;
    return resources.filter((r) => !r.assignmentUid
        && (!assignment.team || r.resourceIdentifier === assignment.team));
}

/** OP assignments a resource can be assigned to: its own OP when it has one, else all. */
export function assignableFor(
    resource: ResourceAssignment,
    assignments: OpAssignment[],
): OpAssignment[] {
    const list = resource.opNumber == null
        ? assignments
        : assignments.filter((a) => a.opNumber === resource.opNumber);
    return [...list].sort((a, b) => a.opNumber - b.opNumber || a.label.localeCompare(b.label));
}

/** Option label for an OP assignment: "OP 2 · Division A". */
export function assignmentOptionLabel(assignment: OpAssignment): string {
    return `OP ${assignment.opNumber} · ${assignment.label}`;
}
