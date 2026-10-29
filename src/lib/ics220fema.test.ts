import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ics220fema, ics220femaPageCount } from './ics220fema.ts';
import type { IapAircraftRow, IapPlan } from './iapPlanPersistence.ts';

function aircraft(n: number, category = 'Helicopter T2'): IapAircraftRow {
    return {
        faaId: `N${n}`, category, makeModel: 'Bell 407', baseOwner: 'ICP',
        available: '0700', start: '0800', remarks: `r${n}`,
    };
}

function plan(list: IapAircraftRow[]): IapPlan {
    return {
        dateFrom: '10/29/2026', timeFrom: '0600', dateTo: '10/30/2026', timeTo: '0600',
        preparedBy: 'Plans', preparers: { ics205: '', ics206: '', ics220: '' },
        uas: {
            include: true, sunrise: '0738', sunset: '1834', tfrAltitude: '400 ft AGL',
            tfrCenter: '38.70N 98.00W', briefingTime: '0630', briefingLocation: 'ICP',
            personnel: ['Air Ops'], aircraft: list,
        },
    } as unknown as IapPlan;
}

const ctx = { incidentName: 'Test Fire' };

test('header on both pages, TFR, briefing in remarks, preparer falls back to the plan author', () => {
    const f = ics220fema(plan([aircraft(1)]), ctx);
    const t = f.text;
    assert.deepEqual(f.pages, [0, 1]);
    assert.equal(t['1 Incident Name_23'], 'Test Fire');
    assert.equal(t['Date From'], '10/29/2026');
    assert.equal(t['Time To'], '0600');
    assert.equal(t['3 Sunrise'], '0738');
    assert.equal(t['6 Temporary Flight Restriction Number: Altitude'], '400 ft AGL');
    assert.equal(t['6 Temporary Flight Restriction Number: Center Point'], '38.70N 98.00W');
    assert.equal(t['4 Remarks safety notes hazards air operations special equipment etc'], 'Aviation briefing: 0630, ICP');
    assert.equal(t['11 Prepared by Name'], 'Plans');
    assert.equal(t['11 Prepared by Name_2'], 'Plans');
    assert.equal(t.DateTime_18, '10/29/2026 0600');
    assert.equal(t['NameAir Operations Branch Director'], undefined, 'personnel left for hand entry');
});

test('helicopters then UAS in block 10, fixed-wing on block 9 lines', () => {
    const t = ics220fema(plan([
        { ...aircraft(1, 'UAS T3'), makeModel: 'Mavic 3' },
        aircraft(2),
        { ...aircraft(3, 'Fixed Wing'), makeModel: 'Cessna 206' },
    ]), ctx).text;
    assert.equal(t['FAA NRow1'], 'N2');
    assert.equal(t['CategoryKindTypeRow1'], 'Helicopter T2');
    assert.equal(t['MakeModelRow1'], 'Bell 407');
    assert.equal(t['BaseRow1'], 'ICP');
    assert.equal(t['AvailableRow1'], '0700');
    assert.equal(t['StartRow1'], '0800');
    assert.equal(t['RemarksRow1_2'], 'r2');
    assert.equal(t['FAA NRow2'], 'N1');
    assert.equal(t['MakeModelRow2'], 'Mavic 3');
    assert.equal(t['FAA NRow3'], undefined);
    assert.equal(t['Other Fixed Wing Aircraft 1'], 'Fixed Wing, Cessna 206, N3, ICP');
});

test('seven rows per page; continuation pages repeat page 1 only and say so', () => {
    const p = plan(Array.from({ length: 15 }, (_, i) => aircraft(i + 1)));
    assert.equal(ics220femaPageCount(p), 3);
    assert.equal(ics220femaPageCount(plan([])), 1);
    const third = ics220fema(p, ctx, 2);
    assert.deepEqual(third.pages, [0]);
    assert.equal(third.text['FAA NRow1'], 'N15');
    assert.equal(third.text['FAA NRow2'], undefined);
    assert.match(third.text['4 Remarks safety notes hazards air operations special equipment etc'], /Continuation page 3 of the aircraft lists\./);
});

test('four fixed-wing need a second page', () => {
    const p = plan(Array.from({ length: 4 }, (_, i) => aircraft(i + 1, 'Fixed Wing')));
    assert.equal(ics220femaPageCount(p), 2);
    assert.equal(ics220fema(p, ctx, 1).text['Other Fixed Wing Aircraft 1'], 'Fixed Wing, Bell 407, N4, ICP');
});
