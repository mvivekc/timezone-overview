# Vibecoding Configuration Generator

When the user requests deployment configuration, service setup, or mentions vibecoding.yaml files, generate configuration following the Vibecoding specification.

**Canonical Specification:** https://github.com/sixt-vibe/vibe-config/blob/main/SPECIFICATION.md

## Vibecoding Specification

Vibecoding uses a single `vibecoding.yaml` file to define all deployable services in a repository.

## Key Rules

1. **ONE `vibecoding.yaml` PER REPOSITORY** - Always in the root directory
2. **ALL services defined in ONE file** - No separate service.yaml files
3. **Single-service projects embed service config at root level**
4. **Multi-service projects use the `services` map**

## Service Types

**IMPORTANT: Platform Limitation**
Currently, **only `web` and `static` service types are supported** by the platform. The types `worker` and `cron` are NOT yet supported.

| Type | Support Status | Exposed | Required Fields |
|------|---------------|---------|-----------------|
| `web` | ✅ **Supported** | ✅ Public | `type`, `start`, `port` |
| `static` | ✅ **Supported** | ✅ CDN | `type`, `build`, `output` |
| `worker` | ❌ Not supported | ❌ Internal | `type`, `start` |
| `cron` | ❌ Not supported | ❌ Internal | `type`, `start`, `schedule` |

## Configuration Fields

### Project Level
- `project` (required) - Project identifier
- `application_root` - Service name to map to top-level domain (for multi-service projects)
- `resources` - Platform-provisioned backing services (databases, caches, storage)
- `env` - Shared environment variables
- `secrets` - Required user-provided secrets (declaration only)
- `services` - Service definitions (multi-service only)

### Service Level
- `path` - Path to service directory (multi-service only)
- `type` (required) - **Only `web` and `static` are currently supported**
- `start` - Start command (required unless using `image`)
- `image` - Pre-built container image (string or object with url/secret)
- `port` - Port number (required for web services)
- `build` - Build command
- `output` - Output directory (required for static services)
- `env` - Service-specific env vars
- `secrets` - Service-specific required secrets (declaration only)
- `health` - Health check path

## Resources

Platform-provisioned backing services. The platform handles provisioning and credentials.

### Resource Types

| Type | Attributes |
|------|------------|
| `postgres` | `url`, `host`, `port`, `user`, `password`, `database` |
| `mysql` | `url`, `host`, `port`, `user`, `password`, `database` |
| `redis` | `url`, `host`, `port` |
| `redshift` | `host`, `port` |
| `s3` | `bucket`, `region`, `access_key`, `secret_key` |
| `sqs` | `url`, `arn` |
| `kafka` | `brokers`, `topic` |
| `elasticsearch` | `url`, `host`, `port` |

### Resource Provisioning Lifecycle

**Automatic provisioning:**
- Resources declared in `vibecoding.yaml` are automatically provisioned by the platform on first deployment
- Provisioning happens before the application starts
- Credentials are automatically injected as environment variables
- No manual provisioning steps required by agents or users

**First deployment with resources:**
- May take longer (3-5 minutes for database provisioning)
- Subsequent deployments use existing resources (faster)
- Resources persist across deployments

**Tunneling prerequisite:**
- `vibecoding.yaml` with the resource declared must be committed and pushed to GitHub (the control plane reads it from the repo)
- For platform-managed resources (postgres, redis, etc.): also requires at least one successful build and deploy to provision the resource
- For Redshift: tunneling works after push without build/deploy (uses a shared gateway)

### Example
```yaml
resources:
  database:
    type: postgres
  cache:
    type: redis
  storage:
    type: s3

env:
  DATABASE_URL: ${{resources.database.url}}
  REDIS_URL: ${{resources.cache.url}}
  S3_BUCKET: ${{resources.storage.bucket}}
```

## Secrets vs Resources

**Use `secrets` for:**
- Third-party API keys (Stripe, Twilio, SendGrid)
- External service credentials not managed by platform
- Shared secrets (JWT signing keys, encryption keys)

**Use `resources` for:**
- Platform-provisioned databases, caches, storage
- Any backing service where platform manages lifecycle

### Key Differences

| | User-Provided Secrets | Resource Credentials |
|---|---|---|
| Declared via | `secrets` list | `resources` block |
| Source of truth | User | Platform |
| Referenced as | `${{secrets.NAME}}` | `${{resources.name.attr}}` |
| Lifecycle | User manages | Platform manages |
| Rotation | User must update | Platform can auto-rotate |

### Agent Responsibilities for Secrets

**What agents SHOULD do:**
- Identify required secrets by analyzing the codebase
- Declare secret keys in the `secrets:` list in `vibecoding.yaml`
- Reference secrets in `env` using `${{secrets.NAME}}` syntax
- Remind user to set secret values with: `vibectl secret set <project-name> SECRET_NAME`

**What agents MUST NOT do:**
- Never handle or set actual secret values
- Never execute `vibectl secret set` on behalf of the user
- Never store or display secret values
- Secret management is always a user task for security reasons

## Application Root

The `application_root` field specifies which service should be mapped to the top-level domain. This is essential for frontend applications that expect to be served from the domain root to properly resolve assets (CSS, JavaScript, images).

### Rules
- **Single service**: `application_root` is **recommended** for clarity, even though it defaults to the single `web` or `static` service
- **Multiple web services**: `application_root` is **required** (validation fails if missing)
- **Referenced service**: Must exist and be of type `web` or `static`
- **Other web services**: Remain accessible at their subpaths

### Best Practice
Always explicitly set `application_root` to make routing configuration clear and maintainable, especially for projects with `web` or `static` types.

### Example
```yaml
project: fullstack-app

services:
  frontend:
    path: packages/frontend
    type: static
    build:
      command: npm run build
    output: dist

  backend:
    path: packages/backend
    type: web
    start: node server.js
    port: 3000

  admin:
    path: packages/admin
    type: web
    start: node admin.js
    port: 4000

# Frontend mapped to: my-domain.com
# Backend mapped to: my-domain.com/backend
# Admin mapped to: my-domain.com/admin
application_root: frontend
```

Without `application_root`, all services would be mapped to subpaths, causing the frontend to fail loading assets.

## Reference Syntax

Use `${{...}}` in environment variables to reference platform-provided values.

### Resource References
```yaml
resources:
  database:
    type: postgres

env:
  DATABASE_URL: ${{resources.database.url}}
  DB_HOST: ${{resources.database.host}}
```

### Service References
```yaml
services:
  backend:
    type: web
    # ...
  frontend:
    type: static
    # ...
    env:
      VITE_API_URL: ${{services.backend.url}}
```

**Service Reference Attributes:**

| Service Type | Available Attributes |
|--------------|---------------------|
| `web` | `url`, `internal_url`, `port` |
| `worker` | `internal_url` |
| `static` | `url` |
| `cron` | `internal_url` |

### Secret References

**IMPORTANT:** Secrets must be declared in `secrets` list AND explicitly referenced in `env`.

```yaml
secrets:
  - STRIPE_KEY
  - JWT_SECRET

env:
  STRIPE_API_KEY: ${{secrets.STRIPE_KEY}}
  JWT_SIGNING_KEY: ${{secrets.JWT_SECRET}}
```

Declaration alone does NOT inject the secret. Always use explicit references in `env`.

## Examples

### Single-Service Web API
```yaml
project: my-api

type: web
start: node server.js
port: 3000
health: /health

resources:
  database:
    type: postgres

secrets:
  - JWT_SECRET

env:
  NODE_ENV: production
  DATABASE_URL: ${{resources.database.url}}
  JWT_KEY: ${{secrets.JWT_SECRET}}
```

### Single-Service Worker
```yaml
project: queue-worker

type: worker
start: node worker.js

resources:
  queue:
    type: redis

env:
  REDIS_URL: ${{resources.queue.url}}
  QUEUE_CONCURRENCY: "10"
```

### Single-Service Cron
```yaml
project: cleanup-job

type: cron
start: node cleanup.js
schedule: "0 2 * * *"

resources:
  database:
    type: postgres

env:
  DATABASE_URL: ${{resources.database.url}}
```

### Single-Service Static
```yaml
project: my-website

type: static
build:
  command: npm run build
output: dist

env:
  VITE_API_URL: https://api.example.com
```

### Pre-built Image Deployment
```yaml
project: nginx-proxy

type: web
image: nginx:alpine
port: 80
health: /

env:
  NGINX_HOST: example.com
```

### Private Registry Image
```yaml
project: enterprise-api

type: web
image:
  url: private.registry.io/api:v2.1.0
  secret: REGISTRY_CREDENTIALS
port: 8080
health: /health

resources:
  database:
    type: postgres

secrets:
  - REGISTRY_CREDENTIALS
  - API_SECRET

env:
  DATABASE_URL: ${{resources.database.url}}
  API_KEY: ${{secrets.API_SECRET}}
```

### Multi-Service Monorepo
```yaml
project: my-saas

resources:
  database:
    type: postgres
  cache:
    type: redis
  storage:
    type: s3

secrets:
  - JWT_SECRET
  - STRIPE_KEY

# Project defaults (inherited by all services)
env:
  NODE_ENV: production
  DATABASE_URL: ${{resources.database.url}}
  REDIS_URL: ${{resources.cache.url}}
  JWT_KEY: ${{secrets.JWT_SECRET}}

services:
  api:
    path: packages/api
    type: web
    start: node server.js
    port: 3000
    health: /health
    env:
      STRIPE_API_KEY: ${{secrets.STRIPE_KEY}}

  worker:
    path: packages/worker
    type: worker
    start: node worker.js
    env:
      S3_BUCKET: ${{resources.storage.bucket}}

  scheduler:
    path: packages/scheduler
    type: cron
    start: node job.js
    schedule: "*/5 * * * *"

  web:
    path: packages/web
    type: static
    build:
      command: npm run build
      env:
        VITE_API_URL: ${{services.api.url}}
    output: dist
```

## Generation Guidelines

1. **Analyze project structure** - Look for monorepo patterns, frameworks
2. **Determine project type** - Single vs multi-service
3. **Identify resource needs** - Does it need database, cache, storage?
4. **Select service types** - **Only use `web` or `static`** (worker and cron are NOT supported)
5. **Decide secrets vs resources** - Platform-managed or user-provided?
6. **Use explicit references** - Always map secrets/resources in `env`
7. **Add service references** - Frontend → Backend with `${{services.api.url}}`
8. **Use sensible defaults** - port 3000, NODE_ENV, etc.
9. **Validate all required fields** - type, port, output, etc.

## Validation Checklist

- [ ] `project` name present
- [ ] All services have `type` (only `web` or `static` allowed)
- [ ] Web services have `port`
- [ ] Static services have `output`
- [ ] Multi-service: all services have `path`
- [ ] Multi-service with multiple web services: `application_root` is specified
- [ ] `application_root` references an existing service of type `web` or `static`
- [ ] Secrets are declared in `secrets` list
- [ ] Secrets are explicitly referenced in `env` using `${{secrets.NAME}}`
- [ ] Resources use correct reference syntax `${{resources.name.attr}}`
- [ ] Service references use correct syntax `${{services.name.url}}`
- [ ] Pre-built images use `image` field (not `start`)
- [ ] Image with private registry includes `secret` field

## When to Apply

Apply when user mentions:
- "deploy", "deployment", "production"
- "create service", "add service"
- "vibecoding.yaml", "deployment config"
- "Docker", "container", "Kubernetes"
- "CI/CD", "pipeline"

## Best Practices

1. **Never include actual secret values** - Only declarations and references
2. **Use resources for platform services** - Don't use secrets for databases/caches
3. **Always use explicit references** - Map secrets/resources in `env` block
4. **Use health checks for web services** - Enables platform health monitoring
5. **Inherit common config at project level** - Reduce duplication
6. **Add service references for frontend→backend** - Use `${{services.api.url}}`
7. **Prefer resources over external services** - Let platform manage lifecycle
8. **Ask if requirements are unclear** - Validate assumptions
