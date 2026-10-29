/**
 * ICS-204 WF (NWCG wildland fire Assignment List), filled from the same IAP
 * plan as the FEMA ICS-204 and used instead of it on wildland fire incidents
 * (ADR-005). Differences from the FEMA form: 14 resource rows (designator,
 * leader, number of persons), block 8 is four radio channels (Command,
 * Tactical, Logistics, Air to Ground) taken from the ICS-205 channel plan, and
 * there is no people/contacts block, so the assignment's contacts are added
 * to Special Instructions.
 */

import type { FilledForm } from './iapPdf.ts';
import type { IapAssignmentPlan, IapCommsRow, IapPlan } from './iapPlanPersistence.ts';

export const ICS204WF_RESOURCE_ROWS = 14;

/** Block 8 rows: field-name suffix and how to recognise the channel in the 205 plan. */
const CHANNEL_ROWS: { suffix: string; match: RegExp }[] = [
    { suffix: 'Command', match: /\bcommand\b|\bcmd\b/i },
    { suffix: 'Tactical DivGroup', match: /\btac(tical)?\b/i },
    { suffix: 'Logistics', match: /\blogistics\b|\blog\b/i },
    { suffix: 'Air to Ground', match: /air[\s-]*to[\s-]*ground|\ba\/?g\b/i },
];

/** First 205 channel whose function, name or assignment matches. */
export function channelFor(comms: IapCommsRow[], match: RegExp): IapCommsRow | undefined {
    return comms.find((c) => match.test(c.func) || match.test(c.channelName) || match.test(c.assignment));
}

function joined(...parts: string[]): string {
    return parts.map((p) => p.trim()).filter(Boolean).join(' ');
}

export function ics204wf(plan: IapPlan, incidentName: string, assignment: IapAssignmentPlan): FilledForm {
    const division = plan.divisions.find((d) => d.id === assignment.divisionId);
    const resources = assignment.resources
        .filter((r) => r.identifier.trim() || r.leader.trim() || r.persons.trim())
        .slice(0, ICS204WF_RESOURCE_ROWS);
    const contacts = assignment.contacts
        .filter((c) => c.nameFunction.trim() || c.contact.trim())
        .map((c) => [c.nameFunction.trim(), c.contact.trim()].filter(Boolean).join(': '));
    const special = [
        assignment.specialInstructions.trim(),
        contacts.length ? `Contacts: ${contacts.join('; ')}` : '',
    ].filter(Boolean).join('\n');

    const text: Record<string, string> = {
        '1 Incident NameRow1': incidentName,
        'DateTime From': joined(plan.dateFrom, plan.timeFrom),
        'DateTime To': joined(plan.dateTo, plan.timeTo),
        Division: division?.name || assignment.label,
        'Operations Chief': plan.org.operationsChief,
        'DivisionGroup Supervisor': division?.supervisor || assignment.supervisor,
        '6 Control OperationsWork Assignments': assignment.workAssignment,
        '7 Special Instructions': special,
        '9 Prepared by Resource Unit Leader': plan.preparedBy,
        'Approved by Planning Section Chief': plan.org.planningChief,
        // "Prepared" stamp, as on the other IAP forms: the OP start.
        Date: plan.dateFrom,
        Time: plan.timeFrom,
        'Number of resources assigned': resources.length ? String(resources.length) : '',
    };
    resources.forEach((r, i) => {
        const n = i + 1;
        text[`Strike Team  Task Force  Resource DesignatorRow${n}`] = r.identifier;
        text[`LeaderRow${n}`] = r.leader;
        text[`Number PersonsRow${n}`] = r.persons;
    });
    for (const row of CHANNEL_ROWS) {
        const c = channelFor(plan.comms, row.match);
        if (!c) continue;
        text[`Channel${row.suffix}`] = c.ch;
        text[`Channel Name${row.suffix}`] = c.channelName;
        text[`RX Frequency NW${row.suffix}`] = c.rxFreq;
        text[`RX ToneNAC${row.suffix}`] = c.rxTone;
        text[`TX Frequency NW${row.suffix}`] = c.txFreq;
        text[`TX ToneNAC${row.suffix}`] = c.txTone;
        text[`Mode${row.suffix}`] = c.mode;
    }
    return { text, pages: [0] };
}
