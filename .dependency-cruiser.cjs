/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-ui-imports-backend-internals",
      comment: "Frontend code must use typed API clients instead of importing self-hosted backend modules directly.",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^backend/self-hosted/" },
    },
    {
      name: "no-patient-ui-imports-doctor-pages",
      comment: "Patient-facing pages must not depend on doctor-only screens or report internals.",
      severity: "error",
      from: { path: "^src/pages/patient/" },
      to: { path: "^src/pages/doctor/" },
    },
    {
      name: "no-public-ui-imports-doctor-or-admin-pages",
      comment: "Public pages must not depend on privileged doctor/admin pages.",
      severity: "error",
      from: { path: "^src/pages/public/" },
      to: { path: "^src/pages/(doctor|admin|sys)/" },
    },
    {
      name: "no-backend-imports-ui",
      comment: "Self-hosted backend modules must remain UI-free.",
      severity: "error",
      from: { path: "^backend/self-hosted/" },
      to: { path: "^src/(pages|components)/" },
    },
    {
      name: "no-circular-dependencies",
      comment: "Cycles make staged safety gates brittle; keep this warning visible while the repo is cleaned incrementally.",
      severity: "warn",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: [
        "^node_modules/",
        "^dist/",
        "^coverage/",
        "^reports/",
        "^test-results/",
        "\\.snapshots/",
      ].join("|"),
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default"],
      exportsFields: ["exports"],
      mainFields: ["module", "main", "types"],
    },
  },
};
