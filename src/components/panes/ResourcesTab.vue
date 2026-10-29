<template>
    <div>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
            <h3 class='mb-0'>
                Resources
            </h3>
            <span
                v-if='meta?.fetchedAt'
                class='text-muted small'
            >
                D4H agencies synced {{ formatD4hSyncTime(meta.fetchedAt) }}
            </span>
            <div class='ms-auto d-flex gap-2 align-items-center'>
                <TablerEnum
                    v-if='activeMission'
                    v-model='formsOp'
                    :options='formsOpOptions'
                    :disabled='exporting'
                    title='ICS forms for'
                />
                <TablerEnum
                    v-if='activeMission'
                    v-model='formsVersion'
                    :options='FORM_VERSIONS'
                    :disabled='exporting'
                    title='FEMA or NWCG wildland fire (WF) version — ICS-211 WF is one card per resource'
                />
                <button
                    v-if='activeMission'
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='exporting'
                    title='Incident Check-In List (ICS-211) PDF'
                    @click='onExportForm("ICS-211")'
                >
                    ICS-211 PDF
                </button>
                <button
                    v-if='activeMission'
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='exporting'
                    title='Resource Status Change (ICS-210) PDF'
                    @click='onExportForm("ICS-210")'
                >
                    ICS-210 PDF
                </button>
                <button
                    v-if='activeMission'
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='exporting'
                    title='Activity Log (ICS-214) PDF of the resource trail'
                    @click='onExportForm("ICS-214")'
                >
                    ICS-214 PDF
                </button>
                <button
                    v-if='activeMission'
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='exporting'
                    title='Demobilization Check-Out (ICS-221) PDF, one per demobilized resource'
                    @click='onExportForm("ICS-221")'
                >
                    ICS-221 PDF
                </button>
                <button
                    v-if='infoDismissed'
                    type='button'
                    class='btn btn-outline-secondary btn-sm d-inline-flex align-items-center'
                    title='Show information'
                    aria-label='Show information'
                    @click='restoreInfo'
                >
                    <IconInfoCircle
                        :size='16'
                        stroke='1.5'
                    />
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='loadingRoster'
                    @click='refreshAgencies'
                >
                    {{ loadingRoster ? 'Loading…' : 'Refresh agencies' }}
                </button>
            </div>
        </div>

        <p class='text-muted small mb-2'>
            Create and manage resource team assignments. Each record is saved to
            <strong>mission_schema.json</strong> (<code>incident_response.resource_assignments</code>)
            and appears in the <strong>Organization</strong> palette by Resource Identifier.
        </p>

        <TablerInlineAlert
            v-if='!activeMission'
            class='mb-3'
            severity='info'
            title='Mission required'
            description='Select a mission in Create | Open before creating resource assignments.'
        />

        <TablerInlineAlert
            v-if='opRegistryError'
            severity='warning'
            title='Operational Periods'
            :description='opRegistryError'
        />
        <TablerInlineAlert
            v-if='statusMessage'
            class='mb-3'
            :severity='statusError ? "danger" : "success"'
            :title='statusError ? "Error" : "Saved"'
            :description='statusMessage'
        />
        <TablerInlineAlert
            v-if='exportNotice'
            class='mb-3'
            :severity='exportError ? "danger" : "success"'
            :title='exportTitle'
            :description='exportNotice'
        />
        <TablerInlineAlert
            v-if='trailError'
            class='mb-3'
            severity='warning'
            title='Resource log'
            :description='trailError'
        />

        <TablerBorder
            v-if='!infoDismissed'
            class='cloudtak-accent text-white mb-3'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center gap-1'>
                    <IconInfoCircle
                        :size='16'
                        stroke='1.5'
                    />
                    Information
                </p>
            </template>
            <p class='small mb-2'>
                Utilize the
                <a
                    href='#'
                    @click.prevent='selectHTabGuarded("organization")'
                >Organization Tab</a>
                to create your ICS 201 Organizational Chart and Team Assignments
            </p>
            <button
                type='button'
                class='btn btn-outline-secondary btn-sm'
                @click='dismissInfo'
            >
                Do not remind me
            </button>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='defaultAgencyExpanded'
                    @click='defaultAgencyExpanded = !defaultAgencyExpanded'
                    @keydown.enter.prevent='defaultAgencyExpanded = !defaultAgencyExpanded'
                    @keydown.space.prevent='defaultAgencyExpanded = !defaultAgencyExpanded'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Default Agency
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :class='{ "rotate-180": defaultAgencyExpanded }'
                        :size='18'
                        stroke='1.5'
                    />
                </div>
            </template>
            <div v-show='defaultAgencyExpanded'>
                <TablerInput
                    v-model='defaultAgencyInput'
                    label='Default Agency'
                    placeholder='Your agency name'
                    autocomplete='organization'
                    :disabled='!activeMission || saving || savingDefaultAgency'
                    :description='defaultAgencyHint'
                    @blur='onDefaultAgencyBlur'
                />
            </div>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center gap-2 w-100'>
                    <span>New Resource Assignment</span>
                    <span
                        class='ms-auto d-inline-flex'
                        @click.stop
                    >
                        <NavHelpButton help-key='resource-summary' />
                    </span>
                </p>
            </template>

            <div class='row g-2'>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.resourceIdentifier'
                        label='Resource Identifier'
                        placeholder='e.g. SO GROUND TEAM 1'
                        autocomplete='off'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerEnum
                        v-model='formResourceLabel'
                        label='Resource'
                        :options='resourceFormOptions'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerEnum
                        v-model='formAgencyLabel'
                        label='Agency'
                        :options='agencyFormOptions'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.timeOrdered'
                        label='Time Ordered'
                        type='datetime-local'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='formEtaString'
                        label='ETA'
                        type='number'
                        placeholder='Hours'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerEnum
                        v-model='formStatusLabel'
                        label='Status'
                        :options='statusLabelOptions'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.timeArrived'
                        label='Time Arrived'
                        type='datetime-local'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div
                    v-if='opLabelOptions.length > 1'
                    class='col-md-3'
                >
                    <TablerEnum
                        v-model='formOpLabel'
                        label='Operational Period'
                        :options='opLabelOptions'
                        :disabled='!activeMission || saving'
                    />
                </div>
            </div>

            <div class='d-flex flex-wrap gap-2 mt-3'>
                <button
                    type='button'
                    class='btn btn-primary btn-sm'
                    :disabled='!canCreate || saving'
                    @click='createAssignment'
                >
                    {{ saving ? 'Saving…' : 'Create assignment' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='saving'
                    @click='resetForm'
                >
                    Clear form
                </button>
            </div>
        </TablerBorder>

        <TablerBorder
            v-if='activeMission'
            class='cloudtak-accent text-white'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Mission Resource Assignments ({{ assignments.length }})
                    <span
                        v-if='loading'
                        class='text-muted fw-normal text-lowercase'
                    > — Loading…</span>
                </p>
            </template>

            <div
                v-if='!assignments.length && !loading'
                class='text-muted small'
            >
                No assignments yet — create one above. They will be stored in mission_schema.json.
            </div>
            <div
                v-else-if='assignments.length'
                class='resources-table-scroll'
            >
                <table class='table table-sm table-hover mb-0 small align-middle'>
                    <thead class='sticky-top bg-body'>
                        <tr>
                            <th>Resource Identifier</th>
                            <th>Resource</th>
                            <th>Agency</th>
                            <th>Time Ordered</th>
                            <th style='width: 72px;'>
                                ETA
                            </th>
                            <th style='width: 110px;'>
                                Status
                            </th>
                            <th>Time Arrived</th>
                            <th
                                v-if='opLabelOptions.length > 1'
                                style='width: 100px;'
                            >
                                OP
                            </th>
                            <th style='min-width: 220px;'>
                                Assignment / Actions
                            </th>
                            <th style='width: 72px;' />
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='assignment in assignments'
                            :key='assignment.id'
                        >
                            <td>
                                <TablerInput
                                    :model-value='assignment.resourceIdentifier'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "resourceIdentifier", String($event))'
                                />
                            </td>
                            <td>
                                <TablerEnum
                                    :model-value='assignment.resource || "—"'
                                    :options='rowResourceOptions'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "resource", $event === "—" ? "" : $event)'
                                />
                            </td>
                            <td>
                                <TablerEnum
                                    :model-value='assignment.agency'
                                    :options='rowAgencyOptions(assignment.agency)'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "agency", $event)'
                                />
                            </td>
                            <td>
                                <TablerInput
                                    :model-value='assignment.timeOrdered'
                                    type='datetime-local'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "timeOrdered", String($event))'
                                />
                            </td>
                            <td>
                                <TablerInput
                                    :model-value='assignment.eta ?? ""'
                                    type='number'
                                    :disabled='saving'
                                    @update:model-value='onEtaChange(assignment.id, String($event))'
                                />
                            </td>
                            <td>
                                <TablerEnum
                                    :model-value='statusLabelFor(assignment.status)'
                                    :options='statusLabelOptions'
                                    :disabled='saving'
                                    @update:model-value='onStatusLabelChange(assignment.id, $event)'
                                />
                            </td>
                            <td>
                                <TablerInput
                                    :model-value='assignment.timeArrived'
                                    type='datetime-local'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "timeArrived", String($event))'
                                />
                            </td>
                            <td v-if='opLabelOptions.length > 1'>
                                <TablerEnum
                                    :model-value='opLabelFor(assignment.opNumber)'
                                    :options='opLabelOptions'
                                    :disabled='saving'
                                    @update:model-value='onOpLabelChange(assignment.id, $event)'
                                />
                            </td>
                            <td>
                                <TablerEnum
                                    :model-value='assignmentLabelFor(assignment)'
                                    :options='assignmentOptionsFor(assignment)'
                                    :disabled='saving'
                                    @update:model-value='onAssignmentChange(assignment.id, $event)'
                                />
                                <TablerEnum
                                    class='mt-1'
                                    :model-value='ics210StatusFor(assignment.id)'
                                    :options='ics210Options'
                                    :disabled='saving'
                                    title='ICS-210 status'
                                    @update:model-value='onIcs210StatusChange(assignment.id, $event)'
                                />
                                <div class='d-flex gap-1 mt-1'>
                                    <button
                                        v-if='assignment.status !== "have" && assignment.status !== "demobilized"'
                                        type='button'
                                        class='btn btn-outline-success btn-sm'
                                        title='Check in now (ICS-211)'
                                        :disabled='saving'
                                        @click='onCheckIn(assignment.id)'
                                    >
                                        Check in
                                    </button>
                                    <button
                                        v-if='assignment.status !== "demobilized"'
                                        type='button'
                                        class='btn btn-outline-secondary btn-sm'
                                        title='Demobilize (ICS-221)'
                                        :disabled='saving'
                                        @click='onDemobilize(assignment.id)'
                                    >
                                        Demob
                                    </button>
                                </div>
                            </td>
                            <td>
                                <button
                                    type='button'
                                    class='btn btn-outline-danger btn-sm'
                                    title='Remove assignment'
                                    :disabled='saving'
                                    @click='removeAssignmentRecord(assignment.id)'
                                >
                                    ×
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import { IconChevronDown, IconInfoCircle } from '@tabler/icons-vue';
import {
    TablerBorder,
    TablerInput,
    TablerEnum,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import { useIncident } from '../../composables/useIncident.ts';
import { usePluginSettings } from '../../composables/usePluginSettings.ts';
import { useResourceAssignments } from '../../composables/useResourceAssignments.ts';
import { formatD4hSyncTime, loadD4hMeta, loadD4hRoster } from '../../lib/d4hRoster.ts';
import type { D4HRosterMeta } from '../../lib/d4hTypes.ts';
import { nowDatetimeLocal } from '../../lib/incidentInfo.ts';
import NavHelpButton from '../NavHelpButton.vue';
import {
    buildAgencyOptions,
    resolveEffectiveDefaultAgency,
    RESOURCE_ASSIGNMENT_STATUSES,
    RESOURCE_TYPE_OPTIONS,
    type ResourceAssignment,
    type ResourceAssignmentStatus,
} from '../../lib/resourceAssignments.ts';
import type { OpAssignment, OpPeriodRegistryEntry } from '../../domain/entities.ts';
import { currentOpPeriod } from '../../domain/registry.ts';
import { createRegistryStore } from '../../lib/registryPersistence.ts';
import { createAssignmentStore } from '../../lib/opAssignmentPersistence.ts';
import {
    assignableFor,
    assignmentOptionLabel,
    assignPatch,
    checkInPatch,
    demobilizePatch,
    unassignPatch,
} from '../../lib/resourceActions.ts';
import {
    currentIcs210Status,
    ICS210_STATUSES,
    type Ics210Status,
    type ResourceLogEntry,
    type ResourceLogInput,
} from '../../lib/resourceLogs.ts';
import { loadResourceTrail, sendResourceLog } from '../../lib/resourceLogPersistence.ts';
import { buildIcs211Forms, ics211Resources } from '../../lib/ics211.ts';
import { buildIcs210Forms, ics210Rows } from '../../lib/ics210.ts';
import { buildIcs214Forms, ics214Rows } from '../../lib/ics214.ts';
import { buildIcs221Forms, ics221Releases } from '../../lib/ics221.ts';
import { buildIcs211WfForms } from '../../lib/ics211wf.ts';
import { loadIapPlan } from '../../lib/iapPlanPersistence.ts';
import { usesWfForms } from '../../domain/iap.ts';
import type { FilledForm, IapFormId } from '../../lib/iapPdf.ts';
import { buildIapPdf, saveIapPdf } from '../../lib/iapPdf.ts';
import { loadIcs201FromMission } from '../../lib/ics201.ts';

const { activeMission, requireActiveMission, selectHTabGuarded } = useIncident();
const {
    assignments,
    defaultAgency,
    loading,
    saving,
    statusMessage,
    statusError,
    blankResourceAssignmentForm,
    loadForMission,
    addAssignment,
    removeAssignment,
    updateAssignment,
    updateDefaultAgency,
} = useResourceAssignments();

const {
    yourAgency,
    useD4hAidingAgencies,
    aidingAgencies,
} = usePluginSettings();

const RESOURCES_INFO_DISMISSED_KEY = 'incident-manager:resources-info-dismissed';
const RESOURCE_PLACEHOLDER = '— Select resource —';
const AGENCY_PLACEHOLDER = '— Select agency —';

function loadInfoDismissed(): boolean {
    try {
        return localStorage.getItem(RESOURCES_INFO_DISMISSED_KEY) === 'true';
    } catch {
        return false;
    }
}

const infoDismissed = ref(loadInfoDismissed());

function dismissInfo(): void {
    infoDismissed.value = true;
    try {
        localStorage.setItem(RESOURCES_INFO_DISMISSED_KEY, 'true');
    } catch {
        // ignore quota / private-mode errors
    }
}

function restoreInfo(): void {
    infoDismissed.value = false;
    try {
        localStorage.removeItem(RESOURCES_INFO_DISMISSED_KEY);
    } catch {
        // ignore quota / private-mode errors
    }
}

const defaultAgencyExpanded = ref(true);
const loadingRoster = ref(false);
const savingDefaultAgency = ref(false);
const meta = ref<D4HRosterMeta | null>(null);
const d4hExternalResources = ref<{ id: number; name: string }[]>([]);
const defaultAgencyInput = ref('');
const agencyOptions = ref<string[]>([]);
const lastEffectiveDefaultAgency = ref('');

const form = ref<Omit<ResourceAssignment, 'id'>>({
    ...blankResourceAssignmentForm(),
    timeOrdered: nowDatetimeLocal(),
});

const resourceTypeOptions = RESOURCE_TYPE_OPTIONS;
const statusOptions = RESOURCE_ASSIGNMENT_STATUSES;
const statusLabelOptions = statusOptions.map((opt) => opt.label);
const rowResourceOptions = ['—', ...resourceTypeOptions];

// ── Operational periods (Area Search phase) ────────────────────────────────
const OP_NONE_LABEL = 'Initial Response';
const opRegistry = ref<OpPeriodRegistryEntry[]>([]);
const opLabelOptions = computed(() => [
    OP_NONE_LABEL,
    ...opRegistry.value.map((op) => `OP${op.opNumber}`),
]);

function opLabelFor(opNumber?: number | null): string {
    return Number.isInteger(opNumber) && (opNumber as number) > 0 ? `OP${opNumber}` : OP_NONE_LABEL;
}

function opNumberFromLabel(label: string): number | null {
    const match = /^OP(\d+)$/.exec(label);
    return match ? Number(match[1]) : null;
}

const formOpLabel = computed({
    get(): string { return opLabelFor(form.value.opNumber); },
    set(label: string): void { form.value.opNumber = opNumberFromLabel(label); },
});

const opRegistryError = ref('');

async function loadOpRegistry(): Promise<void> {
    const mission = activeMission.value;
    opRegistryError.value = '';
    if (!mission?.mgmt) {
        opRegistry.value = [];
        return;
    }
    try {
        opRegistry.value = await createRegistryStore(mission).load();
        // Default new resources to the current (open) OP when one exists.
        if (form.value.opNumber == null) {
            const current = currentOpPeriod(opRegistry.value);
            if (current) form.value.opNumber = current.opNumber;
        }
    } catch (err) {
        opRegistry.value = [];
        opRegistryError.value = `Operational periods unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
}

async function onOpLabelChange(id: string, label: string): Promise<void> {
    if (!activeMission.value) return;
    await updateAssignment(activeMission.value, id, { opNumber: opNumberFromLabel(label) });
}

const UNASSIGNED = '—';
/** OP assignments (segments) a resource can be placed on (ICS-204, ADR-005). */
const opAssignments = ref<OpAssignment[]>([]);

async function loadOpAssignments(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) {
        opAssignments.value = [];
        return;
    }
    try {
        opAssignments.value = await createAssignmentStore(mission).load();
    } catch {
        opAssignments.value = [];
    }
}

function assignmentOptionsFor(resource: ResourceAssignment): string[] {
    const options = assignableFor(resource, opAssignments.value).map(assignmentOptionLabel);
    const current = assignmentLabelFor(resource);
    if (current !== UNASSIGNED && !options.includes(current)) options.unshift(current);
    return [UNASSIGNED, ...options];
}

function assignmentLabelFor(resource: ResourceAssignment): string {
    if (!resource.assignmentUid) return UNASSIGNED;
    const match = opAssignments.value.find((a) => a.segmentUid === resource.assignmentUid
        && (resource.opNumber == null || a.opNumber === resource.opNumber));
    if (match) return assignmentOptionLabel(match);
    return resource.assignmentCallsign?.trim() || resource.assignmentUid;
}

/** The assignment's own name for the log ("Division A"), '' when unassigned. */
function assignmentNameFor(resource: ResourceAssignment): string {
    if (!resource.assignmentUid) return '';
    const match = opAssignments.value.find((a) => a.segmentUid === resource.assignmentUid
        && (resource.opNumber == null || a.opNumber === resource.opNumber));
    return match?.label || resource.assignmentCallsign?.trim() || resource.assignmentUid;
}

async function onAssignmentChange(id: string, label: string): Promise<void> {
    const mission = activeMission.value;
    const before = assignments.value.find((a) => a.id === id);
    if (!mission || !before) return;
    if (label === assignmentLabelFor(before)) return;
    const from = assignmentNameFor(before);
    if (label === UNASSIGNED) {
        if (!from) return;
        await updateAssignment(mission, id, unassignPatch());
        await logAction(id, { action: 'unassign', from });
        return;
    }
    const target = opAssignments.value.find((a) => assignmentOptionLabel(a) === label);
    if (!target) return;
    await updateAssignment(mission, id, assignPatch(target));
    await logAction(id, { action: 'assign', from, to: target.label });
}

async function onCheckIn(id: string): Promise<void> {
    if (!activeMission.value) return;
    const at = nowDatetimeLocal();
    await updateAssignment(activeMission.value, id, checkInPatch(at));
    await logAction(id, { action: 'check-in', at });
}

async function onDemobilize(id: string): Promise<void> {
    if (!activeMission.value) return;
    if (!window.confirm('Demobilize this resource?')) return;
    await updateAssignment(activeMission.value, id, demobilizePatch());
    await logAction(id, { action: 'demob' });
}

/** The resource trail on the management sync (ICS-210/211/214/221, ADR-005). */
const trail = ref<ResourceLogEntry[]>([]);
const trailError = ref('');
const ics210Options = [UNASSIGNED, ...ICS210_STATUSES];

async function loadTrail(): Promise<void> {
    trailError.value = '';
    const mission = activeMission.value;
    if (!mission) {
        trail.value = [];
        return;
    }
    try {
        trail.value = await loadResourceTrail(mission);
    } catch (err) {
        trail.value = [];
        trailError.value = `Resource log unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
}

/** Write one trail entry for a resource (after its record is saved). */
async function logAction(id: string, input: Omit<ResourceLogInput, 'resource'>): Promise<void> {
    const mission = activeMission.value;
    const resource = assignments.value.find((a) => a.id === id);
    if (!mission || !resource) return;
    const entry = { ...input, resource };
    try {
        const written = await sendResourceLog(mission, entry);
        if (written) trail.value = [...trail.value, written];
        trailError.value = '';
    } catch (err) {
        trailError.value = `Saved, but the resource log entry failed: ${err instanceof Error ? err.message : String(err)}`;
    }
}

function ics210StatusFor(id: string): string {
    return currentIcs210Status(trail.value, id) || UNASSIGNED;
}

async function onIcs210StatusChange(id: string, label: string): Promise<void> {
    if (label === UNASSIGNED || label === ics210StatusFor(id)) return;
    await logAction(id, { action: 'status', status: label as Ics210Status });
}

// ── ICS-210 / 211 / 214 / 221 exports (ADR-005) ────────────────────────────
const ALL_OPS = 'All OPs';
const formsOp = ref(ALL_OPS);
const formsOpOptions = computed(() => [ALL_OPS, ...opLabelOptions.value]);
/** FEMA or NWCG WF version (only the ICS-211 has a WF version here). */
const FORM_VERSIONS = ['FEMA', 'WF'];
const formsVersion = ref('FEMA');
const exporting = ref(false);
const exportTitle = ref('');

/** Follow the selected OP's IAP choice; FEMA otherwise (ADR-005). */
async function syncFormsVersion(): Promise<void> {
    const mission = activeMission.value;
    if (!mission) return;
    const op = opNumberFromLabel(formsOp.value);
    let version: 'fema' | 'wf' | undefined;
    if (op != null) {
        try {
            version = (await loadIapPlan(mission, op))?.formVersion;
        } catch {
            // No readable IAP for this OP: FEMA.
        }
    }
    formsVersion.value = usesWfForms(version) ? 'WF' : 'FEMA';
}

watch([formsOp, () => activeMission.value?.guid], () => void syncFormsVersion(), { immediate: true });
const exportNotice = ref('');
const exportError = ref(false);

function resourceNameFor(id: string): string {
    const r = assignments.value.find((a) => a.id === id);
    return r?.resourceIdentifier.trim() || r?.resource.trim() || id;
}

async function onExportForm(kind: 'ICS-211' | 'ICS-210' | 'ICS-214' | 'ICS-221'): Promise<void> {
    const mission = activeMission.value;
    if (!mission) return;
    exporting.value = true;
    exportTitle.value = kind;
    exportNotice.value = '';
    exportError.value = false;
    try {
        const form201 = (await loadIcs201FromMission(mission.guid, mission.missionToken, mission.name, mission)).form;
        const incidentName = form201.incidentName || mission.name;
        const op = formsOp.value === ALL_OPS ? 'all' : opNumberFromLabel(formsOp.value);
        const opEntry = typeof op === 'number' ? opRegistry.value.find((o) => o.opNumber === op) : undefined;
        let id: IapFormId;
        let forms: FilledForm[];
        let count: string;
        if (kind === 'ICS-211' && formsVersion.value === 'WF') {
            const resources = ics211Resources(assignments.value, op);
            id = 'ics211wf';
            forms = buildIcs211WfForms({
                incidentName,
                incidentNumber: form201.incidentNumber,
                resources,
                assignmentName: assignmentNameFor,
            });
            count = `${resources.length} WF check-in form${resources.length === 1 ? '' : 's'}`;
        } else if (kind === 'ICS-211') {
            const resources = ics211Resources(assignments.value, op);
            id = 'ics211';
            forms = buildIcs211Forms({
                incidentName,
                incidentNumber: form201.incidentNumber,
                start: opEntry?.openedAt,
                preparedBy: form201.preparedByName,
                preparedAt: new Date(),
                resources,
                assignmentName: assignmentNameFor,
            });
            count = `${resources.length} resource${resources.length === 1 ? '' : 's'}`;
        } else if (kind === 'ICS-214') {
            await loadTrail();
            if (trailError.value) throw new Error(trailError.value);
            const rows = ics214Rows(trail.value, op);
            id = 'ics214';
            forms = buildIcs214Forms({
                incidentName,
                opFrom: opEntry?.openedAt,
                opTo: opEntry?.closedAt,
                name: form201.preparedByName,
                // No stored ICS position: left for hand entry.
                icsPosition: '',
                homeAgency: yourAgency.value.trim(),
                preparedAt: new Date(),
                rows,
            });
            count = `${rows.length} activit${rows.length === 1 ? 'y' : 'ies'}`;
        } else if (kind === 'ICS-221') {
            await loadTrail();
            if (trailError.value) throw new Error(trailError.value);
            const releases = ics221Releases(trail.value, assignments.value, op);
            id = 'ics221';
            forms = buildIcs221Forms({
                incidentName,
                incidentNumber: form201.incidentNumber,
                preparedBy: form201.preparedByName,
                preparedAt: new Date(),
                releases,
            });
            count = `${releases.length} demobilized resource${releases.length === 1 ? '' : 's'}`;
        } else {
            // Re-read so status changes made by other planners are included.
            await loadTrail();
            if (trailError.value) throw new Error(trailError.value);
            const rows = ics210Rows(trail.value, op, resourceNameFor);
            id = 'ics210';
            forms = buildIcs210Forms({
                incidentName,
                opFrom: opEntry?.openedAt,
                opTo: opEntry?.closedAt,
                preparedBy: form201.preparedByName,
                preparedAt: new Date(),
                rows,
            });
            count = `${rows.length} status change${rows.length === 1 ? '' : 's'}`;
        }
        const bytes = await buildIapPdf(forms.map((filled) => ({ id, filled })));
        const suffix = op === 'all' ? '' : `-${op == null ? 'Initial' : `OP${op}`}`;
        const version = id.endsWith('wf') ? 'WF' : '';
        const safe = `${incidentName}${suffix}-${kind.replace('-', '')}${version}`.replace(/[^\w.-]+/g, '_');
        const where = await saveIapPdf(bytes, `${safe}.pdf`, incidentName);
        exportNotice.value = `${where} (${count})`;
    } catch (err) {
        exportError.value = true;
        exportNotice.value = err instanceof Error ? err.message : String(err);
    } finally {
        exporting.value = false;
    }
}

const resourceFormOptions = computed(() => [RESOURCE_PLACEHOLDER, ...resourceTypeOptions]);
const agencyFormOptions = computed(() => [AGENCY_PLACEHOLDER, ...agencyOptions.value]);

const formResourceLabel = computed({
    get(): string {
        return form.value.resource || RESOURCE_PLACEHOLDER;
    },
    set(label: string): void {
        form.value.resource = label === RESOURCE_PLACEHOLDER ? '' : label;
    },
});

const formAgencyLabel = computed({
    get(): string {
        return form.value.agency || AGENCY_PLACEHOLDER;
    },
    set(label: string): void {
        form.value.agency = label === AGENCY_PLACEHOLDER ? '' : label;
    },
});

const formStatusLabel = computed({
    get(): string {
        return statusLabelFor(form.value.status);
    },
    set(label: string): void {
        const opt = statusOptions.find((entry) => entry.label === label);
        if (opt) form.value.status = opt.value;
    },
});

const formEtaString = computed({
    get(): string {
        return form.value.eta == null ? '' : String(form.value.eta);
    },
    set(raw: string | number): void {
        const s = String(raw);
        form.value.eta = s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s);
    },
});

const d4hContextName = computed(() => (meta.value?.contextName ?? '').trim());

const effectiveDefaultAgency = computed(() =>
    resolveEffectiveDefaultAgency(
        defaultAgency.value,
        d4hContextName.value,
        yourAgency.value,
    ),
);

const pluginDefaultAgency = computed(() =>
    resolveEffectiveDefaultAgency('', d4hContextName.value, yourAgency.value),
);

const defaultAgencyHint = computed(() => {
    const override = defaultAgency.value.trim();
    const settingsHome = yourAgency.value.trim();
    const d4h = d4hContextName.value;
    if (override) {
        if (settingsHome && override !== settingsHome) {
            return `Override active. Settings Your Agency: ${settingsHome}.`;
        }
        return 'Saved on this mission as default_agency in mission_schema.json.';
    }
    if (settingsHome) {
        return 'Using Your Agency from Settings. Enter a different value to override on this mission.';
    }
    if (d4h) {
        return `Using D4H team: ${d4h}. Set Your Agency in Settings, or enter a value above to override.`;
    }
    return 'Set Your Agency in Settings, or enter a name here to override on this mission.';
});

const canCreate = computed(() =>
    form.value.resourceIdentifier.trim().length > 0
    && form.value.resource.trim().length > 0
    && form.value.agency.trim().length > 0,
);

function statusLabelFor(status: ResourceAssignmentStatus): string {
    return statusOptions.find((opt) => opt.value === status)?.label ?? 'Requested';
}

function rebuildAgencyOptions(): void {
    const aidingNames = useD4hAidingAgencies.value
        ? d4hExternalResources.value.map((r) => r.name)
        : aidingAgencies.value;
    agencyOptions.value = buildAgencyOptions(aidingNames, effectiveDefaultAgency.value);
}

function applyEffectiveDefaultToForm(force = false): void {
    const effective = effectiveDefaultAgency.value;
    if (!effective) return;
    if (force || !form.value.agency.trim() || form.value.agency === lastEffectiveDefaultAgency.value) {
        form.value.agency = effective;
    }
    lastEffectiveDefaultAgency.value = effective;
}

function resetForm(): void {
    form.value = {
        ...blankResourceAssignmentForm(),
        timeOrdered: nowDatetimeLocal(),
        agency: effectiveDefaultAgency.value,
    };
}

async function refreshAgencies(): Promise<void> {
    loadingRoster.value = true;
    try {
        const roster = await loadD4hRoster();
        meta.value = roster?.meta ?? await loadD4hMeta();
        d4hExternalResources.value = roster?.externalResources ?? [];
        rebuildAgencyOptions();
        applyEffectiveDefaultToForm();
    } finally {
        loadingRoster.value = false;
    }
}

async function onDefaultAgencyBlur(): Promise<void> {
    if (!activeMission.value) return;
    const next = defaultAgencyInput.value.trim();
    const schema = defaultAgency.value.trim();
    if (next === schema) return;
    if (!schema && next === pluginDefaultAgency.value) return;

    savingDefaultAgency.value = true;
    try {
        await updateDefaultAgency(activeMission.value, next);
        rebuildAgencyOptions();
        applyEffectiveDefaultToForm(true);
    } finally {
        savingDefaultAgency.value = false;
    }
}

async function createAssignment(): Promise<void> {
    if (!requireActiveMission()) return;
    const mission = activeMission.value;
    if (!mission || !canCreate.value) return;

    const etaRaw = form.value.eta;
    const eta = etaRaw == null || Number.isNaN(Number(etaRaw))
        ? null
        : Number(etaRaw);

    await addAssignment(mission, {
        resourceIdentifier: form.value.resourceIdentifier.trim(),
        resource: form.value.resource.trim(),
        agency: form.value.agency.trim(),
        timeOrdered: form.value.timeOrdered.trim(),
        eta,
        status: form.value.status,
        timeArrived: form.value.timeArrived.trim(),
        opNumber: form.value.opNumber ?? null,
    });

    resetForm();
}

async function removeAssignmentRecord(id: string): Promise<void> {
    if (!activeMission.value) return;
    if (!window.confirm('Remove this resource assignment?')) return;
    await removeAssignment(activeMission.value, id);
}

function rowAgencyOptions(currentAgency: string): string[] {
    if (currentAgency && !agencyOptions.value.includes(currentAgency)) {
        return [currentAgency, ...agencyOptions.value];
    }
    return agencyOptions.value;
}

async function onFieldChange(
    id: string,
    field: keyof Omit<ResourceAssignment, 'id' | 'eta' | 'status'>,
    value: string,
): Promise<void> {
    if (!activeMission.value) return;
    await updateAssignment(activeMission.value, id, { [field]: value });
}

async function onEtaChange(id: string, raw: string | number): Promise<void> {
    if (!activeMission.value) return;
    const s = String(raw);
    const eta = s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s);
    await updateAssignment(activeMission.value, id, { eta });
}

async function onStatusChange(id: string, status: ResourceAssignmentStatus): Promise<void> {
    if (!activeMission.value) return;
    await updateAssignment(activeMission.value, id, { status });
}

async function onStatusLabelChange(id: string, label: string): Promise<void> {
    const opt = statusOptions.find((entry) => entry.label === label);
    if (!opt) return;
    await onStatusChange(id, opt.value);
}

watch(() => activeMission.value?.guid, async (guid) => {
    await loadForMission(guid ? activeMission.value : null);
    defaultAgencyInput.value = effectiveDefaultAgency.value;
    applyEffectiveDefaultToForm(true);
    await loadOpRegistry();
    await loadOpAssignments();
    await loadTrail();
}, { immediate: true });

watch(defaultAgency, () => {
    defaultAgencyInput.value = effectiveDefaultAgency.value;
    rebuildAgencyOptions();
    applyEffectiveDefaultToForm();
});

watch(effectiveDefaultAgency, (value) => {
    defaultAgencyInput.value = value;
    rebuildAgencyOptions();
    applyEffectiveDefaultToForm();
});

watch([useD4hAidingAgencies, aidingAgencies], () => {
    rebuildAgencyOptions();
});

onMounted(() => {
    void refreshAgencies();
});
</script>

<style scoped>
.resources-table-scroll {
    max-height: 50vh;
    overflow: auto;
}

.rotate-180 {
    transform: rotate(-180deg);
}

.transition-transform {
    transition: transform 0.2s ease-out;
}
</style>
