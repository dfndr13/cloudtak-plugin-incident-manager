import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildResourceLogBody,
    buildResourceLogContent,
    currentIcs210Status,
    parseResourceLogEntry,
    RESOURCE_LOG_KEYWORD,
    resourceTrail,
} from './resourceLogs.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';

function resource(extra: Partial<ResourceAssignment> = {}): ResourceAssignment {
    return {
        id: 'r1',
        resourceIdentifier: 'UAS 1',
        resource: 'Drone',
        agency: 'Agency A',
        timeOrdered: '',
        eta: null,
        status: 'have',
        timeArrived: '',
        opNumber: 2,
        ...extra,
    };
}

test('content reads as one sentence per action', () => {
    const r = resource();
    assert.equal(buildResourceLogContent({ action: 'check-in', resource: r }), 'UAS 1 checked in (OP 2)');
    assert.equal(buildResourceLogContent({ action: 'assign', resource: r, to: 'Division A' }),
        'UAS 1 assigned to Division A (OP 2)');
    assert.equal(buildResourceLogContent({ action: 'assign', resource: r, from: 'Division A', to: 'Division B' }),
        'UAS 1 reassigned from Division A to Division B (OP 2)');
    assert.equal(buildResourceLogContent({ action: 'unassign', resource: r, from: 'Division A' }),
        'UAS 1 released from Division A (OP 2)');
    assert.equal(buildResourceLogContent({ action: 'status', resource: r, status: 'O/S' }), 'UAS 1 status O/S (OP 2)');
    assert.equal(buildResourceLogContent({ action: 'demob', resource: resource({ opNumber: null }) }),
        'UAS 1 demobilized');
    assert.equal(buildResourceLogContent({ action: 'status', resource: r, status: 'O/S', note: ' battery swap ' }),
        'UAS 1 status O/S (OP 2)\nbattery swap');
});

test('body carries keywords, the given time and the assignment uid', () => {
    const body = buildResourceLogBody({
        action: 'assign',
        resource: resource({ assignmentUid: 'seg-a' }),
        to: 'Division A',
        at: '2026-10-29T09:14:00.000Z',
    });
    assert.equal(body.dtg, '2026-10-29T09:14:00.000Z');
    assert.equal(body.entryUid, 'seg-a');
    assert.deepEqual(body.keywords, [RESOURCE_LOG_KEYWORD, 'action:assign', 'resource:r1', 'op:2', 'to:Division A']);
});

test('body time defaults to now', () => {
    const now = new Date('2026-10-29T10:00:00.000Z');
    assert.equal(buildResourceLogBody({ action: 'check-in', resource: resource() }, now).dtg, now.toISOString());
});

test('an entry round-trips through the mission log', () => {
    const body = buildResourceLogBody({
        action: 'status', resource: resource(), status: 'Assigned', at: '2026-10-29T09:14:00.000Z',
    });
    const parsed = parseResourceLogEntry({ id: 'log-1', creatorUid: 'ANDROID-x', ...body });
    assert.deepEqual(parsed, {
        id: 'log-1',
        dtg: '2026-10-29T09:14:00.000Z',
        creatorUid: 'ANDROID-x',
        action: 'status',
        resourceId: 'r1',
        opNumber: 2,
        from: '',
        to: '',
        status: 'Assigned',
        content: 'UAS 1 status Assigned (OP 2)',
    });
});

test('other mission log entries are ignored', () => {
    assert.equal(parseResourceLogEntry({ keywords: ['work-assignment', 'phase:started'] }), null);
    assert.equal(parseResourceLogEntry({ keywords: [RESOURCE_LOG_KEYWORD, 'action:bogus', 'resource:r1'] }), null);
    assert.equal(parseResourceLogEntry({ keywords: [RESOURCE_LOG_KEYWORD, 'action:demob'] }), null);
});

test('trail is oldest first and gives the latest ICS-210 status', () => {
    const entry = (dtg: string, status: string, id = 'r1') => ({
        id: dtg, dtg, keywords: [RESOURCE_LOG_KEYWORD, 'action:status', `resource:${id}`, `status:${status}`],
    });
    const trail = resourceTrail([
        entry('2026-10-29T11:00:00Z', 'O/S'),
        { keywords: ['work-assignment'] },
        entry('2026-10-29T09:00:00Z', 'Available'),
        entry('2026-10-29T12:00:00Z', 'Assigned', 'r2'),
    ]);
    assert.deepEqual(trail.map((e) => e.dtg),
        ['2026-10-29T09:00:00Z', '2026-10-29T11:00:00Z', '2026-10-29T12:00:00Z']);
    assert.equal(currentIcs210Status(trail, 'r1'), 'O/S');
    assert.equal(currentIcs210Status(trail, 'r2'), 'Assigned');
    assert.equal(currentIcs210Status(trail, 'r3'), '');
});
