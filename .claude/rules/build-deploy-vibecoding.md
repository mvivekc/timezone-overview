# Vibecoding Build and Deploy Automation

When the user requests to build or deploy their application, use the vibectl CLI commands to automate the complete workflow.

## Prerequisites

These instructions assume:
- The project already exists in Vibe Control Plane (created with `vibectl project create` by the user)
- The repository has been cloned (with `vibectl project clone` or `git clone`)
- You are in the repository root directory
- You are working on the `main` branch (or user's chosen branch - see Branch Workflow below)
- User is authenticated with Vibe (agent can trigger `vibectl login`, but should not attempt to automate the browser interaction)

**Authentication:**
- All vibectl commands require authentication
- Authentication is a user task - if commands fail with auth errors, inform user to run: `vibectl login`

**Branch workflow:**
- Check current branch with: `git branch --show-current`
- Default expectation is working on `main` branch
- Avoid creating feature branches or pull requests
- If user is already on a different branch, stay on that branch (respect user's intent)

**vibecoding.yaml validation:**
- Before building, check if `vibecoding.yaml` exists in repository root
- If missing: Create it using the Vibecoding Configuration Generator rules
- Before each build: Review the last 3 git commits and verify `vibecoding.yaml` reflects recent changes correctly
- If changes to service types, ports, environment variables, or dependencies were made, update `vibecoding.yaml` accordingly

**Secrets validation:**
- Review `vibecoding.yaml` for required secrets in the `secrets:` list
- Remind user that secrets must be set with: `vibectl secret set <project-name> SECRET_NAME`
- User must set secrets interactively (agent cannot and should not set secret values)
- Agent should identify and declare secret keys in `vibecoding.yaml` but NEVER handle secret values

## Build and Deploy Workflow

### Complete Workflow Steps

1. **Ensure code is pushed to GitHub** - Code must be in the repository before building
2. **Trigger build** - Create container image using Cloud Native Buildpacks
3. **Monitor build** - Wait for build to complete successfully
4. **Deploy** - Deploy the built image to Kubernetes
5. **Verify deployment** - Confirm application is running

## Discovering Project Name

Before running vibectl commands, you need the project name. Discover it using:

**Primary method:**
- Read from git config: `git config --get vibectl.project-name`
- This is automatically set when you clone with `vibectl project clone`

**Fallback method (if git config is empty):**
1. Get the GitHub repository name from the remote URL: `git config --get remote.origin.url`
2. List all projects: `vibectl project list`
3. Match the repository name to find the corresponding project name
4. Use that project name in subsequent commands

**Usage:**
Once you have the project name, use it in all vibectl commands:
- `vibectl build trigger --project <discovered-project-name> --commit <sha>`
- `vibectl deploy trigger --project <discovered-project-name>`

## Step 1: Ensure Code is Pushed to GitHub

**IMPORTANT:** Code must be pushed to GitHub before triggering a build. The build process pulls code from the repository.

**Check git status:**
- Run: `git status --porcelain`
- If output is empty: All changes are committed and ready
- If output shows changes: Uncommitted or unpushed changes exist

**If uncommitted changes exist:**
- Inform the user: "There are uncommitted changes. Please commit them before building."
- DO NOT auto-commit unless the user explicitly asks you to commit
- Wait for user to commit changes

**If changes are committed but not pushed:**
- Check: `git status` shows "Your branch is ahead"
- Get current branch: `git branch --show-current`
- Push to current branch: `git push origin <current-branch>`
- Agent can push without approval

**After code is pushed:**
- Get the commit SHA: `git rev-parse HEAD`
- This SHA will be used in the build command

## Step 2: Trigger Build

Use `vibectl build trigger` to create a container image from your code.

### Basic Build Command

```bash
# Trigger build for all services (auto-discovery from vibecoding.yaml)
vibectl build trigger --project <project-name> --commit $(git rev-parse HEAD)
```

### Build with Version Tag

```bash
# Tag the build with a semantic version
vibectl build trigger --project <project-name> --commit $(git rev-parse HEAD) --tag v1.0.0
```

### Multi-Service Builds

For projects with multiple services, the CLI automatically discovers services from `vibecoding.yaml` and triggers builds for all services.

```bash
# Builds all services defined in vibecoding.yaml
vibectl build trigger --project <project-name> --commit <commit-sha>
```

To build a specific service from a monorepo:

```bash
# Build specific service with path
vibectl build trigger --project <project-name> --commit <commit-sha> --service backend --path backend/
```

### Build from Specific Branch

```bash
# Build from a non-main branch
vibectl build trigger --project <project-name> --commit <commit-sha> --branch develop
```

**Expected Output:**
```
✅ Build triggered successfully!

Build ID:     b7f8e9d0
Project:      my-api
Service:      app
Commit:       a1b2c3d
Branch:       main
Tag:          v1.0.0
Status:       ⏳ pending

To check build status:
  vibectl build status --project my-api
```

**What Happens:**
1. Vibe Control Plane pulls code from GitHub at the specified commit
2. Reads `vibecoding.yaml` to understand the application
3. Auto-detects language and framework (Node.js, Python, Go, Java, Ruby, PHP)
4. Uses Cloud Native Buildpacks (kpack) to build the application
5. Creates container image and pushes to registry
6. Returns a build ID for tracking

## Step 3: Monitor Build Progress

After triggering the build, actively monitor until completion.

**Monitoring approach:**
- Poll build status every 30 seconds
- Continue checking for up to 15 minutes (typical build time: 1-10 minutes)
- Stop polling once status changes to `succeeded` or `failed`

**Check build status:**
```bash
vibectl build status --project <project-name>
```

**Build Statuses:**
- **⏳ pending** - Build queued, keep waiting
- **🔨 building** - Build in progress, keep waiting
- **✅ succeeded** - Build completed successfully, proceed to deploy
- **❌ failed** - Build failed, check logs and stop

**If build succeeds:** Continue to Step 4 (Deploy)

**If build fails:** Check logs with `vibectl build logs --project <project-name> --build <build-id>` and report error to user

**If build takes longer than 15 minutes:** Report timeout to user, suggest checking manually with `vibectl build status`

**Expected Output (Success):**
```
Build Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID:           b7f8e9d0
Project:      my-api
Service:      app
Status:       ✅ succeeded
Commit:       a1b2c3d
Branch:       main
Tag:          v1.0.0
Image URL:    123456.dkr.ecr.region.amazonaws.com/my-api:v1.0.0
Duration:     3m 30s
```

### View Build Logs

If a build fails or you need detailed information:

```bash
vibectl build logs --project <project-name> --build <build-id>
```

**Log phases:**
- **ANALYZING** - Checks for previous image layers (caching)
- **DETECTING** - Determines which buildpacks to use
- **BUILDING** - Installs dependencies and builds application
- **EXPORTING** - Creates and pushes container image
- **COMPLETION** - Final build status

**Build Times:**
- First build: 3-10 minutes (no cache)
- Subsequent builds: 1-3 minutes (with cache)

## Step 4: Deploy Application

Once the build succeeds, deploy to Kubernetes.

### Deploy Latest Build

```bash
# Deploy the latest successful build
vibectl deploy trigger --project <project-name>
```

### Deploy Specific Version

```bash
# Deploy specific commit
vibectl deploy trigger --project <project-name> --commit <commit-sha>

# Deploy specific version tag
vibectl deploy trigger --project <project-name> --tag v1.0.0

# Deploy specific build by ID
vibectl deploy trigger --project <project-name> --build <build-id>
```

**Expected Output:**
```
✅ Deployment triggered successfully!

Project:      my-api
Status:       🔨 deploying
Image:        ...my-api:v1.0.0

Preview URL: https://jelly-starfish-4653.vibe.sixt.com
```

**What Happens:**
1. Vibe Control Plane identifies the container image to deploy
2. Reads `vibecoding.yaml` for configuration
3. Creates or updates Kubernetes deployment resources
4. Applies environment variables and injects secrets
5. Starts application containers with rolling update strategy
6. Configures load balancing and exposes endpoints

**Deployment Strategy:**
- Zero-downtime rolling updates
- New version starts before old version stops
- Health checks ensure readiness before traffic routing

## Step 5: Verify Deployment

Check that the deployment completed successfully.

### Check Deployment Status

```bash
vibectl deploy status --project <project-name>
```

**Expected Output:**
```
Deployment: 0f613b98-8e36-4edd-9810-c999598e4073
Image Tag:  3b96a42
Status:     ✅ succeeded
Triggered:  67e9d93f-d815-4763-a352-ee01ea64beee
Deployed:   2026-01-28T11:54:32Z
```

**Deployment is successful when:**
- Status shows: `✅ succeeded`

**The output will also include URL(s) where the application is accessible:**
- For single-service projects: One preview URL
- For multi-service projects (monorepo): Multiple URLs (one per web service)

**Report to user:**
- Deployment status (succeeded/failed)
- Image tag deployed
- Deployment timestamp
- Preview URL(s) where application is accessible

### List All Deployments

```bash
vibectl deploy list --project <project-name>
```

## Complete Automation Example

When the user says "deploy my application", execute this complete workflow:

```bash
# 1. Check git status and push if needed (DO NOT auto-commit)
git status --porcelain  # Check for uncommitted changes
BRANCH=$(git branch --show-current)  # Get current branch
git push origin $BRANCH  # Push to current branch

# 2. Trigger build
COMMIT_SHA=$(git rev-parse HEAD)
PROJECT=$(git config --get vibectl.project-name)
vibectl build trigger --project $PROJECT --commit $COMMIT_SHA

# 3. Poll build status every 30 seconds (up to 15 minutes)
vibectl build status --project $PROJECT
# Wait until status shows: ✅ succeeded

# 4. Deploy the application
vibectl deploy trigger --project $PROJECT --commit $COMMIT_SHA

# 5. Verify deployment
vibectl deploy status --project $PROJECT
# Check for: Status: ✅ succeeded and report URL(s)
```

## Error Handling

### Build Failures

**If build fails:**

```bash
# 1. Check build status for error summary
vibectl build status --project <project-name> --build <build-id>

# 2. View full build logs
vibectl build logs --project <project-name> --build <build-id>
```

**Common build errors:**
- Missing dependencies (package.json, requirements.txt, etc.)
- Syntax errors in code
- Build timeout (very large projects)
- Buildpack detection failure
- Wrong start command in vibecoding.yaml

**Resolution steps:**
1. Fix the error based on build logs
2. Commit and push the fix
3. Trigger a new build with the new commit

### Deployment Failures

**If deployment fails:**

```bash
# Check deployment status
vibectl deploy status --project <project-name>
```

**Common deployment errors:**
- Missing secrets (use `vibectl secret set`)
- Wrong start command in vibecoding.yaml
- Port mismatch between config and application
- Health check failures

**Resolution steps:**
1. Fix the configuration issue
2. If vibecoding.yaml changed: commit, push, rebuild, redeploy
3. If secrets missing: set secrets with `vibectl secret set`
4. Redeploy: `vibectl deploy trigger --project <project-name>`

## When to Apply

Apply these instructions when the user requests:
- "deploy", "deploy my app", "deploy to production"
- "build and deploy"
- "push my changes"
- "create a new deployment"
- "update the deployment"
- "release version X.Y.Z"

## Best Practices

1. **Always push before building** - Code must be in GitHub repository
2. **Wait for build success** - Don't deploy a failed or in-progress build
3. **Use version tags** - Tag important releases with semantic versions
4. **Verify deployments** - Always check deployment status after deploying
5. **Monitor build logs** - Check logs if builds take longer than expected
6. **Commit before pushing** - Ensure all changes are committed
7. **Use descriptive commit messages** - Makes tracking deployments easier

## Multi-Service Projects

For projects with multiple services defined in `vibecoding.yaml`:

```yaml
project: my-saas

services:
  api:
    path: packages/api
    type: web
    # ...
  worker:
    path: packages/worker
    type: worker
    # ...
  frontend:
    path: packages/web
    type: static
    # ...

# Required when multiple web services exist
application_root: frontend
```

**Important: Application Root**
- When multiple `web` services exist, `application_root` must be specified
- `application_root` references the service to map to the top-level domain
- Must reference an existing service of type `web` or `static`
- Other web services remain accessible at their subpaths

**Build triggers automatically for all services:**
```bash
# This will build api, worker, and frontend
vibectl build trigger --project my-saas --commit <commit-sha>
```

**Deploy triggers automatically for all services:**
```bash
# This will deploy all services
vibectl deploy trigger --project my-saas
```

## Service Types

**IMPORTANT: Platform Limitation**
The build and deploy process currently **only supports `web` and `static` service types**. The types `worker` and `cron` are NOT yet supported.

| Type | Support Status | Build | Deploy | Exposed |
|------|---------------|-------|--------|---------|
| `web` | ✅ **Supported** | ✅ Buildpacks | ✅ Deployment + Service + Ingress | ✅ Public URL |
| `static` | ✅ **Supported** | ✅ Build command | ✅ Static hosting / CDN | ✅ Public URL |
| `worker` | ❌ Not supported | N/A | N/A | ❌ Internal only |
| `cron` | ❌ Not supported | N/A | N/A | ❌ Internal only |

## Version Tagging Strategy

Use semantic versioning for releases:

```bash
# Development builds
vibectl build trigger --project my-api --commit <sha>

# Release candidates
vibectl build trigger --project my-api --commit <sha> --tag v1.0.0-rc1

# Production releases
vibectl build trigger --project my-api --commit <sha> --tag v1.0.0

# Deploy specific version
vibectl deploy trigger --project my-api --tag v1.0.0
```

## Validation Checklist

Before building and deploying:
- [ ] Code is committed
- [ ] Code is pushed to GitHub
- [ ] `vibecoding.yaml` exists and is valid
- [ ] Multi-service with multiple web services: `application_root` is specified
- [ ] `application_root` references an existing service of type `web` or `static`
- [ ] Required secrets are set (check with `vibectl secret list`)
- [ ] Service types are correctly defined
- [ ] Start commands are correct
- [ ] Ports match application configuration (for web services)

## Additional Commands

### List All Builds

```bash
vibectl build list --project <project-name>
```

### Get Detailed Build Information

```bash
vibectl build get <build-id> --project <project-name>
```

### Get Detailed Deployment Information

```bash
vibectl deploy get <deployment-id> --project <project-name>
```

## References

- Complete deployment workflow: https://github.com/sixt-vibe/vibe-documentation/docs/getting-started/deploy-app.md
- CLI command reference: https://github.com/sixt-vibe/vibe-documentation/docs/reference/cli/index.md
- Configuration reference: https://github.com/sixt-vibe/vibe-config/blob/main/SPECIFICATION.md
