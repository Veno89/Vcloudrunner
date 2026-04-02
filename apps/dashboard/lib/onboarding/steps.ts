/** Central registry of onboarding steps, tours, and contextual tips. */

// ---------------------------------------------------------------------------
// Milestone steps — tracked as completed when user reaches a key moment
// ---------------------------------------------------------------------------

export const ONBOARDING_STEPS = {
  WELCOME_SEEN: 'welcome-seen',
  FIRST_PROJECT_CREATED: 'first-project-created',
  FIRST_DEPLOY_TRIGGERED: 'first-deploy-triggered',
  FIRST_ENV_ADDED: 'first-env-added',
  FIRST_DOMAIN_ADDED: 'first-domain-added',
  FIRST_DATABASE_PROVISIONED: 'first-database-provisioned',
  PROJECT_SETUP_TOUR_COMPLETED: 'project-setup-tour-completed',
} as const;

// ---------------------------------------------------------------------------
// Tour definitions — multi-step guided spotlight walkthroughs
// ---------------------------------------------------------------------------

export interface TourStepDefinition {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export interface TourDefinition {
  id: string;
  label: string;
  description: string;
  /** Route prefix where this tour can start (e.g. '/projects/'). */
  routePrefix: string;
  /** Step that must be completed before this tour auto-starts. */
  prerequisiteStep?: string;
  steps: TourStepDefinition[];
}

export const TOURS: TourDefinition[] = [
  {
    id: 'project-setup-tour',
    label: 'Project Setup Tour',
    description: 'Learn how to navigate and configure your project.',
    routePrefix: '/projects/',
    prerequisiteStep: ONBOARDING_STEPS.FIRST_PROJECT_CREATED,
    steps: [
      {
        id: 'project-subnav',
        title: 'Project Navigation',
        description:
          'These tabs let you switch between deployments, environment variables, logs, databases, domains, and project settings.',
        targetSelector: '[data-onboarding="project-subnav"]',
        side: 'bottom',
      },
      {
        id: 'deploy-action',
        title: 'Deploy Your Service',
        description:
          'Hit Deploy to build and run your project from Git. You can also deploy all services at once from the project page.',
        targetSelector: '[data-onboarding="deploy-action"]',
        side: 'bottom',
      },
      {
        id: 'environment-tab',
        title: 'Environment Variables',
        description:
          'Add runtime environment variables your app needs. You can bulk-import from a .env file too.',
        targetSelector: '[data-onboarding="env-link"]',
        side: 'right',
      },
      {
        id: 'settings-tab',
        title: 'Service Settings',
        description:
          'Configure per-service health checks, restart policies, resource limits, and multi-service composition here.',
        targetSelector: '[data-onboarding="settings-link"]',
        side: 'right',
      },
      {
        id: 'status-link',
        title: 'Platform Status',
        description:
          'Check the Status page anytime to see if the API, queue, and worker are healthy.',
        targetSelector: '[data-onboarding="status-link"]',
        side: 'right',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Contextual tooltip definitions — shown inline on complex controls
// ---------------------------------------------------------------------------

export interface ContextualTipDefinition {
  id: string;
  label: string;
}

export const TIPS = {
  // Project create form
  PROJECT_NAME: {
    id: 'tip-project-name',
    label: 'A human-readable name for your project. A URL-safe slug will be generated automatically.',
  },
  PROJECT_REPO: {
    id: 'tip-project-repo',
    label: 'The Git repository to clone and build. Must be accessible from the server (HTTPS recommended).',
  },
  PROJECT_BRANCH: {
    id: 'tip-project-branch',
    label: 'The branch to build from. Defaults to "main" if left blank.',
  },

  // Service editor
  SERVICE_KIND: {
    id: 'tip-service-kind',
    label: 'Web services receive HTTP traffic. Worker services run background tasks without a public endpoint.',
  },
  SERVICE_EXPOSURE: {
    id: 'tip-service-exposure',
    label: 'Public services get an external URL. Internal services are only reachable by other services in the same project.',
  },
  CONTAINER_PORT: {
    id: 'tip-container-port',
    label: 'The port your application listens on inside the container.',
  },
  MEMORY_MB: {
    id: 'tip-memory-mb',
    label: 'Maximum memory allocation for this service container (in megabytes).',
  },
  HEALTH_CHECK_COMMAND: {
    id: 'tip-hc-command',
    label: "A shell command to probe service health (e.g. 'curl -f http://localhost:3000/health'). The container is marked unhealthy after consecutive failures.",
  },
  HEALTH_CHECK_INTERVAL: {
    id: 'tip-hc-interval',
    label: 'Time in seconds between health check probes.',
  },
  HEALTH_CHECK_TIMEOUT: {
    id: 'tip-hc-timeout',
    label: 'Maximum time in seconds each health check probe is allowed to run.',
  },
  HEALTH_CHECK_RETRIES: {
    id: 'tip-hc-retries',
    label: 'Number of consecutive failures before the container is considered unhealthy.',
  },
  HEALTH_CHECK_START_PERIOD: {
    id: 'tip-hc-start-period',
    label: 'Grace period in seconds before health checks start counting failures. Gives your app time to boot.',
  },
  RESTART_POLICY: {
    id: 'tip-restart-policy',
    label: "'always' restarts on any exit. 'on-failure' only restarts on non-zero exit codes. 'unless-stopped' restarts unless explicitly stopped.",
  },

  // Deployment actions
  REDEPLOY: {
    id: 'tip-redeploy',
    label: 'Re-runs the deployment with the same Git ref and configuration. Useful after pushing new commits.',
  },
  ROLLBACK: {
    id: 'tip-rollback',
    label: 'Reverts to the exact build artifact and config from this deployment.',
  },
  DEPLOYMENT_STATUS: {
    id: 'tip-deployment-status',
    label: 'queued → building → running. Deployments can be cancelled while queued or building.',
  },

  // Environment
  ENV_IMPORT: {
    id: 'tip-env-import',
    label: 'Paste or upload a .env file to bulk-import variables. Existing keys will be overwritten.',
  },
  ENV_EXPORT: {
    id: 'tip-env-export',
    label: 'Download all environment variables as a .env file.',
  },
  ENV_MASKED: {
    id: 'tip-env-masked',
    label: 'Click to reveal. Values are encrypted at rest.',
  },

  // Tokens
  TOKEN_SCOPES: {
    id: 'tip-token-scopes',
    label: 'Restrict what this token can access. Read scopes allow fetching data; write scopes allow mutations.',
  },
  TOKEN_ROTATE: {
    id: 'tip-token-rotate',
    label: 'Generates a new token value and revokes the old one. Connected integrations will need the new token.',
  },
  TOKEN_EXPIRATION: {
    id: 'tip-token-expiration',
    label: 'Optional. Tokens without an expiration remain valid until manually revoked.',
  },

  // Domains
  DOMAIN_ADD: {
    id: 'tip-domain-add',
    label: "Add a custom domain for your project. You'll need to add a TXT record to verify ownership.",
  },
  DOMAIN_VERIFY: {
    id: 'tip-domain-verify',
    label: 'Triggers a DNS lookup to check if the TXT verification record exists.',
  },
} as const satisfies Record<string, ContextualTipDefinition>;
