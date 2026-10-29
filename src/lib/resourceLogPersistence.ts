/** Write and read the resource trail on the management sync (ADR-005). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadSchemaSubscription } from './incidentSubscription.ts';
import {
    buildResourceLogBody,
    parseResourceLogEntry,
    resourceTrail,
    type ResourceLogBody,
    type ResourceLogEntry,
    type ResourceLogInput,
} from './resourceLogs.ts';

/** Write one trail entry to the management sync. Returns the entry as written. */
export async function sendResourceLog(
    mission: ActiveMission,
    input: ResourceLogInput,
): Promise<ResourceLogEntry | null> {
    const sub = await loadSchemaSubscription(mission);
    const log = sub.log as unknown as {
        create(body: ResourceLogBody): Promise<{ id: string; creatorUid?: string }>;
    };
    const body = buildResourceLogBody(input);
    const created = await log.create(body);
    return parseResourceLogEntry({ ...body, id: created.id, creatorUid: created.creatorUid });
}

/** Read the trail from the management sync, oldest first. */
export async function loadResourceTrail(mission: ActiveMission): Promise<ResourceLogEntry[]> {
    const sub = await loadSchemaSubscription(mission);
    const logs = await sub.log.list({ refresh: true });
    return resourceTrail(logs as unknown[]);
}
