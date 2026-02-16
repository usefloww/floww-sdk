# Seed the local database with development fixtures (skips if data already exists)
seed:
    pnpm db:seed

# Wipe all data and re-seed the local database from scratch
reseed:
    pnpm db:seed:reset

# Build Docker image (tests the Dockerfile)
build-docker:
    docker build -t floww:test .
    docker run --rm -p 3000:3000 floww:test

# Pull environment variables from AWS Parameter Store to .env
env-pull:
    pnpm env:pull

# Push environment variables from .env to AWS Parameter Store (with interactive diff)
env-push:
    pnpm env:push

