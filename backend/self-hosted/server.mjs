#!/usr/bin/env node

import { createServer } from "node:http";

import { readSelfHostedConfig } from "./config.mjs";
import { createNodeHandler } from "./routes.mjs";

const config = readSelfHostedConfig();
const server = createServer(createNodeHandler(config));

server.listen(config.port, "0.0.0.0", () => {
  console.log(
    `[stage4a-backend] ${config.serviceName} listening on 0.0.0.0:${config.port}`,
  );
});

function shutdown(signal) {
  console.log(`[stage4a-backend] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
