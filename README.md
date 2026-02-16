<p align="center">
  <a href="https://floww.dev">
    <picture>
      <img alt="Floww logo" src="./.github/assets/floww_logo_full.png" width="300">
    </picture>
  </a>
</p>

# Floww

**The complete Floww platform - monorepo containing the web dashboard, API server, and Floww SDK.**

This repository powers the Floww automation platform at [app.floww.dev](https://app.floww.dev), providing users with a code-first framework for building production-ready workflow automations.

## What is Floww?

Floww is a code-first framework for building production-ready workflow automations. Replace complex orchestration tools with simple TypeScript code. Build workflows that respond to webhooks, run on schedules, integrate with AI, and connect to external services - all with full type safety.

```typescript
import { GitHub, Slack } from "floww";

const github = new GitHub();
const slack = new Slack();
gs
github.triggers.onPush({
  owner: "my-org",
  repository: "my-repo",
  handler: async (ctx, event) => {
    await slack.actions.sendMessage({
      channel: '#deployments',
      text: `🚀 New push to ${event.repository.name}`
    });
  }
});
```

## Repository Structure

This is a monorepo containing:

- **Dashboard** (`/src`, `/server`) - The web UI and backend API for managing workflows, providers, and deployments
- **Floww SDK** (`/packages/sdk`) - The TypeScript SDK and CLI that developers use to build workflows
- **Claude Plugin** (`/.claude-plugin`, `/skills`) - Official Claude Code plugin for building Floww automations
- **Database** (`/server/db`) - PostgreSQL schema and migrations using Drizzle ORM
- **Worker** (`/server/jobs`) - Background job processing with Graphile Worker

## Features

### Dashboard & Platform
- User authentication and account management
- Workflow deployment and hosting infrastructure
- Real-time workflow execution monitoring
- Provider configuration and OAuth flows
- Usage analytics and billing integration
- Admin interface for platform management

### Floww SDK
- Connect any external service with webhook and event triggers
- Schedule workflows with cron expressions, no infrastructure needed
- Agent builder integrated with OpenAI, Anthropic, and Google AI
- Hot reload in development for instant feedback
- 100% TypeScript with full type safety and autocomplete
- One-command deployment to production-ready infrastructure
- Built-in providers for GitLab, Slack, Google Calendar, and more
- Local testing with real webhook URLs during development

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm 8+
- Docker (optional, for containerized development)

## Quick Start

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development setup instructions.

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Run database migrations
pnpm db:migrate

# Start the development server
pnpm dev

# In another terminal, start the worker
pnpm worker
```

## Claude Code Plugin

This repository includes the official Claude Code plugin for Floww, which helps Claude understand the Floww SDK and build workflow automations correctly.

### Using the Plugin

The plugin is located in the `.claude-plugin/` and `skills/` directories at the repository root. When you open this repository in Claude Code, the plugin is automatically available.

The plugin activates when you:
- Mention "automations", "workflows", or "triggers"
- Ask Claude to help build Floww integrations
- Use Floww SDK commands

### Plugin Features

- Comprehensive provider documentation and examples
- Correct patterns for triggers, actions, and AI integrations
- Step-by-step guidance for scaffolding, testing, and deploying workflows
- Support for all Floww providers (GitHub, Slack, Discord, Jira, GitLab, and more)

For more information about the plugin, see `skills/floww/SKILL.md`.

## Documentation

For detailed documentation about using Floww, visit [floww.dev](https://floww.dev)

- [Quick Start Guide](https://floww.dev/docs/getting-started/quick-start)
- [Running Locally](https://floww.dev/docs/running-locally)
- [All Providers](https://floww.dev/docs/providers)
- [Architecture](https://floww.dev/docs/advanced/architecture)

## Community

Join our Discord community to get help, share workflows, and connect with other developers:

[Join Discord →](https://discord.gg/D9bughShqn)

## Project Structure

```
floww/
├── .claude-plugin/         # Claude Code plugin metadata
│   ├── plugin.json         # Plugin manifest
│   └── marketplace.json    # Marketplace configuration
├── skills/                 # Claude Code skill definitions
│   └── floww/              # Floww SDK skill
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── routes/            # Tanstack Router routes
│   └── lib/               # Frontend utilities
├── server/                # Backend API and services
│   ├── api/              # API routes (Hono)
│   ├── db/               # Database schema and migrations
│   ├── jobs/             # Background worker tasks
│   └── services/         # Business logic
├── packages/
│   └── sdk/              # Floww SDK (published to npm as 'floww')
│       ├── cli/          # CLI implementation
│       ├── runtime/      # Runtime for executing workflows
│       └── providers/    # Integration providers
└── docker/               # Docker configuration

```

## Tech Stack

### Frontend
- React 19 with TypeScript
- Tanstack Router for routing
- Tanstack Query for data fetching
- Tailwind CSS for styling
- Vite for build tooling

### Backend
- Hono for API server
- PostgreSQL + Drizzle ORM
- Graphile Worker for background jobs
- Better Auth for authentication
- Pino for logging

### Infrastructure
- AWS Lambda for workflow execution
- Docker for containerization
- Stripe for payments
- Sentry for error tracking

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup guide
- Coding standards and conventions
- Testing requirements
- Pull request process

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Links

- [Website](https://floww.dev)
- [Documentation](https://floww.dev/docs)
- [Discord Community](https://discord.gg/D9bughShqn)
- [npm Package](https://www.npmjs.com/package/floww)
