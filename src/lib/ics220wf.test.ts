import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ics220wf, ics220wfPageCount } from './ics220wf.ts';
import type { IapAircraftRow, IapPlan } from './iapPlanPersistence.ts';

function aircraft(n: number): IapAircraftRow {
    return {
        faaId: `FA${n}`, category: 'UAS T3', makeModel: 'Mavic 3', baseOwner: 'ICP',
        available: '0700', start: '0800', remarks: `r${n}`,
    };
}

function plan(count: number, extra: Partial<IapPlan['uas']> = {}): IapPlan {
    return {
        dateFrom: '10/29/2026', timeFrom: '0600', dateTo: '10/29/2026', timeTo: '1800',
        preparedBy: 'Plans', preparers: { ics205: '', ics206: '', ics220: 'Air Ops' },
        uas: {
            include: true, sunrise: '0738', sunset: '1834', tfrAltitude: '400 ft AGL',
            tfrCenter: '38.70N 98.00W', briefingTime: '0630', briefingLocation: 'ICP',
            personnel: [], aircraft: Array.from({ length: count }, (_, i) => aircraft(i + 1)), ...extra,
        },
    } as unknown as IapPlan;
}

const ctx = { incidentName: 'Test Fire', incidentNumber: 'XX-AAA-000123' };

test('header, sunrise/sunset, OP, TFR altitude and remarks', () => {
    const t = ics220wf(plan(1), ctx).text;
    assert.equal(t['Incident Name  Number'], 'Test Fire / XX-AAA-000123');
    assert.equal(t['Date Prepared'], '10/29/2026');
    assert.equal(t['Time Prepared'], '0600');
    assert.equal(t['Prepared By'], 'Air Ops');
    assert.equal(t.Sunrise, '0738');
    assert.equal(t.Sunset, '1834');
    assert.equal(t['Operational Period Date'], '10/29/2026');
    assert.equal(t['Operational Period  Time'], '0600-1800');
    assert.equal(t.Altitude, '400 ft AGL');
    assert.equal(t['General Remarks'], 'TFR center point: 38.70N 98.00W\nAviation briefing: 0630, ICP');
});

test('block 18 rows, make/model column numbered 13-16', () => {
    const t = ics220wf(plan(4), ctx).text;
    assert.equal(t.IdentifierRow1, 'FA1');
    assert.equal(t['Cat TypeRow1'], 'UAS T3');
    assert.equal(t['Make ModelRow13'], 'Mavic 3');
    assert.equal(t.LocationRow1, 'ICP');
    assert.equal(t.StartRow1, '0800');
    assert.equal(t.AvailRow1, '0700');
    assert.equal(t.RemarksRow4, 'r4');
    assert.equal(t['Make ModelRow16'], 'Mavic 3');
});

test('four aircraft per page; continuation pages say so', () => {
    const p = plan(9);
    assert.equal(ics220wfPageCount(p), 3);
    assert.equal(ics220wfPageCount(plan(0)), 1);
    const third = ics220wf(p, ctx, 2).text;
    assert.equal(third.IdentifierRow1, 'FA9');
    assert.equal(third.IdentifierRow2, undefined);
    assert.match(third['General Remarks'], /Continuation page 3: UAS 9-9\./);
});

test('multi-day OP and missing preparer override', () => {
    const p = plan(0);
    (p as { dateTo: string }).dateTo = '10/30/2026';
    (p as { preparers: IapPlan['preparers'] }).preparers = { ics205: '', ics206: '', ics220: '' };
    const t = ics220wf(p, { incidentName: 'Test Fire', incidentNumber: '' }).text;
    assert.equal(t['Operational Period Date'], '10/29/2026 - 10/30/2026');
    assert.equal(t['Prepared By'], 'Plans');
    assert.equal(t['Incident Name  Number'], 'Test Fire');
});
