import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OpAssignment } from '../domain/entities.ts';
import type { IapPlan } from './iapPlanPersistence.ts';
import {
    addAircraftToPlan,
    aircraftRowFor,
    assignableFor,
    assignmentOptionLabel,
    assignPatch,
    checkInPatch,
    demobilizePatch,
    hasAircraft,
    isAssignedTo,
    resourcesForAssignment,
    unassignPatch,
} from './resourceActions.ts';
import { mergeResourceAssignmentPatch, type ResourceAssignment } from './resourceAssignments.ts';

function resource(id: string, extra: Partial<ResourceAssignment> = {}): ResourceAssignment {
    return {
        id,
        resourceIdentifier: id.toUpperCase(),
        resource: 'Drone',
        agency: 'Agency A',
        timeOrdered: '',
        eta: null,
        status: 'requested',
        timeArrived: '',
        opNumber: null,
        ...extra,
    };
}

const divA: OpAssignment = { opNumber: 2, segmentUid: 'seg-a', label: 'Division A', team: 'UAS 1' };
const divB: OpAssignment = { opNumber: 2, segmentUid: 'seg-b', label: 'Division B' };
const op1A: OpAssignment = { opNumber: 1, segmentUid: 'seg-a', label: 'Division A' };

test('check in sets status have and the arrival time', () => {
    const r = mergeResourceAssignmentPatch(resource('uas 1'), checkInPatch('2026-10-29T09:14'));
    assert.equal(r.status, 'have');
    assert.equal(r.timeArrived, '2026-10-29T09:14');
});

test('assign links the resource to the OP assignment through existing fields', () => {
    const r = mergeResourceAssignmentPatch(resource('uas 1'), assignPatch(divA));
    assert.equal(r.assignmentUid, 'seg-a');
    assert.equal(r.assignmentCallsign, 'Division A');
    assert.equal(r.opNumber, 2);
    assert.equal(isAssignedTo(r, divA), true);
    assert.equal(isAssignedTo(r, op1A), false, 'same segment, other OP');
});

test('unassign clears the link but keeps the OP', () => {
    const assigned = mergeResourceAssignmentPatch(resource('uas 1'), assignPatch(divA));
    const r = mergeResourceAssignmentPatch(assigned, unassignPatch());
    assert.equal(r.assignmentUid, undefined);
    assert.equal(r.assignmentCallsign, undefined);
    assert.equal(r.opNumber, 2);
});

test('demobilize sets status demobilized', () => {
    assert.equal(mergeResourceAssignmentPatch(resource('uas 1'), demobilizePatch()).status, 'demobilized');
});

test('a link without an OP number matches the segment in any OP', () => {
    const r = resource('uas 1', { assignmentUid: 'seg-a' });
    assert.equal(isAssignedTo(r, divA), true);
    assert.equal(isAssignedTo(r, op1A), true);
});

test('ICS-204 resources: explicit assignments win over the team-name match', () => {
    const explicit = resource('engine 3', assignPatch(divA) as Partial<ResourceAssignment>);
    const byName = resource('uas 1');
    assert.deepEqual(resourcesForAssignment([explicit, byName], divA).map((r) => r.id), ['engine 3']);
});

test('ICS-204 resources: falls back to the team-name match when nothing is assigned', () => {
    const byName = resource('uas 1');
    const other = resource('engine 3');
    assert.deepEqual(resourcesForAssignment([byName, other], divA).map((r) => r.id), ['uas 1']);
});

test('ICS-204 resources: fallback leaves out resources assigned elsewhere', () => {
    const elsewhere = resource('engine 3', assignPatch(divA) as Partial<ResourceAssignment>);
    const free = resource('uas 1');
    // Division B has no team, so the fallback lists every unassigned resource.
    assert.deepEqual(resourcesForAssignment([elsewhere, free], divB).map((r) => r.id), ['uas 1']);
});

test('assignable list is limited to the resource OP and sorted', () => {
    const list = [divB, op1A, divA];
    assert.deepEqual(assignableFor(resource('x', { opNumber: 2 }), list).map(assignmentOptionLabel),
        ['OP 2 · Division A', 'OP 2 · Division B']);
    assert.deepEqual(assignableFor(resource('x'), list).map(assignmentOptionLabel),
        ['OP 1 · Division A', 'OP 2 · Division A', 'OP 2 · Division B']);
});

test('air ops: aircraft row from existing fields, added once, 220 switched on', () => {
    const plan = { uas: { include: false, aircraft: [] as ReturnType<typeof aircraftRowFor>[] } } as Pick<IapPlan, 'uas'>;
    const r = resource('uas 1', { resource: 'Drone', agency: 'Agency A' });
    assert.deepEqual(aircraftRowFor(r), {
        faaId: 'UAS 1', category: 'Drone', makeModel: '', baseOwner: 'Agency A', available: '', start: '', remarks: '',
    });
    const once = addAircraftToPlan(plan, r);
    assert.equal(once.uas.include, true);
    assert.equal(once.uas.aircraft.length, 1);
    assert.equal(hasAircraft(once, r), true);
    assert.equal(addAircraftToPlan(once, r), once, 'already there: unchanged');
    assert.equal(hasAircraft(plan, r), false);
});
