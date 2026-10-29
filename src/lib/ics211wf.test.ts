import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIcs211WfForms, ICS211WF_UAS_GROUP, ICS211WF_YES } from './ics211wf.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';

function resource(id: string, extra: Partial<ResourceAssignment> = {}): ResourceAssignment {
    return {
        id, resourceIdentifier: id.toUpperCase(), resource: 'Drone', agency: 'Agency A',
        timeOrdered: '', eta: null, status: 'have', timeArrived: '2026-10-29T09:14', opNumber: 1, ...extra,
    };
}

test('one form per resource with the record fields', () => {
    const forms = buildIcs211WfForms({
        incidentName: 'Test Fire',
        incidentNumber: 'XX-AAA-000123',
        resources: [
            resource('uas 1', { assignmentCallsign: 'Division A' }),
            resource('engine 3', { resource: 'Vehicle', timeArrived: '' }),
        ],
    });
    assert.equal(forms.length, 2);
    assert.deepEqual(forms[0].pages, [0]);
    assert.equal(forms[0].text['Incident Name'], 'Test Fire');
    assert.equal(forms[0].text['Incident Number'], 'XX-AAA-000123');
    assert.equal(forms[0].text['Resource Name'], 'UAS 1');
    assert.equal(forms[0].text['Incident Assignment'], 'Division A');
    assert.equal(forms[0].text.Agency, 'Agency A');
    assert.equal(forms[0].text['Resource TypeKind'], 'Drone');
    assert.equal(forms[0].text.Date, '10/29/2026');
    assert.equal(forms[1].text.Date, '');
});

test('UAS resources tick "UAS: YES"; others leave it alone', () => {
    const [uas, engine] = buildIcs211WfForms({
        incidentName: 'x', incidentNumber: '',
        resources: [resource('a'), resource('b', { resource: 'Vehicle', resourceIdentifier: 'Engine 3' })],
        assignmentName: () => '',
    });
    assert.deepEqual(uas.radio, { [ICS211WF_UAS_GROUP]: ICS211WF_YES });
    assert.deepEqual(engine.radio, {});
});

test('no resources gives one blank form', () => {
    const forms = buildIcs211WfForms({ incidentName: 'x', incidentNumber: 'y', resources: [] });
    assert.equal(forms.length, 1);
    assert.equal(forms[0].text['Incident Name'], 'x');
});
