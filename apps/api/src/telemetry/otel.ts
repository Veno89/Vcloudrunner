/**
 * OpenTelemetry instrumentation bootstrap.
 *
 * This module is designed to be imported **before** any other modules in the
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

export async function initTelemetry(): Promise<void> {
  // Read raw env to avoid circular dependency with validated env module
  if (process.env['OTEL_ENABLED'] !== 'true' && process.env['OTEL_ENABLED'] !== '1') {
    return;
  }

  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    // Dynamic imports for optional OTEL packages — suppressed because they
    // are optional dependencies that may not be installed.
    // @ts-expect-error optional dependency
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    // @ts-expect-error optional dependency
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    // @ts-expect-error optional dependency
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
    // @ts-expect-error optional dependency
    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
    // @ts-expect-error optional dependency
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    // @ts-expect-error optional dependency
    const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');
    // @ts-expect-error optional dependency
    const { Resource } = await import('@opentelemetry/resources');

    const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';
    const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'vcloudrunner-api';

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

    sdk.start();

    shutdownFn = () => sdk.shutdown();

    console.log(`[otel] telemetry enabled — exporting to ${endpoint}`);
  } catch (error) {
    console.warn(
      '[otel] failed to initialize OpenTelemetry (missing deps?):',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (shutdownFn) {
    await shutdownFn();
  }
}
