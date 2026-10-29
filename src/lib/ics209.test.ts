import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIcs209Form, ics209ResourceSummary, type Ics209Input } from './ics209.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';

function resource(id: string, extra: Partial<ResourceAssignment> = {}): ResourceAssignment {
    return {
        id, resourceIdentifier: id.toUpperCase(), resource: 'Drone', agency: 'Agency A',
        timeOrdered: '', eta: null, status: 'have', timeArrived: '', opNumber: 1, ...extra,
    };
}

const base: Ics209Input = {
    incidentName: 'Test Search',
    incidentNumber: 'INC-26-001',
    opNumber: 1,
    opFrom: '10/29/2026 0600',
    opTo: '10/29/2026 1800',
    incidentStartDate: '10/28/2026',
    incidentStartTime: '2215',
    incidentCommander: 'IC 1 (Agency A)',
    preparedBy: 'Plans',
    preparedByPosition: 'PSC',
    preparedAt: '10/29/2026 0600',
    location: 'Search area, north shore',
    significantEvents: 'Search area expanded',
    weather: 'Clear, 55F',
    objectives: ['Locate subject', ' ', 'Keep searchers safe'],
    resources: [],
};

test('pages 1-3: header, OP, preparer, location, events, weather, objectives', () => {
    const f = buildIcs209Form(base);
    assert.deepEqual(f.pages, [0, 1, 2, 3]);
    assert.equal(f.text['Incident Name'], 'Test Search');
    assert.equal(f.text['Incident Number'], 'INC-26-001');
    assert.equal(f.text['4 Incident Commanders  Agency or Organization'], 'IC 1 (Agency A)');
    assert.equal(f.text.Date, '10/28/2026');
    assert.equal(f.text.Time, '2215');
    assert.equal(f.text['From DateTime'], '10/29/2026 0600');
    assert.equal(f.text['To DateTime'], '10/29/2026 1800');
    assert.equal(f.text['Print Name'], 'Plans');
    assert.equal(f.text['ICS Position'], 'PSC');
    assert.equal(f.text['37 Strategic Objectives define planned endstate for incident'],
        '1. Locate subject\n2. Keep searchers safe');
    assert.equal(f.text['ICS 209 Page of'], '4 of 4');
});

test('report version: Initial on OP1, Update after', () => {
    assert.deepEqual(buildIcs209Form(base).check, ['Check Box Report Version - Initial']);
    assert.deepEqual(buildIcs209Form({ ...base, opNumber: 3 }).check, ['Check Box Report Version -Update']);
});

test('summary counts checked-in resources by agency and kind, busiest first', () => {
    const s = ics209ResourceSummary([
        resource('a'), resource('b'), resource('c', { resource: 'Dog Team' }),
        resource('d', { agency: 'Agency B' }), resource('e', { status: 'requested' }),
        resource('f', { status: 'demobilized' }),
    ], (r) => (r.id === 'a' ? 2 : null));
    assert.deepEqual(s.agencies, ['Agency A', 'Agency B']);
    assert.deepEqual(s.kinds, ['Drone', 'Dog Team']);
    assert.deepEqual(s.resources, [[2, 1], [1, 0]]);
    assert.deepEqual(s.personnel, [[2, 0], [0, 0]]);
    assert.deepEqual(s.personnelKnown, [[true, false], [false, false]]);
});

test('page 4 cells, totals and the irregular field names', () => {
    const resources = [
        resource('a'), resource('b', { resource: 'Vehicle' }), resource('c', { resource: 'Boat' }),
        resource('d', { resource: 'ATV' }),
    ];
    const f = buildIcs209Form({ ...base, resources, personsFor: (r) => (r.id === 'a' ? 3 : 1) });
    const t = f.text;
    assert.equal(t['Agency or OrganizationRow1'], 'Agency A');
    assert.equal(t['Resource 1'], 'ATV');
    // Column 4, row 1 is the one cell named without a comma.
    assert.equal(t['Number of Resources 4 Row 1'], '1');
    assert.equal(t['Number of Resources 4, Row 1'], undefined);
    assert.equal(t['Number of Personnel 4, Row 1'], '1');
    assert.equal(t['Total 1'], '1');
    assert.equal(t['51 Total Personnel includes those associated with resources  eg aircraft or engines  and individual overhead'], '6');
    assert.equal(t['51 Total Personnel includes those associated with resources  eg aircraft or engines  and individual overhead52 Total Resources'], '6');
});

test('more than 17 agencies or 21 kinds fold into "Other"', () => {
    const many = Array.from({ length: 20 }, (_, i) => resource(`r${i}`, { agency: `A${String(i).padStart(2, '0')}`, resource: `K${String(i).padStart(2, '0')}` }));
    const s = ics209ResourceSummary(many);
    assert.equal(s.agencies.length, 17);
    assert.equal(s.agencies[16], 'Other');
    assert.equal(s.resources[16].reduce((a, b) => a + b, 0), 4);
    const f = buildIcs209Form({ ...base, resources: many });
    assert.equal(f.text['48 Agency or OrganizationRow11'], 'A10');
    assert.equal(f.text['Agency or OrganizationRow17'], 'Other');
});
