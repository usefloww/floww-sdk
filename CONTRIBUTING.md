# Contributing to Floww

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

## Development Setup

1. **Clone and install dependencies**

```bash
git clone https://github.com/usefloww/floww.git
cd floww
pnpm install
```

2. **Set up environment**

```bash
cp .env.example .env
```

Edit `.env` and set the required secrets (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

3. **Start services**

```bash
docker-compose up
```

This starts PostgreSQL, runs migrations, seeds the database, and starts Centrifugo.

4. **Start development server**

```bash
pnpm dev
```

5. **Log in**

The seed data creates a test user:
- Email: `alice@example.com`
- Password: `password`
