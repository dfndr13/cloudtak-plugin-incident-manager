import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIcs221Forms, describeResource, ics221Releases } from './ics221.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';
import type { ResourceLogEntry } from './resourceLogs.ts';

function resource(id: string, extra: Partial<ResourceAssignment> = {}): ResourceAssignment {
    return {
        id, resourceIdentifier: id.toUpperCase(), resource: 'Drone', agency: 'Agency A',
        timeOrdered: '', eta: null, status: 'demobilized', timeArrived: '', opNumber: 1, ...extra,
    };
}

function demob(resourceId: string, dtg: string, content = 'x demobilized', opNumber: number | null = 1): ResourceLogEntry {
    return {
        id: dtg, dtg, creatorUid: 't', action: 'demob', resourceId, opNumber,
        from: '', to: '', status: '', content,
    };
}

test('describeResource: identifier with type and agency', () => {
    assert.equal(describeResource(resource('uas 1'), 'x'), 'UAS 1 (Drone, Agency A)');
    assert.equal(describeResource(resource('a', { resourceIdentifier: '', agency: '' }), 'x'), 'Drone');
    assert.equal(describeResource(undefined, 'r9'), 'r9');
});

test('releases: latest demob per resource in time order, then demobilized ones without an entry', () => {
    const resources = [resource('uas 1'), resource('k9 2'), resource('boat 3'), resource('have', { status: 'have' })];
    const releases = ics221Releases([
        demob('k9 2', '2026-10-29T15:00:00', 'K9 2 demobilized (OP 1)\ncrew rest'),
        demob('uas 1', '2026-10-29T12:00:00'),
        demob('uas 1', '2026-10-29T13:00:00'),
    ], resources, 1);
    assert.deepEqual(releases.map((r) => [r.released, r.releasedAt, r.note]), [
        ['UAS 1 (Drone, Agency A)', '10/29/2026 1300', ''],
        ['K9 2 (Drone, Agency A)', '10/29/2026 1500', 'crew rest'],
        ['BOAT 3 (Drone, Agency A)', '', ''],
    ]);
});

test('releases: OP filter', () => {
    const resources = [resource('a', { opNumber: 2 }), resource('b', { opNumber: null })];
    const trail = [demob('a', '2026-10-29T20:00:00', 'a', 2)];
    assert.deepEqual(ics221Releases(trail, resources, 2).map((r) => r.resourceId), ['a']);
    assert.deepEqual(ics221Releases(trail, resources, null).map((r) => r.resourceId), ['b']);
    assert.equal(ics221Releases(trail, resources, 'all').length, 2);
});

test('forms: one per release with header; one blank form when none', () => {
    const forms = buildIcs221Forms({
        incidentName: 'Test Search',
        incidentNumber: 'INC-26-001',
        preparedBy: 'Resource Tracker',
        preparedAt: new Date(2026, 9, 29, 19, 0),
        releases: [
            { resourceId: 'a', released: 'UAS 1 (Drone, Agency A)', releasedAt: '10/29/2026 1300', note: 'crew rest' },
            { resourceId: 'b', released: 'K9 2', releasedAt: '', note: '' },
        ],
    });
    assert.equal(forms.length, 2);
    assert.deepEqual(forms[0].pages, [0]);
    assert.equal(forms[0].text['1 Incident Name_25'], 'Test Search');
    assert.equal(forms[0].text['2 Incident Number_12'], 'INC-26-001');
    assert.equal(forms[0].text['4 Resource or Personnel Released'], 'UAS 1 (Drone, Agency A)');
    assert.equal(forms[0].text['Actual Release DateTime'], '10/29/2026 1300');
    assert.equal(forms[0].text['7 Remarks'], 'crew rest');
    assert.equal(forms[1].text['10 Prepared by Name'], 'Resource Tracker');
    assert.equal(forms[1].text.DateTime_20, '10/29/2026 1900');
    assert.equal(buildIcs221Forms({ incidentName: 'x', incidentNumber: '', preparedBy: '', preparedAt: new Date(), releases: [] }).length, 1);
});
