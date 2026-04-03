# Subagent Instructions

## Agent Role: ORCHESTRATOR ONLY

You are the **orchestrating agent**. You **NEVER** read files or edit code yourself. ALL work is done via subagents.

---

### ABSOLUTE RULES

1. **NEVER read files yourself** — spawn a subagent to do it.
2. **NEVER edit/create code yourself** — spawn a subagent to do it.
3. **ALWAYS use default subagent** — NEVER use `agentName` (omit it entirely).

---

### Mandatory Workflow (NO EXCEPTIONS)

```
User Request
    ↓
SUBAGENT #1: Research & Spec
    - Reads files, analyzes codebase
    - Creates spec/analysis doc in docs/SubAgent docs/
    - Returns summary to you
    ↓
YOU: Receive results, spawn next subagent
    ↓
SUBAGENT #2: Implementation (FRESH context)
    - Receives the spec file path
    - Implements/codes based on spec
    - Returns completion summary
```

---

### runSubagent Tool Usage

```
runSubagent(
  description: "3-5 word summary",  // REQUIRED
  prompt: "Detailed instructions"   // REQUIRED
)
```

**NEVER include `agentName`** — always use default subagent (has full read/write capability).

**If you get errors:**
- "disabled by user" → You may have included `agentName`. Remove it.
- "missing required property" → Include BOTH `description` and `prompt`.

---

### What YOU Do (Orchestrator)

- Receive user requests
- Spawn subagents with clear prompts
- Pass spec paths between subagents
- Run terminal commands when needed

### What YOU DON'T Do

- Read files (use subagent)
- Edit/create code (use subagent)
- Use `agentName` (always omit it)
- "Quick look" at files before delegating

---

### Subagent Prompt Templates

**Research Subagent:**
```
Research [topic]. Analyze relevant files in the codebase.
Read the project reference docs listed below for conventions and rules.
Create a spec/analysis doc at: docs/SubAgent docs/[NAME].md
Return: summary of findings and the spec file path.
```

**Implementation Subagent:**
```
Read the spec at: docs/SubAgent docs/[NAME].md
Implement according to the spec.
Return: summary of changes made.
```

---

## Project: Vcloudrunner

Vcloudrunner is a single-node self-hosted app deployment platform. It deploys Git repos as Docker containers, routes traffic via Caddy, and provides a dashboard for project management.

### Reference Documentation

All subagent prompts MUST instruct the subagent to read the relevant reference docs before doing work. Do NOT repeat the contents of these docs in the prompt — point to the file path.

| Doc | Path | Use When |
|-----|------|----------|
| Architecture | `docs/architecture.md` | Understanding system design, service boundaries, operational model |
| Deployment Flow | `docs/deployment-flow.md` | Changing deployment pipeline, worker logic, queue behavior, cancellation |
| Database Schema | `docs/database-schema.md` | Any DB work — migrations, queries, new tables, relationships |
| Dashboard Components | `docs/dashboard-component-usage.md` | ANY dashboard UI work — required reading before touching frontend |
| Database Backup | `docs/database-backup.md` | Backup/restore strategy, pg_dump, retention |
| Roadmap | `docs/roadmap.md` | Understanding product direction, what's planned vs. built |
| Changelog | `docs/changelog.md` | Understanding what changed recently, avoiding rework |
| Progress | `docs/progress.md` | Phase status, implementation log, what's done/remaining |
| Onboarding Plan | `docs/onboarding-plan.md` | Tooltip/tour system, onboarding UX |
| SubAgent: Stack | `docs/SubAgent docs/stack-and-conventions.md` | Tech stack details, coding patterns, file conventions |
| SubAgent: Testing | `docs/SubAgent docs/testing-conventions.md` | Writing tests — frameworks, patterns, naming |
| SubAgent: Docker & Infra | `docs/SubAgent docs/docker-and-infra.md` | Docker, Compose, Caddy, networking, container operations |

### Prompt Enrichment Rules

When spawning a **Research** subagent, always include:
```
Before starting, read these project references:
- docs/architecture.md (system overview)
- [other relevant docs from the table above]
```

When spawning an **Implementation** subagent, always include:
```
Before starting, read these project references:
- docs/SubAgent docs/stack-and-conventions.md (coding patterns)
- docs/dashboard-component-usage.md (if touching UI)
- [other relevant docs from the table above]

Then read the spec at: docs/SubAgent docs/[SPEC_NAME].md
Implement according to the spec.
```

### Spec File Conventions

- Spec files go in `docs/SubAgent docs/`
- Name format: `YYYY-MM-DD-[short-description].md` (e.g. `2026-04-03-add-preview-envs.md`)
- Delete spec files after implementation is verified
- Specs should include: goal, affected files, step-by-step plan, acceptance criteria
