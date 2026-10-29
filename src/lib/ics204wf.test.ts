import assert from 'node:assert/strict';
import { test } from 'node:test';
import { channelFor, ics204wf } from './ics204wf.ts';
import type { IapAssignmentPlan, IapCommsRow, IapPlan } from './iapPlanPersistence.ts';

function comms(func: string, extra: Partial<IapCommsRow> = {}): IapCommsRow {
    return {
        zone: '', ch: '1', func, channelName: `${func} 1`, assignment: '', rxFreq: '151.100',
        rxTone: '', txFreq: '151.100', txTone: '', mode: 'A', remarks: '', ...extra,
    };
}

const assignment: IapAssignmentPlan = {
    segmentUid: 'seg-a',
    label: 'Segment 1',
    supervisor: 'Seg Sup',
    workAssignment: 'Hold the line along the road',
    specialInstructions: 'Watch for snags',
    divisionId: 'div-a',
    resources: [
        { identifier: 'Engine 3', leader: 'Leader 1', persons: '4', contact: '', reporting: '' },
        { identifier: '', leader: '', persons: '', contact: '', reporting: '' },
        { identifier: 'UAS 1', leader: 'Pilot', persons: '2', contact: '', reporting: '' },
    ],
    contacts: [{ nameFunction: 'Div A Sup', contact: 'Tac 2' }, { nameFunction: '', contact: '' }],
};

const plan = {
    dateFrom: '10/29/2026', timeFrom: '0600', dateTo: '10/29/2026', timeTo: '1800',
    preparedBy: 'Resource Tracker',
    org: { operationsChief: 'Ops Chief', planningChief: 'Plans Chief' },
    divisions: [{ id: 'div-a', name: 'Division A', supervisor: 'Div A Sup' }],
    comms: [comms('Command'), comms('Tactical', { ch: '2' }), comms('Air to Ground', { ch: '5' })],
    assignments: [assignment],
} as unknown as IapPlan;

test('header, division and blocks 6/7/9', () => {
    const t = ics204wf(plan, 'Test Fire', assignment).text;
    assert.equal(t['1 Incident NameRow1'], 'Test Fire');
    assert.equal(t['DateTime From'], '10/29/2026 0600');
    assert.equal(t['DateTime To'], '10/29/2026 1800');
    assert.equal(t.Division, 'Division A');
    assert.equal(t['Operations Chief'], 'Ops Chief');
    assert.equal(t['DivisionGroup Supervisor'], 'Div A Sup');
    assert.equal(t['6 Control OperationsWork Assignments'], 'Hold the line along the road');
    assert.equal(t['7 Special Instructions'], 'Watch for snags\nContacts: Div A Sup: Tac 2');
    assert.equal(t['9 Prepared by Resource Unit Leader'], 'Resource Tracker');
    assert.equal(t['Approved by Planning Section Chief'], 'Plans Chief');
});

test('resources: blank rows skipped, count filled', () => {
    const t = ics204wf(plan, 'x', assignment).text;
    assert.equal(t['Strike Team  Task Force  Resource DesignatorRow1'], 'Engine 3');
    assert.equal(t.LeaderRow1, 'Leader 1');
    assert.equal(t['Number PersonsRow1'], '4');
    assert.equal(t['Strike Team  Task Force  Resource DesignatorRow2'], 'UAS 1');
    assert.equal(t['Number of resources assigned'], '2');
});

test('block 8 channels come from the 205 plan by function', () => {
    const t = ics204wf(plan, 'x', assignment).text;
    assert.equal(t.ChannelCommand, '1');
    assert.equal(t['Channel NameCommand'], 'Command 1');
    assert.equal(t['RX Frequency NWCommand'], '151.100');
    assert.equal(t['ChannelTactical DivGroup'], '2');
    assert.equal(t['ChannelAir to Ground'], '5');
    assert.equal(t.ChannelLogistics, undefined);
    assert.equal(channelFor([comms('', { channelName: 'A/G 1' })], /\ba\/?g\b/i)?.channelName, 'A/G 1');
});

test('assignment without a division uses its label', () => {
    const t = ics204wf(plan, 'x', { ...assignment, divisionId: '' }).text;
    assert.equal(t.Division, 'Segment 1');
    assert.equal(t['DivisionGroup Supervisor'], 'Seg Sup');
});
