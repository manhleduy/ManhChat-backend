import * as Sentry from "@sentry/node"
import { app } from "./config/socket.js"
import * as Tracing from "@sentry/tracing"
import dotenv from "dotenv"
dotenv.config();

// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: process.env.SENTRY_DNS,

  // Set tracesSampleRate to 0.05 to capture 5%
  // of transactions for performance monitoring.
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#sendDefaultPii
  tracesSampleRate:0.05,
  sendDefaultPii: true,
});





