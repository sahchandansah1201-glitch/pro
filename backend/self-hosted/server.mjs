#!/usr/bin/env node

import { createServer } from "node:http";

import { readSelfHostedConfig } from "./config.mjs";
import { createOpsLogger } from "./ops-logger.mjs";
import { createNodeHandler } from "./routes.mjs";

const config = readSelfHostedConfig();
const logger = createOpsLogger({ service: config.serviceName });
const server = createServer(createNodeHandler(config, { logger }));

server.listen(config.port, "0.0.0.0", () => {
  logger.info("server.listen", {
    host: "0.0.0.0",
    port: config.port,
    deploymentMode: config.deploymentMode,
  });
});

function shutdown(signal) {
  logger.info("server.shutdown", { signal });
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
