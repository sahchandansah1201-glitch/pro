import { describe, expect, it } from "vitest";
import * as viewModel from "./accessEventsViewModel";

describe("Working access-events public interface", () => {
  it("does not expose a generator of educational events", () => {
    expect(viewModel).not.toHaveProperty("buildDemoRows");
  });

  it("maps a managed API row without replacing its labels with an educational lookup", () => {
    const row={id:"synthetic-event",created_at:"2026-10-13T00:00:00Z",clinic_name:"Рабочая клиника",actor_full_name:null,actor_id:"u-001",action:"visit.open",entity:"visit",entity_id:"v-001",patient_code:null,visit_id:"v-001",lesion_label:null} as viewModel.AccessEventsViewRow;
    expect(viewModel.fromViewRow(row)).toEqual({id:row.id,createdAt:row.created_at,clinicName:row.clinic_name,actorLabel:"u-001",action:row.action,entity:row.entity,entityId:"v-001",patientCode:null,visitId:"v-001",lesionLabel:null,source:"api"});
  });

  it("maps a native audit event without inventing clinical context", () => {
    const event={id:"synthetic-event",createdAt:"2026-10-13T00:00:00Z",clinicName:null,actorName:null,action:"admin.audit.list",entityType:"admin_audit"};
    expect(viewModel.fromAdminAuditEvent(event)).toEqual({id:event.id,createdAt:event.createdAt,clinicName:"Все клиники",actorLabel:"Системное событие",action:event.action,entity:event.entityType,entityId:null,patientCode:null,visitId:null,lesionLabel:null,source:"api"});
  });
});
