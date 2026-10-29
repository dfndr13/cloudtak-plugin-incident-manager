import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIcs214Forms, ics214Rows, type Ics214Row } from './ics214.ts';
import type { ResourceLogEntry } from './resourceLogs.ts';

function entry(dtg: string, content: string, opNumber: number | null = 1): ResourceLogEntry {
    return {
        id: dtg, dtg, creatorUid: 't', action: 'assign', resourceId: 'r1',
        opNumber, from: '', to: '', status: '', content,
    };
}

const base = {
    incidentName: 'Test Search',
    opFrom: '2026-10-29T06:00',
    opTo: '2026-10-29T18:00',
    name: 'Resource Tracker',
    icsPosition: 'RESL',
    homeAgency: 'Agency A',
    preparedAt: new Date(2026, 9, 29, 19, 0),
};

function rows(n: number): Ics214Row[] {
    return Array.from({ length: n }, (_, i) => ({ dateTime: `t${i + 1}`, activity: `a${i + 1}` }));
}

test('rows: entry time and sentence, note joined, OP filter', () => {
    const trail = [
        entry('2026-10-29T08:31:00', 'UAS 1 assigned to Division A (OP 1)\nlaunch from CP'),
        entry('2026-10-29T20:00:00', 'K9 2 checked in (OP 2)', 2),
    ];
    assert.deepEqual(ics214Rows(trail, 1), [
        { dateTime: '10/29/2026 0831', activity: 'UAS 1 assigned to Division A (OP 1) — launch from CP' },
    ]);
    assert.equal(ics214Rows(trail, 'all').length, 2);
    assert.equal(ics214Rows(trail, null).length, 0);
});

test('up to 24 rows: page 1 only, with the header blocks', () => {
    const forms = buildIcs214Forms({ ...base, rows: rows(24) });
    assert.equal(forms.length, 1);
    assert.deepEqual(forms[0].pages, [0]);
    const t = forms[0].text;
    assert.equal(t['1 Incident Name_19'], 'Test Search');
    assert.equal(t['Date From'], '10/29/2026');
    assert.equal(t['Time To'], '1800');
    assert.equal(t['3 Name'], 'Resource Tracker');
    assert.equal(t['4 ICS Position'], 'RESL');
    assert.equal(t['5 Home Agency and Unit'], 'Agency A');
    assert.equal(t['8 Prepared by Name'], 'Resource Tracker');
    assert.equal(t.DateTime_15, '10/29/2026 1900');
    assert.equal(t.DateTimeRow24, 't24');
    assert.equal(t['Notable ActivitiesRow1'], 'a1');
});

test('25-60 rows: page 1 + page 2 from one copy; naming switches at row 25', () => {
    const forms = buildIcs214Forms({ ...base, rows: rows(60) });
    assert.equal(forms.length, 1);
    assert.deepEqual(forms[0].pages, [0, 1]);
    const t = forms[0].text;
    assert.equal(t['DateTimeRow1_2'], 't25');
    assert.equal(t['Notable ActivitiesRow24_2'], 'a48');
    assert.equal(t.DateTimeRow25, 't49');
    assert.equal(t['Notable ActivitiesRow36'], 'a60');
    assert.equal(t['1 Incident Name_20'], 'Test Search');
    assert.equal(t['8 Prepared by Name_2'], 'Resource Tracker');
});

test('more than 60 rows: further copies use the continuation page only', () => {
    const forms = buildIcs214Forms({ ...base, rows: rows(100) });
    assert.equal(forms.length, 3);
    assert.deepEqual(forms[1].pages, [1]);
    assert.equal(forms[1].text['DateTimeRow1_2'], 't61');
    assert.equal(forms[1].text.DateTimeRow36, 't96');
    assert.equal(forms[2].text['DateTimeRow4_2'], 't100');
    assert.equal(forms[2].text['DateTimeRow5_2'], undefined);
    assert.equal(forms[1].text['1 Incident Name_19'], undefined);
    assert.equal(buildIcs214Forms({ ...base, rows: [] }).length, 1);
});
