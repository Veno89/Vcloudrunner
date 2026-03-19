/**
 * OpenTelemetry instrumentation bootstrap.
 *
 * This module is designed to be imported before any other modules in the
 * application entry point so that auto-instrumentation hooks are installed
 * before the frameworks are loaded.
 *
 * When OTEL_ENABLED is falsy the module is a no-op.
 *
 * Required packages (install when enabling):
 *   @opentelemetry/sdk-node
 *   @opentelemetry/exporter-trace-otlp-http
 *   @opentelemetry/exporter-metrics-otlp-http
 *   @opentelemetry/auto-instrumentations-node
 *   @opentelemetry/resources
 *   @opentelemetry/semantic-conventions
 */

let shutdownFn: (() => Promise<void>) | undefined;
let initPromise: Promise<void> | undefined;

const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_ENV_VALUES = new Set(['0', 'false', 'no', 'off', '']);

function isTelemetryEnabled(raw: string | undefined) {
  if (raw === undefined) {
    return false;
  }

  const normalized = raw.trim().toLowerCase();
  if (TRUE_ENV_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_ENV_VALUES.has(normalized)) {
    return false;
  }

  return false;
}

type ImportModule = (specifier: string) => Promise<unknown>;

interface TelemetryOptions {
  env?: NodeJS.ProcessEnv;
  importModule?: ImportModule;
  log?: (message: string) => void;
  warn?: (...args: unknown[]) => void;
}

async function loadTelemetryDependencies(importModule: ImportModule) {
  /* eslint-disable @typescript-eslint/no-require-imports */
  /* eslint-disable @typescript-eslint/ban-ts-comment */
  // Dynamic imports are kept here because the telemetry dependencies remain optional.
  // @ts-ignore optional dependency
  const { NodeSDK } = await importModule('@opentelemetry/sdk-node') as {
    NodeSDK: new (options: unknown) => { start: () => void | Promise<void>; shutdown: () => Promise<void> };
  };
  // @ts-ignore optional dependency
  const { OTLPTraceExporter } = await importModule('@opentelemetry/exporter-trace-otlp-http') as {
    OTLPTraceExporter: new (options: { url: string }) => unknown;
  };
  // @ts-ignore optional dependency
  const { OTLPMetricExporter } = await importModule('@opentelemetry/exporter-metrics-otlp-http') as {
    OTLPMetricExporter: new (options: { url: string }) => unknown;
  };
  // @ts-ignore optional dependency
  const { PeriodicExportingMetricReader } = await importModule('@opentelemetry/sdk-metrics') as {
    PeriodicExportingMetricReader: new (options: { exporter: unknown; exportIntervalMillis: number }) => unknown;
  };
  // @ts-ignore optional dependency
  const { getNodeAutoInstrumentations } = await importModule('@opentelemetry/auto-instrumentations-node') as {
    getNodeAutoInstrumentations: (options: Record<string, unknown>) => unknown;
  };
  // @ts-ignore optional dependency
  const { ATTR_SERVICE_NAME } = await importModule('@opentelemetry/semantic-conventions') as {
    ATTR_SERVICE_NAME: string;
  };
  // @ts-ignore optional dependency
  const { Resource } = await importModule('@opentelemetry/resources') as {
    Resource: new (attributes: Record<string, string>) => unknown;
  };
  /* eslint-enable @typescript-eslint/ban-ts-comment */

  return {
    NodeSDK,
    OTLPTraceExporter,
    OTLPMetricExporter,
    PeriodicExportingMetricReader,
    getNodeAutoInstrumentations,
    ATTR_SERVICE_NAME,
    Resource
  };
}

export async function initTelemetry(options: TelemetryOptions = {}): Promise<void> {
  const env = options.env ?? process.env;
  if (!isTelemetryEnabled(env['OTEL_ENABLED'])) {
    return;
  }

  if (shutdownFn) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  const importModule = options.importModule ?? ((specifier: string) => import(specifier));
  const log = options.log ?? console.log;
  const warn = options.warn ?? console.warn;

  initPromise = (async () => {
    try {
      const {
        NodeSDK,
        OTLPTraceExporter,
        OTLPMetricExporter,
        PeriodicExportingMetricReader,
        getNodeAutoInstrumentations,
        ATTR_SERVICE_NAME,
        Resource
      } = await loadTelemetryDependencies(importModule);

      const endpoint = env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';
      const serviceName = env['OTEL_SERVICE_NAME'] ?? 'vcloudrunner-api';

      const resource = new Resource({
        [ATTR_SERVICE_NAME]: serviceName,
      });

      const sdk = new NodeSDK({
        resource,
        traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
        metricReader: new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
          exportIntervalMillis: 30_000,
        }),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
          }),
        ],
      });

      await sdk.start();
      shutdownFn = async () => {
        await sdk.shutdown();
      };

      log(`[otel] telemetry enabled - exporting to ${endpoint}`);
    } catch (error) {
      warn(
        '[otel] failed to initialize OpenTelemetry (missing deps?):',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      initPromise = undefined;
    }
  })();

  return initPromise;
}

export async function shutdownTelemetry(): Promise<void> {
  if (initPromise) {
    await initPromise;
  }

  if (shutdownFn) {
    const close = shutdownFn;
    shutdownFn = undefined;
    await close();
  }
}
