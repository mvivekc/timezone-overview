# Redshift Gateway

The vibe-redshift-gateway provides secure access to Datashop Redshift clusters. Three access methods:

| Port | Protocol | Use case |
|------|----------|----------|
| **5439** | PostgreSQL wire protocol v1 | Standard PostgreSQL drivers (`pgx`, `psycopg2`, `node-postgres`), `psql`, BI tools |
| **5440** | Redshift wire protocol v2 | Redshift-native JDBC/ODBC drivers, `amazon-redshift-python-driver` |
| **8443** | HTTP REST API | `curl`, scripts, ad-hoc queries — stateless `POST /query` with JSON |

Prefer wire protocols (5439/5440) for application code. HTTP API is for ad-hoc queries only.

## Setup

Declare in `vibecoding.yaml`:

```yaml
resources:
  datashop:
    type: redshift

env:
  REDSHIFT_HOST: ${{resources.datashop.host}}
  REDSHIFT_PORT: ${{resources.datashop.port}}
```

## Local Development

```bash
vibectl tunnel start --project <project-name> datashop
```

Creates three tunnels: localhost:5439 (wire v1), localhost:5440 (wire v2), localhost:8443 (HTTP REST API). The tunnel provides network access only — tokens must be provided explicitly.

Tunneling works after push without build/deploy (Redshift uses a shared gateway).

## Authentication

All connections use JWT (Keycloak token). The gateway validates the JWT, exchanges it for an AWS Identity Center token, and authenticates with Redshift.

The application code must handle **two scenarios**. Both use the same JWT mechanism but the token arrives differently.

### Scenario 1: Deployed on Vibe platform (EKS)

The Vibe auth-gateway sits in front of the application and injects an `X-Vibe-Gateway-Token` header containing the JWT into every incoming HTTP request. The application does not need to obtain or refresh the token — just read it from the request header.

- Token source: `X-Vibe-Gateway-Token` header on the incoming request
- Who provides it: the platform (auth-gateway), automatically
- Token refresh: not the application's concern — each request arrives with a fresh token
- What the code does: read the header value, pass it as the PostgreSQL password

### Scenario 2: Running locally during development

The developer runs `vibectl tunnel start` to reach the gateway (see Local Development above). The application reads the token from a **file on disk** pointed to by the `REDSHIFT_TOKEN_FILE` environment variable.

- Token source: file at the path in `REDSHIFT_TOKEN_FILE`
- Who provides it: `vibectl login` writes credentials to `~/.vibeconfig.yaml`. The developer sets `REDSHIFT_TOKEN_FILE` to point to that file (e.g. `export REDSHIFT_TOKEN_FILE=~/.vibeconfig.yaml`)
- Token refresh: `vibectl login` must be re-run when the token expires. The application must re-read the file on every new connection (never cache the token in memory)
- What the code does: read the file, parse the token (see format below), pass it as the PostgreSQL password

### Token resolution order in application code

Generated code must check these sources in order:

1. **Request header** — if the incoming request has `X-Vibe-Gateway-Token`, use its value. This is the deployed (EKS) path.
2. **Token file** — if `REDSHIFT_TOKEN_FILE` is set, read the file. This is the local development path.
3. **Neither** — throw an error explaining both options.

IMPORTANT: Do not fall back to hardcoded paths like `~/.vibeconfig.yaml`. The token file location is always explicit via `REDSHIFT_TOKEN_FILE`.

### Token file format

The file is YAML with a nested JSON string under the `auth_token` key:

```yaml
auth_token: '{"access_token":"eyJhbGciOiJSUzI1NiIs...","refresh_token":"eyJhbGciOiJSUzI1NiIs..."}'
```

Parsing rule: parse the file as YAML, extract the `auth_token` value, then JSON-parse that string to get `access_token`. Use proper YAML and JSON parsers — not regex.

### Wire protocol connection string

```
postgresql://oauth:<JWT_TOKEN>@<host>:<port>/<database>?sslmode=disable
```

- `user` is always the literal string `oauth`
- `password` is the JWT token
- `sslmode` must be `disable` — the gateway handles TLS termination, so the connection between the application and the gateway is plain TCP. Do not set `sslmode=require` or other SSL modes.
- The JWT is only validated during the connection handshake — an already-open connection is not terminated when the token expires. However, **do not rely on this for long-lived connections or pooling**. Always open a fresh connection with a fresh token for each query (see Token Lifetime and Connection Pooling below).

## Error Handling

### HTTP API Errors

| HTTP Status | `error_type` | Meaning |
|-------------|-------------|---------|
| `400` | `InvalidRequest` | Missing/invalid JSON body, missing `query` field |
| `401` | `AuthError` | Missing `Authorization` header or invalid JWT |
| `401` | `TokenExpired` | JWT has expired |
| `400` | `QueryError` | SQL execution error |
| `400` | `RowLimitExceeded` | Query returned more than 1000 rows (default limit) |

### Wire Protocol Errors

| PG Code | Message | Meaning |
|---------|---------|---------|
| `28P01` | `password (JWT) required` | No password/token provided |
| `28P01` | `JWT token expired` | Token has expired |
| `28000` | `invalid JWT token: ...` | Token is malformed or signature invalid |
| `28000` | `user parameter required` | Missing `user` in connection string |
| `3D000` | `database name required` | Missing database in connection string |

All wire protocol errors are `FATAL` — connection is terminated.

### Retry Strategy

| Token source | On auth error | Why |
|-------------|---------------|-----|
| **`REDSHIFT_TOKEN_FILE`** | Re-read file, retry once | Background process may have refreshed the token |
| **Request header** | Propagate error (return `401`) | Header can't change mid-request |

Match PG error codes `28P01` or `28000` (not error message strings). In `psycopg2` use `e.pgcode`, in `node-postgres` use `err.code`. For HTTP API, check `error_type` or HTTP status `401`.

## Token Lifetime and Connection Pooling

**CRITICAL: The JWT token is short-lived (minutes, not hours).** Because the token is passed as the PostgreSQL password, this has major implications for connection management.

### Why standard connection pooling breaks

Standard connection pools (e.g., `SQLAlchemy` `create_engine`, `node-postgres` `Pool`, `pgBouncer`, HikariCP) store connection parameters — including the password — at pool creation time. When the pool later opens a new connection (to replace an evicted one, or to grow), it reuses the **original token**, which is now expired. Result: `28P01` (authentication failure) errors in production.

This is not a regular password — it is a **short-lived credential masquerading as a password**. Treat it accordingly.

### Recommended pattern: connect-per-query with fresh token

For each query:

1. Resolve a **fresh token** (from the incoming request header, or by re-reading the token file)
2. Open a **new connection** using that token as the password
3. Execute the query
4. **Close the connection immediately**

The ~100-300ms connection overhead is acceptable for Redshift workloads, which are analytical (not OLTP).

### Anti-patterns

DO NOT generate code that:
- Creates a connection pool with a static token/password
- Caches a connection string containing a JWT for reuse across requests
- Uses `pgBouncer` or similar external connection poolers with JWT auth
- Opens a connection at application startup and reuses it for all subsequent requests

## Connection Patterns

| Pattern | How | When to use |
|---------|-----|-------------|
| **Connect-per-query** (recommended) | Fresh token → open → query → close | Default for all applications. Safe with short-lived tokens. |
| **Connection reuse within a single request** | Open once per incoming HTTP request, reuse for multiple queries in that request, close when request ends | Multiple Redshift queries in one API call. Token is fresh from the request header. |

## Schema Discovery

```sql
SELECT schema_name FROM information_schema.schemata;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'my_schema';
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'my_schema' AND table_name = 'my_table';
SELECT * FROM my_schema.my_table LIMIT 10;
```

Always use LIMIT (HTTP API default max: 1000 rows).
