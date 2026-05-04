// Демо-пользователи. UX-симуляция, не настоящая авторизация.
// Все имена, email и идентификаторы выдуманы и не связаны с реальными людьми.
// Реальные пользователи и сессии появятся при подключении Lovable Cloud.

import type { Role } from "@/lib/roles";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** Идентификатор клиники. Для пациента/сисадмина может быть null. */
  clinicId: string | null;
  locale: "ru-RU";
}

const CLINIC_DEMO = "clinic-demo-001";
const CLINIC_PRIVATE = "clinic-private-007";

export const DEMO_USERS: Record<Role, CurrentUser> = {
  doctor: {
    id: "u-doc-001",
    email: "i.sokolova@derma-pro.demo",
    fullName: "Соколова Ирина Андреевна",
    role: "doctor",
    clinicId: CLINIC_DEMO,
    locale: "ru-RU",
  },
  assistant: {
    id: "u-asst-001",
    email: "m.petrova@derma-pro.demo",
    fullName: "Петрова Мария Сергеевна",
    role: "assistant",
    clinicId: CLINIC_DEMO,
    locale: "ru-RU",
  },
  clinic_admin: {
    id: "u-cadm-001",
    email: "a.volkov@derma-pro.demo",
    fullName: "Волков Алексей Дмитриевич",
    role: "clinic_admin",
    clinicId: CLINIC_DEMO,
    locale: "ru-RU",
  },
  private_doctor: {
    id: "u-pdoc-001",
    email: "d.morozov@derma-pro.demo",
    fullName: "Морозов Дмитрий Игоревич",
    role: "private_doctor",
    clinicId: CLINIC_PRIVATE,
    locale: "ru-RU",
  },
  operator: {
    id: "u-op-001",
    email: "e.lebedeva@derma-pro.demo",
    fullName: "Лебедева Екатерина Павловна",
    role: "operator",
    clinicId: CLINIC_DEMO,
    locale: "ru-RU",
  },
  system_admin: {
    id: "u-sys-001",
    email: "s.orlov@derma-pro.demo",
    fullName: "Орлов Сергей Викторович",
    role: "system_admin",
    clinicId: null,
    locale: "ru-RU",
  },
  patient: {
    id: "u-pat-001",
    email: "n.ivanova@mail.demo",
    fullName: "Иванова Наталья Олеговна",
    role: "patient",
    clinicId: null,
    locale: "ru-RU",
  },
};

export function userForRole(role: Role): CurrentUser {
  return DEMO_USERS[role];
}
