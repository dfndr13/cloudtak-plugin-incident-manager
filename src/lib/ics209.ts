/**
 * ICS-209 Incident Status Summary (FEMA v3, bundled template), filled from
 * the IAP plan, the ICS-201 and the OP's resource records (ADR-005). Pages 1-3
 * carry the incident, location, weather and objectives blocks the plugin
 * knows; page 4 is the Incident Resource Commitment Summary, counted from the
 * resources checked in for the OP: one row per agency, one column per
 * resource kind, resources over personnel in each cell. Casualty, damage,
 * threat, cost and jurisdiction blocks are left for hand entry.
 */

import type { FilledForm } from './iapPdf.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';

export const ICS209_AGENCY_ROWS = 17;
export const ICS209_KIND_COLUMNS = 21;
const OTHER = 'Other';

export interface Ics209Input {
    incidentName: string;
    incidentNumber: string;
    opNumber: number;
    /** Operational period start / end, already formatted ("10/29/2026 0600"). */
    opFrom: string;
    opTo: string;
    incidentStartDate: string;
    incidentStartTime: string;
    incidentCommander: string;
    preparedBy: string;
    preparedByPosition: string;
    preparedAt: string;
    location: string;
    significantEvents: string;
    weather: string;
    objectives: string[];
    /** The OP's resource records; only checked-in ("have") ones are counted. */
    resources: ResourceAssignment[];
    /** Persons with a resource (from the ICS-204 rows), when known. */
    personsFor?: (resource: ResourceAssignment) => number | null;
}

export interface Ics209Summary {
    agencies: string[];
    kinds: string[];
    /** resources[agency][kind] and personnel[agency][kind]. */
    resources: number[][];
    personnel: number[][];
    /** True when a cell's personnel count is known (some resource had persons). */
    personnelKnown: boolean[][];
}

/** Keep the first `max - 1` labels and fold the rest into "Other". */
function fold(labels: string[], max: number): { shown: string[]; index: (label: string) => number } {
    if (labels.length <= max) return { shown: labels, index: (l) => labels.indexOf(l) };
    const shown = [...labels.slice(0, max - 1), OTHER];
    return { shown, index: (l) => Math.min(labels.indexOf(l), max - 1) };
}

/** Agency × kind counts of the checked-in resources (block 48-52). */
export function ics209ResourceSummary(
    resources: ResourceAssignment[],
    personsFor: (r: ResourceAssignment) => number | null = () => null,
): Ics209Summary {
    const onScene = resources.filter((r) => r.status === 'have');
    const agencyOf = (r: ResourceAssignment) => r.agency.trim() || 'Unknown agency';
    const kindOf = (r: ResourceAssignment) => r.resource.trim() || OTHER;
    const tally = (key: (r: ResourceAssignment) => string) => {
        const m = new Map<string, number>();
        for (const r of onScene) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
        return m;
    };
    const agencyCount = tally(agencyOf);
    const kindCount = tally(kindOf);
    // Busiest first, then alphabetical, so folding keeps the main ones.
    const order = (m: Map<string, number>) => [...m.keys()].sort((a, b) => (m.get(b)! - m.get(a)!) || a.localeCompare(b));
    const agencies = fold(order(agencyCount), ICS209_AGENCY_ROWS);
    const kinds = fold(order(kindCount), ICS209_KIND_COLUMNS);

    const grid = () => agencies.shown.map(() => kinds.shown.map(() => 0));
    const summary: Ics209Summary = {
        agencies: agencies.shown,
        kinds: kinds.shown,
        resources: grid(),
        personnel: grid(),
        personnelKnown: agencies.shown.map(() => kinds.shown.map(() => false)),
    };
    for (const r of onScene) {
        const a = agencies.index(agencyOf(r));
        const k = kinds.index(kindOf(r));
        summary.resources[a][k] += 1;
        const persons = personsFor(r);
        if (persons != null) {
            summary.personnel[a][k] += persons;
            summary.personnelKnown[a][k] = true;
        }
    }
    return summary;
}

/** Block 51 (total personnel) field for agency row n; the template's names vary. */
function totalPersonnelField(n: number): string {
    const base = '51 Total Personnel includes those associated with resources  eg aircraft or engines  and individual overhead';
    if (n === 1) return base;
    if (n <= 12) return `${base}_${n}`;
    return `${base}Row${n}`;
}

/** Block 48 (agency) field for row n; rows 11, 13 and 14 carry a "48 " prefix. */
function agencyField(n: number): string {
    return [11, 13, 14].includes(n) ? `48 Agency or OrganizationRow${n}` : `Agency or OrganizationRow${n}`;
}

/** Block 49 resource-count cell; one cell is named without its comma. */
function resourceCellField(kind: number, row: number): string {
    return kind === 4 && row === 1 ? 'Number of Resources 4 Row 1' : `Number of Resources ${kind}, Row ${row}`;
}

const num = (n: number): string => (n ? String(n) : '');

/** The filled ICS-209 (pages 1-4 of the template). */
export function buildIcs209Form(input: Ics209Input): FilledForm {
    const text: Record<string, string> = {
        // Name / number are one field each, shown on every page.
        'Incident Name': input.incidentName,
        'Incident Number': input.incidentNumber,
        '4 Incident Commanders  Agency or Organization': input.incidentCommander,
        Date: input.incidentStartDate,
        Time: input.incidentStartTime,
        'From DateTime': input.opFrom,
        'To DateTime': input.opTo,
        'Print Name': input.preparedBy,
        'ICS Position': input.preparedByPosition,
        'DateTime Prepared_2': input.preparedAt,
        '25 Short Location or Area Description list all affected areas or a reference point': input.location,
        '28 Significant Events for the Time Period Reported summarize significant progress made evacuations incident growth etc':
            input.significantEvents,
        '35.Weather Concerns (synopsis of current and predictedweather; discuss related factors that may cause concern):':
            input.weather,
        '37 Strategic Objectives define planned endstate for incident': input.objectives
            .map((o) => o.trim())
            .filter(Boolean)
            .map((o, i) => `${i + 1}. ${o}`)
            .join('\n'),
        'ICS 209 Page 1 of': '4',
        'ICS 209 Page 2 of': '4',
        'ICS 209 Page 3 of': '4',
        'ICS 209 Page of': '4 of 4',
    };

    const s = ics209ResourceSummary(input.resources, input.personsFor);
    s.kinds.forEach((kind, k) => { text[`Resource ${k + 1}`] = kind; });
    let grandPersonnel = 0;
    let anyPersonnel = false;
    s.agencies.forEach((agency, a) => {
        const row = a + 1;
        text[agencyField(row)] = agency;
        let rowPersonnel = 0;
        let rowKnown = false;
        s.kinds.forEach((_, k) => {
            const col = k + 1;
            text[resourceCellField(col, row)] = num(s.resources[a][k]);
            if (s.personnelKnown[a][k]) {
                text[`Number of Personnel ${col}, Row ${row}`] = String(s.personnel[a][k]);
                rowPersonnel += s.personnel[a][k];
                rowKnown = true;
            }
        });
        if (rowKnown) text[totalPersonnelField(row)] = String(rowPersonnel);
        grandPersonnel += rowPersonnel;
        anyPersonnel ||= rowKnown;
    });
    s.kinds.forEach((_, k) => {
        text[`Total ${k + 1}`] = num(s.resources.reduce((sum, row) => sum + row[k], 0));
    });
    if (anyPersonnel) {
        text['51 Total Personnel includes those associated with resources  eg aircraft or engines  and individual overhead52 Total Resources'] =
            String(grandPersonnel);
    }

    return {
        text,
        check: [input.opNumber <= 1 ? 'Check Box Report Version - Initial' : 'Check Box Report Version -Update'],
        pages: [0, 1, 2, 3],
    };
}
