import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIcs210Forms, ics210Rows } from './ics210.ts';
import type { ResourceLogEntry } from './resourceLogs.ts';

function entry(dtg: string, extra: Partial<ResourceLogEntry>): ResourceLogEntry {
    return {
        id: dtg,
        dtg,
        creatorUid: 'tracker',
        action: 'status',
        resourceId: 'r1',
        opNumber: 1,
        from: '',
        to: '',
        status: '',
        content: '',
        ...extra,
    };
}

const names = (id: string) => ({ r1: 'UAS 1', r2: 'K9 2' } as Record<string, string>)[id] ?? id;

test('status and demob entries become rows with replayed From/To', () => {
    const trail = [
        entry('2026-10-29T08:00:00', { action: 'check-in' }),
        entry('2026-10-29T08:05:00', { status: 'Available' }),
        entry('2026-10-29T08:30:00', { action: 'assign', to: 'Division A' }),
        entry('2026-10-29T08:31:00', { status: 'Assigned', content: 'UAS 1 status Assigned (OP 1)\nlaunch from CP' }),
        entry('2026-10-29T11:00:00', { status: 'O/S' }),
        entry('2026-10-29T12:00:00', { action: 'demob' }),
    ];
    const rows = ics210Rows(trail, 'all', names);
    assert.deepEqual(rows.map((r) => [r.resource, r.status, r.from, r.to, r.time]), [
        ['UAS 1', 'Available', '', 'Available', '0805'],
        ['UAS 1', 'Assigned', 'Division A, Available', 'Division A, Assigned', '0831'],
        ['UAS 1', 'O/S', 'Division A, Assigned', 'Division A, O/S', '1100'],
        ['UAS 1', 'O/S', 'Division A, O/S', 'Demobilized', '1200'],
    ]);
    assert.equal(rows[1].date, '10/29/2026');
    assert.equal(rows[1].note, 'launch from CP');
});

test('OP filter keeps rows of that OP but replays the whole trail', () => {
    const trail = [
        entry('2026-10-29T08:00:00', { action: 'assign', to: 'Division A', opNumber: 1 }),
        entry('2026-10-29T08:01:00', { status: 'Assigned', opNumber: 1 }),
        entry('2026-10-29T20:00:00', { status: 'Available', opNumber: 2 }),
        entry('2026-10-29T20:05:00', { status: 'Available', resourceId: 'r2', opNumber: null }),
    ];
    const op2 = ics210Rows(trail, 2, names);
    assert.equal(op2.length, 1);
    assert.equal(op2[0].from, 'Division A, Assigned');
    assert.deepEqual(ics210Rows(trail, null, names).map((r) => r.resource), ['K9 2']);
});

test('release clears the assignment', () => {
    const rows = ics210Rows([
        entry('2026-10-29T08:00:00', { action: 'assign', to: 'Division A' }),
        entry('2026-10-29T09:00:00', { action: 'unassign', from: 'Division A' }),
        entry('2026-10-29T09:01:00', { status: 'Available' }),
    ], 'all', names);
    assert.equal(rows[0].from, '');
    assert.equal(rows[0].to, 'Available');
});

test('forms: header on every page, 28 rows per page, notes in comments', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
        resource: `R${i + 1}`, status: 'Available', from: '', to: 'Available',
        time: '0800', date: '10/29/2026', note: i === 29 ? 'battery swap' : '',
    }));
    const pages = buildIcs210Forms({
        incidentName: 'Test Search',
        opFrom: '2026-10-29T06:00',
        opTo: '2026-10-29T18:00',
        preparedBy: 'Resource Tracker',
        preparedAt: new Date(2026, 9, 29, 19, 0),
        rows,
    });
    assert.equal(pages.length, 2);
    assert.equal(pages[0].text['1 Incident Name_17'], 'Test Search');
    assert.equal(pages[0].text['Date From'], '10/29/2026');
    assert.equal(pages[0].text['Time From'], '0600');
    assert.equal(pages[0].text['Time To'], '1800');
    assert.equal(pages[0].text['9 Prepared by Name_3'], 'Resource Tracker');
    assert.equal(pages[0].text.DateTime_13, '10/29/2026 1900');
    assert.equal(pages[0].text['3 Resource NumberRow28'], 'R28');
    assert.equal(pages[0].text['8 Comments'], undefined);
    assert.equal(pages[1].text['3 Resource NumberRow2'], 'R30');
    assert.equal(pages[1].text['7 Time and Date of ChangeRow2'], '0800');
    assert.equal(pages[1].text['7 Time and Date of ChangeRow2_2'], '10/29/2026');
    assert.equal(pages[1].text['8 Comments'], 'R30 (0800): battery swap');
    assert.equal(buildIcs210Forms({ incidentName: 'x', preparedBy: '', preparedAt: new Date(), rows: [] }).length, 1);
});
