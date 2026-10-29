# ADR-005: Resource actions that place a resource on ICS forms, with a mission-log trail

## Status

Proposed (draft for discussion)

## Date

2026-10-29

## Context

A resource is entered once on the Resources tab (`ResourceAssignment`: identifier, type, agency,
time ordered, ETA, status, time arrived, linked assignment, operational period). Getting it onto
the forms today is implicit:

- The IAP prefill (`prefillIapPlan`) puts a resource on an ICS-204 when its identifier equals the
  assignment's team name, and turns on the ICS-220 when a resource name contains drone/UAS/UAV.
- Nothing records *when* a resource checked in, changed status or was released, so the ICS-211
  (check-in list), ICS-210 (status change), ICS-214 (activity log) and ICS-221 (demobilization
  check-out) cannot be produced.

The Assignments tab already writes TAK Data Sync mission log entries (`sub.log.create` with `dtg`,
`content`, `keywords`, `entryUid`) when an assignment starts or completes
(`src/lib/workAssignmentLogs.ts`). Log entries are timestamped, kept by TAK Server 5.6 and later,
visible to subscribers (ATAK Data Sync log included) and stored one entry at a time, so concurrent
writers do not overwrite each other.

## Decision

1. **Explicit actions on each resource row** of the Resources tab. Each action only writes fields
   that already exist, then writes one mission log entry:

   | Action | Existing fields written | Form it places the resource on |
   |---|---|---|
   | Check in | `status` = have, `timeArrived` = now (editable) | ICS-211 |
   | Assign to... (pick an OP assignment) | `assignmentUid`, `assignmentCallsign`, `opNumber` | that assignment's ICS-204 resource rows |
   | Status change (Available / Assigned / O/S) | `status` where it maps; the ICS-210 status itself is kept in the log entry | ICS-210 |
   | Add to air operations | IAP plan `uas.personnel` / `uas.aircraft` | ICS-220 |
   | Add to contact list | IAP plan `commsList` | ICS-205A |
   | Demobilize | `status` = demobilized | ICS-221 (and an ICS-210 line) |

   The IAP prefill uses these explicit links first and falls back to today's name matching, so
   existing incidents keep working.

2. **The trail is the mission log.** Each action writes one entry on the incident's management
   DataSync only (planners; not the operational-period DataSyncs that field users subscribe to),
   the same way work-assignment start/complete entries are written:
   - `dtg`: the action time; `content`: one readable line (`UAS 1 assigned to Division A (OP 2)`);
   - `keywords`: `ics-resource`, `action:<check-in|assign|status|air-ops|contact-list|demob>`,
     `resource:<id>`, `op:<n>`, plus `from:<...>` / `to:<...>` where it applies, and
     `status:<Available|Assigned|O/S>` for ICS-210 status changes;
   - `entryUid`: the assignment's uid when the action concerns an assignment.

3. **Forms built from records plus the trail**, filled with the official FEMA fillable PDFs the
   same way as the IAP forms (field names from the PDF, the shared header helper for incident name,
   operational period and preparer):
   - ICS-211: one row per checked-in resource for the operational period;
   - ICS-210: one row per status change entry, using the official FEMA statuses
     (Available / Assigned / O/S);
   - ICS-214: one log for the person taking the actions (the resource tracker): their name, ICS
     position and home agency in the header, and the operational period's entries in time order as
     Notable Activities;
   - ICS-221: one form per demobilized resource.

4. **FEMA or NWCG wildland fire (WF) forms, per operational period, on any incident type.** A
   "WF forms" switch on each OP's IAP plan (and a FEMA / WF selector on the Resources tab, which
   follows that OP's plan) picks the NWCG versions where they exist (ICS-204 WF, ICS-211 WF,
   ICS-220 WF), fed from the same records. FEMA is the default; the incident type does not change it.

## Consequences

- No new data fields on resources or forms; the change is the explicit links and the trail.
- Works on TAK Server 5.6 (mission logs) and with the 5.9 Mission Properties layout alike.
- The trail is visible to anyone subscribed to the management DataSync; a correction is a new
  entry, not an edit of the old one.
- One PR per step: actions and links, then the trail, then each new form, then the WF variants.

## Settled

- One ICS-214 for the person taking the actions, not one per resource.
- ICS-210 uses the official FEMA statuses; the status chosen is recorded in the log entry, so no
  field is added to the resource record. Revisit if other status sets are needed.
- The trail stays on the management DataSync (planners only) for now.
- ICS-207 and ICS-209 are in the IAP only when ticked in the OP's plan, on any incident type (they
  were automatic for wildland fire / disaster). The ICS-209 is now generated: incident, location,
  weather and objectives blocks from the plan and the ICS-201, and the resource commitment summary
  (block 48-52) counted from the resources checked in for the OP.
