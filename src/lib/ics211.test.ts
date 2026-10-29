import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIcs211Forms, ics211Resources, icsDateTime } from './ics211.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';

function resource(id: string, extra: Partial<ResourceAssignment> = {}): ResourceAssignment {
    return {
        id,
        resourceIdentifier: id.toUpperCase(),
        resource: 'Drone',
        agency: 'Agency A',
        timeOrdered: '',
        eta: null,
        status: 'have',
        timeArrived: '',
        opNumber: 1,
        ...extra,
    };
}

const base = {
    incidentName: 'Test Search',
    incidentNumber: 'INC-26-001',
    start: '2026-10-29T06:00',
    preparedBy: 'Resource Tracker',
    preparedAt: new Date(2026, 9, 29, 9, 30),
};

test('dates print as MM/DD/YYYY and HHMM', () => {
    assert.deepEqual(icsDateTime('2026-10-29T09:14'), { date: '10/29/2026', time: '0914' });
    assert.deepEqual(icsDateTime(''), { date: '', time: '' });
    assert.deepEqual(icsDateTime('not a date'), { date: '', time: '' });
});

test('check-in list: checked-in resources of the OP, in arrival order', () => {
    const list = ics211Resources([
        resource('late', { timeArrived: '2026-10-29T10:00' }),
        resource('early', { timeArrived: '2026-10-29T08:00' }),
        resource('requested', { status: 'requested' }),
        resource('cancelled', { status: 'cancelled', timeArrived: '2026-10-29T07:00' }),
        resource('demobbed', { status: 'demobilized', timeArrived: '2026-10-29T09:00' }),
        resource('have-no-time'),
        resource('other-op', { opNumber: 2, timeArrived: '2026-10-29T08:30' }),
    ], 1);
    assert.deepEqual(list.map((r) => r.id), ['early', 'demobbed', 'late', 'have-no-time']);
    const mixed = [resource('a', { opNumber: 2 }), resource('b', { opNumber: null })];
    assert.deepEqual(ics211Resources(mixed, 'all').map((r) => r.id), ['a', 'b']);
    assert.deepEqual(ics211Resources(mixed, null).map((r) => r.id), ['b']);
});

test('rows fill only existing fields, header on every page', () => {
    const [page] = buildIcs211Forms({
        ...base,
        resources: [resource('uas 1', { timeArrived: '2026-10-29T09:14', assignmentCallsign: 'Division A' })],
    });
    assert.deepEqual(page.pages, [0]);
    assert.equal(page.text['1 Incident Name'], 'Test Search');
    assert.equal(page.text['2 Incident Number'], 'INC-26-001');
    assert.equal(page.text['Start Date'], '10/29/2026');
    assert.equal(page.text['Start Time'], '0600');
    assert.equal(page.text.Name, 'Resource Tracker');
    assert.equal(page.text['Date/Time'], '10/29/2026 0930');
    assert.equal(page.text['R1 Agency 1'], 'Agency A');
    assert.equal(page.text['R1 Kind 1'], 'Drone');
    assert.equal(page.text['R1 Resource Name or ID 1'], 'UAS 1');
    assert.equal(page.text['R1 Date/Time Check In 1'], '10/29/2026\n0914');
    assert.equal(page.text['R1 Incident Assignment 1'], 'Division A');
    assert.equal(page.text['R2 Agency 2'], undefined);
});

test('eight rows per page; an empty list still gives one page', () => {
    const resources = Array.from({ length: 9 }, (_, i) => resource(`r${i + 1}`));
    const pages = buildIcs211Forms({ ...base, resources, assignmentName: (r) => `A-${r.id}` });
    assert.equal(pages.length, 2);
    assert.equal(pages[0].text['R8 Resource Name or ID 8'], 'R8');
    assert.equal(pages[1].text['R1 Resource Name or ID 1'], 'R9');
    assert.equal(pages[1].text['R1 Incident Assignment 1'], 'A-r9');
    assert.equal(pages[1].text['1 Incident Name'], 'Test Search');
    assert.equal(buildIcs211Forms({ ...base, resources: [] }).length, 1);
});
