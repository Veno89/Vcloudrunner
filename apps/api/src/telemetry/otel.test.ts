import assert from 'node:assert/strict';
import test from 'node:test';

import { initTelemetry, shutdownTelemetry } from './otel.js';

test.afterEach(async () => {
  await shutdownTelemetry();
});

test('initTelemetry honors strict boolean-style truthy values and only initializes once', async () => {
  let startCalls = 0;
  let shutdownCalls = 0;
  const logs: string[] = [];

  class FakeNodeSdk {
    constructor(public readonly options: Record<string, unknown>) {}

    async start() {
      startCalls += 1;
    }

    async shutdown() {
      shutdownCalls += 1;
    }
  }

  const importModule = async (specifier: string) => {
    switch (specifier) {
      case '@opentelemetry/sdk-node':
        return { NodeSDK: FakeNodeSdk };
      case '@opentelemetry/exporter-trace-otlp-http':
        return { OTLPTraceExporter: class { constructor(public readonly options: Record<string, unknown>) {} } };
      case '@opentelemetry/exporter-metrics-otlp-http':
        return { OTLPMetricExporter: class { constructor(public readonly options: Record<string, unknown>) {} } };
      case '@opentelemetry/sdk-metrics':
        return { PeriodicExportingMetricReader: class { constructor(public readonly options: Record<string, unknown>) {} } };
      case '@opentelemetry/auto-instrumentations-node':
        return { getNodeAutoInstrumentations: (options: Record<string, unknown>) => options };
      case '@opentelemetry/semantic-conventions':
        return { ATTR_SERVICE_NAME: 'service.name' };
      case '@opentelemetry/resources':
        return { Resource: class { constructor(public readonly attributes: Record<string, string>) {} } };
      default:
        throw new Error(`Unexpected import: ${specifier}`);
    }
  };

  const env = {
    OTEL_ENABLED: 'on',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
    OTEL_SERVICE_NAME: 'vcloudrunner-test'
  } as NodeJS.ProcessEnv;

  await initTelemetry({
    env,
    importModule,
    log: (message) => logs.push(message)
  });
  await initTelemetry({
    env,
    importModule,
    log: (message) => logs.push(message)
  });

  assert.equal(startCalls, 1);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /telemetry enabled - exporting to http:\/\/collector:4318/);

  await shutdownTelemetry();
  await shutdownTelemetry();

  assert.equal(shutdownCalls, 1);
});

test('initTelemetry warns on missing deps and remains retryable afterwards', async () => {
  const warnings: string[] = [];
  let startCalls = 0;

  class FakeNodeSdk {
    async start() {
      startCalls += 1;
    }

    async shutdown() {}
  }

  const failingImportModule = async () => {
    throw new Error('module not found');
  };

  const workingImportModule = async (specifier: string) => {
    switch (specifier) {
      case '@opentelemetry/sdk-node':
        return { NodeSDK: FakeNodeSdk };
      case '@opentelemetry/exporter-trace-otlp-http':
        return {
          OTLPTraceExporter: class {
            constructor(options: Record<string, unknown>) {
              void options;
            }
          }
        };
      case '@opentelemetry/exporter-metrics-otlp-http':
        return {
          OTLPMetricExporter: class {
            constructor(options: Record<string, unknown>) {
              void options;
            }
          }
        };
      case '@opentelemetry/sdk-metrics':
        return {
          PeriodicExportingMetricReader: class {
            constructor(options: Record<string, unknown>) {
              void options;
            }
          }
        };
      case '@opentelemetry/auto-instrumentations-node':
        return { getNodeAutoInstrumentations: () => ({}) };
      case '@opentelemetry/semantic-conventions':
        return { ATTR_SERVICE_NAME: 'service.name' };
      case '@opentelemetry/resources':
        return {
          Resource: class {
            constructor(attributes: Record<string, string>) {
              void attributes;
            }
          }
        };
      default:
        throw new Error(`Unexpected import: ${specifier}`);
    }
  };

  const env = { OTEL_ENABLED: 'yes' } as NodeJS.ProcessEnv;

  await initTelemetry({
    env,
    importModule: failingImportModule,
    warn: (...args) => warnings.push(args.map((value) => String(value)).join(' '))
  });

  assert.equal(startCalls, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /failed to initialize OpenTelemetry/);
  assert.match(warnings[0], /module not found/);

  await initTelemetry({
    env,
    importModule: workingImportModule,
    log: () => undefined
  });

  assert.equal(startCalls, 1);
});
