import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelfHostedConfig } from "./config.mjs";
import { DatabaseUnavailableError } from "./db-client.mjs";
import { ForbiddenError } from "./rbac.mjs";
import { handleSelfHostedRequest } from "./routes.mjs";

const NOW = () => "2026-05-13T00:00:00.000Z";
const MANAGED_RUNTIME_ENV_TOKEN = "SUP" + "ABASE_";
const MANAGED_RUNTIME_ERROR_PATTERN = new RegExp(
  `postgres:\\/\\/|${MANAGED_RUNTIME_ENV_TOKEN}|navigator\\.usb`,
  "i",
);
const WORKER_SECRET_ERROR_PATTERN = new RegExp(
  `postgres:\\/\\/|${MANAGED_RUNTIME_ENV_TOKEN}|DEVICE_BRIDGE_WORKER_TOKEN`,
  "i",
);

function createRuntime({
  connected = true,
  patients = [],
  patientError = null,
  bridges = [],
  devices = [],
  deviceError = null,
  deviceCommandResult = null,
  deviceCommandError = null,
  doctorDashboard = null,
  doctorDashboardError = null,
  visitSchedule = null,
  visitScheduleError = null,
  leadsAppointments = null,
  leadsAppointmentsError = null,
  patientPortalOverview = null,
  patientPortalReport = null,
  patientPortalPhotoProtocol = null,
  patientPhotoProtocolDownload = null,
  patientPortalBookingRequest = null,
  patientPortalReminderPreferences = null,
  patientPortalError = null,
  clinicalFollowUps = null,
  clinicalFollowUp = null,
  clinicalFollowUpMessage = null,
  clinicalFollowUpError = null,
  clinicBookingRequests = null,
  clinicBookingRequest = null,
  clinicBookingRequestsError = null,
  bookedClinicBookingRequest = null,
  clinicAvailableSlots = null,
  clinicAvailableSlotsError = null,
  externalIntakeImportBatch = null,
  externalIntakeImportBatches = null,
  externalIntakeImportStatus = null,
  externalIntakeImportError = null,
  createdLead = null,
  updatedLead = null,
  bookedLead = null,
  bookedAppointment = null,
  leadsAppointmentsWriteError = null,
  deviceWorkerError = null,
  deviceWorkerCommand = null,
  patientDetail = null,
  createdPatient = null,
  updatedPatient = null,
  archivedPatient = null,
  authContext = {
    userId: "10000000-0000-4000-8000-000000000101",
    displayName: "Demo Doctor",
    roles: ["doctor"],
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    roleBindings: [
      {
        role: "doctor",
        clinicId: "10000000-0000-4000-8000-000000000001",
        clinicSlug: "demo-clinic",
      },
    ],
    token: { issuedAt: 1, expiresAt: 3601 },
  },
  authError = null,
  loginError = null,
  auditEvents = [],
} = {}) {
  return {
    dbClient: {
      async checkConnection() {
        if (!connected) {
          throw new DatabaseUnavailableError("PostgreSQL password=secret failed");
        }
        return { connected: true, detail: "PostgreSQL connection verified" };
      },
    },
    authService: {
      async login() {
        if (loginError) throw loginError;
        return {
          tokenType: "Bearer",
          accessToken: "header.payload.signature",
          expiresInSeconds: 3600,
          user: {
            id: authContext.userId,
            displayName: authContext.displayName,
            roles: authContext.roleBindings,
          },
        };
      },
      async authenticate() {
        if (authError) throw authError;
        return authContext;
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
    patientRepository: {
      async listPatients(params) {
        if (patientError) throw patientError;
        return {
          items: patients,
          count: patients.length,
          limit: params.limit,
          offset: params.offset,
          search: params.search,
          clinicIds: params.clinicIds,
          allClinics: params.allClinics,
          source: "postgres",
        };
      },
      async getPatient() {
        if (patientError) throw patientError;
        return patientDetail;
      },
      async createPatient() {
        if (patientError) throw patientError;
        return createdPatient;
      },
      async updatePatient() {
        if (patientError) throw patientError;
        return updatedPatient;
      },
      async archivePatient() {
        if (patientError) throw patientError;
        return archivedPatient;
      },
    },
    deviceRegistryRepository: {
      async listDeviceBridges(params) {
        if (deviceError) throw deviceError;
        return {
          items: bridges,
          count: bridges.length,
          clinicIds: params.clinicIds,
          allClinics: params.allClinics,
          source: "postgres",
        };
      },
      async listMedicalDevices(params) {
        if (deviceError) throw deviceError;
        return {
          items: devices,
          count: devices.length,
          limit: params.limit,
          offset: params.offset,
          search: params.search,
          status: params.status,
          needsCalibration: params.needsCalibration,
          clinicIds: params.clinicIds,
          allClinics: params.allClinics,
          source: "postgres",
        };
      },
    },
    doctorDashboardService: {
      async getDashboard() {
        if (doctorDashboardError) throw doctorDashboardError;
        return {
          dashboard: doctorDashboard || {
            kpis: {
              visitsToday: 0,
              activeVisits: 0,
              awaitingConclusion: 0,
              patientsInScope: patients.length,
              assetsNeedReview: 0,
              devicesTotal: devices.length,
              devicesActive30d: 0,
            },
            upcoming: [],
            awaitingConclusions: [],
            recentPatients: [],
            assetIssues: [],
            devices: [],
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
    },
    visitScheduleService: {
      async listVisits() {
        if (visitScheduleError) throw visitScheduleError;
        return {
          schedule: visitSchedule || {
            items: [],
            count: 0,
            limit: 50,
            offset: 0,
            filters: { status: "all", dateFrom: null, dateTo: null, search: null },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
    },
    leadsAppointmentsService: {
      async getOverview() {
        if (leadsAppointmentsError) throw leadsAppointmentsError;
        return {
          overview: leadsAppointments || {
            kpis: {
              leadsTotal: 0,
              newLeads: 0,
              qualifiedLeads: 0,
              bookedLeads: 0,
              plannedAppointments: 0,
              completedAppointments: 0,
            },
            leads: [],
            appointments: [],
            filters: { leadStatus: "all", appointmentStatus: "all", dateFrom: null, dateTo: null, search: null },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
    },
    leadsAppointmentsWriteService: {
      async createLead() {
        if (leadsAppointmentsWriteError) throw leadsAppointmentsWriteError;
        return {
          lead: createdLead || {
            id: "10000000-0000-4000-8000-000000000701",
            clinicId: "10000000-0000-4000-8000-000000000001",
            patientId: null,
            source: "operator",
            status: "new",
            safeSummary: "Live lead",
            patient: { id: null, fullName: null, code: null },
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateLeadStatus() {
        if (leadsAppointmentsWriteError) throw leadsAppointmentsWriteError;
        return {
          lead: updatedLead || {
            id: "10000000-0000-4000-8000-000000000701",
            clinicId: "10000000-0000-4000-8000-000000000001",
            patientId: null,
            source: "operator",
            status: "qualified",
            safeSummary: "Live lead",
            patient: { id: null, fullName: null, code: null },
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async bookLeadAppointment() {
        if (leadsAppointmentsWriteError) throw leadsAppointmentsWriteError;
        return {
          lead: bookedLead || {
            id: "10000000-0000-4000-8000-000000000701",
            clinicId: "10000000-0000-4000-8000-000000000001",
            patientId: "10000000-0000-4000-8000-000000000201",
            source: "site",
            status: "booked",
            safeSummary: "Live lead",
            patient: { id: "10000000-0000-4000-8000-000000000201", fullName: "Live Patient", code: "DP-LIVE" },
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          appointment: bookedAppointment || {
            id: "10000000-0000-4000-8000-000000000301",
            visitId: "10000000-0000-4000-8000-000000000301",
            patientId: "10000000-0000-4000-8000-000000000201",
            doctorUserId: "10000000-0000-4000-8000-000000000101",
            status: "planned",
            slotAt: "2026-05-20T09:00:00.000Z",
            patient: { id: "10000000-0000-4000-8000-000000000201", fullName: "Live Patient", code: "DP-LIVE" },
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
    },
    patientPortalService: {
      async getOverview() {
        if (patientPortalError) throw patientPortalError;
        return {
          overview: patientPortalOverview || {
            patient: {
              id: "10000000-0000-4000-8000-000000000201",
              code: "DP-LIVE",
              fullName: "Live Patient",
              clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
            },
            nextAppointment: null,
            reports: [],
            reminders: [],
            reminderPreferences: {
              appointmentRemindersEnabled: true,
              reportNotificationsEnabled: true,
              preferredChannel: "email",
            },
            bookingRequests: [],
          },
          scope: {
            userId: authContext?.userId,
            roles: authContext?.roles || [],
          },
        };
      },
      async getReport(reportId) {
        if (patientPortalError) throw patientPortalError;
        return {
          report: patientPortalReport || {
            id: reportId,
            visitId: "10000000-0000-4000-8000-000000000301",
            status: "signed",
            patientSafeText: "Patient-safe report text",
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          scope: {
            userId: authContext?.userId,
            roles: authContext?.roles || [],
          },
        };
      },
      async getPhotoProtocol(visitId) {
        if (patientPortalError) throw patientPortalError;
        return {
          photoProtocol: patientPortalPhotoProtocol || {
            id: "10000000-0000-4000-8000-000000000601",
            visitId,
            reportId: "10000000-0000-4000-8000-000000000401",
            status: "prepared",
            selectedPhotoCount: 2,
            counts: {
              selectedPhotos: 2,
              overviewPhotos: 1,
              dermoscopyPhotos: 1,
              reportAttachments: 0,
            },
            accessStatus: "metadata_ready_delivery_blocked",
            deliveryBoundary: {
              patientDeliveryAllowed: false,
              rawFilesExposed: false,
              signedUrlsIssued: false,
              storagePathsExposed: false,
              tokensExposed: false,
              doctorOnlyTextExposed: false,
              fileProxyReady: false,
            },
            photos: [
              {
                sequence: 1,
                kind: "overview_photo",
                contentType: "image/jpeg",
                capturedAt: "2026-06-01T10:00:00.000Z",
                lesionLabel: "Очаг A",
                bodyZone: "спина",
                previewAvailable: false,
              },
            ],
          },
          scope: {
            userId: authContext?.userId,
            roles: authContext?.roles || [],
          },
        };
      },
      async createBookingRequest() {
        if (patientPortalError) throw patientPortalError;
        return {
          bookingRequest: patientPortalBookingRequest || {
            id: "10000000-0000-4000-8000-000000000501",
            status: "requested",
            preferredFrom: "2026-06-15T10:00:00.000Z",
            preferredTo: "2026-06-15T12:00:00.000Z",
            reason: "Плановый контроль",
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          scope: {
            userId: authContext?.userId,
            roles: authContext?.roles || [],
          },
        };
      },
      async updateReminderPreferences() {
        if (patientPortalError) throw patientPortalError;
        return {
          reminderPreferences: patientPortalReminderPreferences || {
            appointmentRemindersEnabled: false,
            reportNotificationsEnabled: true,
            preferredChannel: "phone",
            updatedAt: "2026-05-01T10:00:00.000Z",
          },
          scope: {
            userId: authContext?.userId,
            roles: authContext?.roles || [],
          },
        };
      },
    },
    patientPhotoProtocolDeliveryService: {
      async downloadPhoto() {
        if (patientPortalError) throw patientPortalError;
        return patientPhotoProtocolDownload || {
          asset: {
            id: "10000000-0000-4000-8000-000000000902",
            sequence: 1,
            kind: "overview_photo",
            contentType: "image/jpeg",
            byteSize: Buffer.byteLength("patient-photo"),
          },
          object: {
            bytes: Buffer.from("patient-photo"),
            byteSize: Buffer.byteLength("patient-photo"),
            contentType: "image/jpeg",
          },
          download: {
            fileName: "photo-protocol-1.jpg",
          },
          scope: {
            userId: authContext?.userId,
            roles: authContext?.roles || [],
          },
        };
      },
    },
    clinicalFollowUpService: {
      async listClinicalFollowUps() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          result: {
            items: clinicalFollowUps || [
              clinicalFollowUp || {
                id: "10000000-0000-4000-8000-000000000701",
                clinicId: "10000000-0000-4000-8000-000000000001",
                patientId: "10000000-0000-4000-8000-000000000201",
                visitId: "10000000-0000-4000-8000-000000000301",
                dueAt: "2026-06-10T10:00:00.000Z",
                status: "sent",
                priority: "normal",
                reason: "Контроль после визита",
                patientSummary: "Patient-safe follow-up summary",
                internalNote: "Doctor-only follow-up note",
                messageCount: 1,
              },
            ],
            limit: 50,
            offset: 0,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async createClinicalFollowUp() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: clinicalFollowUp || {
            id: "10000000-0000-4000-8000-000000000701",
            clinicId: "10000000-0000-4000-8000-000000000001",
            patientId: "10000000-0000-4000-8000-000000000201",
            visitId: "10000000-0000-4000-8000-000000000301",
            dueAt: "2026-06-10T10:00:00.000Z",
            status: "planned",
            priority: "normal",
            reason: "Контроль после визита",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUp() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            status: "completed",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async createClinicalFollowUpMessage() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          message: clinicalFollowUpMessage || {
            id: "10000000-0000-4000-8000-000000000801",
            followUpId: "10000000-0000-4000-8000-000000000701",
            direction: "clinic_to_patient",
            body: "Контроль назначен.",
            patientVisible: true,
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async listPatientFollowUps() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          result: {
            items: clinicalFollowUps || [
              {
                id: "10000000-0000-4000-8000-000000000701",
                visitId: "10000000-0000-4000-8000-000000000301",
                dueAt: "2026-06-10T10:00:00.000Z",
                status: "sent",
                priority: "normal",
                reason: "Контроль после визита",
                patientSummary: "Patient-safe follow-up summary",
                messageCount: 1,
              },
            ],
            source: "postgres",
          },
          scope: {
            userId: authContext?.userId,
            roles: authContext?.roles || [],
          },
        };
      },
      async createPatientFollowUpMessage() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          message: clinicalFollowUpMessage || {
            id: "10000000-0000-4000-8000-000000000802",
            followUpId: "10000000-0000-4000-8000-000000000701",
            direction: "patient_to_clinic",
            body: "Ответ пациента.",
          },
          scope: {
            userId: authContext?.userId,
            roles: authContext?.roles || [],
          },
        };
      },
      async listClinicalFollowUpOperations() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          result: {
            items: clinicalFollowUps || [
              {
                id: "10000000-0000-4000-8000-000000000701",
                visitId: "10000000-0000-4000-8000-000000000301",
                dueAt: "2026-06-10T10:00:00.000Z",
                status: "sent",
                priority: "urgent",
                reason: "Контроль после визита",
                triageState: "escalated",
                escalationLevel: "clinic_admin",
                deliveryState: "failed",
                deliveryAttempts: 2,
                operationsNote: "Call patient.",
              },
            ],
            limit: 50,
            offset: 0,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpOperationsSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalOpen: 3,
            overdue: 1,
            waitingPatient: 1,
            escalated: 1,
            deliveryFailed: 1,
            deliveryPending: 0,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpOutcomeQualitySummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            closedFollowUps: 2,
            openOverdue: 1,
            openEscalated: 1,
            closedWithEvidence: 1,
            closedMissingEvidence: 1,
            qualityReviewed: 1,
            qualityPending: 2,
            qualityNeedsAttention: 1,
            patientReached: 1,
            clinicalEscalations: 1,
            deliveryFailures: 1,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpClinicReviewSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            retentionDue: 1,
            retentionReviewed: 1,
            retentionArchived: 0,
            clinicReviewScheduled: 1,
            clinicReviewCompleted: 1,
            clinicNeedsPolicyReview: 1,
            qualityNeedsAttention: 1,
            closedMissingEvidence: 1,
            localReviewEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopValidationSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            sopRequired: 2,
            sopValidated: 1,
            sopExceptions: 1,
            sopBlocked: 0,
            clinicNeedsPolicyReview: 1,
            qualityNeedsAttention: 1,
            openEscalated: 1,
            closedMissingEvidence: 1,
            localSopEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyTemplateSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalTemplates: 2,
            activeTemplates: 1,
            inactiveTemplates: 1,
            exceptionsAllowed: 1,
            requiredByDefault: 1,
            localPolicyEvents: 3,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyApplicationSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            activeTemplates: 1,
            appliedTemplates: 1,
            notChecked: 1,
            inSync: 1,
            drifted: 0,
            missingTemplate: 0,
            reviewRequired: 1,
            needsPolicyApplication: 1,
            localApplicationEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyExceptionClosureSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            openExceptions: 1,
            closedExceptions: 1,
            acceptedExceptions: 1,
            rejectedExceptions: 0,
            unresolvedDrift: 1,
            unclosedValidationExceptions: 1,
            closedWithLocalResolution: 1,
            localExceptionEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyAuditRollupSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            auditReady: 2,
            needsAuditReview: 1,
            reviewedAudits: 1,
            needsFollowUp: 0,
            unresolvedPolicyDrift: 1,
            openExceptions: 1,
            missingPolicyTemplate: 1,
            localPolicyAuditEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceReadinessSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            governanceReady: 1,
            needsGovernanceReview: 1,
            reviewedGovernance: 1,
            governanceNeedsFollowUp: 0,
            reviewedPolicyAudits: 1,
            unresolvedPolicyDrift: 1,
            openExceptions: 0,
            localGovernanceEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceClosureSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            closureReady: 1,
            needsClosureReview: 1,
            closedGovernanceReviews: 1,
            closureNeedsFollowUp: 0,
            reviewedGovernance: 1,
            unresolvedPolicyDrift: 0,
            openExceptions: 0,
            localGovernanceClosureEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            evidenceReady: 1,
            needsEvidenceReview: 1,
            exportedGovernanceEvidence: 1,
            evidenceNeedsFollowUp: 0,
            closedGovernanceReviews: 1,
            unresolvedPolicyDrift: 0,
            openExceptions: 0,
            localGovernanceEvidenceEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            reconciliationReady: 1,
            needsReconciliation: 1,
            reconciledGovernanceEvidence: 1,
            evidenceMismatches: 0,
            reconciliationNeedsFollowUp: 0,
            exportedGovernanceEvidence: 1,
            closedGovernanceReviews: 1,
            localGovernanceEvidenceReconciliationEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            reconciliationClosureReady: 1,
            needsReconciliationClosure: 1,
            closedReconciliationEvidence: 1,
            reconciliationClosureExceptions: 0,
            reconciliationClosureNeedsRework: 0,
            reconciledGovernanceEvidence: 1,
            openReconciliationMismatches: 0,
            localGovernanceEvidenceReconciliationClosureEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            closureReceiptReady: 1,
            needsClosureReceipt: 1,
            receivedClosureReceipts: 1,
            closureReceiptExceptions: 0,
            closureReceiptNeedsRework: 0,
            closedReconciliationEvidence: 1,
            reconciledGovernanceEvidence: 1,
            localGovernanceEvidenceReconciliationClosureReceiptEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            archiveReadinessReady: 1,
            needsArchiveReadiness: 1,
            archivedLocal: 0,
            archiveReadinessExceptions: 0,
            archiveReadinessNeedsRework: 0,
            receivedClosureReceipts: 1,
            closedReconciliationEvidence: 1,
            localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            archiveClosureReady: 1,
            needsArchiveClosure: 1,
            closedLocalArchives: 1,
            archiveClosureExceptions: 0,
            archiveClosureNeedsRework: 0,
            archiveReadinessMarked: 1,
            receivedClosureReceipts: 1,
            localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            archiveClosureReceiptReady: 1,
            needsArchiveClosureReceipt: 1,
            receivedArchiveClosureReceipts: 1,
            archiveClosureReceiptExceptions: 0,
            archiveClosureReceiptNeedsRework: 0,
            closedLocalArchives: 1,
            archiveReadinessMarked: 1,
            localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            archiveClosureReceiptHandoffReady: 1,
            needsArchiveClosureReceiptHandoff: 1,
            handedOffArchiveClosureReceipts: 1,
            archiveClosureReceiptHandoffExceptions: 0,
            archiveClosureReceiptHandoffNeedsRework: 0,
            receivedArchiveClosureReceipts: 1,
            closedLocalArchives: 1,
            localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            archiveClosureReceiptHandoffReceiptReady: 1,
            needsArchiveClosureReceiptHandoffReceipt: 1,
            receivedArchiveClosureReceiptHandoffReceipts: 1,
            archiveClosureReceiptHandoffReceiptExceptions: 0,
            archiveClosureReceiptHandoffReceiptNeedsRework: 0,
            handedOffArchiveClosureReceipts: 1,
            receivedArchiveClosureReceipts: 1,
            localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            archiveClosureReceiptHandoffReceiptReconciliationReady: 1,
            needsArchiveClosureReceiptHandoffReceiptReconciliation: 1,
            reconciledArchiveClosureReceiptHandoffReceipts: 1,
            archiveClosureReceiptHandoffReceiptReconciliationExceptions: 0,
            archiveClosureReceiptHandoffReceiptReconciliationNeedsRework: 0,
            receivedArchiveClosureReceiptHandoffReceipts: 1,
            handedOffArchiveClosureReceipts: 1,
            receivedArchiveClosureReceipts: 1,
            localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReady: 1,
            needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure: 1,
            closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: 1,
            archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureExceptions: 0,
            archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNeedsRework: 0,
            archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 1,
            receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 1,
            closedArchiveClosureReceiptHandoffReceiptReconciliations: 1,
            reconciledArchiveClosureReceiptHandoffReceipts: 1,
            receivedArchiveClosureReceiptHandoffReceipts: 1,
            handedOffArchiveClosureReceipts: 1,
            receivedArchiveClosureReceipts: 1,
            localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          summary: {
            totalFollowUps: 4,
            archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptReady: 1,
            needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt: 1,
            receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: 1,
            archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptExceptions: 0,
            archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNeedsRework: 0,
            archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 1,
            receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 1,
            closedArchiveClosureReceiptHandoffReceiptReconciliations: 1,
            reconciledArchiveClosureReceiptHandoffReceipts: 1,
            receivedArchiveClosureReceiptHandoffReceipts: 1,
            handedOffArchiveClosureReceipts: 1,
            receivedArchiveClosureReceipts: 1,
            localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptEvents: 2,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async listClinicalFollowUpSopPolicyTemplates() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          result: {
            items: [{
              id: "10000000-0000-4000-8000-000000000901",
              clinicId: "10000000-0000-4000-8000-000000000001",
              code: "followup-standard",
              title: "Follow-up standard SOP",
              version: "clinic-local-v1",
              description: "Local clinic policy template.",
              appliesTo: { workspace: "visit-follow-up" },
              requiredValidationStates: ["required", "blocked"],
              defaultValidationState: "required",
              exceptionAllowed: true,
              active: true,
            }],
            limit: 25,
            offset: 0,
            source: "postgres",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async createClinicalFollowUpSopPolicyTemplate() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          template: {
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: "10000000-0000-4000-8000-000000000001",
            code: "followup-standard",
            title: "Follow-up standard SOP",
            version: "clinic-local-v1",
            defaultValidationState: "required",
            requiredValidationStates: ["required", "blocked"],
            exceptionAllowed: true,
            active: true,
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyTemplate() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          template: {
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: "10000000-0000-4000-8000-000000000001",
            code: "followup-standard",
            title: "Follow-up standard SOP",
            version: "clinic-local-v2",
            defaultValidationState: "required",
            requiredValidationStates: ["required", "blocked"],
            exceptionAllowed: true,
            active: true,
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpOperations() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            triageState: "resolved",
            escalationLevel: "none",
            deliveryState: "delivered",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpQuality() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            resolutionOutcome: "patient_reached",
            qualityReviewState: "reviewed",
            qualityReviewNote: "QA ok.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpClinicReview() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            retentionReviewState: "reviewed",
            retentionReviewNote: "Retention ok.",
            clinicReviewState: "completed",
            clinicReviewNote: "Clinic review complete.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopValidation() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyVersion: "clinic-local-v1",
            sopExceptionReason: null,
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyApplication() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "required",
            sopPolicyVersion: "clinic-local-v1",
            sopPolicyTemplateId: "10000000-0000-4000-8000-000000000901",
            sopPolicyTemplateCode: "followup-standard",
            sopPolicyDriftState: "in_sync",
            sopPolicyDriftReason: "Applied active local SOP policy template.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyExceptionClosure() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "exception",
            sopPolicyDriftState: "review_required",
            sopPolicyExceptionState: "accepted",
            sopPolicyExceptionReason: "Local exception accepted.",
            sopPolicyExceptionResolution: "Closed inside clinic policy review.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyAuditRollup() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyAuditNote: "Local SOP policy audit reviewed.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceReadiness() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceClosure() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceClosureNote: "Local SOP policy governance closure completed.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidence() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceNote: "Local SOP policy governance evidence export marked.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationNote: "Local SOP policy governance evidence reconciled.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure completed.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt recorded.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closed.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt recorded.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff completed.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt recorded.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation recorded.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "archived",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure closed.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt() {
        if (clinicalFollowUpError) throw clinicalFollowUpError;
        return {
          followUp: {
            ...(clinicalFollowUp || { id: "10000000-0000-4000-8000-000000000701" }),
            sopValidationState: "validated",
            sopPolicyDriftState: "in_sync",
            sopPolicyExceptionState: "closed",
            sopPolicyAuditState: "reviewed",
            sopPolicyGovernanceState: "reviewed",
            sopPolicyGovernanceClosureState: "closed",
            sopPolicyGovernanceEvidenceState: "exported",
            sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "archived",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "closed",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "received",
            sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt received.",
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
    },
    clinicBookingRequestsService: {
      async listBookingRequests() {
        if (clinicBookingRequestsError) throw clinicBookingRequestsError;
        return {
          queue: clinicBookingRequests || {
            items: [
              clinicBookingRequest || {
                id: "10000000-0000-4000-8000-000000000501",
                status: "requested",
                preferredFrom: "2026-06-15T10:00:00.000Z",
                reason: "Плановый контроль",
                patient: {
                  id: "10000000-0000-4000-8000-000000000201",
                  fullName: "Live Patient",
                  code: "DP-LIVE",
                },
                clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
              },
            ],
            count: 1,
            limit: 25,
            offset: 0,
            filters: { status: "all", search: null },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getBookingRequest() {
        if (clinicBookingRequestsError) throw clinicBookingRequestsError;
        return {
          bookingRequest: clinicBookingRequest || {
            id: "10000000-0000-4000-8000-000000000501",
            status: "requested",
            preferredFrom: "2026-06-15T10:00:00.000Z",
            reason: "Плановый контроль",
            patient: {
              id: "10000000-0000-4000-8000-000000000201",
              fullName: "Live Patient",
              code: "DP-LIVE",
            },
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async updateBookingRequest(_requestId, body) {
        if (clinicBookingRequestsError) throw clinicBookingRequestsError;
        return {
          bookingRequest: clinicBookingRequest || {
            id: "10000000-0000-4000-8000-000000000501",
            status: body?.status || "reviewing",
            assignedVisitId: body?.assignedVisitId || null,
            clinicNote: body?.clinicNote || null,
            patient: {
              id: "10000000-0000-4000-8000-000000000201",
              fullName: "Live Patient",
              code: "DP-LIVE",
            },
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async bookBookingRequestFromSlot(_requestId, body) {
        if (clinicBookingRequestsError) throw clinicBookingRequestsError;
        return {
          bookingRequest: bookedClinicBookingRequest || {
            id: "10000000-0000-4000-8000-000000000501",
            status: "booked",
            assignedVisitId: "10000000-0000-4000-8000-000000000301",
            clinicNote: body?.clinicNote || null,
            assignedVisit: {
              id: "10000000-0000-4000-8000-000000000301",
              startedAt: "2026-06-15T11:00:00.000Z",
              status: "draft",
            },
            patient: {
              id: "10000000-0000-4000-8000-000000000201",
              fullName: "Live Patient",
              code: "DP-LIVE",
            },
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
    },
    externalIntakeImportService: {
      async importExternalIntake(_body) {
        if (externalIntakeImportError) throw externalIntakeImportError;
        return {
          batch: externalIntakeImportBatch || {
            id: "10000000-0000-4000-8000-000000000601",
            sourceSystem: "clinic_crm",
            sourceReference: "daily-sync",
            status: "completed",
            itemCount: 2,
            acceptedBookingCount: 1,
            acceptedSlotCount: 1,
            rejectedCount: 0,
            duplicateCount: 0,
            hardeningVersion: "stage5t",
            summary: { storedRawPayload: false },
            clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async listImportBatches() {
        if (externalIntakeImportError) throw externalIntakeImportError;
        return {
          batches: externalIntakeImportBatches || {
            items: [
              externalIntakeImportBatch || {
                id: "10000000-0000-4000-8000-000000000601",
                sourceSystem: "clinic_crm",
                sourceReference: "daily-sync",
                status: "completed",
                itemCount: 2,
                acceptedBookingCount: 1,
                acceptedSlotCount: 1,
                rejectedCount: 0,
                duplicateCount: 0,
                hardeningVersion: "stage5t",
                summary: { storedRawPayload: false },
                clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
              },
            ],
            count: 1,
            limit: 10,
            offset: 0,
            filters: { sourceSystem: "clinic_crm" },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
      async getImportStatus() {
        if (externalIntakeImportError) throw externalIntakeImportError;
        return {
          status: externalIntakeImportStatus || {
            sourceSystem: "all",
            recentBatchCount: 1,
            rejectedLast24h: 0,
            duplicateLast24h: 0,
            latestImportAt: "2026-05-15T10:00:00.000Z",
            openBookingRequestCount: 1,
            availableSlotCount: 1,
            storedRawPayload: false,
            runtimeCallsExternalSystems: false,
            hardeningVersion: "stage5t",
            latestBySource: [],
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
    },
    clinicAvailableSlotsService: {
      async listAvailableSlots() {
        if (clinicAvailableSlotsError) throw clinicAvailableSlotsError;
        return {
          slots: clinicAvailableSlots || {
            items: [{
              id: "10000000-0000-4000-8000-000000000801",
              clinicId: "10000000-0000-4000-8000-000000000001",
              doctorUserId: "10000000-0000-4000-8000-000000000101",
              sourceSystem: "clinic_crm",
              externalSlotId: "crm-slot-1",
              startedAt: "2026-06-15T11:00:00.000Z",
              durationMinutes: 30,
              status: "available",
              clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
              doctor: { id: "10000000-0000-4000-8000-000000000101", displayName: "Demo Doctor" },
            }],
            count: 1,
            limit: 20,
            offset: 0,
            filters: { sourceSystem: "clinic_crm", status: "available", dateFrom: null, dateTo: null },
          },
          scope: {
            allClinics: false,
            clinicIds: ["10000000-0000-4000-8000-000000000001"],
            roles: authContext?.roles || [],
          },
        };
      },
    },
    deviceBridgeCommandService: {
      async requestBridgeCommand() {
        if (deviceCommandError) throw deviceCommandError;
        return deviceCommandResult || {
          command: {
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            deviceId: null,
            commandType: "bridge_health_check",
            status: "queued",
          },
          bridge: {
            id: "10000000-0000-4000-8000-000000000301",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeCode: "br-live-01",
          },
          scope: { allClinics: false, clinicIds: ["10000000-0000-4000-8000-000000000001"], roles: authContext.roles },
          mode: "bridge_health_check",
        };
      },
      async requestDeviceCommand() {
        if (deviceCommandError) throw deviceCommandError;
        return deviceCommandResult || {
          command: {
            id: "10000000-0000-4000-8000-000000000902",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            deviceId: "10000000-0000-4000-8000-000000000401",
            commandType: "device_calibration_request",
            status: "queued",
          },
          device: {
            id: "10000000-0000-4000-8000-000000000401",
            clinicId: "10000000-0000-4000-8000-000000000001",
            serial: "DL5-AX-1042",
            bridgeId: "10000000-0000-4000-8000-000000000301",
          },
          scope: { allClinics: false, clinicIds: ["10000000-0000-4000-8000-000000000001"], roles: authContext.roles },
          mode: "calibration_request",
        };
      },
    },
    deviceBridgeWorkerService: {
      assertWorker(headers = {}) {
        if (!String(headers.authorization || headers.Authorization || "").includes("stage4s-worker-token")) {
          throw Object.assign(new Error("worker auth required"), {
            publicCode: "worker_auth_required",
            publicStatus: 401,
          });
        }
      },
      async recordHeartbeat(headers) {
        if (deviceWorkerError) throw deviceWorkerError;
        this.assertWorker(headers);
        return {
          worker: { workerId: "local_device_bridge_worker", authType: "device_bridge_worker_token" },
          bridge: {
            id: "10000000-0000-4000-8000-000000000301",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeCode: "br-live-01",
            workerStatus: "online",
          },
          heartbeat: {
            bridgeCode: "br-live-01",
            lanStatus: "online",
            workerStatus: "online",
          },
        };
      },
      async listCommands(headers) {
        if (deviceWorkerError) throw deviceWorkerError;
        this.assertWorker(headers);
        return {
          worker: { workerId: "local_device_bridge_worker", authType: "device_bridge_worker_token" },
          query: { bridgeCode: "br-live-01", clinicId: "10000000-0000-4000-8000-000000000001", limit: 10 },
          commands: [
            deviceWorkerCommand || {
              id: "10000000-0000-4000-8000-000000000901",
              clinicId: "10000000-0000-4000-8000-000000000001",
              bridgeId: "10000000-0000-4000-8000-000000000301",
              commandType: "bridge_health_check",
              status: "queued",
              payload: { requestedFrom: "sys_devices" },
            },
          ],
        };
      },
      async updateCommandStatus(_commandId, _headers, body) {
        if (deviceWorkerError) throw deviceWorkerError;
        this.assertWorker(_headers);
        return {
          worker: { workerId: "local_device_bridge_worker", authType: "device_bridge_worker_token" },
          status: body?.status || "acknowledged",
          command: {
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            commandType: "bridge_health_check",
            status: body?.status || "acknowledged",
          },
        };
      },
      async listWorkerTelemetry(authContext, searchParams) {
        if (deviceWorkerError) throw deviceWorkerError;
        if (!authContext.roles.includes("system_admin")) throw new ForbiddenError();
        return {
          source: "postgres",
          summary: {
            bridgeCount: 1,
            onlineWorkers: 1,
            degradedWorkers: 0,
            offlineWorkers: 0,
            queuedCommands: 1,
            failedCommands: 1,
          },
          bridges: [{
            id: "10000000-0000-4000-8000-000000000301",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeCode: "br-live-01",
            hostName: "worker-host",
            lanStatus: "online",
            workerStatus: searchParams?.get?.("workerStatus") || "online",
            workerVersion: "stage4t-local-worker",
            workerLastSeenAt: "2026-05-14T10:00:00.000Z",
            queuedCount: 1,
            failedCount: 1,
          }],
          commands: [{
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            bridgeCode: "br-live-01",
            commandType: "bridge_health_check",
            status: searchParams?.get?.("commandStatus") || "failed",
            createdAt: "2026-05-14T09:00:00.000Z",
          }],
          filters: {
            workerStatus: searchParams?.get?.("workerStatus") || "all",
            commandStatus: searchParams?.get?.("commandStatus") || "all",
            limit: Number(searchParams?.get?.("limit") || 25),
          },
          scope: { roles: ["system_admin"] },
        };
      },
      async listWorkerHardening(authContext, searchParams) {
        if (deviceWorkerError) throw deviceWorkerError;
        if (!authContext.roles.includes("system_admin")) throw new ForbiddenError();
        return {
          source: "postgres",
          summary: {
            staleWorkers: 1,
            retryingCommands: 2,
            rateLimitedCommands: 1,
            maxQueueAgeSeconds: 120,
            cleanupCandidates: 3,
          },
          policy: {
            staleAfterMinutes: Number(searchParams?.get?.("staleAfterMinutes") || 10),
            retentionDays: Number(searchParams?.get?.("retentionDays") || 30),
            pollBackoff: "linear-capped",
            maxPollLimit: 50,
          },
          bridges: [{
            id: "10000000-0000-4000-8000-000000000301",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeCode: "br-live-01",
            hostName: "worker-host",
            workerStatus: "degraded",
            workerVersion: "stage4t-local-worker",
            workerLastSeenAt: "2026-05-14T09:40:00.000Z",
            stale: true,
            activeCommandCount: 3,
            retryingCommandCount: 2,
            rateLimitedCommandCount: 1,
            maxQueueAgeSeconds: 120,
          }],
          filters: {
            staleAfterMinutes: Number(searchParams?.get?.("staleAfterMinutes") || 10),
            retentionDays: Number(searchParams?.get?.("retentionDays") || 30),
            limit: Number(searchParams?.get?.("limit") || 25),
          },
          scope: { roles: ["system_admin"] },
        };
      },
      async listWorkerRecovery(authContext, searchParams) {
        if (deviceWorkerError) throw deviceWorkerError;
        if (!authContext.roles.includes("system_admin")) throw new ForbiddenError();
        return {
          source: "postgres",
          summary: {
            stuckCommands: 1,
            expiredCommands: 1,
            leaseExpiredCommands: 1,
            retryableCommands: 1,
            cancellableCommands: 2,
          },
          policy: {
            staleAfterMinutes: Number(searchParams?.get?.("staleAfterMinutes") || 10),
            leaseTtlSeconds: Number(searchParams?.get?.("leaseTtlSeconds") || 90),
            maxRecoveryBatch: 100,
            allowedActions: ["reschedule", "cancel"],
          },
          commands: [{
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            deviceId: null,
            bridgeCode: "br-live-01",
            commandType: "bridge_health_check",
            status: "failed",
            reason: "safe reason",
            attemptCount: 3,
            lifecycleRevision: 2,
            lastPolledAt: "2026-05-14T09:40:00.000Z",
            nextAttemptAt: null,
            leaseOwner: "br-live-01",
            leaseExpiresAt: "2026-05-14T09:41:30.000Z",
            recoveryState: "retryable_failed",
          }],
          filters: {
            staleAfterMinutes: Number(searchParams?.get?.("staleAfterMinutes") || 10),
            leaseTtlSeconds: Number(searchParams?.get?.("leaseTtlSeconds") || 90),
            limit: Number(searchParams?.get?.("limit") || 25),
          },
          scope: { roles: ["system_admin"] },
        };
      },
      async recoverCommand(commandId, authContext, body) {
        if (deviceWorkerError) throw deviceWorkerError;
        if (!authContext.roles.includes("system_admin")) throw new ForbiddenError();
        return {
          action: body?.action || "reschedule",
          scope: { roles: ["system_admin"] },
          command: {
            id: commandId,
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            deviceId: null,
            commandType: "bridge_health_check",
            status: body?.action === "cancel" ? "cancelled" : "queued",
            attemptCount: 3,
            lifecycleRevision: 3,
            recoveryAction: body?.action || "reschedule",
            recoveryReason: body?.reason || null,
          },
        };
      },
      async listWorkerCommandAudit(authContext, searchParams) {
        if (deviceWorkerError) throw deviceWorkerError;
        if (!authContext.roles.includes("system_admin")) throw new ForbiddenError();
        return {
          source: "postgres",
          summary: {
            totalEvents: 2,
            replayEvents: 1,
            recoveryEvents: 1,
            affectedCommands: 2,
          },
          policy: {
            replayPolicy: "manual_system_admin",
            allowedReplayStatuses: ["completed", "failed", "cancelled"],
            allowedReplayCommandTypes: ["bridge_health_check", "device_calibration_request"],
            payloadVisibility: "backend-only",
          },
          events: [{
            id: "audit-1",
            clinicId: "10000000-0000-4000-8000-000000000001",
            actorUserId: authContext.userId,
            action: searchParams?.get?.("action") || "replay",
            commandId: "10000000-0000-4000-8000-000000000901",
            correlationId: "corr-audit",
            createdAt: "2026-05-14T09:50:00.000Z",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            deviceId: null,
            bridgeCode: "br-live-01",
            commandType: "bridge_health_check",
            status: searchParams?.get?.("status") || "queued",
            reason: "safe reason",
            attemptCount: 3,
            lifecycleRevision: 4,
            replayPolicy: "manual_system_admin",
          }],
          filters: {
            action: searchParams?.get?.("action") || "all",
            status: searchParams?.get?.("status") || "all",
            limit: Number(searchParams?.get?.("limit") || 25),
          },
          scope: { roles: ["system_admin"] },
        };
      },
      async exportWorkerCommandAudit(authContext, searchParams) {
        if (deviceWorkerError) throw deviceWorkerError;
        if (!authContext.roles.includes("system_admin")) throw new ForbiddenError();
        return {
          source: "postgres",
          policy: {
            replayPolicy: "manual_system_admin",
            allowedReplayStatuses: ["completed", "failed", "cancelled"],
            allowedReplayCommandTypes: ["bridge_health_check", "device_calibration_request"],
            payloadVisibility: "backend-only",
          },
          filters: {
            action: searchParams?.get?.("action") || "all",
            status: searchParams?.get?.("status") || "all",
            limit: Number(searchParams?.get?.("limit") || 25),
          },
          export: {
            format: "csv",
            mime: "text/csv;charset=utf-8",
            filename: "device-bridge-command-audit-replay-failed-1-rows.csv",
            rowCount: 1,
            content: "# stage,4Y\n\"event_id\",\"action\"\n\"audit-1\",\"replay\"",
            privacy: {
              payloadVisibility: "backend-only",
              excludedFieldCount: 3,
              exportedFieldSet: "safe-command-metadata-only",
            },
          },
          scope: { roles: ["system_admin"] },
        };
      },
      async replayCommand(commandId, authContext, body) {
        if (deviceWorkerError) throw deviceWorkerError;
        if (!authContext.roles.includes("system_admin")) throw new ForbiddenError();
        return {
          scope: { roles: ["system_admin"] },
          command: {
            id: "10000000-0000-4000-8000-000000000902",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            deviceId: null,
            commandType: "bridge_health_check",
            status: "queued",
            reason: body?.reason || "Replay",
            attemptCount: 0,
            lifecycleRevision: 0,
            replayOfCommandId: commandId,
            replayPolicy: "manual_system_admin",
          },
        };
      },
    },
  };
}

async function request(
  path,
  env = {},
  runtime = createRuntime(),
  method = "GET",
  body = undefined,
  extraHeaders = {},
) {
  const config = readSelfHostedConfig(env);
  const response = await handleSelfHostedRequest(
    {
      method,
      url: path,
      headers: {
        origin: "http://localhost:8080",
        authorization: "Bearer header.payload.signature",
        ...extraHeaders,
      },
      body,
    },
    config,
    NOW,
    runtime,
  );
  return {
    ...response,
    json: response.headers?.["content-type"]?.includes("application/json") && response.body
      ? JSON.parse(response.body)
      : null,
  };
}

const configuredEnv = {
  DATABASE_URL: "postgres://user:secret@postgres:5432/app",
  OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
  JWT_SECRET: "stage4c-local-test-secret",
};

test("healthz returns a safe self-hosted service status", async () => {
  const response = await request("/healthz", configuredEnv);

  assert.equal(response.status, 200);
  assert.equal(response.json.status, "ok");
  assert.equal(response.json.deploymentMode, "self-hosted");
  assert.doesNotMatch(response.body, /secret|postgres:\/\/user/i);
});

test("readyz reports degraded until database and object storage are configured", async () => {
  const degraded = await request("/readyz", {}, createRuntime());
  assert.equal(degraded.status, 503);
  assert.equal(degraded.json.status, "degraded");
  assert.equal(degraded.json.dependencies.length, 3);

  const unavailable = await request(
    "/readyz",
    configuredEnv,
    createRuntime({ connected: false }),
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.json.status, "degraded");
  assert.equal(
    unavailable.json.dependencies.find((item) => item.name === "postgres").status,
    "unavailable",
  );
  assert.doesNotMatch(unavailable.body, /secret|postgres:\/\//);

  const ready = await request("/readyz", configuredEnv, createRuntime());
  assert.equal(ready.status, 200);
  assert.equal(ready.json.status, "ready");
  assert.equal(
    ready.json.dependencies.find((item) => item.name === "postgres").status,
    "connected",
  );
  assert.doesNotMatch(ready.body, /secret|app/);
});

test("meta and openapi routes expose contracts without runtime secrets", async () => {
  const meta = await request("/api/v1/meta", {
    ...configuredEnv,
    OBJECT_STORAGE_BUCKET: "medical-assets",
  });
  assert.equal(meta.status, 200);
  assert.equal(meta.json.stage, "5T");
  assert.equal(meta.json.capabilities.auth, "local-jwt");
  assert.equal(meta.json.capabilities.patients, "rbac-read-write-postgres");
  assert.equal(meta.json.capabilities.doctorDashboard, "rbac-read-postgres");
  assert.equal(meta.json.capabilities.visitSchedule, "rbac-read-postgres");
  assert.equal(meta.json.capabilities.leadsAppointments, "rbac-read-write-postgres");
  assert.equal(meta.json.capabilities.clinicBookingRequests, "rbac-read-write-postgres");
  assert.equal(meta.json.capabilities.clinicBookingSlotConfirmation, "rbac-write-postgres-local-slot-cache");
  assert.equal(meta.json.capabilities.externalIntakeImports, "rbac-read-write-postgres-inbound-only-idempotent-redacted-status");
  assert.equal(meta.json.capabilities.clinicAvailableSlots, "rbac-read-postgres-local-import-cache");
  assert.equal(meta.json.capabilities.patientPortal, "patient-owned-read-postgres");
  assert.equal(meta.json.capabilities.patientPortalWrites, "patient-owned-write-postgres");
  assert.equal(meta.json.capabilities.clinicalFollowUps, "rbac-read-write-postgres-patient-portal-local-communication");
  assert.equal(meta.json.capabilities.clinicalFollowUpOperations, "rbac-read-write-postgres-sla-triage-escalation-local-evidence");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyExceptionClosure, "rbac-read-write-postgres-local-sop-policy-exception-closure");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyAuditRollup, "rbac-read-write-postgres-local-sop-policy-audit-rollup");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceReadiness, "rbac-read-write-postgres-local-sop-policy-governance-readiness");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceClosure, "rbac-read-write-postgres-local-sop-policy-governance-closure");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidence, "rbac-read-write-postgres-local-sop-policy-governance-evidence-export");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliation, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation");
  assert.equal(meta.json.capabilities.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure, "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure");
  assert.equal(meta.json.capabilities.devices, "rbac-read-command-postgres-device-bridge-registry-worker-contract");
  assert.equal(meta.json.capabilities.deviceBridgeWorker, "token-auth-heartbeat-poll-ack-complete-telemetry-hardening-recovery-audit-replay-export-product-readiness-production-readiness-operations-continuity-fleet-reliability-lifecycle-assurance");
  assert.equal(meta.json.capabilities.observability, "structured-json-logs-redacted-ops-status-runtime-checks");
  assert.equal(meta.json.links.openapi, "/openapi.stage4z.json");
  assert.equal(meta.json.links.openapiStage4A, "/openapi.stage4a.json");
  assert.equal(meta.json.links.openapiStage4B, "/openapi.stage4b.json");
  assert.equal(meta.json.links.openapiStage4C, "/openapi.stage4c.json");
  assert.equal(meta.json.links.openapiStage4H, "/openapi.stage4h.json");
  assert.equal(meta.json.links.openapiStage4I, "/openapi.stage4i.json");
  assert.equal(meta.json.links.openapiStage4J, "/openapi.stage4j.json");
  assert.equal(meta.json.links.openapiStage4N, "/openapi.stage4n.json");
  assert.equal(meta.json.links.openapiStage4P, "/openapi.stage4p.json");
  assert.equal(meta.json.links.openapiStage4Q, "/openapi.stage4q.json");
  assert.equal(meta.json.links.openapiStage4R, "/openapi.stage4r.json");
  assert.equal(meta.json.links.openapiStage4S, "/openapi.stage4s.json");
  assert.equal(meta.json.links.openapiStage4U, "/openapi.stage4u.json");
  assert.equal(meta.json.links.openapiStage4V, "/openapi.stage4v.json");
  assert.equal(meta.json.links.openapiStage4W, "/openapi.stage4w.json");
  assert.equal(meta.json.links.openapiStage4X, "/openapi.stage4x.json");
  assert.equal(meta.json.links.openapiStage4Y, "/openapi.stage4y.json");
  assert.equal(meta.json.links.openapiStage4Z, "/openapi.stage4z.json");
  assert.equal(meta.json.links.openapiStage8J8O, "/openapi.stage8j-8o.json");
  assert.equal(meta.json.links.openapiStage8P9A, "/openapi.stage8p-9a.json");
  assert.equal(meta.json.links.openapiStage9B9M, "/openapi.stage9b-9m.json");
  assert.equal(meta.json.links.openapiStage9N9Z, "/openapi.stage9n-9z.json");
  assert.equal(meta.json.links.openapiStage17A17Z, "/openapi.stage17a-17z.json");
  assert.equal(meta.json.links.openapiStage18A18Z, "/openapi.stage18a-18z.json");
  assert.equal(meta.json.links.openapiStage19A19Z, "/openapi.stage19a-19z.json");
  assert.equal(meta.json.links.openapiStage20A20Z, "/openapi.stage20a-20z.json");
  assert.equal(meta.json.links.openapiStage21A21Z, "/openapi.stage21a-21z.json");
  assert.equal(meta.json.links.openapiStage22A22Z, "/openapi.stage22a-22z.json");
  assert.equal(meta.json.links.openapiStage23A23Z, "/openapi.stage23a-23z.json");
  assert.equal(meta.json.links.openapiStage24A24Z, "/openapi.stage24a-24z.json");
  assert.equal(meta.json.links.openapiStage25A25Z, "/openapi.stage25a-25z.json");
  assert.equal(meta.json.links.openapiStage26A26Z, "/openapi.stage26a-26z.json");
  assert.equal(meta.json.links.openapiStage27A27Z, "/openapi.stage27a-27z.json");
  assert.equal(meta.json.links.openapiStage28A28Z, "/openapi.stage28a-28z.json");
  assert.equal(meta.json.links.openapiStage29A29Z, "/openapi.stage29a-29z.json");
  assert.equal(meta.json.links.openapiStage30A30Z, "/openapi.stage30a-30z.json");
  assert.equal(meta.json.links.openapiStage31A31Z, "/openapi.stage31a-31z.json");
  assert.equal(meta.json.links.openapiStage32A32Z, "/openapi.stage32a-32z.json");
  assert.equal(meta.json.links.openapiStage33A33Z, "/openapi.stage33a-33z.json");
  assert.equal(meta.json.links.openapiStage34A34Z, "/openapi.stage34a-34z.json");
  assert.equal(meta.json.links.openapiStage35A35Z, "/openapi.stage35a-35z.json");
  assert.equal(meta.json.links.openapiStage36A36Z, "/openapi.stage36a-36z.json");
  assert.equal(meta.json.links.openapiStage37A37Z, "/openapi.stage37a-37z.json");
  assert.equal(meta.json.links.openapiStage5I, "/openapi.stage5i.json");
  assert.equal(meta.json.links.openapiStage5J, "/openapi.stage5j.json");
  assert.equal(meta.json.links.openapiStage5K, "/openapi.stage5k.json");
  assert.equal(meta.json.links.openapiStage5L, "/openapi.stage5l.json");
  assert.equal(meta.json.links.openapiStage5N, "/openapi.stage5n.json");
  assert.equal(meta.json.links.openapiStage5O, "/openapi.stage5o.json");
  assert.equal(meta.json.links.openapiStage5P, "/openapi.stage5p.json");
  assert.equal(meta.json.links.openapiStage5Q, "/openapi.stage5q.json");
  assert.equal(meta.json.links.openapiStage5R, "/openapi.stage5r.json");
  assert.equal(meta.json.links.openapiStage5S, "/openapi.stage5s.json");
  assert.equal(meta.json.links.openapiStage5T, "/openapi.stage5t.json");
  assert.equal(meta.json.links.opsStatus, "/api/v1/ops/status");
  assert.equal(meta.json.links.opsRuntimeChecks, "/api/v1/ops/runtime-checks");
  assert.equal(meta.json.links.productReadiness, "/api/v1/product/readiness");
  assert.equal(meta.json.links.deviceBridges, "/api/v1/device-bridges");
  assert.equal(meta.json.links.deviceBridgeCommands, "/api/v1/device-bridges/{bridgeId}/commands");
  assert.equal(meta.json.links.deviceBridgeWorkerHeartbeat, "/api/v1/device-bridge-worker/heartbeat");
  assert.equal(meta.json.links.deviceBridgeWorkerCommands, "/api/v1/device-bridge-worker/commands");
  assert.equal(meta.json.links.deviceBridgeWorkerCommand, "/api/v1/device-bridge-worker/commands/{commandId}");
  assert.equal(meta.json.links.deviceBridgeWorkerStatus, "/api/v1/device-bridge-worker/status");
  assert.equal(meta.json.links.deviceBridgeWorkerHardening, "/api/v1/device-bridge-worker/hardening");
  assert.equal(meta.json.links.deviceBridgeWorkerRecovery, "/api/v1/device-bridge-worker/recovery");
  assert.equal(meta.json.links.deviceBridgeWorkerAudit, "/api/v1/device-bridge-worker/audit");
  assert.equal(meta.json.links.deviceBridgeWorkerAuditExport, "/api/v1/device-bridge-worker/audit/export");
  assert.equal(meta.json.links.deviceBridgeWorkerReplay, "/api/v1/device-bridge-worker/commands/{commandId}/replay");
  assert.equal(meta.json.links.deviceBridgeWorkerProductionReadiness, "/api/v1/device-bridge-worker/production-readiness");
  assert.equal(meta.json.links.deviceBridgeWorkerOperationsContinuity, "/api/v1/device-bridge-worker/operations-continuity");
  assert.equal(meta.json.links.deviceBridgeWorkerFleetReliability, "/api/v1/device-bridge-worker/fleet-reliability");
  assert.equal(meta.json.links.deviceBridgeWorkerLifecycleAssurance, "/api/v1/device-bridge-worker/lifecycle-assurance");
  assert.equal(meta.json.links.devices, "/api/v1/devices");
  assert.equal(meta.json.links.deviceCommands, "/api/v1/devices/{deviceId}/commands");
  assert.equal(meta.json.links.doctorDashboard, "/api/v1/doctor/dashboard");
  assert.equal(meta.json.links.leadsAppointments, "/api/v1/leads/appointments");
  assert.equal(meta.json.links.createLead, "/api/v1/leads");
  assert.equal(meta.json.links.updateLeadStatus, "/api/v1/leads/{leadId}");
  assert.equal(meta.json.links.bookLeadAppointment, "/api/v1/leads/{leadId}/book-appointment");
  assert.equal(meta.json.links.clinicBookingRequests, "/api/v1/clinic/booking-requests");
  assert.equal(meta.json.links.clinicBookingRequest, "/api/v1/clinic/booking-requests/{requestId}");
  assert.equal(meta.json.links.bookClinicBookingRequestFromSlot, "/api/v1/clinic/booking-requests/{requestId}/book-from-slot");
  assert.equal(meta.json.links.externalBookingImports, "/api/v1/integrations/booking-imports");
  assert.equal(meta.json.links.externalBookingImportStatus, "/api/v1/integrations/booking-imports/status");
  assert.equal(meta.json.links.clinicAvailableSlots, "/api/v1/clinic/available-slots");
  assert.equal(meta.json.links.patientPortal, "/api/v1/me/portal");
  assert.equal(meta.json.links.patientPortalReport, "/api/v1/me/reports/{reportId}");
  assert.equal(meta.json.links.patientPortalBookingRequests, "/api/v1/me/booking-requests");
  assert.equal(meta.json.links.patientPortalReminderPreferences, "/api/v1/me/reminder-preferences");
  assert.equal(meta.json.links.clinicalFollowUps, "/api/v1/clinical/follow-ups");
  assert.equal(meta.json.links.createVisitFollowUp, "/api/v1/visits/{visitId}/follow-ups");
  assert.equal(meta.json.links.clinicalFollowUpMessages, "/api/v1/clinical/follow-ups/{followUpId}/messages");
  assert.equal(meta.json.links.clinicalFollowUpOperations, "/api/v1/clinical/follow-ups/operations");
  assert.equal(meta.json.links.clinicalFollowUpOperationsSummary, "/api/v1/clinical/follow-ups/operations/summary");
  assert.equal(meta.json.links.clinicalFollowUpClinicReviewSummary, "/api/v1/clinical/follow-ups/clinic-review/summary");
  assert.equal(meta.json.links.clinicalFollowUpClinicReview, "/api/v1/clinical/follow-ups/{followUpId}/clinic-review");
  assert.equal(meta.json.links.clinicalFollowUpSopValidationSummary, "/api/v1/clinical/follow-ups/sop-validation/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopValidation, "/api/v1/clinical/follow-ups/{followUpId}/sop-validation");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyTemplatesSummary, "/api/v1/clinical/follow-ups/sop-policy-templates/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyTemplates, "/api/v1/clinical/follow-ups/sop-policy-templates");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyTemplate, "/api/v1/clinical/follow-ups/sop-policy-templates/{templateId}");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyApplicationSummary, "/api/v1/clinical/follow-ups/sop-policy-application/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyApplication, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-application");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyExceptionClosureSummary, "/api/v1/clinical/follow-ups/sop-policy-exceptions/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyExceptionClosure, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-exception");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyAuditRollupSummary, "/api/v1/clinical/follow-ups/sop-policy-audit/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyAuditRollup, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-audit");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceReadinessSummary, "/api/v1/clinical/follow-ups/sop-policy-governance/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceReadiness, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceClosureSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceClosure, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-closure");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidence, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliation, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure/summary");
  assert.equal(meta.json.links.clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure, "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure");
  assert.equal(meta.json.links.clinicalFollowUpOperation, "/api/v1/clinical/follow-ups/{followUpId}/operations");
  assert.equal(meta.json.links.patientPortalFollowUps, "/api/v1/me/follow-ups");
  assert.equal(meta.json.links.patientPortalFollowUpMessages, "/api/v1/me/follow-ups/{followUpId}/messages");
  assert.equal(meta.json.links.visits, "/api/v1/visits");
  assert.equal(meta.json.links.assetDownloadUrl, "/api/v1/assets/{assetId}/download-url");
  assert.equal(meta.json.links.assetDownload, "/api/v1/assets/{assetId}/download");
  assert.equal(meta.json.service.objectStorageBucket, "medical-assets");
  assert.doesNotMatch(meta.body, /secret|postgres:\/\//);

  const openapi4a = await request("/openapi.stage4a.json");
  assert.equal(openapi4a.status, 200);
  assert.equal(openapi4a.json.info.version, "4A-foundation");

  const openapi4b = await request("/openapi.stage4b.json");
  assert.equal(openapi4b.status, 200);
  assert.equal(openapi4b.json.info.version, "4B-runtime");
  assert.equal(
    openapi4b.json.paths["/api/v1/patients"].get.responses["200"].description,
    "Read-only patient list from PostgreSQL",
  );

  const openapi4c = await request("/openapi.stage4c.json");
  assert.equal(openapi4c.status, 200);
  assert.equal(openapi4c.json.info.version, "4C-auth-rbac");
  assert.equal(openapi4c.json.components.securitySchemes.bearerAuth.scheme, "bearer");

  const openapi4d = await request("/openapi.stage4d.json");
  assert.equal(openapi4d.status, 200);
  assert.equal(openapi4d.json.info.version, "4D-patient-writes");
  assert.equal(openapi4d.json.paths["/api/v1/patients"].post.responses["201"].description, "Patient created");

  const openapi4h = await request("/openapi.stage4h.json");
  assert.equal(openapi4h.status, 200);
  assert.equal(openapi4h.json.info.version, "4H-visit-workspace-writes");
  assert.ok(openapi4h.json.paths["/api/v1/visits/{visitId}/report"].patch);

  const openapi5h = await request("/openapi.stage5h.json");
  assert.equal(openapi5h.status, 200);
  assert.equal(openapi5h.json.info.version, "5H-clinical-workspace-contracts");
  assert.ok(openapi5h.json.paths["/api/v1/visits/{visitId}/assessment"].patch);

  const openapi5i = await request("/openapi.stage5i.json");
  assert.equal(openapi5i.status, 200);
  assert.equal(openapi5i.json.info.version, "5I-doctor-dashboard-contracts");
  assert.ok(openapi5i.json.paths["/api/v1/doctor/dashboard"].get);

  const openapi5j = await request("/openapi.stage5j.json");
  assert.equal(openapi5j.status, 200);
  assert.equal(openapi5j.json.info.version, "5J-visit-schedule-contracts");
  assert.ok(openapi5j.json.paths["/api/v1/visits"].get);

  const openapi5k = await request("/openapi.stage5k.json");
  assert.equal(openapi5k.status, 200);
  assert.equal(openapi5k.json.info.version, "5K-leads-appointments-contracts");
  assert.ok(openapi5k.json.paths["/api/v1/leads/appointments"].get);

  const openapi5l = await request("/openapi.stage5l.json");
  assert.equal(openapi5l.status, 200);
  assert.equal(openapi5l.json.info.version, "5L-leads-appointments-writes");
  assert.ok(openapi5l.json.paths["/api/v1/leads"].post);

  const openapi5n = await request("/openapi.stage5n.json");
  assert.equal(openapi5n.status, 200);
  assert.equal(openapi5n.json.info.version, "5N-patient-portal");
  assert.ok(openapi5n.json.paths["/api/v1/me/portal"].get);

  const openapi5p = await request("/openapi.stage5p.json");
  assert.equal(openapi5p.status, 200);
  assert.equal(openapi5p.json.info.version, "5P-clinic-booking-requests-intake");
  assert.ok(openapi5p.json.paths["/api/v1/clinic/booking-requests"].get);

  const openapi5q = await request("/openapi.stage5q.json");
  assert.equal(openapi5q.status, 200);
  assert.equal(openapi5q.json.info.version, "5Q-external-intake-import-contracts");
  assert.ok(openapi5q.json.paths["/api/v1/integrations/booking-imports"].post);

  const openapi5r = await request("/openapi.stage5r.json");
  assert.equal(openapi5r.status, 200);
  assert.equal(openapi5r.json.info.version, "5R-clinic-available-slots-contract");
  assert.ok(openapi5r.json.paths["/api/v1/clinic/available-slots"].get);

  const openapi4i = await request("/openapi.stage4i.json");
  assert.equal(openapi4i.status, 200);
  assert.equal(openapi4i.json.info.version, "4I-assets-write");
  assert.ok(openapi4i.json.paths["/api/v1/assets/{assetId}/download-url"].get);

  const openapi4j = await request("/openapi.stage4j.json");
  assert.equal(openapi4j.status, 200);
  assert.equal(openapi4j.json.info.version, "4J-asset-binaries");
  assert.ok(openapi4j.json.paths["/api/v1/assets/{assetId}/download"].get);

  const openapi4n = await request("/openapi.stage4n.json");
  assert.equal(openapi4n.status, 200);
  assert.equal(openapi4n.json.info.version, "4N-production-observability-audit");
  assert.ok(openapi4n.json.paths["/api/v1/ops/status"].get);

  const openapi4p = await request("/openapi.stage4p.json");
  assert.equal(openapi4p.status, 200);
  assert.equal(openapi4p.json.info.version, "4P-ops-runtime-checks");
  assert.ok(openapi4p.json.paths["/api/v1/ops/runtime-checks"].get);

  const openapi4q = await request("/openapi.stage4q.json");
  assert.equal(openapi4q.status, 200);
  assert.equal(openapi4q.json.info.version, "4Q-device-registry");

  const openapi4r = await request("/openapi.stage4r.json");
  assert.equal(openapi4r.status, 200);
  assert.equal(openapi4r.json.info.version, "4R-device-bridge-commands");
  const openapi4s = await request("/openapi.stage4s.json");
  assert.equal(openapi4s.status, 200);
  assert.equal(openapi4s.json.info.version, "4S-device-bridge-worker-contract");
  assert.ok(openapi4s.json.paths["/api/v1/device-bridge-worker/heartbeat"].post);
  assert.ok(openapi4s.json.paths["/api/v1/device-bridge-worker/commands"].get);
  const openapi4u = await request("/openapi.stage4u.json");
  assert.equal(openapi4u.status, 200);
  assert.equal(openapi4u.json.info.version, "4U-device-bridge-worker-observability");
  assert.ok(openapi4u.json.paths["/api/v1/device-bridge-worker/status"].get);
  const openapi4v = await request("/openapi.stage4v.json");
  assert.equal(openapi4v.status, 200);
  assert.equal(openapi4v.json.info.version, "4V-device-bridge-production-hardening");
  assert.ok(openapi4v.json.paths["/api/v1/device-bridge-worker/hardening"].get);
  const openapi4w = await request("/openapi.stage4w.json");
  assert.equal(openapi4w.status, 200);
  assert.equal(openapi4w.json.info.version, "4W-device-bridge-command-safety");
  assert.ok(openapi4w.json.paths["/api/v1/device-bridge-worker/recovery"].get);
  assert.ok(openapi4w.json.paths["/api/v1/device-bridge-worker/commands/{commandId}/recovery"].post);
  const openapi4x = await request("/openapi.stage4x.json");
  assert.equal(openapi4x.status, 200);
  assert.equal(openapi4x.json.info.version, "4X-device-bridge-audit-replay");
  assert.ok(openapi4x.json.paths["/api/v1/device-bridge-worker/audit"].get);
  assert.ok(openapi4x.json.paths["/api/v1/device-bridge-worker/commands/{commandId}/replay"].post);
  const openapi4y = await request("/openapi.stage4y.json");
  assert.equal(openapi4y.status, 200);
  assert.equal(openapi4y.json.info.version, "4Y-device-bridge-audit-export");
  assert.ok(openapi4y.json.paths["/api/v1/device-bridge-worker/audit/export"].get);
  const openapi4z = await request("/openapi.stage4z.json");
  assert.equal(openapi4z.status, 200);
  assert.equal(openapi4z.json.info.version, "4Z-self-hosted-product-readiness");
  assert.ok(openapi4z.json.paths["/api/v1/product/readiness"].get);
  assert.ok(openapi4q.json.paths["/api/v1/devices"].get);
  assert.ok(openapi4q.json.paths["/api/v1/device-bridges"].get);
});

test("ops status is system-admin only, safe, audited, and correlation-aware", async () => {
  const auditEvents = [];
  const systemAdminRuntime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request("/api/v1/ops/status", configuredEnv, systemAdminRuntime);

  assert.equal(response.status, 200);
  assert.equal(response.headers["x-correlation-id"], "stage4i-local");
  assert.equal(response.json.stage, "4N");
  assert.equal(response.json.source, "self-hosted");
  assert.equal(response.json.observability.structuredJsonLogs, true);
  assert.equal(response.json.observability.correlationHeader, "x-correlation-id");
  assert.equal(response.json.audit.mode, "append-only");
  assert.equal(response.json.auth.roles[0], "system_admin");
  assert.equal(auditEvents[0].action, "ops.status.read");
  assert.doesNotMatch(response.body, /secret|postgres:\/\/|password|Bearer|object_key|storage_object_path|patient_full_name|Demo Patient/i);

  const denied = await request(
    "/api/v1/ops/status",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000102",
        displayName: "Clinic Admin",
        roles: ["clinic_admin"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [{ role: "clinic_admin", clinicId: "10000000-0000-4000-8000-000000000001" }],
        token: {},
      },
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");

  const anonymous = await request(
    "/api/v1/ops/status",
    configuredEnv,
    createRuntime({ authContext: null }),
  );
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.json.error.code, "auth_required");
});

test("Stage 4Z · product readiness is system-admin only, safe, and audited", async () => {
  const auditEvents = [];
  const runtime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });

  const response = await request("/api/v1/product/readiness", configuredEnv, runtime);
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4Z");
  assert.equal(response.json.source, "self-hosted");
  assert.equal(response.json.status, "ready_for_server_deploy");
  assert.equal(response.json.productBoundary.managedRuntime, "none");
  assert.equal(response.json.productBoundary.managedDatabase, "none");
  assert.equal(response.json.productBoundary.supabaseRuntimeCoupling, false);
  assert.equal(response.json.productBoundary.browserHardwareApis, false);
  assert.ok(response.json.capabilities.some((item) => item.key === "frontend"));
  assert.ok(response.json.capabilities.some((item) => item.key === "device_bridge"));
  assert.ok(response.json.gates.some((item) => item.command === "npm run preflight:all"));
  assert.ok(response.json.openapi.includes("/openapi.stage4z.json"));
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.equal(auditEvents.at(-1).action, "product.readiness.read");
  assert.doesNotMatch(
    response.body,
    /SUPABASE_|access_token|storage_object_path|patient_full_name|signed_url|navigator\.|postgres:\/\//i,
  );

  const denied = await request("/api/v1/product/readiness", configuredEnv, createRuntime());
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("ops runtime checks are system-admin only, safe, audited, and self-hosted", async () => {
  const auditEvents = [];
  const systemAdminRuntime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/ops/runtime-checks",
    configuredEnv,
    systemAdminRuntime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers["x-correlation-id"], "stage4i-local");
  assert.equal(response.json.stage, "4P");
  assert.equal(response.json.source, "self-hosted");
  assert.ok(response.json.checks.some((item) => item.key === "postgres_connectivity"));
  assert.ok(response.json.checks.some((item) => item.key === "object_storage_runtime"));
  assert.ok(response.json.checks.some((item) => item.key === "migration_bundle"));
  assert.ok(response.json.commands.some((item) => item.command === "npm run ops:stage4l:backup:dry-run"));
  assert.ok(response.json.commands.some((item) => item.command === "npm run smoke:stage4k:dry-run"));
  assert.equal(response.json.auth.roles[0], "system_admin");
  assert.equal(auditEvents[0].action, "ops.runtime_checks.read");
  assert.doesNotMatch(
    response.body,
    /secret|postgres:\/\/|password|Bearer|object_key|storage_object_path|patient_full_name|Demo Patient/i,
  );

  const denied = await request(
    "/api/v1/ops/runtime-checks",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000102",
        displayName: "Clinic Admin",
        roles: ["clinic_admin"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [{ role: "clinic_admin", clinicId: "10000000-0000-4000-8000-000000000001" }],
        token: {},
      },
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 4Q · device registry endpoints are RBAC-scoped, audited, and safe", async () => {
  const auditEvents = [];
  const clinicAdminRuntime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000102",
      displayName: "Clinic Admin",
      roles: ["clinic_admin"],
      clinicIds: ["10000000-0000-4000-8000-000000000001"],
      roleBindings: [{ role: "clinic_admin", clinicId: "10000000-0000-4000-8000-000000000001" }],
      token: {},
    },
    bridges: [
      {
        id: "10000000-0000-4000-8000-000000000301",
        bridgeCode: "br-msk-01",
        hostName: "dp-bridge-msk-01",
        lanStatus: "online",
        version: "1.0.0",
        pairedCount: 2,
        lastHeartbeatAt: "2026-05-14T08:00:00.000Z",
      },
    ],
    devices: [
      {
        id: "10000000-0000-4000-8000-000000000401",
        model: "DermLite DL5",
        serial: "DL5-AX-1042",
        firmware: "2.4.1",
        magnification: "x10",
        polarization: "polarized",
        calibrationProfile: "DL5-std-A",
        calibrationDueAt: "2026-05-20",
        status: "connected",
        lastSeenAt: "2026-05-14T08:00:00.000Z",
        bridgeId: "10000000-0000-4000-8000-000000000301",
        bridge: {
          id: "10000000-0000-4000-8000-000000000301",
          code: "br-msk-01",
          hostName: "dp-bridge-msk-01",
          lanStatus: "online",
        },
      },
    ],
  });

  const bridges = await request("/api/v1/device-bridges?bridgeStatus=online", configuredEnv, clinicAdminRuntime);
  assert.equal(bridges.status, 200);
  assert.equal(bridges.json.stage, "4Q");
  assert.equal(bridges.json.items[0].bridgeCode, "br-msk-01");
  assert.equal(bridges.json.auth.allClinics, false);
  assert.equal(auditEvents[0].action, "device_bridge.list");
  assert.doesNotMatch(bridges.body, /secret|password|Bearer|object_key|storage_object_path|metadata_json|patient_full_name/i);

  const devices = await request(
    "/api/v1/devices?status=connected&needsCalibration=true&search=DL5",
    configuredEnv,
    clinicAdminRuntime,
  );
  assert.equal(devices.status, 200);
  assert.equal(devices.json.stage, "4Q");
  assert.equal(devices.json.items[0].serial, "DL5-AX-1042");
  assert.equal(devices.json.status, "connected");
  assert.equal(devices.json.needsCalibration, true);
  assert.equal(auditEvents[1].action, "device.list");
  assert.doesNotMatch(devices.body, /secret|password|Bearer|object_key|storage_object_path|metadata_json|patient_full_name/i);

  const denied = await request(
    "/api/v1/devices",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000101",
        displayName: "Demo Doctor",
        roles: ["doctor"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [{ role: "doctor", clinicId: "10000000-0000-4000-8000-000000000001" }],
        token: {},
      },
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 4R · Device Bridge command endpoints queue safe backend-owned commands", async () => {
  const clinicAdminRuntime = createRuntime({
    authContext: {
      userId: "10000000-0000-4000-8000-000000000102",
      displayName: "Clinic Admin",
      roles: ["clinic_admin"],
      clinicIds: ["10000000-0000-4000-8000-000000000001"],
      roleBindings: [{ role: "clinic_admin", clinicId: "10000000-0000-4000-8000-000000000001" }],
      token: {},
    },
  });

  const bridgeCommand = await request(
    "/api/v1/device-bridges/10000000-0000-4000-8000-000000000301/commands",
    configuredEnv,
    clinicAdminRuntime,
    "POST",
    JSON.stringify({ commandType: "bridge_health_check", reason: "Проверка LAN" }),
  );
  assert.equal(bridgeCommand.status, 202);
  assert.equal(bridgeCommand.json.stage, "4R");
  assert.equal(bridgeCommand.json.command.commandType, "bridge_health_check");
  assert.equal(bridgeCommand.json.execution.worker, "local_device_bridge");
  assert.equal(bridgeCommand.json.execution.browserHardwareAccess, false);
  assert.doesNotMatch(bridgeCommand.body, /secret|password|Bearer|object_key|storage_object_path|metadata_json|navigator\./i);

  const deviceCommand = await request(
    "/api/v1/devices/10000000-0000-4000-8000-000000000401/commands",
    configuredEnv,
    clinicAdminRuntime,
    "POST",
    JSON.stringify({ commandType: "device_calibration_request" }),
  );
  assert.equal(deviceCommand.status, 202);
  assert.equal(deviceCommand.json.command.deviceId, "10000000-0000-4000-8000-000000000401");
  assert.equal(deviceCommand.json.mode, "calibration_request");
});

test("Stage 4R · Device Bridge command endpoints map RBAC and validation errors safely", async () => {
  const denied = await request(
    "/api/v1/device-bridges/10000000-0000-4000-8000-000000000301/commands",
    configuredEnv,
    createRuntime({ deviceCommandError: new ForbiddenError() }),
    "POST",
    JSON.stringify({ commandType: "bridge_health_check" }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");

  const invalid = await request(
    "/api/v1/devices/10000000-0000-4000-8000-000000000401/commands",
    configuredEnv,
    createRuntime(),
    "POST",
    "{bad-json",
  );
  assert.equal(invalid.status, 400);
  assert.equal(invalid.json.error.code, "invalid_json");
  assert.doesNotMatch(invalid.body, MANAGED_RUNTIME_ERROR_PATTERN);
});

test("Stage 4S · Device Bridge worker endpoints record heartbeat, poll, and update lifecycle", async () => {
  const workerHeaders = { authorization: "Bearer stage4s-worker-token" };
  const heartbeat = await request(
    "/api/v1/device-bridge-worker/heartbeat",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000001",
      bridgeCode: "br-live-01",
      hostName: "worker-host",
      version: "4.0.0",
    }),
    workerHeaders,
  );
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.json.stage, "4S");
  assert.equal(heartbeat.json.worker.authenticated, true);
  assert.equal(heartbeat.json.bridge.bridgeCode, "br-live-01");

  const list = await request(
    "/api/v1/device-bridge-worker/commands?clinicId=10000000-0000-4000-8000-000000000001&bridgeCode=br-live-01",
    configuredEnv,
    createRuntime(),
    "GET",
    undefined,
    workerHeaders,
  );
  assert.equal(list.status, 200);
  assert.equal(list.json.count, 1);
  assert.equal(list.json.items[0].commandType, "bridge_health_check");

  const ack = await request(
    "/api/v1/device-bridge-worker/commands/10000000-0000-4000-8000-000000000901",
    configuredEnv,
    createRuntime(),
    "PATCH",
    JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000001",
      bridgeCode: "br-live-01",
      status: "acknowledged",
    }),
    workerHeaders,
  );
  assert.equal(ack.status, 200);
  assert.equal(ack.json.lifecycle.status, "acknowledged");
  assert.equal(ack.json.command.status, "acknowledged");
  assert.doesNotMatch(`${heartbeat.body}\n${list.body}\n${ack.body}`, /stage4s-worker-token|secret|password|storage_object_path|object_key|navigator\./i);
});

test("Stage 4S · Device Bridge worker endpoints map auth and lifecycle errors safely", async () => {
  const denied = await request(
    "/api/v1/device-bridge-worker/commands?clinicId=10000000-0000-4000-8000-000000000001&bridgeCode=br-live-01",
    configuredEnv,
    createRuntime(),
    "GET",
    undefined,
    { authorization: "" },
  );
  assert.equal(denied.status, 401);
  assert.equal(denied.json.error.code, "worker_auth_required");

  const missing = await request(
    "/api/v1/device-bridge-worker/commands/10000000-0000-4000-8000-000000000901",
    configuredEnv,
    createRuntime({
      deviceWorkerError: Object.assign(new Error("missing"), {
        publicCode: "command_not_found",
        publicStatus: 404,
      }),
    }),
    "PATCH",
    JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000001",
      bridgeCode: "br-live-01",
      status: "completed",
    }),
    { authorization: "Bearer stage4s-worker-token" },
  );
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, "command_not_found");
  assert.doesNotMatch(missing.body, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 4U · system_admin reads Device Bridge worker telemetry safely", async () => {
  const auditEvents = [];
  const runtime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/status?workerStatus=online&commandStatus=failed&limit=10",
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4U");
  assert.equal(response.json.summary.bridgeCount, 1);
  assert.equal(response.json.items[0].workerVersion, "stage4t-local-worker");
  assert.equal(response.json.commands[0].status, "failed");
  assert.equal(response.json.filters.workerStatus, "online");
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.doesNotMatch(response.body, /stage4s-worker-token|payload_json|result_json|access_token|storage_object_path|patient_full_name|navigator\./i);
});

test("Stage 4U · Device Bridge worker telemetry denies non-system-admin", async () => {
  const response = await request(
    "/api/v1/device-bridge-worker/status",
    configuredEnv,
    createRuntime(),
  );

  assert.equal(response.status, 403);
  assert.equal(response.json.error.code, "forbidden");
  assert.doesNotMatch(response.body, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 4V · system_admin reads Device Bridge worker hardening safely", async () => {
  const auditEvents = [];
  const runtime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/hardening?staleAfterMinutes=15&retentionDays=45&limit=20",
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4V");
  assert.equal(response.json.summary.staleWorkers, 1);
  assert.equal(response.json.summary.retryingCommands, 2);
  assert.equal(response.json.summary.rateLimitedCommands, 1);
  assert.equal(response.json.policy.retentionDays, 45);
  assert.equal(response.json.filters.staleAfterMinutes, 15);
  assert.equal(response.json.items[0].bridgeCode, "br-live-01");
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.doesNotMatch(response.body, /stage4s-worker-token|payload_json|result_json|access_token|storage_object_path|patient_full_name|navigator\./i);
});

test("Stage 4V · Device Bridge worker hardening denies non-system-admin", async () => {
  const response = await request(
    "/api/v1/device-bridge-worker/hardening",
    configuredEnv,
    createRuntime(),
  );

  assert.equal(response.status, 403);
  assert.equal(response.json.error.code, "forbidden");
  assert.doesNotMatch(response.body, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 4W · system_admin reads Device Bridge command recovery safely", async () => {
  const auditEvents = [];
  const runtime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/recovery?staleAfterMinutes=20&leaseTtlSeconds=120&limit=10",
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4W");
  assert.equal(response.json.summary.stuckCommands, 1);
  assert.equal(response.json.summary.retryableCommands, 1);
  assert.equal(response.json.policy.leaseTtlSeconds, 120);
  assert.equal(response.json.filters.staleAfterMinutes, 20);
  assert.equal(response.json.items[0].recoveryState, "retryable_failed");
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.doesNotMatch(response.body, /stage4s-worker-token|payload_json|result_json|access_token|storage_object_path|patient_full_name|navigator\./i);
});

test("Stage 4W · system_admin reschedules and cancels recoverable commands safely", async () => {
  const runtime = createRuntime({
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const reschedule = await request(
    "/api/v1/device-bridge-worker/commands/10000000-0000-4000-8000-000000000901/recovery",
    configuredEnv,
    runtime,
    "POST",
    JSON.stringify({ action: "reschedule", reason: "Повторить безопасно" }),
  );
  assert.equal(reschedule.status, 200);
  assert.equal(reschedule.json.stage, "4W");
  assert.equal(reschedule.json.recovery.action, "reschedule");
  assert.equal(reschedule.json.command.status, "queued");

  const cancel = await request(
    "/api/v1/device-bridge-worker/commands/10000000-0000-4000-8000-000000000901/recovery",
    configuredEnv,
    runtime,
    "POST",
    JSON.stringify({ action: "cancel", reason: "Отмена оператором" }),
  );
  assert.equal(cancel.status, 200);
  assert.equal(cancel.json.recovery.action, "cancel");
  assert.equal(cancel.json.command.status, "cancelled");
  assert.doesNotMatch(`${reschedule.body}\n${cancel.body}`, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 4W · Device Bridge recovery denies non-system-admin", async () => {
  const list = await request(
    "/api/v1/device-bridge-worker/recovery",
    configuredEnv,
    createRuntime(),
  );
  assert.equal(list.status, 403);
  assert.equal(list.json.error.code, "forbidden");

  const action = await request(
    "/api/v1/device-bridge-worker/commands/10000000-0000-4000-8000-000000000901/recovery",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({ action: "reschedule" }),
  );
  assert.equal(action.status, 403);
  assert.equal(action.json.error.code, "forbidden");
  assert.doesNotMatch(`${list.body}\n${action.body}`, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 4X · system_admin reads Device Bridge command audit safely", async () => {
  const runtime = createRuntime({
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/audit?action=replay&status=queued&limit=10",
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4X");
  assert.equal(response.json.summary.replayEvents, 1);
  assert.equal(response.json.policy.payloadVisibility, "backend-only");
  assert.equal(response.json.filters.action, "replay");
  assert.equal(response.json.items[0].action, "replay");
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.doesNotMatch(response.body, /stage4s-worker-token|metadata_json|payload_json|result_json|access_token|storage_object_path|patient_full_name|navigator\./i);
});

test("Stage 4Y · system_admin exports Device Bridge command audit CSV safely", async () => {
  const runtime = createRuntime({
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/audit/export?action=replay&status=failed&limit=10",
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4Y");
  assert.equal(response.json.export.format, "csv");
  assert.equal(response.json.export.rowCount, 1);
  assert.match(response.json.export.filename, /device-bridge-command-audit-replay-failed-1-rows\.csv/);
  assert.match(response.json.export.content, /# stage,4Y/);
  assert.match(response.json.export.content, /"audit-1","replay"/);
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.doesNotMatch(response.body, /stage4s-worker-token|metadata_json|payload_json|result_json|access_token|storage_object_path|patient_full_name|navigator\./i);
});

test("Stage 8J-8L · system_admin reads Device Bridge production readiness safely", async () => {
  const auditEvents = [];
  const runtime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/production-readiness?limit=10",
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "8J-8L");
  assert.equal(response.json.readiness.policy.managedRuntimeDependency, "none");
  assert.equal(response.json.readiness.policy.managedDatabaseDependency, "none");
  assert.equal(response.json.readiness.policy.payloadVisibility, "backend-only");
  assert.equal(response.json.readiness.summary.bridgeCount, 1);
  assert.ok(response.json.readiness.gates.some((gate) => gate.key === "worker_health"));
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.equal(auditEvents.at(-1).action, "device_bridge.production_readiness.read");
  assert.doesNotMatch(response.body, /stage4s-worker-token|metadata_json|payload_json|result_json|access_token|storage_object_path|patient_full_name|navigator\./i);
});

test("Stage 8J-8L · Device Bridge production readiness denies non-system-admin", async () => {
  const response = await request(
    "/api/v1/device-bridge-worker/production-readiness",
    configuredEnv,
    createRuntime(),
  );

  assert.equal(response.status, 403);
  assert.equal(response.json.error.code, "forbidden");
  assert.doesNotMatch(response.body, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 8P-9A · system_admin reads Device Bridge operations continuity safely", async () => {
  const auditEvents = [];
  const runtime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/operations-continuity",
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "8P-9A");
  assert.equal(response.json.continuity.productBoundary.managedRuntimeDependency, "none");
  assert.equal(response.json.continuity.productBoundary.managedDatabaseDependency, "none");
  assert.equal(response.json.continuity.productBoundary.payloadVisibility, "backend-only");
  assert.equal(response.json.continuity.handoff.nextBatchHypothesis, "Stage 9B-9D");
  assert.equal(response.json.continuity.stages.length, 12);
  assert.ok(response.json.continuity.gates.some((gate) => gate.key === "self_hosted_boundary"));
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.equal(auditEvents.at(-1).action, "device_bridge.operations_continuity.read");
  assert.doesNotMatch(response.body, /stage4s-worker-token|metadata_json|payload_json|result_json|access_token|storage_object_path|patient_full_name|navigator\./i);
});

test("Stage 8P-9A · Device Bridge operations continuity denies non-system-admin", async () => {
  const response = await request(
    "/api/v1/device-bridge-worker/operations-continuity",
    configuredEnv,
    createRuntime(),
  );

  assert.equal(response.status, 403);
  assert.equal(response.json.error.code, "forbidden");
  assert.doesNotMatch(response.body, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 9B-9M · system_admin reads Device Bridge fleet reliability safely", async () => {
  const auditEvents = [];
  const runtime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/fleet-reliability",
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "9B-9M");
  assert.equal(response.json.reliability.productBoundary.managedRuntimeDependency, "none");
  assert.equal(response.json.reliability.productBoundary.managedDatabaseDependency, "none");
  assert.equal(response.json.reliability.productBoundary.payloadVisibility, "backend-only");
  assert.equal(response.json.reliability.handoff.currentBatch, "Stage 9B-9M");
  assert.equal(response.json.reliability.handoff.originalHypothesis, "Stage 9B-9D");
  assert.equal(response.json.reliability.handoff.nextBatchHypothesis, "Stage 9N-9Z");
  assert.equal(response.json.reliability.stages.length, 12);
  assert.ok(response.json.reliability.gates.some((gate) => gate.key === "self_hosted_boundary"));
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.equal(auditEvents.at(-1).action, "device_bridge.fleet_reliability.read");
  assert.doesNotMatch(response.body, /stage4s-worker-token|metadata_json|payload_json|result_json|access_token|storage_object_path|patient_full_name|navigator\./i);
});

test("Stage 9B-9M · Device Bridge fleet reliability denies non-system-admin", async () => {
  const response = await request(
    "/api/v1/device-bridge-worker/fleet-reliability",
    configuredEnv,
    createRuntime(),
  );

  assert.equal(response.status, 403);
  assert.equal(response.json.error.code, "forbidden");
  assert.doesNotMatch(response.body, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 9N-9Z · system_admin reads Device Bridge lifecycle assurance safely", async () => {
  const auditEvents = [];
  const runtime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/lifecycle-assurance",
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "9N-9Z");
  assert.equal(response.json.assurance.productBoundary.managedRuntimeDependency, "none");
  assert.equal(response.json.assurance.productBoundary.managedDatabaseDependency, "none");
  assert.equal(response.json.assurance.productBoundary.payloadVisibility, "backend-only");
  assert.equal(response.json.assurance.handoff.previousBatch, "Stage 9B-9M");
  assert.equal(response.json.assurance.handoff.currentBatch, "Stage 9N-9Z");
  assert.equal(response.json.assurance.handoff.nextBatchHypothesis, "Stage 10A-10L");
  assert.equal(response.json.assurance.stages.length, 13);
  assert.ok(response.json.assurance.gates.some((gate) => gate.key === "self_hosted_boundary"));
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.equal(auditEvents.at(-1).action, "device_bridge.lifecycle_assurance.read");
  assert.doesNotMatch(response.body, /stage4s-worker-token|metadata_json|payload_json|result_json|access_token|storage_object_path|patient_full_name|navigator\./i);
});

test("Stage 9N-9Z · Device Bridge lifecycle assurance denies non-system-admin", async () => {
  const response = await request(
    "/api/v1/device-bridge-worker/lifecycle-assurance",
    configuredEnv,
    createRuntime(),
  );

  assert.equal(response.status, 403);
  assert.equal(response.json.error.code, "forbidden");
  assert.doesNotMatch(response.body, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 4X · system_admin replays a safe command through backend policy", async () => {
  const runtime = createRuntime({
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/device-bridge-worker/commands/10000000-0000-4000-8000-000000000901/replay",
    configuredEnv,
    runtime,
    "POST",
    JSON.stringify({ reason: "Replay safe command" }),
  );

  assert.equal(response.status, 201);
  assert.equal(response.json.stage, "4X");
  assert.equal(response.json.replay.persisted, true);
  assert.equal(response.json.replay.sourceCommandId, "10000000-0000-4000-8000-000000000901");
  assert.equal(response.json.command.status, "queued");
  assert.deepEqual(response.json.auth.roles, ["system_admin"]);
  assert.doesNotMatch(response.body, WORKER_SECRET_ERROR_PATTERN);
});

test("Stage 4X · Device Bridge audit and replay deny non-system-admin", async () => {
  const list = await request(
    "/api/v1/device-bridge-worker/audit",
    configuredEnv,
    createRuntime(),
  );
  assert.equal(list.status, 403);
  assert.equal(list.json.error.code, "forbidden");

  const exportResponse = await request(
    "/api/v1/device-bridge-worker/audit/export",
    configuredEnv,
    createRuntime(),
  );
  assert.equal(exportResponse.status, 403);
  assert.equal(exportResponse.json.error.code, "forbidden");

  const action = await request(
    "/api/v1/device-bridge-worker/commands/10000000-0000-4000-8000-000000000901/replay",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({ reason: "Replay" }),
  );
  assert.equal(action.status, 403);
  assert.equal(action.json.error.code, "forbidden");
  assert.doesNotMatch(`${list.body}\n${exportResponse.body}\n${action.body}`, WORKER_SECRET_ERROR_PATTERN);
});

test("auth login returns a bearer token without leaking password material", async () => {
  const response = await request(
    "/api/v1/auth/login",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({ email: "doctor.demo@example.invalid", password: "demo-password" }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.tokenType, "Bearer");
  assert.equal(response.json.user.displayName, "Demo Doctor");
  assert.equal(response.json.user.roles[0].role, "doctor");
  assert.doesNotMatch(response.body, /demo-password|passwordHash|\$scrypt|secret/i);
});

test("auth me returns role bindings for an authenticated bearer token", async () => {
  const response = await request("/api/v1/auth/me", configuredEnv, createRuntime());

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.user.displayName, "Demo Doctor");
  assert.equal(response.json.user.roles[0].clinicSlug, "demo-clinic");
  assert.equal(response.json.token.expiresAt, 3601);
});

test("patients list returns role-scoped read-only PostgreSQL data and audit metadata", async () => {
  const patients = [
    {
      id: "10000000-0000-4000-8000-000000000201",
      code: "DP-DEMO-0001",
      fullName: "Demo Patient One",
      birthDate: "1984-02-14",
      sex: "female",
      phototype: "II",
      imagingConsent: true,
      clinic: { slug: "demo-clinic", name: "Dermatolog Pro Demo Clinic" },
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:00.000Z",
    },
  ];
  const auditEvents = [];
  const response = await request(
    "/api/v1/patients?limit=1&offset=2&search=Demo",
    configuredEnv,
    createRuntime({ patients, auditEvents }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.limit, 1);
  assert.equal(response.json.offset, 2);
  assert.equal(response.json.search, "Demo");
  assert.equal(response.json.clinicIds[0], "10000000-0000-4000-8000-000000000001");
  assert.equal(response.json.auth.roles[0], "doctor");
  assert.equal(response.json.items[0].fullName, "Demo Patient One");
  assert.equal(auditEvents[0].action, "patient.list");
  assert.doesNotMatch(response.body, /storage_object_path|access_token|postgres:\/\/|secret/i);
});

test("patients list maps database failures to safe JSON errors", async () => {
  const response = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime({
      patientError: new DatabaseUnavailableError(
        "PostgreSQL failed for postgres://user:secret@postgres:5432/app",
      ),
    }),
  );

  assert.equal(response.status, 503);
  assert.equal(response.json.error.code, "database_unavailable");
  assert.equal(
    response.json.error.message,
    "Database is unavailable for the self-hosted backend.",
  );
  assert.doesNotMatch(response.body, /secret|postgres:\/\/user|app/);
});

test("patients list requires auth and rejects roles without patient-read access", async () => {
  const anonymous = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime({ authContext: null }),
  );
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.json.error.code, "auth_required");
  assert.equal(
    anonymous.json.error.message,
    "Authentication is required for this endpoint.",
  );

  const denied = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "operator-1",
        displayName: "Operator",
        roles: ["operator"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
        token: {},
      },
      authError: new ForbiddenError(),
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
  assert.equal(
    denied.json.error.message,
    "The authenticated user does not have access to this resource.",
  );
});

test("patient detail returns role-scoped data and audit event", async () => {
  const auditEvents = [];
  const response = await request(
    "/api/v1/patients/10000000-0000-4000-8000-000000000201",
    configuredEnv,
    createRuntime({
      auditEvents,
      patientDetail: {
        id: "10000000-0000-4000-8000-000000000201",
        code: "DP-DEMO-0001",
        fullName: "Demo Patient One",
        birthDate: "1984-02-14",
        sex: "female",
        phototype: "II",
        imagingConsent: true,
        notes: "detail note",
        clinic: {
          id: "10000000-0000-4000-8000-000000000001",
          slug: "demo-clinic",
          name: "Dermatolog Pro Demo Clinic",
        },
        createdAt: "2026-05-13T00:00:00.000Z",
        updatedAt: "2026-05-13T00:00:00.000Z",
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.item.notes, "detail note");
  assert.equal(auditEvents[0].action, "patient.read");
});

test("patient write routes create, update, and archive with audit-safe responses", async () => {
  const auditEvents = [];
  const basePatient = {
    id: "10000000-0000-4000-8000-000000000201",
    code: "DP-DEMO-0001",
    fullName: "Demo Patient One",
    birthDate: "1984-02-14",
    sex: "female",
    phototype: "II",
    imagingConsent: true,
    notes: null,
    clinic: {
      id: "10000000-0000-4000-8000-000000000001",
      slug: "demo-clinic",
      name: "Dermatolog Pro Demo Clinic",
    },
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
  };
  const runtime = createRuntime({
    auditEvents,
    createdPatient: basePatient,
    updatedPatient: { ...basePatient, fullName: "Updated Patient" },
    archivedPatient: { ...basePatient, deletedAt: "2026-05-13T00:00:00.000Z" },
  });

  const created = await request(
    "/api/v1/patients",
    configuredEnv,
    runtime,
    "POST",
    JSON.stringify({ fullName: "Demo Patient One", birthDate: "1984-02-14" }),
  );
  assert.equal(created.status, 201);
  assert.equal(created.json.stage, "4D");
  assert.equal(created.json.item.id, basePatient.id);

  const updated = await request(
    `/api/v1/patients/${basePatient.id}`,
    configuredEnv,
    runtime,
    "PATCH",
    JSON.stringify({ fullName: "Updated Patient" }),
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.item.fullName, "Updated Patient");

  const archived = await request(
    `/api/v1/patients/${basePatient.id}`,
    configuredEnv,
    runtime,
    "DELETE",
    JSON.stringify({ reason: "duplicate" }),
  );
  assert.equal(archived.status, 200);
  assert.equal(archived.json.archived, true);
  assert.equal(auditEvents.map((event) => event.action).join(","), "patient.create,patient.update,patient.archive");
  assert.doesNotMatch(archived.body, /password_hash|storage_object_path|access_token|postgres:\/\/|secret/i);
});

test("patient write routes validate payload, auth, and clinic scope safely", async () => {
  const invalid = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({ fullName: "Only" }),
  );
  assert.equal(invalid.status, 422);
  assert.equal(invalid.json.error.code, "validation_error");
  assert.equal(invalid.json.error.details[0].field, "fullName");

  const malformed = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
    "{bad json",
  );
  assert.equal(malformed.status, 400);
  assert.equal(malformed.json.error.code, "invalid_json");

  const forbiddenClinic = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000099",
      fullName: "Demo Patient",
    }),
  );
  assert.equal(forbiddenClinic.status, 403);
  assert.equal(forbiddenClinic.json.error.code, "forbidden");
});

test("unknown routes and unsupported methods return the common JSON error shape", async () => {
  const missing = await request("/missing");
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, "not_found");
  assert.equal(typeof missing.json.error.message, "string");
  assert.equal(missing.json.correlationId, "stage4i-local");

  const post = await request("/api/v1/meta", {}, createRuntime(), "POST");
  assert.equal(post.status, 405);
  assert.equal(post.json.error.code, "method_not_allowed");

  const put = await request(
    "/api/v1/patients/10000000-0000-4000-8000-000000000201",
    configuredEnv,
    createRuntime(),
    "PUT",
  );
  assert.equal(put.status, 405);
  assert.equal(put.json.error.code, "method_not_allowed");
});

// =====================================================================
// Stage 4G · self-hosted visit workspace read endpoints
// =====================================================================

function visitWorkspaceRuntime({
  visitsByPatient = [],
  visit = null,
  lesions = [],
  assets = [],
  authContext,
  auditEvents = [],
  authError,
} = {}) {
  return {
    ...createRuntime({ authContext, auditEvents, authError }),
    visitWorkspaceRepository: {
      async listVisitsByPatient() {
        return visitsByPatient;
      },
      async getVisit() {
        return visit;
      },
      async listVisitLesions() {
        return lesions;
      },
      async listVisitAssets() {
        return assets;
      },
    },
  };
}

function visitWorkspaceWriteRuntime({
  updatedVisit = null,
  createdLesion = null,
  updatedLesion = null,
  archivedLesion = null,
  upsertedReport = null,
  authContext,
  auditEvents = [],
  authError,
  writeError = null,
} = {}) {
  return {
    ...visitWorkspaceRuntime({ authContext, auditEvents, authError }),
    visitWorkspaceWriteService: {
      async updateVisit() {
        if (writeError) throw writeError;
        return { visit: updatedVisit, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async createLesion() {
        if (writeError) throw writeError;
        return { lesion: createdLesion, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async updateLesion() {
        if (writeError) throw writeError;
        return { lesion: updatedLesion, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async archiveLesion() {
        if (writeError) throw writeError;
        return { lesion: archivedLesion, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async updateReport() {
        if (writeError) throw writeError;
        return { report: upsertedReport, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
    },
  };
}

function clinicalWorkspaceRuntime({
  assessment = null,
  conclusion = null,
  report = null,
  reportPackage = null,
  photoProtocolRelease = null,
  authContext,
  auditEvents = [],
  authError,
  clinicalError = null,
} = {}) {
  return {
    ...visitWorkspaceRuntime({ authContext, auditEvents, authError }),
    clinicalWorkspaceService: {
      async getAssessment() {
        if (clinicalError) throw clinicalError;
        return { assessment, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async updateAssessment() {
        if (clinicalError) throw clinicalError;
        return { assessment, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async getConclusion() {
        if (clinicalError) throw clinicalError;
        return { conclusion, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async updateConclusion() {
        if (clinicalError) throw clinicalError;
        return { conclusion, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async getReport() {
        if (clinicalError) throw clinicalError;
        return { report, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
    },
    clinicalReportPackageService: {
      async getReportPackage() {
        if (clinicalError) throw clinicalError;
        return { reportPackage, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
    },
    patientPhotoProtocolReleaseService: {
      async prepareRelease() {
        if (clinicalError) throw clinicalError;
        return { release: photoProtocolRelease, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async revokeRelease() {
        if (clinicalError) throw clinicalError;
        return {
          release: { ...photoProtocolRelease, status: "revoked", revokeReason: "Пациент попросил закрыть доступ" },
          scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] },
        };
      },
    },
  };
}

function assetWriteRuntime({
  createdAsset = null,
  download = null,
  authContext,
  auditEvents = [],
  authError,
  assetError = null,
} = {}) {
  return {
    ...visitWorkspaceRuntime({ authContext, auditEvents, authError }),
    assetWriteService: {
      async createVisitAsset() {
        if (assetError) throw assetError;
        return {
          asset: createdAsset,
          scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] },
        };
      },
      async getAssetDownloadUrl() {
        if (assetError) throw assetError;
        return {
          ...download,
          scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] },
        };
      },
      async downloadAsset() {
        if (assetError) throw assetError;
        return {
          asset: download?.asset || {
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: STAGE4G_CLINIC_ID,
            visitId: STAGE4G_VISIT_ID,
            contentType: "image/png",
          },
          object: {
            bytes: Buffer.from("asset-binary"),
            byteSize: Buffer.byteLength("asset-binary"),
            contentType: "image/png",
          },
          scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] },
        };
      },
    },
  };
}

const STAGE4G_VISIT_ID = "10000000-0000-4000-8000-000000000301";
const STAGE4G_PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const STAGE4G_CLINIC_ID = "10000000-0000-4000-8000-000000000001";

test("Stage 4G · GET /api/v1/patients/{id}/visits returns role-scoped read-only data", async () => {
  const auditEvents = [];
  const runtime = visitWorkspaceRuntime({
    auditEvents,
    visitsByPatient: [
      {
        id: STAGE4G_VISIT_ID,
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        doctorUserId: "10000000-0000-4000-8000-000000000101",
        status: "in_progress",
        startedAt: "2026-05-12T09:00:00.000Z",
        signedAt: null,
        chiefComplaint: "follow-up",
        createdAt: "2026-05-12T09:00:00.000Z",
        updatedAt: "2026-05-12T09:00:00.000Z",
      },
    ],
  });
  const response = await request(
    `/api/v1/patients/${STAGE4G_PATIENT_ID}/visits`,
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4G");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.count, 1);
  assert.equal(response.json.items[0].status, "in_progress");
  assert.equal(auditEvents[0].action, "visit.list");
  assert.doesNotMatch(response.body, /password|object_key|signed url|secret/i);
});

test("Stage 4G · GET /api/v1/visits/{id} returns visit detail and audit", async () => {
  const auditEvents = [];
  const runtime = visitWorkspaceRuntime({
    auditEvents,
    visit: {
      id: STAGE4G_VISIT_ID,
      clinicId: STAGE4G_CLINIC_ID,
      patientId: STAGE4G_PATIENT_ID,
      doctorUserId: null,
      status: "in_progress",
      startedAt: "2026-05-12T09:00:00.000Z",
      signedAt: null,
      chiefComplaint: null,
      createdAt: "2026-05-12T09:00:00.000Z",
      updatedAt: "2026-05-12T09:00:00.000Z",
      patient: { id: STAGE4G_PATIENT_ID, fullName: "Demo Patient One", code: "DP-DEMO-0001" },
      clinic: { id: STAGE4G_CLINIC_ID, slug: "demo-clinic", name: "Dermatolog Pro Demo Clinic" },
    },
  });
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}`,
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.item.patient.fullName, "Demo Patient One");
  assert.equal(response.json.item.clinic.slug, "demo-clinic");
  assert.equal(auditEvents[0].action, "visit.read");
});

test("Stage 4G · visit detail returns 404 when not in scope", async () => {
  const runtime = visitWorkspaceRuntime({ visit: null });
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}`,
    configuredEnv,
    runtime,
  );
  assert.equal(response.status, 404);
  assert.equal(response.json.error.code, "visit_not_found");
});

test("Stage 4G · GET /api/v1/visits/{id}/lesions returns lesion list and audit", async () => {
  const auditEvents = [];
  const runtime = visitWorkspaceRuntime({
    auditEvents,
    lesions: [
      {
        id: "lesion-1",
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        visitId: STAGE4G_VISIT_ID,
        label: "L1",
        bodyZone: "спина",
        bodySurface: null,
        status: "active",
        riskLevel: "moderate",
        createdAt: "2026-05-12T09:00:00.000Z",
        updatedAt: "2026-05-12T09:00:00.000Z",
      },
    ],
  });
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/lesions`,
    configuredEnv,
    runtime,
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.items[0].label, "L1");
  assert.equal(auditEvents[0].action, "visit.lesions");
});

test("Stage 4G · GET /api/v1/visits/{id}/assets returns metadata only", async () => {
  const auditEvents = [];
  const runtime = visitWorkspaceRuntime({
    auditEvents,
    assets: [
      {
        id: "asset-1",
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        visitId: STAGE4G_VISIT_ID,
        lesionId: "lesion-1",
        kind: "dermoscopy",
        contentType: "image/jpeg",
        byteSize: 2048,
        capturedAt: "2026-05-12T09:00:00.000Z",
        uploadedBy: "10000000-0000-4000-8000-000000000101",
        createdAt: "2026-05-12T09:00:00.000Z",
      },
    ],
  });
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/assets`,
    configuredEnv,
    runtime,
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.items[0].kind, "dermoscopy");
  assert.doesNotMatch(response.body, /object_bucket|object_key|signed/i);
  assert.equal(auditEvents[0].action, "visit.assets");
});

test("Stage 4G · visit endpoints require auth and reject roles without read scope", async () => {
  const anonymous = await request(
    `/api/v1/patients/${STAGE4G_PATIENT_ID}/visits`,
    configuredEnv,
    visitWorkspaceRuntime({ authContext: null }),
  );
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.json.error.code, "auth_required");

  const denied = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/lesions`,
    configuredEnv,
    visitWorkspaceRuntime({
      authContext: { userId: "u", displayName: "X", roles: ["operator"], clinicIds: [], roleBindings: [], token: {} },
      authError: new ForbiddenError(),
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 4G · invalid uuid in path is rejected with validation error", async () => {
  const response = await request(
    "/api/v1/visits/not-a-uuid/lesions",
    configuredEnv,
    visitWorkspaceRuntime(),
  );
  assert.equal(response.status, 422);
  assert.equal(response.json.error.code, "validation_error");
});

test("Stage 4G · /openapi.stage4g.json documents the new visit workspace endpoints", async () => {
  const response = await request("/openapi.stage4g.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "4G-visit-workspace");
  assert.ok(response.json.paths["/api/v1/patients/{patientId}/visits"]);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}"]);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/lesions"]);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/assets"]);
});

test("Stage 8J-8O · /openapi.stage8j-8o.json documents Device Bridge production readiness", async () => {
  const response = await request("/openapi.stage8j-8o.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "8J-8O-device-ops-hardening");
  assert.ok(response.json.paths["/api/v1/device-bridge-worker/production-readiness"]);
  assert.doesNotMatch(response.body, /SUPABASE_|api-read|api-write|storage_object_path|signed_url|access_token/i);
});

test("Stage 8P-9A · /openapi.stage8p-9a.json documents Device Bridge operations continuity", async () => {
  const response = await request("/openapi.stage8p-9a.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "8P-9A-device-ops-continuity");
  assert.ok(response.json.paths["/api/v1/device-bridge-worker/operations-continuity"]);
  assert.doesNotMatch(response.body, /SUPABASE_|api-read|api-write|storage_object_path|signed_url|access_token/i);
});

test("Stage 9B-9M · /openapi.stage9b-9m.json documents Device Bridge fleet reliability", async () => {
  const response = await request("/openapi.stage9b-9m.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "9B-9M-device-bridge-fleet-reliability");
  assert.ok(response.json.paths["/api/v1/device-bridge-worker/fleet-reliability"]);
  assert.doesNotMatch(response.body, /SUPABASE_|api-read|api-write|storage_object_path|signed_url|access_token/i);
});

test("Stage 9N-9Z · /openapi.stage9n-9z.json documents Device Bridge lifecycle assurance", async () => {
  const response = await request("/openapi.stage9n-9z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "9N-9Z-device-bridge-lifecycle-assurance");
  assert.ok(response.json.paths["/api/v1/device-bridge-worker/lifecycle-assurance"]);
  assert.doesNotMatch(response.body, /SUPABASE_|api-read|api-write|storage_object_path|signed_url|access_token/i);
});

test("Stage 4G · /api/v1/meta exposes current self-hosted capabilities and links", async () => {
  const response = await request("/api/v1/meta", configuredEnv);
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "5T");
  assert.equal(response.json.capabilities.doctorDashboard, "rbac-read-postgres");
  assert.equal(response.json.capabilities.visitSchedule, "rbac-read-postgres");
  assert.equal(response.json.capabilities.leadsAppointments, "rbac-read-write-postgres");
  assert.equal(response.json.capabilities.clinicBookingRequests, "rbac-read-write-postgres");
  assert.equal(response.json.capabilities.clinicBookingSlotConfirmation, "rbac-write-postgres-local-slot-cache");
  assert.equal(response.json.capabilities.externalIntakeImports, "rbac-read-write-postgres-inbound-only-idempotent-redacted-status");
  assert.equal(response.json.capabilities.clinicAvailableSlots, "rbac-read-postgres-local-import-cache");
  assert.equal(response.json.capabilities.patientPortal, "patient-owned-read-postgres");
  assert.equal(response.json.capabilities.patientPortalWrites, "patient-owned-write-postgres");
  assert.equal(response.json.capabilities.visits, "rbac-read-write-postgres");
  assert.equal(response.json.capabilities.lesions, "rbac-read-write-postgres");
  assert.equal(response.json.capabilities.assets, "rbac-read-write-postgres-backend-url-local-object-store");
  assert.equal(response.json.capabilities.observability, "structured-json-logs-redacted-ops-status-runtime-checks");
  assert.equal(response.json.links.openapiStage4G, "/openapi.stage4g.json");
  assert.equal(response.json.links.openapiStage4H, "/openapi.stage4h.json");
  assert.equal(response.json.links.openapiStage4I, "/openapi.stage4i.json");
  assert.equal(response.json.links.openapiStage4J, "/openapi.stage4j.json");
  assert.equal(response.json.links.openapiStage4N, "/openapi.stage4n.json");
  assert.equal(response.json.links.openapiStage4P, "/openapi.stage4p.json");
  assert.equal(response.json.links.openapiStage4Q, "/openapi.stage4q.json");
  assert.equal(response.json.links.openapiStage4R, "/openapi.stage4r.json");
  assert.equal(response.json.links.openapiStage4S, "/openapi.stage4s.json");
  assert.equal(response.json.links.openapiStage4U, "/openapi.stage4u.json");
  assert.equal(response.json.links.openapiStage4V, "/openapi.stage4v.json");
  assert.equal(response.json.links.openapiStage4W, "/openapi.stage4w.json");
  assert.equal(response.json.links.openapiStage4X, "/openapi.stage4x.json");
  assert.equal(response.json.links.openapiStage4Y, "/openapi.stage4y.json");
  assert.equal(response.json.links.openapiStage4Z, "/openapi.stage4z.json");
  assert.equal(response.json.links.openapiStage5I, "/openapi.stage5i.json");
  assert.equal(response.json.links.openapiStage5J, "/openapi.stage5j.json");
  assert.equal(response.json.links.openapiStage5K, "/openapi.stage5k.json");
  assert.equal(response.json.links.openapiStage5L, "/openapi.stage5l.json");
  assert.equal(response.json.links.openapiStage5N, "/openapi.stage5n.json");
  assert.equal(response.json.links.openapiStage5O, "/openapi.stage5o.json");
  assert.equal(response.json.links.openapiStage5P, "/openapi.stage5p.json");
  assert.equal(response.json.links.openapiStage5Q, "/openapi.stage5q.json");
  assert.equal(response.json.links.openapiStage5R, "/openapi.stage5r.json");
  assert.equal(response.json.links.openapiStage5S, "/openapi.stage5s.json");
  assert.equal(response.json.links.openapiStage5T, "/openapi.stage5t.json");
  assert.equal(response.json.links.openapiStage8J8O, "/openapi.stage8j-8o.json");
  assert.equal(response.json.links.openapiStage8P9A, "/openapi.stage8p-9a.json");
  assert.equal(response.json.links.openapiStage9B9M, "/openapi.stage9b-9m.json");
  assert.equal(response.json.links.openapiStage9N9Z, "/openapi.stage9n-9z.json");
  assert.equal(response.json.links.doctorDashboard, "/api/v1/doctor/dashboard");
  assert.equal(response.json.links.leadsAppointments, "/api/v1/leads/appointments");
  assert.equal(response.json.links.createLead, "/api/v1/leads");
  assert.equal(response.json.links.updateLeadStatus, "/api/v1/leads/{leadId}");
  assert.equal(response.json.links.bookLeadAppointment, "/api/v1/leads/{leadId}/book-appointment");
  assert.equal(response.json.links.clinicBookingRequests, "/api/v1/clinic/booking-requests");
  assert.equal(response.json.links.clinicBookingRequest, "/api/v1/clinic/booking-requests/{requestId}");
  assert.equal(response.json.links.bookClinicBookingRequestFromSlot, "/api/v1/clinic/booking-requests/{requestId}/book-from-slot");
  assert.equal(response.json.links.externalBookingImports, "/api/v1/integrations/booking-imports");
  assert.equal(response.json.links.externalBookingImportStatus, "/api/v1/integrations/booking-imports/status");
  assert.equal(response.json.links.clinicAvailableSlots, "/api/v1/clinic/available-slots");
  assert.equal(response.json.links.patientPortal, "/api/v1/me/portal");
  assert.equal(response.json.links.patientPortalReport, "/api/v1/me/reports/{reportId}");
  assert.equal(response.json.links.patientPortalBookingRequests, "/api/v1/me/booking-requests");
  assert.equal(response.json.links.patientPortalReminderPreferences, "/api/v1/me/reminder-preferences");
  assert.equal(response.json.links.visits, "/api/v1/visits");
  assert.equal(response.json.links.opsStatus, "/api/v1/ops/status");
  assert.equal(response.json.links.opsRuntimeChecks, "/api/v1/ops/runtime-checks");
  assert.equal(response.json.links.productReadiness, "/api/v1/product/readiness");
  assert.equal(response.json.links.deviceBridges, "/api/v1/device-bridges");
  assert.equal(response.json.links.deviceBridgeCommands, "/api/v1/device-bridges/{bridgeId}/commands");
  assert.equal(response.json.links.deviceBridgeWorkerHeartbeat, "/api/v1/device-bridge-worker/heartbeat");
  assert.equal(response.json.links.deviceBridgeWorkerCommands, "/api/v1/device-bridge-worker/commands");
  assert.equal(response.json.links.deviceBridgeWorkerStatus, "/api/v1/device-bridge-worker/status");
  assert.equal(response.json.links.deviceBridgeWorkerHardening, "/api/v1/device-bridge-worker/hardening");
  assert.equal(response.json.links.deviceBridgeWorkerRecovery, "/api/v1/device-bridge-worker/recovery");
  assert.equal(response.json.links.deviceBridgeWorkerAudit, "/api/v1/device-bridge-worker/audit");
  assert.equal(response.json.links.deviceBridgeWorkerReplay, "/api/v1/device-bridge-worker/commands/{commandId}/replay");
  assert.equal(response.json.links.deviceBridgeWorkerAuditExport, "/api/v1/device-bridge-worker/audit/export");
  assert.equal(response.json.links.deviceBridgeWorkerProductionReadiness, "/api/v1/device-bridge-worker/production-readiness");
  assert.equal(response.json.links.deviceBridgeWorkerOperationsContinuity, "/api/v1/device-bridge-worker/operations-continuity");
  assert.equal(response.json.links.deviceBridgeWorkerFleetReliability, "/api/v1/device-bridge-worker/fleet-reliability");
  assert.equal(response.json.links.deviceBridgeWorkerLifecycleAssurance, "/api/v1/device-bridge-worker/lifecycle-assurance");
  assert.equal(response.json.links.devices, "/api/v1/devices");
  assert.equal(response.json.links.deviceCommands, "/api/v1/devices/{deviceId}/commands");
  assert.equal(response.json.links.visit, "/api/v1/visits/{visitId}");
  assert.equal(response.json.links.visitReport, "/api/v1/visits/{visitId}/report");
  assert.equal(response.json.links.assetDownloadUrl, "/api/v1/assets/{assetId}/download-url");
  assert.equal(response.json.links.assetDownload, "/api/v1/assets/{assetId}/download");
});

// =====================================================================
// Stage 4I · self-hosted clinical asset write/download-url endpoints
// =====================================================================

test("Stage 4I · POST /api/v1/visits/{id}/assets registers metadata only", async () => {
  const asset = {
    id: "10000000-0000-4000-8000-000000000901",
    clinicId: STAGE4G_CLINIC_ID,
    patientId: STAGE4G_PATIENT_ID,
    visitId: STAGE4G_VISIT_ID,
    lesionId: null,
    kind: "overview_photo",
    contentType: "image/png",
    byteSize: 4096,
    capturedAt: "2026-05-12T09:00:00.000Z",
    uploadedBy: "10000000-0000-4000-8000-000000000101",
    createdAt: "2026-05-12T09:00:01.000Z",
  };
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/assets`,
    configuredEnv,
    assetWriteRuntime({ createdAsset: asset }),
    "POST",
    JSON.stringify({ kind: "overview", contentType: "image/png", byteSize: 4096 }),
  );
  assert.equal(response.status, 201);
  assert.equal(response.json.stage, "4I");
  assert.equal(response.json.item.kind, "overview_photo");
  assert.equal(response.json.upload.objectStorage, "backend-owned");
  assert.doesNotMatch(response.body, /object_bucket|object_key|storage_object_path|signed|access_token/i);
});

test("Stage 4I · GET /api/v1/assets/{id}/download-url returns backend route only", async () => {
  const assetId = "10000000-0000-4000-8000-000000000901";
  const response = await request(
    `/api/v1/assets/${assetId}/download-url?expiresIn=120`,
    configuredEnv,
    assetWriteRuntime({
      download: {
        asset: { id: assetId, clinicId: STAGE4G_CLINIC_ID, visitId: STAGE4G_VISIT_ID },
        download: {
          assetId,
          clinicId: STAGE4G_CLINIC_ID,
          visitId: STAGE4G_VISIT_ID,
          downloadUrl: `/api/v1/assets/${assetId}/download`,
          expiresIn: 120,
          expiresAt: "2026-05-13T00:02:00.000Z",
        },
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4I");
  assert.equal(response.json.item.downloadUrl, `/api/v1/assets/${assetId}/download`);
  assert.equal(response.json.item.expiresIn, 120);
  assert.doesNotMatch(response.body, /object_bucket|object_key|storage_object_path|sig=|access_token/i);
});

test("Stage 4I · /openapi.stage4i.json documents asset write contract", async () => {
  const response = await request("/openapi.stage4i.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "4I-assets-write");
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/assets"].post);
  assert.ok(response.json.paths["/api/v1/assets/{assetId}/download-url"].get);
});

test("Stage 4J · GET /api/v1/assets/{id}/download streams bytes with safe headers", async () => {
  const assetId = "10000000-0000-4000-8000-000000000901";
  const response = await request(
    `/api/v1/assets/${assetId}/download`,
    configuredEnv,
    assetWriteRuntime({
      download: {
        asset: {
          id: assetId,
          clinicId: STAGE4G_CLINIC_ID,
          visitId: STAGE4G_VISIT_ID,
          contentType: "image/png",
        },
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "image/png");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(String(response.body), "asset-binary");
  assert.doesNotMatch(String(response.headers["content-disposition"]), /object|bucket|key|storage/i);
});

// =====================================================================
// Stage 4H · self-hosted visit workspace write endpoints
// =====================================================================

test("Stage 4H · PATCH /api/v1/visits/{id} updates visit JSON fields", async () => {
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}`,
    configuredEnv,
    visitWorkspaceWriteRuntime({
      updatedVisit: {
        id: STAGE4G_VISIT_ID,
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        status: "in_progress",
        chiefComplaint: "контроль динамики",
      },
    }),
    "PATCH",
    JSON.stringify({ chiefComplaint: "контроль динамики" }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4H");
  assert.equal(response.json.item.chiefComplaint, "контроль динамики");
  assert.doesNotMatch(response.body, /password_hash|object_key|access_token|postgres:\/\/|secret/i);
});

test("Stage 4H · lesion create, update and soft archive routes return audit-safe JSON", async () => {
  const lesion = {
    id: "10000000-0000-4000-8000-000000000401",
    clinicId: STAGE4G_CLINIC_ID,
    patientId: STAGE4G_PATIENT_ID,
    visitId: STAGE4G_VISIT_ID,
    label: "L1",
    status: "active",
  };
  const runtime = visitWorkspaceWriteRuntime({
    createdLesion: lesion,
    updatedLesion: { ...lesion, label: "L2", riskLevel: "moderate" },
    archivedLesion: { ...lesion, status: "archived", deletedAt: "2026-05-13T00:00:00.000Z" },
  });

  const created = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/lesions`,
    configuredEnv,
    runtime,
    "POST",
    JSON.stringify({ label: "L1", riskLevel: "moderate" }),
  );
  assert.equal(created.status, 201);
  assert.equal(created.json.item.label, "L1");

  const updated = await request(
    `/api/v1/lesions/${lesion.id}`,
    configuredEnv,
    runtime,
    "PATCH",
    JSON.stringify({ label: "L2" }),
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.item.label, "L2");

  const archived = await request(
    `/api/v1/lesions/${lesion.id}`,
    configuredEnv,
    runtime,
    "DELETE",
    JSON.stringify({ reason: "duplicate" }),
  );
  assert.equal(archived.status, 200);
  assert.equal(archived.json.archived, true);
  assert.equal(archived.json.item.status, "archived");
  assert.doesNotMatch(archived.body, /object_bucket|object_key|signed|storage_object_path/i);
});

test("Stage 4H · PATCH /api/v1/visits/{id}/report upserts report text", async () => {
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/report`,
    configuredEnv,
    visitWorkspaceWriteRuntime({
      upsertedReport: {
        id: "10000000-0000-4000-8000-000000000501",
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        visitId: STAGE4G_VISIT_ID,
        status: "draft",
        physicianText: "Описание для врача",
        patientSafeText: "Рекомендован контроль у врача.",
      },
    }),
    "PATCH",
    JSON.stringify({
      physicianText: "Описание для врача",
      patientSafeText: "Рекомендован контроль у врача.",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4H");
  assert.equal(response.json.item.patientSafeText, "Рекомендован контроль у врача.");
});

test("Stage 4H · write routes validate JSON and RBAC", async () => {
  const malformed = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/report`,
    configuredEnv,
    visitWorkspaceWriteRuntime(),
    "PATCH",
    "{bad json",
  );
  assert.equal(malformed.status, 400);
  assert.equal(malformed.json.error.code, "invalid_json");

  const denied = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}`,
    configuredEnv,
    visitWorkspaceWriteRuntime({
      authContext: { userId: "admin-1", displayName: "Admin", roles: ["clinic_admin"], clinicIds: [STAGE4G_CLINIC_ID], roleBindings: [], token: {} },
      authError: new ForbiddenError(),
    }),
    "PATCH",
    JSON.stringify({ chiefComplaint: "x" }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 4H · /openapi.stage4h.json documents write endpoints", async () => {
  const response = await request("/openapi.stage4h.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "4H-visit-workspace-writes");
  assert.ok(response.json.paths["/api/v1/visits/{visitId}"].patch);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/lesions"].post);
  assert.ok(response.json.paths["/api/v1/lesions/{lesionId}"].delete);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/report"].patch);
});

// =====================================================================
// Stage 5H · production clinical workspace contracts
// =====================================================================

test("Stage 5H · assessment and conclusion contracts read/write via self-hosted backend", async () => {
  const assessment = {
    id: "10000000-0000-4000-8000-000000000701",
    clinicId: STAGE4G_CLINIC_ID,
    patientId: STAGE4G_PATIENT_ID,
    visitId: STAGE4G_VISIT_ID,
    status: "ready",
    riskLevel: "moderate",
    summary: "Нужен контроль динамики.",
  };
  const conclusion = {
    id: "10000000-0000-4000-8000-000000000702",
    clinicId: STAGE4G_CLINIC_ID,
    patientId: STAGE4G_PATIENT_ID,
    visitId: STAGE4G_VISIT_ID,
    status: "ready",
    summary: "Плановое наблюдение.",
  };
  const runtime = clinicalWorkspaceRuntime({ assessment, conclusion });

  const readAssessment = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/assessment`,
    configuredEnv,
    runtime,
  );
  assert.equal(readAssessment.status, 200);
  assert.equal(readAssessment.json.stage, "5H");
  assert.equal(readAssessment.json.item.summary, "Нужен контроль динамики.");

  const writeAssessment = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/assessment`,
    configuredEnv,
    runtime,
    "PATCH",
    JSON.stringify({ status: "ready", summary: "Нужен контроль динамики." }),
  );
  assert.equal(writeAssessment.status, 200);
  assert.equal(writeAssessment.json.item.riskLevel, "moderate");

  const writeConclusion = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/conclusion`,
    configuredEnv,
    runtime,
    "PATCH",
    JSON.stringify({ status: "ready", summary: "Плановое наблюдение." }),
  );
  assert.equal(writeConclusion.status, 200);
  assert.equal(writeConclusion.json.stage, "5H");
  assert.equal(writeConclusion.json.item.summary, "Плановое наблюдение.");
  assert.doesNotMatch(writeConclusion.body, /storage_object_path|signed_url|access_token|postgres:\/\/|secret/i);
});

test("Stage 5H · GET /api/v1/visits/{id}/report reads report without exposing protected fields", async () => {
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/report`,
    configuredEnv,
    clinicalWorkspaceRuntime({
      report: {
        id: "10000000-0000-4000-8000-000000000703",
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        visitId: STAGE4G_VISIT_ID,
        status: "draft",
        physicianText: "Описание для врача",
        patientSafeText: "Пациенту рекомендован контроль.",
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "5H");
  assert.equal(response.json.item.patientSafeText, "Пациенту рекомендован контроль.");
  assert.doesNotMatch(response.body, /object_bucket|object_key|storage_object_path|signed_url|access_token/i);
});

test("Stage 5H · /openapi.stage5h.json documents production clinical contracts", async () => {
  const response = await request("/openapi.stage5h.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5H-clinical-workspace-contracts");
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/assessment"].get);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/conclusion"].patch);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/report"].get);
});

test("Stage 8G-8I · GET /api/v1/visits/{id}/report-package returns readiness without protected fields", async () => {
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/report-package`,
    configuredEnv,
    clinicalWorkspaceRuntime({
      reportPackage: {
        visitId: STAGE4G_VISIT_ID,
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        visitStatus: "signed",
        assessment: { status: "ready", summaryPresent: true },
        conclusion: { status: "signed", summaryPresent: true },
        report: {
          status: "signed",
          physicianTextPresent: true,
          patientSafeTextPresent: true,
        },
        counts: { lesions: 2, assets: 3 },
        readiness: {
          ready: true,
          status: "ready",
          completionPercent: 100,
          missing: [],
          exportAllowed: true,
          patientDeliveryAllowed: true,
        },
        patientPhotoProtocol: {
          brainstormTask: "SD-MF-046",
          status: "metadata_ready_backend_blocked",
          readyForBackendContract: true,
          selectedPhotoCount: 2,
          counts: {
            selectedPhotos: 2,
            overviewPhotos: 1,
            dermoscopyPhotos: 1,
            reportAttachments: 1,
          },
          missing: ["self_hosted_photo_delivery_contract_missing"],
          deliveryBoundary: {
            patientDeliveryAllowed: false,
            rawFilesExposed: false,
            signedUrlsIssued: false,
            storagePathsExposed: false,
            tokensExposed: false,
            physicianTextExposed: false,
            requiresSelfHostedFileProxy: true,
            requiresReleaseAudit: true,
            requiresRevoke: true,
            requiresIdentityCheck: true,
          },
        },
        productBoundary: {
          managedRuntimeDependency: "none",
          managedDatabaseDependency: "none",
          externalRuntimeCalls: false,
          rawPatientDataInReport: false,
        },
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "8G-8I");
  assert.equal(response.json.item.readiness.status, "ready");
  assert.equal(response.json.item.counts.assets, 3);
  assert.equal(response.json.item.patientPhotoProtocol.brainstormTask, "SD-MF-046");
  assert.equal(response.json.item.patientPhotoProtocol.deliveryBoundary.patientDeliveryAllowed, false);
  assert.doesNotMatch(response.body, /object_bucket|object_key|storage_object_path|signed_url|access_token|patientFullName|physician_text/i);
});

test("Batch R · patient photo protocol release prepare/revoke persists metadata only", async () => {
  const photoProtocolRelease = {
    id: "20000000-0000-4000-8000-000000000001",
    clinicId: STAGE4G_CLINIC_ID,
    patientId: STAGE4G_PATIENT_ID,
    visitId: STAGE4G_VISIT_ID,
    reportId: "30000000-0000-4000-8000-000000000001",
    status: "prepared",
    selectedPhotoCount: 2,
    counts: {
      selectedPhotos: 2,
      overviewPhotos: 1,
      dermoscopyPhotos: 1,
      reportAttachments: 0,
    },
    blockers: ["self_hosted_photo_delivery_contract_missing"],
    preparedAt: "2026-05-31T09:30:00.000Z",
    revokedAt: null,
    revokeReason: null,
    expiresAt: "2026-06-07T10:00:00.000Z",
    deliveryBoundary: {
      patientDeliveryAllowed: false,
      rawFilesExposed: false,
      signedUrlsIssued: false,
      storagePathsExposed: false,
      tokensExposed: false,
      physicianTextExposed: false,
      requiresSelfHostedFileProxy: true,
      requiresReleaseAudit: true,
      requiresRevoke: true,
      requiresIdentityCheck: true,
      requiresRetentionPolicy: true,
    },
  };
  const prepare = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/patient-photo-protocol-release`,
    configuredEnv,
    clinicalWorkspaceRuntime({ photoProtocolRelease }),
    "POST",
    JSON.stringify({ expiresAt: "2026-06-07T10:00:00.000Z" }),
  );
  assert.equal(prepare.status, 200);
  assert.equal(prepare.json.item.status, "prepared");
  assert.equal(prepare.json.item.deliveryBoundary.patientDeliveryAllowed, false);
  assert.equal(prepare.json.item.selectedPhotoCount, 2);
  assert.doesNotMatch(prepare.body, /object_bucket|object_key|storage_object_path|signed_url|access_token|preparedByUserId|physician_text/i);

  const revoke = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/patient-photo-protocol-release/revoke`,
    configuredEnv,
    clinicalWorkspaceRuntime({ photoProtocolRelease }),
    "POST",
    JSON.stringify({ reason: "Пациент попросил закрыть доступ" }),
  );
  assert.equal(revoke.status, 200);
  assert.equal(revoke.json.item.status, "revoked");
  assert.equal(revoke.json.item.revokeReason, "Пациент попросил закрыть доступ");
  assert.doesNotMatch(revoke.body, /object_bucket|object_key|storage_object_path|signed_url|access_token|revokedByUserId|physician_text/i);
});

test("Stage 8G-8I · /openapi.stage8g-8i.json documents clinical report package", async () => {
  const response = await request("/openapi.stage8g-8i.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "8G-8I-clinical-reporting-completion");
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/report-package"].get);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/patient-photo-protocol-release"].post);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/patient-photo-protocol-release/revoke"].post);
});

// =====================================================================
// Stage 5I · production doctor dashboard contracts
// =====================================================================

test("Stage 5I · GET /api/v1/doctor/dashboard returns PostgreSQL dashboard safely", async () => {
  const response = await request(
    "/api/v1/doctor/dashboard",
    configuredEnv,
    createRuntime({
      doctorDashboard: {
        kpis: {
          visitsToday: 2,
          activeVisits: 3,
          awaitingConclusion: 1,
          patientsInScope: 8,
          assetsNeedReview: 4,
          devicesTotal: 2,
          devicesActive30d: 1,
        },
        upcoming: [{
          id: STAGE4G_VISIT_ID,
          patientId: STAGE4G_PATIENT_ID,
          patientFullName: "Live Patient",
          patientCode: "DP-LIVE-1",
          status: "in_progress",
        }],
        awaitingConclusions: [],
        recentPatients: [],
        assetIssues: [{
          id: "asset-live-1",
          visitId: STAGE4G_VISIT_ID,
          patientId: STAGE4G_PATIENT_ID,
          patientFullName: "Live Patient",
          kind: "dermoscopy",
          issue: "checksum_missing",
        }],
        devices: [{ id: "device-live-1", model: "DermLite", serial: "DL-LIVE", status: "active" }],
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "5I");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.dashboard.kpis.visitsToday, 2);
  assert.equal(response.json.dashboard.upcoming[0].patientFullName, "Live Patient");
  assert.doesNotMatch(response.body, /object_bucket|object_key|storage_object_path|signed_url|access_token|postgres:\/\/|secret/i);
});

test("Stage 5I · /openapi.stage5i.json documents doctor dashboard contract", async () => {
  const response = await request("/openapi.stage5i.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5I-doctor-dashboard-contracts");
  assert.ok(response.json.paths["/api/v1/doctor/dashboard"].get);
});

test("Stage 5J · GET /api/v1/visits returns PostgreSQL schedule safely", async () => {
  const response = await request(
    "/api/v1/visits?status=draft&dateFrom=2026-05-01&dateTo=2026-05-31&search=Live",
    configuredEnv,
    createRuntime({
      visitSchedule: {
        items: [{
          id: "10000000-0000-4000-8000-000000000301",
          clinicId: STAGE4G_CLINIC_ID,
          patientId: STAGE4G_PATIENT_ID,
          doctorUserId: "10000000-0000-4000-8000-000000000101",
          status: "draft",
          startedAt: "2026-05-15T09:00:00.000Z",
          signedAt: null,
          chiefComplaint: "Live schedule",
          patient: { id: STAGE4G_PATIENT_ID, fullName: "Live Patient", code: "DP-LIVE" },
          clinic: { id: STAGE4G_CLINIC_ID, slug: "main", name: "Live Clinic" },
        }],
        count: 1,
        limit: 50,
        offset: 0,
        filters: { status: "draft", dateFrom: "2026-05-01", dateTo: "2026-05-31", search: "Live" },
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "5J");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.items[0].patient.fullName, "Live Patient");
  assert.equal(response.json.filters.status, "draft");
  assert.doesNotMatch(response.body, /object_bucket|object_key|storage_object_path|signed_url|access_token|postgres:\/\/|secret/i);
});

test("Stage 5J · /openapi.stage5j.json documents visit schedule contract", async () => {
  const response = await request("/openapi.stage5j.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5J-visit-schedule-contracts");
  assert.ok(response.json.paths["/api/v1/visits"].get);
});

test("Stage 5K · GET /api/v1/leads/appointments returns PostgreSQL overview safely", async () => {
  const response = await request(
    "/api/v1/leads/appointments?leadStatus=new&appointmentStatus=planned&dateFrom=2026-05-01&search=Live",
    configuredEnv,
    createRuntime({
      leadsAppointments: {
        kpis: {
          leadsTotal: 2,
          newLeads: 1,
          qualifiedLeads: 1,
          bookedLeads: 0,
          plannedAppointments: 3,
          completedAppointments: 1,
        },
        leads: [{
          id: "10000000-0000-4000-8000-000000000701",
          clinicId: STAGE4G_CLINIC_ID,
          patientId: null,
          source: "site",
          status: "new",
          safeSummary: "Live lead",
          createdAt: "2026-05-15T08:00:00.000Z",
          patient: { id: null, fullName: null, code: null },
          clinic: { id: STAGE4G_CLINIC_ID, slug: "main", name: "Live Clinic" },
        }],
        appointments: [{
          id: STAGE4G_VISIT_ID,
          visitId: STAGE4G_VISIT_ID,
          clinicId: STAGE4G_CLINIC_ID,
          patientId: STAGE4G_PATIENT_ID,
          doctorUserId: "10000000-0000-4000-8000-000000000101",
          status: "planned",
          channel: "self_hosted",
          slotAt: "2026-05-15T09:00:00.000Z",
          patient: { id: STAGE4G_PATIENT_ID, fullName: "Live Patient", code: "DP-LIVE" },
          clinic: { id: STAGE4G_CLINIC_ID, slug: "main", name: "Live Clinic" },
        }],
        filters: { leadStatus: "new", appointmentStatus: "planned", dateFrom: "2026-05-01", dateTo: null, search: "Live" },
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "5K");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.kpis.newLeads, 1);
  assert.equal(response.json.leads[0].safeSummary, "Live lead");
  assert.equal(response.json.appointments[0].patient.fullName, "Live Patient");
  assert.doesNotMatch(response.body, /object_bucket|object_key|storage_object_path|signed_url|access_token|postgres:\/\/|secret/i);
});

test("Stage 5K · /openapi.stage5k.json documents leads appointments contract", async () => {
  const response = await request("/openapi.stage5k.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5K-leads-appointments-contracts");
  assert.ok(response.json.paths["/api/v1/leads/appointments"].get);
});

test("Stage 5L · lead write endpoints create, qualify and book safely", async () => {
  const runtime = createRuntime();
  const leadId = "10000000-0000-4000-8000-000000000701";

  const create = await request(
    "/api/v1/leads",
    configuredEnv,
    runtime,
    "POST",
    { source: "site", safeSummary: "Live intake lead" },
  );
  assert.equal(create.status, 201);
  assert.equal(create.json.stage, "5L");
  assert.equal(create.json.item.status, "new");

  const qualify = await request(
    `/api/v1/leads/${leadId}`,
    configuredEnv,
    runtime,
    "PATCH",
    { status: "qualified" },
  );
  assert.equal(qualify.status, 200);
  assert.equal(qualify.json.item.status, "qualified");

  const book = await request(
    `/api/v1/leads/${leadId}/book-appointment`,
    configuredEnv,
    runtime,
    "POST",
    {
      patientId: "10000000-0000-4000-8000-000000000201",
      doctorUserId: "10000000-0000-4000-8000-000000000101",
      startedAt: "2026-05-20T09:00:00.000Z",
      chiefComplaint: "Screening visit",
    },
  );
  assert.equal(book.status, 201);
  assert.equal(book.json.item.status, "booked");
  assert.equal(book.json.appointment.status, "planned");
  assert.doesNotMatch(book.body, /object_bucket|object_key|storage_object_path|signed_url|access_token|postgres:\/\/|secret/i);
});

test("Stage 5L · lead write endpoints map validation and RBAC errors safely", async () => {
  const validation = await request(
    "/api/v1/leads",
    configuredEnv,
    createRuntime({
      leadsAppointmentsWriteError: Object.assign(new Error("validation"), {
        publicCode: "validation_error",
        publicStatus: 422,
        publicDetails: [{ field: "safeSummary", message: "Safe summary is required." }],
      }),
    }),
    "POST",
    { source: "unsupported", safeSummary: "" },
  );
  assert.equal(validation.status, 422);
  assert.equal(validation.json.error.code, "validation_error");

  const denied = await request(
    "/api/v1/leads",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000601",
        roles: ["assistant"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
      },
      leadsAppointmentsWriteError: new ForbiddenError("Lead write access denied."),
    }),
    "POST",
    { source: "operator", safeSummary: "Assistant should not write" },
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 5L · /openapi.stage5l.json documents lead write contracts", async () => {
  const response = await request("/openapi.stage5l.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5L-leads-appointments-writes");
  assert.ok(response.json.paths["/api/v1/leads"].post);
  assert.ok(response.json.paths["/api/v1/leads/{leadId}"].patch);
  assert.ok(response.json.paths["/api/v1/leads/{leadId}/book-appointment"].post);
});

test("Stage 5N · patient portal overview/report endpoints return patient-safe data", async () => {
  const authContext = {
    userId: "10000000-0000-4000-8000-000000000901",
    roles: ["patient"],
    clinicIds: [],
    roleBindings: [{ role: "patient", clinicId: null, clinicSlug: null }],
  };
  const runtime = createRuntime({
    authContext,
    patientPortalOverview: {
      patient: {
        id: "10000000-0000-4000-8000-000000000201",
        fullName: "Live Patient",
        clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
      },
      nextAppointment: { id: "10000000-0000-4000-8000-000000000301", startedAt: "2026-06-01T10:00:00.000Z" },
      reports: [{
        id: "10000000-0000-4000-8000-000000000401",
        patientSafeText: "Patient-safe text",
      }],
      reminders: [{ id: "rem-1", title: "Ближайший приём" }],
    },
    patientPortalReport: {
      id: "10000000-0000-4000-8000-000000000401",
      patientSafeText: "Patient-safe text",
      clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
    },
  });

  const overview = await request("/api/v1/me/portal", configuredEnv, runtime);
  assert.equal(overview.status, 200);
  assert.equal(overview.json.stage, "5N");
  assert.equal(overview.json.portal.patient.fullName, "Live Patient");
  assert.equal(overview.json.portal.reports[0].patientSafeText, "Patient-safe text");
  assert.doesNotMatch(overview.body, /physicianText|physician_text|storage_object_path|signed_url|access_token/i);

  const report = await request(
    "/api/v1/me/reports/10000000-0000-4000-8000-000000000401",
    configuredEnv,
    runtime,
  );
  assert.equal(report.status, 200);
  assert.equal(report.json.item.patientSafeText, "Patient-safe text");
  assert.doesNotMatch(report.body, /physicianText|physician_text|storage_object_path|signed_url|access_token/i);

  const photoProtocol = await request(
    "/api/v1/me/photo-protocols/10000000-0000-4000-8000-000000000301",
    configuredEnv,
    runtime,
  );
  assert.equal(photoProtocol.status, 200);
  assert.equal(photoProtocol.json.stage, "5N");
  assert.equal(photoProtocol.json.item.deliveryBoundary.patientDeliveryAllowed, false);
  assert.equal(photoProtocol.json.item.photos[0].previewAvailable, false);
  assert.doesNotMatch(
    photoProtocol.body,
    /physicianText|physician_text|storage_object_path|object_bucket|object_key|checksum_sha256|signed_url|access_token/i,
  );

  const photoDownload = await request(
    "/api/v1/me/photo-protocols/10000000-0000-4000-8000-000000000301/photos/1/download",
    configuredEnv,
    runtime,
  );
  assert.equal(photoDownload.status, 200);
  assert.equal(photoDownload.headers["content-type"], "image/jpeg");
  assert.equal(photoDownload.headers["cache-control"], "no-store");
  assert.equal(photoDownload.headers["content-disposition"], 'inline; filename="photo-protocol-1.jpg"');
  assert.equal(String(photoDownload.body), "patient-photo");
  assert.doesNotMatch(
    String(photoDownload.body) + JSON.stringify(photoDownload.headers),
    /physicianText|physician_text|storage_object_path|object_bucket|object_key|checksum_sha256|signed_url|access_token/i,
  );
});

test("Stage 5N · patient portal endpoint maps forbidden access safely", async () => {
  const denied = await request(
    "/api/v1/me/portal",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000101",
        roles: ["doctor"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
      },
      patientPortalError: new ForbiddenError("Patient portal access denied."),
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 5N · /openapi.stage5n.json documents patient portal contracts", async () => {
  const response = await request("/openapi.stage5n.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5N-patient-portal");
  assert.ok(response.json.paths["/api/v1/me/portal"].get);
  assert.ok(response.json.paths["/api/v1/me/reports/{reportId}"].get);
  assert.ok(response.json.paths["/api/v1/me/photo-protocols/{visitId}"].get);
  assert.ok(response.json.paths["/api/v1/me/photo-protocols/{visitId}/photos/{sequence}/download"].get);
});

test("Stage 5O · patient portal write endpoints create booking requests and update reminder preferences", async () => {
  const authContext = {
    userId: "10000000-0000-4000-8000-000000000901",
    roles: ["patient"],
    clinicIds: [],
    roleBindings: [{ role: "patient", clinicId: null, clinicSlug: null }],
  };
  const runtime = createRuntime({
    authContext,
    patientPortalBookingRequest: {
      id: "10000000-0000-4000-8000-000000000501",
      status: "requested",
      preferredFrom: "2026-06-15T10:00:00.000Z",
      reason: "Плановый контроль",
      clinic: { id: "10000000-0000-4000-8000-000000000001", name: "Live Clinic" },
    },
    patientPortalReminderPreferences: {
      appointmentRemindersEnabled: false,
      reportNotificationsEnabled: true,
      preferredChannel: "phone",
      updatedAt: "2026-05-01T10:00:00.000Z",
    },
  });

  const booking = await request(
    "/api/v1/me/booking-requests",
    configuredEnv,
    runtime,
    "POST",
    {
      preferredFrom: "2026-06-15T10:00:00.000Z",
      reason: "Плановый контроль",
    },
  );
  assert.equal(booking.status, 201);
  assert.equal(booking.json.stage, "5O");
  assert.equal(booking.json.item.status, "requested");
  assert.doesNotMatch(booking.body, /physicianText|physician_text|storage_object_path|signed_url|access_token/i);

  const preferences = await request(
    "/api/v1/me/reminder-preferences",
    configuredEnv,
    runtime,
    "PATCH",
    {
      appointmentRemindersEnabled: false,
      reportNotificationsEnabled: true,
      preferredChannel: "phone",
    },
  );
  assert.equal(preferences.status, 200);
  assert.equal(preferences.json.stage, "5O");
  assert.equal(preferences.json.item.preferredChannel, "phone");
  assert.equal(preferences.json.item.appointmentRemindersEnabled, false);
});

test("Stage 5O · patient portal write endpoints map forbidden access safely", async () => {
  const denied = await request(
    "/api/v1/me/booking-requests",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000101",
        roles: ["doctor"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
      },
      patientPortalError: new ForbiddenError("Patient portal access denied."),
    }),
    "POST",
    {
      preferredFrom: "2026-06-15T10:00:00.000Z",
      reason: "Плановый контроль",
    },
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 5O · /openapi.stage5o.json documents patient portal write contracts", async () => {
  const response = await request("/openapi.stage5o.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5O-patient-portal-writes");
  assert.ok(response.json.paths["/api/v1/me/booking-requests"].post);
  assert.ok(response.json.paths["/api/v1/me/reminder-preferences"].patch);
});

test("Stage 17A-17Z · clinical follow-up routes support staff and patient communication", async () => {
  const runtime = createRuntime();
  const list = await request("/api/v1/clinical/follow-ups?status=sent", configuredEnv, runtime);
  assert.equal(list.status, 200);
  assert.equal(list.json.stage, "17A-17Z");
  assert.equal(list.json.items[0].reason, "Контроль после визита");
  assert.equal(list.json.items[0].internalNote, "Doctor-only follow-up note");

  const created = await request(
    "/api/v1/visits/10000000-0000-4000-8000-000000000301/follow-ups",
    configuredEnv,
    runtime,
    "POST",
    {
      dueAt: "2026-06-10T10:00:00.000Z",
      reason: "Контроль после визита",
      patientSummary: "Patient-safe follow-up summary",
    },
  );
  assert.equal(created.status, 201);
  assert.equal(created.json.item.status, "planned");

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701",
    configuredEnv,
    runtime,
    "PATCH",
    { status: "completed" },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.item.status, "completed");

  const message = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/messages",
    configuredEnv,
    runtime,
    "POST",
    { body: "Контроль назначен." },
  );
  assert.equal(message.status, 201);
  assert.equal(message.json.item.direction, "clinic_to_patient");
  assert.doesNotMatch(message.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url/i);
});

test("Stage 17A-17Z · patient follow-up routes hide internal notes and accept replies", async () => {
  const authContext = {
    userId: "10000000-0000-4000-8000-000000000901",
    roles: ["patient"],
    clinicIds: [],
    roleBindings: [{ role: "patient", clinicId: null, clinicSlug: null }],
  };
  const runtime = createRuntime({ authContext });

  const list = await request("/api/v1/me/follow-ups", configuredEnv, runtime);
  assert.equal(list.status, 200);
  assert.equal(list.json.stage, "17A-17Z");
  assert.equal(list.json.items[0].patientSummary, "Patient-safe follow-up summary");
  assert.doesNotMatch(list.body, /internalNote|Doctor-only|storage_object_path|signed_url|access_token/i);

  const reply = await request(
    "/api/v1/me/follow-ups/10000000-0000-4000-8000-000000000701/messages",
    configuredEnv,
    runtime,
    "POST",
    { body: "Ответ пациента." },
  );
  assert.equal(reply.status, 201);
  assert.equal(reply.json.item.direction, "patient_to_clinic");
});

test("Stage 17A-17Z · /openapi.stage17a-17z.json documents follow-up communication", async () => {
  const response = await request("/openapi.stage17a-17z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "17A-17Z-clinical-followup-communication");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups"].get);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/follow-ups"].post);
  assert.ok(response.json.paths["/api/v1/me/follow-ups/{followUpId}/messages"].post);
});

test("Stage 18A-18Z · follow-up operations routes list, summarize, and update local queue", async () => {
  const runtime = createRuntime();
  const list = await request(
    "/api/v1/clinical/follow-ups/operations?triageState=escalated&overdueOnly=true",
    configuredEnv,
    runtime,
  );
  assert.equal(list.status, 200);
  assert.equal(list.json.stage, "18A-18Z");
  assert.equal(list.json.items[0].triageState, "escalated");
  assert.equal(list.json.items[0].deliveryState, "failed");

  const summary = await request(
    "/api/v1/clinical/follow-ups/operations/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.item.overdue, 1);
  assert.equal(summary.json.item.deliveryFailed, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/operations",
    configuredEnv,
    runtime,
    "PATCH",
    {
      triageState: "resolved",
      deliveryState: "delivered",
      deliveryEvidence: { channel: "portal", state: "confirmed" },
      operationsNote: "Closed locally.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.item.triageState, "resolved");
  assert.equal(updated.json.item.deliveryState, "delivered");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token/i);
});

test("Stage 18A-18Z · /openapi.stage18a-18z.json documents operations hardening", async () => {
  const response = await request("/openapi.stage18a-18z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "18A-18Z-clinical-followup-operations-hardening");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/operations"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/operations/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/operations"].patch);
});

test("Stage 19A-19Z · follow-up outcome quality routes summarize and update local QA state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/outcomes/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "19A-19Z");
  assert.equal(summary.json.item.closedMissingEvidence, 1);
  assert.equal(summary.json.item.qualityNeedsAttention, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/quality",
    configuredEnv,
    runtime,
    "PATCH",
    {
      resolutionOutcome: "patient_reached",
      qualityReviewState: "reviewed",
      qualityReviewNote: "QA ok.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "19A-19Z");
  assert.equal(updated.json.item.qualityReviewState, "reviewed");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token/i);
});

test("Stage 19A-19Z · /openapi.stage19a-19z.json documents outcome quality", async () => {
  const response = await request("/openapi.stage19a-19z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "19A-19Z-clinical-followup-outcome-quality");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/outcomes/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/quality"].patch);
});

test("Stage 20A-20Z · follow-up retention and clinic review routes summarize and update local review state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/clinic-review/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "20A-20Z");
  assert.equal(summary.json.item.retentionDue, 1);
  assert.equal(summary.json.item.clinicNeedsPolicyReview, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/clinic-review",
    configuredEnv,
    runtime,
    "PATCH",
    {
      retentionReviewState: "reviewed",
      retentionReviewNote: "Retention ok.",
      clinicReviewState: "completed",
      clinicReviewNote: "Clinic review complete.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "20A-20Z");
  assert.equal(updated.json.item.retentionReviewState, "reviewed");
  assert.equal(updated.json.item.clinicReviewState, "completed");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token/i);
});

test("Stage 20A-20Z · /openapi.stage20a-20z.json documents retention and clinic review", async () => {
  const response = await request("/openapi.stage20a-20z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "20A-20Z-clinical-followup-retention-clinic-review");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/clinic-review/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/clinic-review"].patch);
});

test("Stage 21A-21Z · follow-up SOP validation routes summarize and update local SOP state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-validation/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "21A-21Z");
  assert.equal(summary.json.item.sopRequired, 2);
  assert.equal(summary.json.item.localSopEvents, 2);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-validation",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopValidationState: "validated",
      sopPolicyVersion: "clinic-local-v1",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "21A-21Z");
  assert.equal(updated.json.item.sopValidationState, "validated");
  assert.equal(updated.json.item.sopPolicyVersion, "clinic-local-v1");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token/i);
});

test("Stage 21A-21Z · /openapi.stage21a-21z.json documents SOP validation", async () => {
  const response = await request("/openapi.stage21a-21z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "21A-21Z-clinical-followup-sop-validation");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-validation/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-validation"].patch);
});

test("Stage 22A-22Z · SOP policy template routes manage local clinic templates", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-templates/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "22A-22Z");
  assert.equal(summary.json.item.activeTemplates, 1);
  assert.equal(summary.json.item.localPolicyEvents, 3);

  const list = await request(
    "/api/v1/clinical/follow-ups/sop-policy-templates?activeOnly=true",
    configuredEnv,
    runtime,
  );
  assert.equal(list.status, 200);
  assert.equal(list.json.stage, "22A-22Z");
  assert.equal(list.json.items[0].code, "followup-standard");

  const created = await request(
    "/api/v1/clinical/follow-ups/sop-policy-templates",
    configuredEnv,
    runtime,
    "POST",
    {
      code: "followup-standard",
      title: "Follow-up standard SOP",
      version: "clinic-local-v1",
      requiredValidationStates: ["required", "blocked"],
      defaultValidationState: "required",
      active: true,
    },
  );
  assert.equal(created.status, 201);
  assert.equal(created.json.stage, "22A-22Z");
  assert.equal(created.json.item.version, "clinic-local-v1");

  const updated = await request(
    "/api/v1/clinical/follow-ups/sop-policy-templates/10000000-0000-4000-8000-000000000901",
    configuredEnv,
    runtime,
    "PATCH",
    {
      version: "clinic-local-v2",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "22A-22Z");
  assert.equal(updated.json.item.version, "clinic-local-v2");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token/i);
});

test("Stage 22A-22Z · /openapi.stage22a-22z.json documents SOP policy templates", async () => {
  const response = await request("/openapi.stage22a-22z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "22A-22Z-clinical-followup-sop-policy-templates");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-templates/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-templates"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-templates"].post);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-templates/{templateId}"].patch);
});

test("Stage 23A-23Z · SOP policy application routes apply local template metadata", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-application/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "23A-23Z");
  assert.equal(summary.json.item.needsPolicyApplication, 1);
  assert.equal(summary.json.item.reviewRequired, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-application",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyTemplateId: "10000000-0000-4000-8000-000000000901",
      sopPolicyDriftState: "in_sync",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "23A-23Z");
  assert.equal(updated.json.item.sopPolicyTemplateCode, "followup-standard");
  assert.equal(updated.json.item.sopPolicyDriftState, "in_sync");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external SOP approval/i);
});

test("Stage 23A-23Z · /openapi.stage23a-23z.json documents SOP policy application", async () => {
  const response = await request("/openapi.stage23a-23z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "23A-23Z-clinical-followup-sop-policy-application");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-application/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-application"].patch);
});

test("Stage 24A-24Z · SOP policy exception closure routes close local exceptions", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-exceptions/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "24A-24Z");
  assert.equal(summary.json.item.openExceptions, 1);
  assert.equal(summary.json.item.unresolvedDrift, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-exception",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyExceptionState: "accepted",
      sopPolicyExceptionReason: "Local exception accepted.",
      sopPolicyExceptionResolution: "Closed inside clinic policy review.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "24A-24Z");
  assert.equal(updated.json.item.sopPolicyExceptionState, "accepted");
  assert.equal(updated.json.item.sopPolicyExceptionResolution, "Closed inside clinic policy review.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external SOP approval|medical correctness/i);
});

test("Stage 24A-24Z · /openapi.stage24a-24z.json documents SOP policy exception closure", async () => {
  const response = await request("/openapi.stage24a-24z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "24A-24Z-clinical-followup-sop-policy-exception-closure");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-exceptions/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-exception"].patch);
});

test("Stage 25A-25Z · SOP policy audit rollup routes review local policy audit state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-audit/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "25A-25Z");
  assert.equal(summary.json.item.auditReady, 2);
  assert.equal(summary.json.item.needsAuditReview, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-audit",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyAuditState: "reviewed",
      sopPolicyAuditNote: "Local SOP policy audit reviewed.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "25A-25Z");
  assert.equal(updated.json.item.sopPolicyAuditState, "reviewed");
  assert.equal(updated.json.item.sopPolicyAuditNote, "Local SOP policy audit reviewed.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external SOP approval|medical correctness/i);
});

test("Stage 25A-25Z · /openapi.stage25a-25z.json documents SOP policy audit rollup", async () => {
  const response = await request("/openapi.stage25a-25z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "25A-25Z-clinical-followup-sop-policy-audit-rollup");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-audit/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-audit"].patch);
});

test("Stage 26A-26Z · SOP policy governance readiness routes review local governance state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "26A-26Z");
  assert.equal(summary.json.item.governanceReady, 1);
  assert.equal(summary.json.item.needsGovernanceReview, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceState: "reviewed",
      sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "26A-26Z");
  assert.equal(updated.json.item.sopPolicyGovernanceState, "reviewed");
  assert.equal(updated.json.item.sopPolicyGovernanceNote, "Local SOP policy governance reviewed.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external SOP approval|medical correctness/i);
});

test("Stage 26A-26Z · /openapi.stage26a-26z.json documents SOP policy governance readiness", async () => {
  const response = await request("/openapi.stage26a-26z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "26A-26Z-clinical-followup-sop-policy-governance-readiness");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance"].patch);
});

test("Stage 27A-27Z · SOP policy governance closure routes close local governance state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "27A-27Z");
  assert.equal(summary.json.item.closureReady, 1);
  assert.equal(summary.json.item.needsClosureReview, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-closure",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceClosureState: "closed",
      sopPolicyGovernanceClosureNote: "Local SOP policy governance closure completed.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "27A-27Z");
  assert.equal(updated.json.item.sopPolicyGovernanceClosureState, "closed");
  assert.equal(updated.json.item.sopPolicyGovernanceClosureNote, "Local SOP policy governance closure completed.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|medical correctness/i);
});

test("Stage 27A-27Z · /openapi.stage27a-27z.json documents SOP policy governance closure", async () => {
  const response = await request("/openapi.stage27a-27z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "27A-27Z-clinical-followup-sop-policy-governance-closure");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-closure"].patch);
});

test("Stage 28A-28Z · SOP policy governance evidence routes export local evidence state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "28A-28Z");
  assert.equal(summary.json.item.evidenceReady, 1);
  assert.equal(summary.json.item.needsEvidenceReview, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceState: "exported",
      sopPolicyGovernanceEvidenceNote: "Local SOP policy governance evidence export marked.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "28A-28Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceState, "exported");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceNote, "Local SOP policy governance evidence export marked.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|medical correctness/i);
});

test("Stage 28A-28Z · /openapi.stage28a-28z.json documents SOP policy governance evidence", async () => {
  const response = await request("/openapi.stage28a-28z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "28A-28Z-clinical-followup-sop-policy-governance-evidence-export");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence"].patch);
});

test("Stage 29A-29Z · SOP policy governance evidence reconciliation routes reconcile local evidence state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "29A-29Z");
  assert.equal(summary.json.item.reconciliationReady, 1);
  assert.equal(summary.json.item.needsReconciliation, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
      sopPolicyGovernanceEvidenceReconciliationNote: "Local SOP policy governance evidence reconciled.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "29A-29Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationState, "reconciled");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationNote, "Local SOP policy governance evidence reconciled.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|medical correctness/i);
});

test("Stage 29A-29Z · /openapi.stage29a-29z.json documents SOP policy governance evidence reconciliation", async () => {
  const response = await request("/openapi.stage29a-29z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "29A-29Z-clinical-followup-sop-policy-governance-evidence-reconciliation");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation"].patch);
});

test("Stage 30A-30Z · SOP policy governance evidence reconciliation closure routes close local reconciliation state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "30A-30Z");
  assert.equal(summary.json.item.reconciliationClosureReady, 1);
  assert.equal(summary.json.item.needsReconciliationClosure, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure completed.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "30A-30Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureState, "closed");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureNote, "Local SOP policy governance evidence reconciliation closure completed.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|medical correctness/i);
});

test("Stage 30A-30Z · /openapi.stage30a-30z.json documents SOP policy governance evidence reconciliation closure", async () => {
  const response = await request("/openapi.stage30a-30z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "30A-30Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure"].patch);
});

test("Stage 31A-31Z · SOP policy governance evidence reconciliation closure receipt routes record local receipt state", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "31A-31Z");
  assert.equal(summary.json.item.closureReceiptReady, 1);
  assert.equal(summary.json.item.needsClosureReceipt, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure-receipt",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt recorded.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "31A-31Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState, "received");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote, "Local SOP policy governance evidence reconciliation closure receipt recorded.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|medical correctness/i);
});

test("Stage 31A-31Z · /openapi.stage31a-31z.json documents SOP policy governance evidence reconciliation closure receipt", async () => {
  const response = await request("/openapi.stage31a-31z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "31A-31Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt"].patch);
});

test("Stage 32A-32Z · SOP policy governance evidence reconciliation closure receipt archive readiness routes record local archive readiness", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "32A-32Z");
  assert.equal(summary.json.item.archiveReadinessReady, 1);
  assert.equal(summary.json.item.needsArchiveReadiness, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "32A-32Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState, "ready");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote, "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|legal archive sufficiency proof|medical correctness/i);
});

test("Stage 32A-32Z · /openapi.stage32a-32z.json documents SOP policy governance evidence reconciliation closure receipt archive readiness", async () => {
  const response = await request("/openapi.stage32a-32z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "32A-32Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness"].patch);
});

test("Stage 33A-33Z · SOP policy governance evidence reconciliation closure receipt archive closure routes record local archive closure", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "33A-33Z");
  assert.equal(summary.json.item.archiveClosureReady, 1);
  assert.equal(summary.json.item.needsArchiveClosure, 1);
  assert.equal(summary.json.item.closedLocalArchives, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closed.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "33A-33Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState, "closed");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote, "Local SOP policy governance evidence reconciliation closure receipt archive closed.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|legal archive sufficiency proof|medical correctness/i);
});

test("Stage 33A-33Z · /openapi.stage33a-33z.json documents SOP policy governance evidence reconciliation closure receipt archive closure", async () => {
  const response = await request("/openapi.stage33a-33z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "33A-33Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure"].patch);
});

test("Stage 34A-34Z · SOP policy governance evidence reconciliation closure receipt archive closure receipt routes record local archive receipt", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "34A-34Z");
  assert.equal(summary.json.item.archiveClosureReceiptReady, 1);
  assert.equal(summary.json.item.needsArchiveClosureReceipt, 1);
  assert.equal(summary.json.item.receivedArchiveClosureReceipts, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt recorded.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "34A-34Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState, "received");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt recorded.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|legal archive sufficiency proof|medical correctness/i);
});

test("Stage 34A-34Z · /openapi.stage34a-34z.json documents SOP policy governance evidence reconciliation closure receipt archive closure receipt", async () => {
  const response = await request("/openapi.stage34a-34z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "34A-34Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt"].patch);
});

test("Stage 35A-35Z · SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff routes record local handoff", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "35A-35Z");
  assert.equal(summary.json.item.archiveClosureReceiptHandoffReady, 1);
  assert.equal(summary.json.item.needsArchiveClosureReceiptHandoff, 1);
  assert.equal(summary.json.item.handedOffArchiveClosureReceipts, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff completed.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "35A-35Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState, "handed_off");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff completed.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|legal archive sufficiency proof|medical correctness/i);
});

test("Stage 35A-35Z · /openapi.stage35a-35z.json documents SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff", async () => {
  const response = await request("/openapi.stage35a-35z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "35A-35Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff"].patch);
});

test("Stage 36A-36Z · SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt routes record local handoff receipt", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "36A-36Z");
  assert.equal(summary.json.item.archiveClosureReceiptHandoffReceiptReady, 1);
  assert.equal(summary.json.item.needsArchiveClosureReceiptHandoffReceipt, 1);
  assert.equal(summary.json.item.receivedArchiveClosureReceiptHandoffReceipts, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt recorded.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "36A-36Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState, "received");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt recorded.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|legal archive sufficiency proof|medical correctness/i);
});

test("Stage 36A-36Z · /openapi.stage36a-36z.json documents SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt", async () => {
  const response = await request("/openapi.stage36a-36z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "36A-36Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt"].patch);
});

test("Stage 37A-37Z · SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation routes record local reconciliation", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "37A-37Z");
  assert.equal(summary.json.item.archiveClosureReceiptHandoffReceiptReconciliationReady, 1);
  assert.equal(summary.json.item.needsArchiveClosureReceiptHandoffReceiptReconciliation, 1);
  assert.equal(summary.json.item.reconciledArchiveClosureReceiptHandoffReceipts, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation recorded.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "37A-37Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState, "reconciled");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation recorded.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|legal archive sufficiency proof|medical correctness/i);
});

test("Stage 37A-37Z · /openapi.stage37a-37z.json documents SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation", async () => {
  const response = await request("/openapi.stage37a-37z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "37A-37Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation"].patch);
});

test("Stage 41A-41Z · SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure routes record local closure", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "41A-41Z");
  assert.equal(summary.json.item.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReady, 1);
  assert.equal(summary.json.item.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure, 1);
  assert.equal(summary.json.item.closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure closed.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "41A-41Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState, "closed");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure closed.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|legal archive sufficiency proof|medical correctness/i);
});

test("Stage 41A-41Z · /openapi.stage41a-41z.json documents SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure", async () => {
  const response = await request("/openapi.stage41a-41z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "41A-41Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure"].patch);
});

test("Stage 42A-42Z · SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt routes record local receipt", async () => {
  const runtime = createRuntime();
  const summary = await request(
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt/summary",
    configuredEnv,
    runtime,
  );
  assert.equal(summary.status, 200);
  assert.equal(summary.json.stage, "42A-42Z");
  assert.equal(summary.json.item.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptReady, 1);
  assert.equal(summary.json.item.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt, 1);
  assert.equal(summary.json.item.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts, 1);

  const updated = await request(
    "/api/v1/clinical/follow-ups/10000000-0000-4000-8000-000000000701/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt",
    configuredEnv,
    runtime,
    "PATCH",
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt received.",
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.stage, "42A-42Z");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState, "received");
  assert.equal(updated.json.item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt received.");
  assert.doesNotMatch(updated.body, /api-read|api-write|edge function|SUPABASE_|storage_object_path|signed_url|access_token|external governance approval|external SOP approval|legal archive sufficiency proof|medical correctness/i);
});

test("Stage 42A-42Z · /openapi.stage42a-42z.json documents SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt", async () => {
  const response = await request("/openapi.stage42a-42z.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "42A-42Z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt");
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt/summary"].get);
  assert.ok(response.json.paths["/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt"].patch);
});

test("Stage 5P · clinic booking request endpoints list, read, and update intake safely", async () => {
  const authContext = {
    userId: "10000000-0000-4000-8000-000000000101",
    roles: ["operator"],
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    roleBindings: [{ role: "operator", clinicId: "10000000-0000-4000-8000-000000000001" }],
  };
  const runtime = createRuntime({ authContext });

  const list = await request(
    "/api/v1/clinic/booking-requests?status=requested&search=control",
    configuredEnv,
    runtime,
  );
  assert.equal(list.status, 200);
  assert.equal(list.json.stage, "5P");
  assert.equal(list.json.items.length, 1);
  assert.equal(list.json.items[0].status, "requested");
  assert.doesNotMatch(list.body, /api-read|api-write|edge function|SUPABASE_|signed_url|storage_object_path/i);

  const detail = await request(
    "/api/v1/clinic/booking-requests/10000000-0000-4000-8000-000000000501",
    configuredEnv,
    runtime,
  );
  assert.equal(detail.status, 200);
  assert.equal(detail.json.stage, "5P");
  assert.equal(detail.json.item.patient.code, "DP-LIVE");

  const update = await request(
    "/api/v1/clinic/booking-requests/10000000-0000-4000-8000-000000000501",
    configuredEnv,
    runtime,
    "PATCH",
    {
      status: "reviewing",
      clinicNote: "Позвонить пациенту",
    },
  );
  assert.equal(update.status, 200);
  assert.equal(update.json.stage, "5P");
  assert.equal(update.json.item.status, "reviewing");
  assert.equal(update.json.item.clinicNote, "Позвонить пациенту");
});

test("Stage 5P · clinic booking requests map forbidden access safely", async () => {
  const denied = await request(
    "/api/v1/clinic/booking-requests",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000101",
        roles: ["doctor"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
      },
      clinicBookingRequestsError: new ForbiddenError("Clinic intake denied."),
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 5P · /openapi.stage5p.json documents clinic booking request intake", async () => {
  const response = await request("/openapi.stage5p.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5P-clinic-booking-requests-intake");
  assert.ok(response.json.paths["/api/v1/clinic/booking-requests"].get);
  assert.ok(response.json.paths["/api/v1/clinic/booking-requests/{requestId}"].get);
  assert.ok(response.json.paths["/api/v1/clinic/booking-requests/{requestId}"].patch);
});

test("Stage 5Q · external intake import endpoints create and list local batches", async () => {
  const authContext = {
    userId: "10000000-0000-4000-8000-000000000101",
    roles: ["operator"],
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    roleBindings: [{ role: "operator", clinicId: "10000000-0000-4000-8000-000000000001" }],
  };
  const runtime = createRuntime({ authContext });

  const created = await request(
    "/api/v1/integrations/booking-imports",
    configuredEnv,
    runtime,
    "POST",
    {
      sourceSystem: "clinic_crm",
      items: [
        {
          kind: "booking_request",
          externalId: "crm-1",
          patientCode: "DP-LIVE",
          preferredFrom: "2026-06-15T10:00:00.000Z",
        },
        {
          kind: "available_slot",
          externalId: "slot-1",
          startedAt: "2026-06-15T11:00:00.000Z",
        },
      ],
    },
  );
  assert.equal(created.status, 201);
  assert.equal(created.json.stage, "5Q");
  assert.equal(created.json.item.sourceSystem, "clinic_crm");
  assert.equal(created.json.item.acceptedBookingCount, 1);
  assert.equal(created.json.item.acceptedSlotCount, 1);
  assert.doesNotMatch(created.body, /api-read|api-write|edge function|SUPABASE_|signed_url|storage_object_path|https:\/\//i);

  const list = await request(
    "/api/v1/integrations/booking-imports?sourceSystem=clinic_crm",
    configuredEnv,
    runtime,
  );
  assert.equal(list.status, 200);
  assert.equal(list.json.stage, "5Q");
  assert.equal(list.json.items.length, 1);
  assert.equal(list.json.filters.sourceSystem, "clinic_crm");
});

test("Stage 5Q · external intake imports map forbidden access safely", async () => {
  const denied = await request(
    "/api/v1/integrations/booking-imports",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000101",
        roles: ["doctor"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
      },
      externalIntakeImportError: new ForbiddenError("External intake denied."),
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 5Q · /openapi.stage5q.json documents external intake imports", async () => {
  const response = await request("/openapi.stage5q.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5Q-external-intake-import-contracts");
  assert.ok(response.json.paths["/api/v1/integrations/booking-imports"].get);
  assert.ok(response.json.paths["/api/v1/integrations/booking-imports"].post);
});

test("Stage 5T · external intake status exposes local hardening counters", async () => {
  const authContext = {
    userId: "10000000-0000-4000-8000-000000000101",
    roles: ["operator"],
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    roleBindings: [{ role: "operator", clinicId: "10000000-0000-4000-8000-000000000001" }],
  };
  const response = await request(
    "/api/v1/integrations/booking-imports/status?sourceSystem=clinic_crm",
    configuredEnv,
    createRuntime({
      authContext,
      externalIntakeImportStatus: {
        sourceSystem: "clinic_crm",
        recentBatchCount: 3,
        rejectedLast24h: 1,
        duplicateLast24h: 2,
        latestImportAt: "2026-05-15T10:00:00.000Z",
        openBookingRequestCount: 4,
        availableSlotCount: 5,
        storedRawPayload: false,
        runtimeCallsExternalSystems: false,
        hardeningVersion: "stage5t",
        latestBySource: [],
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "5T");
  assert.equal(response.json.item.hardeningVersion, "stage5t");
  assert.equal(response.json.item.duplicateLast24h, 2);
  assert.equal(response.json.item.runtimeCallsExternalSystems, false);
  assert.doesNotMatch(response.body, /api-read|api-write|edge function|SUPABASE_|signed_url|storage_object_path|https:\/\//i);
});

test("Stage 5T · /openapi.stage5t.json documents external intake hardening", async () => {
  const response = await request("/openapi.stage5t.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5T-external-intake-hardening");
  assert.ok(response.json.paths["/api/v1/integrations/booking-imports/status"].get);
});

test("Stage 5R · clinic available slots endpoint returns local cached windows", async () => {
  const authContext = {
    userId: "10000000-0000-4000-8000-000000000101",
    roles: ["operator"],
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    roleBindings: [{ role: "operator", clinicId: "10000000-0000-4000-8000-000000000001" }],
  };
  const response = await request(
    "/api/v1/clinic/available-slots?sourceSystem=clinic_crm&status=available&limit=5",
    configuredEnv,
    createRuntime({ authContext }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "5R");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.items.length, 1);
  assert.equal(response.json.items[0].sourceSystem, "clinic_crm");
  assert.equal(response.json.items[0].status, "available");
  assert.equal(response.json.filters.sourceSystem, "clinic_crm");
  assert.doesNotMatch(response.body, /api-read|api-write|edge function|SUPABASE_|signed_url|storage_object_path|https:\/\//i);
});

test("Stage 5R · clinic available slots map forbidden access safely", async () => {
  const denied = await request(
    "/api/v1/clinic/available-slots",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000101",
        roles: ["doctor"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
      },
      clinicAvailableSlotsError: new ForbiddenError("Slot access denied."),
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 5R · /openapi.stage5r.json documents local availability contract", async () => {
  const response = await request("/openapi.stage5r.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5R-clinic-available-slots-contract");
  assert.ok(response.json.paths["/api/v1/clinic/available-slots"].get);
});

test("Stage 5S · clinic booking request confirms from a local available slot", async () => {
  const authContext = {
    userId: "10000000-0000-4000-8000-000000000101",
    roles: ["operator"],
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    roleBindings: [{ role: "operator", clinicId: "10000000-0000-4000-8000-000000000001" }],
  };
  const response = await request(
    "/api/v1/clinic/booking-requests/10000000-0000-4000-8000-000000000501/book-from-slot",
    configuredEnv,
    createRuntime({ authContext }),
    "POST",
    {
      slotId: "10000000-0000-4000-8000-000000000801",
      clinicNote: "Подтверждено по локальному окну",
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "5S");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.item.status, "booked");
  assert.equal(response.json.item.assignedVisitId, "10000000-0000-4000-8000-000000000301");
  assert.doesNotMatch(response.body, /api-read|api-write|edge function|SUPABASE_|signed_url|storage_object_path|https:\/\//i);
});

test("Stage 5S · booking from slot maps forbidden access safely", async () => {
  const denied = await request(
    "/api/v1/clinic/booking-requests/10000000-0000-4000-8000-000000000501/book-from-slot",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000101",
        roles: ["doctor"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
      },
      clinicBookingRequestsError: new ForbiddenError("Booking confirmation denied."),
    }),
    "POST",
    { slotId: "10000000-0000-4000-8000-000000000801" },
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 5S · /openapi.stage5s.json documents local slot confirmation", async () => {
  const response = await request("/openapi.stage5s.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "5S-booking-slot-confirmation");
  assert.ok(response.json.paths["/api/v1/clinic/booking-requests/{requestId}/book-from-slot"].post);
});
