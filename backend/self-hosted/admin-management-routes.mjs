import { errorResponse, jsonResponse } from "./api-response.mjs";
import { parseAdminListParams } from "./admin-management-repository.mjs";

function adminUserRolePath(pathname) {
  return pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/role$/);
}

function adminUserDisablePath(pathname) {
  return pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/disable$/);
}

function adminUserReactivatePath(pathname) {
  return pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/reactivate$/);
}

function adminUserRoleStatusPath(pathname) {
  return pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/role-status$/);
}

function adminClinicPath(pathname) {
  return pathname.match(/^\/api\/v1\/admin\/clinics\/([^/]+)$/);
}

function adminClinicStatusPath(pathname) {
  return pathname.match(/^\/api\/v1\/admin\/clinics\/([^/]+)\/status$/);
}

function safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin }) {
  const publicError = publicErrorFor(error);
  return errorResponse({ ...publicError, correlationId, config, requestOrigin });
}

export async function handleAdminManagementRequest({
  method,
  url,
  request,
  config,
  requestOrigin,
  runtimeServices,
  correlationId,
  now,
  parseJsonBody,
  publicErrorFor,
}) {
  if (url.pathname === "/api/v1/admin/users") {
    if (method === "GET") {
      try {
        const authContext = await runtimeServices.authService.authenticate(request.headers);
        const params = parseAdminListParams(url.searchParams);
        const result = await runtimeServices.adminManagementService.listUsers(params, authContext, { correlationId });
        return jsonResponse(
          200,
          {
            stage: "6A",
            source: "postgres",
            items: result.items,
            meta: result.meta,
            auth: {
              userId: authContext.userId,
              roles: authContext.roles,
              allClinics: result.scope.allClinics,
            },
            generatedAt: now(),
            correlationId,
          },
          config,
          requestOrigin,
        );
      } catch (error) {
        return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
      }
    }

    if (method === "POST") {
      try {
        const authContext = await runtimeServices.authService.authenticate(request.headers);
        const result = await runtimeServices.adminManagementService.createUser(parseJsonBody(request.body), authContext, {
          correlationId,
        });
        return jsonResponse(201, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
      } catch (error) {
        return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
      }
    }
  }

  const userRole = adminUserRolePath(url.pathname);
  if (userRole && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.adminManagementService.assignUserRole(
        decodeURIComponent(userRole[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(200, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  const userDisable = adminUserDisablePath(url.pathname);
  if (userDisable && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.adminManagementService.disableUser(
        decodeURIComponent(userDisable[1]),
        authContext,
        { correlationId },
      );
      return jsonResponse(200, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  const userReactivate = adminUserReactivatePath(url.pathname);
  if (userReactivate && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.adminManagementService.reactivateUser(
        decodeURIComponent(userReactivate[1]),
        authContext,
        { correlationId },
      );
      return jsonResponse(200, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  const userRoleStatus = adminUserRoleStatusPath(url.pathname);
  if (userRoleStatus && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.adminManagementService.setUserRoleStatus(
        decodeURIComponent(userRoleStatus[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(200, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/admin/clinics") {
    if (method === "GET") {
      try {
        const authContext = await runtimeServices.authService.authenticate(request.headers);
        const params = parseAdminListParams(url.searchParams);
        const result = await runtimeServices.adminManagementService.listClinics(params, authContext, { correlationId });
        return jsonResponse(200, { stage: "6A", source: "postgres", items: result.items, meta: result.meta, generatedAt: now(), correlationId }, config, requestOrigin);
      } catch (error) {
        return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
      }
    }

    if (method === "POST") {
      try {
        const authContext = await runtimeServices.authService.authenticate(request.headers);
        const result = await runtimeServices.adminManagementService.createClinic(parseJsonBody(request.body), authContext, {
          correlationId,
        });
        return jsonResponse(201, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
      } catch (error) {
        return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
      }
    }
  }

  if (url.pathname === "/api/v1/admin/private-practices" && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.adminManagementService.createPrivatePractice(
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(201, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  const clinic = adminClinicPath(url.pathname);
  if (clinic && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.adminManagementService.updateClinic(
        decodeURIComponent(clinic[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(200, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  if (clinic && method === "DELETE") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.adminManagementService.deleteEmptyClinic(
        decodeURIComponent(clinic[1]),
        authContext,
        { correlationId },
      );
      return jsonResponse(200, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  const clinicStatus = adminClinicStatusPath(url.pathname);
  if (clinicStatus && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.adminManagementService.setClinicStatus(
        decodeURIComponent(clinicStatus[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(200, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/admin/doctors") {
    if (method === "GET") {
      try {
        const authContext = await runtimeServices.authService.authenticate(request.headers);
        const params = parseAdminListParams(url.searchParams);
        const result = await runtimeServices.adminManagementService.listDoctors(params, authContext, { correlationId });
        return jsonResponse(200, { stage: "6A", source: "postgres", items: result.items, meta: result.meta, generatedAt: now(), correlationId }, config, requestOrigin);
      } catch (error) {
        return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
      }
    }

    if (method === "POST") {
      try {
        const authContext = await runtimeServices.authService.authenticate(request.headers);
        const body = parseJsonBody(request.body);
        const result = await runtimeServices.adminManagementService.createUser(
          {
            ...body,
            role: body.role === "private_doctor" ? "private_doctor" : "doctor",
          },
          authContext,
          { correlationId },
        );
        return jsonResponse(201, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
      } catch (error) {
        return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
      }
    }
  }

  if (url.pathname === "/api/v1/admin/analytics" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.adminManagementService.getAnalytics(authContext, { correlationId });
      return jsonResponse(200, { stage: "6A", source: "postgres", item: result.item, generatedAt: now(), correlationId }, config, requestOrigin);
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/admin/audit-events" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const params = parseAdminListParams(url.searchParams);
      const result = await runtimeServices.adminManagementService.listAuditEvents(params, authContext, { correlationId });
      return jsonResponse(
        200,
        { stage: "6A", source: "postgres", items: result.items, meta: result.meta, generatedAt: now(), correlationId },
        config,
        requestOrigin,
      );
    } catch (error) {
      return safeErrorResponse({ error, publicErrorFor, correlationId, config, requestOrigin });
    }
  }

  return null;
}
