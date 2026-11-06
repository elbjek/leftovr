import Constants from "expo-constants";

import { env } from "./env";

/**
 * Crash reporting over Sentry's plain HTTP envelope endpoint — no native SDK,
 * so it ships with a JS-only reload and needs no pod install.
 *
 * ponytail: JS errors only. Native iOS crashes and OOM kills are invisible
 * here; move to @sentry/react-native (config plugin + rebuild) if those matter.
 */

type Dsn = { host: string; protocol: string; publicKey: string; projectId: string };

export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  // https://<publicKey>@<host>/<projectId>
  const match = /^(https?):\/\/([^@]+)@([^/]+)\/(.+)$/.exec(dsn.trim());
  if (!match) return null;
  return { protocol: match[1], publicKey: match[2], host: match[3], projectId: match[4] };
}

const dsn = parseDsn(env.sentryDsn);
const release = `${Constants.expoConfig?.slug ?? "leftovr"}@${Constants.expoConfig?.version ?? "0.0.0"}`;
const environment = __DEV__ ? "development" : "production";

function randomEventId() {
  // Sentry wants 32 hex chars without dashes.
  let id = "";
  for (let i = 0; i < 32; i += 1) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

export function isErrorReportingEnabled() {
  return dsn !== null;
}

/**
 * Fire-and-forget: never throws, never blocks the caller. Dropped in dev and
 * when EXPO_PUBLIC_SENTRY_DSN is unset.
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) {
    console.warn("[error]", error, context);
    return;
  }
  if (!dsn) return;

  const normalized = error instanceof Error ? error : new Error(String(error));
  const eventId = randomEventId();
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    release,
    environment,
    exception: {
      values: [
        {
          type: normalized.name,
          value: normalized.message,
        },
      ],
    },
    extra: { ...context, stack: normalized.stack },
  };

  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  fetch(`${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=leftovr/1.0, sentry_key=${dsn.publicKey}`,
    },
    body,
  }).catch(() => undefined);
}

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsShape = {
  getGlobalHandler: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

let installed = false;

/** Reports uncaught JS errors. Safe to call more than once. */
export function installErrorReporting() {
  if (installed) return;
  installed = true;

  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!errorUtils) return;

  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { fatal: Boolean(isFatal) });
    previous(error, isFatal);
  });
}
