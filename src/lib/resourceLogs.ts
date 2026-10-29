/**
 * The resource trail (ADR-005): one DataSync log entry per Resources-tab action,
 * written to the management sync (planners only) via the schema subscription.
 * The ICS-211, ICS-210, ICS-214 and ICS-221 are built from these entries.
 *
 * Keywords: `ics-resource`, `action:<action>`, `resource:<id>`, `op:<n>`, and
 * `from:` / `to:` / `status:` where they apply. Values are kept short; the
 * readable sentence is in `content`. Reading and writing the mission log is in
 * resourceLogPersistence.ts.
 */

import { datetimeLocalToIso } from './incidentInfo.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';

export const RESOURCE_LOG_KEYWORD = 'ics-resource';

export type ResourceLogAction = 'check-in' | 'assign' | 'unassign' | 'status' | 'demob' | 'air-ops';

/** Official ICS-210 statuses. */
export const ICS210_STATUSES = ['Available', 'Assigned', 'O/S'] as const;
export type Ics210Status = typeof ICS210_STATUSES[number];

export interface ResourceLogInput {
    action: ResourceLogAction;
    resource: ResourceAssignment;
    /** datetime-local or ISO; now when blank. */
    at?: string;
    /** Assignment label before / after (assign, unassign). */
    from?: string;
    to?: string;
    /** ICS-210 status (status changes). */
    status?: Ics210Status;
    /** Optional free-text remark. */
    note?: string;
}

export interface ResourceLogBody {
    dtg: string;
    content: string;
    keywords: string[];
    entryUid?: string;
}

/** One parsed trail entry, as read back from the mission log. */
export interface ResourceLogEntry {
    id: string;
    dtg: string;
    creatorUid: string;
    action: ResourceLogAction;
    resourceId: string;
    opNumber: number | null;
    from: string;
    to: string;
    status: Ics210Status | '';
    content: string;
}

const ACTIONS: ResourceLogAction[] = ['check-in', 'assign', 'unassign', 'status', 'demob', 'air-ops'];

function label(resource: ResourceAssignment): string {
    return resource.resourceIdentifier.trim() || resource.resource.trim() || resource.id;
}

function opSuffix(resource: ResourceAssignment): string {
    return resource.opNumber != null ? ` (OP ${resource.opNumber})` : '';
}

export function buildResourceLogContent(input: ResourceLogInput): string {
    const name = label(input.resource);
    const op = opSuffix(input.resource);
    let line: string;
    switch (input.action) {
        case 'check-in':
            line = `${name} checked in${op}`;
            break;
        case 'assign':
            line = input.from
                ? `${name} reassigned from ${input.from} to ${input.to}${op}`
                : `${name} assigned to ${input.to}${op}`;
            break;
        case 'unassign':
            line = `${name} released from ${input.from || 'assignment'}${op}`;
            break;
        case 'status':
            line = `${name} status ${input.status ?? ''}${op}`.trim();
            break;
        case 'demob':
            line = `${name} demobilized${op}`;
            break;
        case 'air-ops':
            line = `${name} added to air operations${op}`;
            break;
    }
    return input.note?.trim() ? `${line}\n${input.note.trim()}` : line;
}

export function buildResourceLogKeywords(input: ResourceLogInput): string[] {
    const keywords = [
        RESOURCE_LOG_KEYWORD,
        `action:${input.action}`,
        `resource:${input.resource.id}`,
    ];
    if (input.resource.opNumber != null) keywords.push(`op:${input.resource.opNumber}`);
    if (input.from) keywords.push(`from:${input.from}`);
    if (input.to) keywords.push(`to:${input.to}`);
    if (input.status) keywords.push(`status:${input.status}`);
    return keywords;
}

export function buildResourceLogBody(input: ResourceLogInput, now = new Date()): ResourceLogBody {
    const dtg = (input.at && (datetimeLocalToIso(input.at) || input.at)) || now.toISOString();
    const body: ResourceLogBody = {
        dtg,
        content: buildResourceLogContent(input),
        keywords: buildResourceLogKeywords(input),
    };
    if (input.resource.assignmentUid) body.entryUid = input.resource.assignmentUid;
    return body;
}

/** Parse a mission log entry back into a trail entry; null for other log entries. */
export function parseResourceLogEntry(log: {
    id?: unknown;
    dtg?: unknown;
    creatorUid?: unknown;
    content?: unknown;
    keywords?: unknown;
}): ResourceLogEntry | null {
    const keywords = Array.isArray(log.keywords) ? log.keywords.map(String) : [];
    if (!keywords.includes(RESOURCE_LOG_KEYWORD)) return null;
    const value = (prefix: string): string => {
        const kw = keywords.find((k) => k.startsWith(`${prefix}:`));
        return kw ? kw.slice(prefix.length + 1) : '';
    };
    const action = value('action') as ResourceLogAction;
    const resourceId = value('resource');
    if (!ACTIONS.includes(action) || !resourceId) return null;
    const op = Number(value('op'));
    const status = value('status');
    return {
        id: String(log.id ?? ''),
        dtg: String(log.dtg ?? ''),
        creatorUid: String(log.creatorUid ?? ''),
        action,
        resourceId,
        opNumber: Number.isInteger(op) && op > 0 ? op : null,
        from: value('from'),
        to: value('to'),
        status: (ICS210_STATUSES as readonly string[]).includes(status) ? status as Ics210Status : '',
        content: String(log.content ?? ''),
    };
}

/** Trail entries, oldest first. */
export function resourceTrail(logs: unknown[]): ResourceLogEntry[] {
    return logs
        .map((log) => (log && typeof log === 'object' ? parseResourceLogEntry(log as Record<string, unknown>) : null))
        .filter((e): e is ResourceLogEntry => e !== null)
        .sort((a, b) => new Date(a.dtg).getTime() - new Date(b.dtg).getTime());
}

/** Resources added to air operations (ICS-220) in one OP, per the trail. */
export function airOpsResourceIds(trail: ResourceLogEntry[], opNumber: number): string[] {
    return [...new Set(trail
        .filter((e) => e.action === 'air-ops' && e.opNumber === opNumber)
        .map((e) => e.resourceId))];
}

/** Latest ICS-210 status recorded for a resource, or '' when none. */
export function currentIcs210Status(trail: ResourceLogEntry[], resourceId: string): Ics210Status | '' {
    for (let i = trail.length - 1; i >= 0; i--) {
        const e = trail[i];
        if (e.resourceId === resourceId && e.action === 'status' && e.status) return e.status;
    }
    return '';
}
