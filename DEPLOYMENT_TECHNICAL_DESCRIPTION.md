# SmartTicket - Deployment-Focused Technical Description

## 1. Overview

### Application purpose

SmartTicket is an IT support and ticketing application with separate PMO, technician, and client workflows.

Main features:

- First-user/PMO bootstrap and JWT login.
- PMO administration of users and the PMO succession workflow.
- Ticket creation, editing, deletion, status changes, team assignment, technician assignment, supervisor assignment, and solution linking.
- Technician team membership and technician ticket workspaces.
- Client invitations and read-only client ticket access.
- User, team, invitation, password-reset, and PMO succession management.
- Management of sites, hardware, software/licences, contracts, support types, and solutions.
- Email invitations and password-reset links through SMTP or console logging.
- Per-connection mail settings with encrypted application passwords.

Primary roles:

- `PMO`: administrative access to core resources and mail settings.
- `TECHNICIAN`: access to team membership and assigned-ticket workflows.
- `CLIENT`: read-only access to linked tickets.
- `ASSISTANT`: recognized in the user model, but no core role-specific routes were found.
- `COMMERCIAL`: recognized in the database model but no dedicated API module was found.
- `HELPDESK_USER`: recognized in the database model but no dedicated API module was found.

### Repository layout

- `frontend/`: Next.js application.
- `backend/`: NestJS application.
- `database/`: base MySQL schema and additive migrations.
- `docs/` and root Markdown files: project documentation.
- `startup.bat`: local Windows launcher.

The project is a single-directory, multi-package layout with separate `package.json` files. It is monorepo-style, but no monorepo tool or workspace configuration was found. Separate Git repositories are not found; the supplied workspace is not a Git repository.

Top-level structure:

```text
SmartTicket/
├── backend/
│   ├── src/
│   ├── scripts/
│   ├── test/
│   ├── dist/
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/app/
│   ├── src/components/
│   ├── src/context/
│   ├── src/lib/
│   ├── package.json
│   └── package-lock.json
├── database/
│   ├── smartticket_schema_v1.sql
│   ├── migrations/
│   └── scripts/
├── docs/
└── startup.bat
```

## 2. Frontend (Next.js)

### Framework and routing

- Next.js: `14.2.15`
- React: `18.3.x`
- TypeScript: `5.5.x`
- Router: App Router
- Styling: Tailwind CSS, Bootstrap 5.3 SCSS, PostCSS
- Node.js: `>=18.17.0`

### Rendering model

The application is mainly client-rendered:

- Almost every route page starts with `"use client"`.
- Data is fetched in browser-side React effects/API helpers from the Nest backend.
- Authentication and route access are checked in browser components.
- Server-side data fetching was not found.
- `generateStaticParams`, `generateMetadata`, `revalidate`, ISR configuration, and Server Actions were not found.
- `output: 'export'` was not found.
- `output: 'standalone'` was not found.
- API route handlers under `src/app/**/route.ts` were not found.
- `middleware.ts` was not found.

Build output classifies ordinary and public route shells as statically prerendered and dynamic `[id]` route shells as dynamically server-rendered. This classification is for Next rendering shells; all page-specific data access is browser-side client fetches.

### Frontend pages

Public/auth pages:

- `/`
- `/login`
- `/setup`
- `/forgot-password`
- `/reset-password`
- `/invite/accept`
- `/invite/client`
- `/pmo/accept`
- `/no-access`

Authenticated application pages:

- `/tickets`
- `/tickets/new`
- `/tickets/[id]`
- `/tickets/[id]/edit`
- `/users`
- `/teams`
- `/teams/[id]`
- `/my/team`
- `/my/tickets`
- `/my/tickets/[id]`
- `/client/tickets`
- `/client/tickets/[id]`
- `/client-invitations`
- `/invitations`
- `/contracts`
- `/equipment`
- `/equipment-softs`
- `/sites`
- `/solutions`
- `/type-supports`
- `/settings/mail`

### Backend communication

- Protocol: browser `fetch`, not Axios.
- Base URL: `NEXT_PUBLIC_API_URL`.
- Local fallback: `http://localhost:3001`.
- Requests include `Authorization: Bearer <JWT>`.
- `cache: "no-store"` is used for browser fetch requests.
- A browser memory/SWR-style cache is present, and JWT/user data are stored in `localStorage`.
- The 401 response handler clears local session state and redirects to `/login`.
- Login and bootstrap 401/409 responses are not redirected.

### Commands and port

- Development: `npm run dev` on port `3000`.
- Production build: `npm run build`.
- Production server: `npm run start` on port `3000`.
- Type check: `npm run typecheck`.
- Lint: `npm run lint`.

### Frontend environment variables

- `NEXT_PUBLIC_API_URL`

Server-only frontend environment variables: not found.

## 3. Backend (NestJS)

### Runtime

- NestJS major: `9`
- Nest package versions: `@nestjs/common`, `core`, `config`, `jwt`, `passport`, and `typeorm` in the Nest 9 family.
- Node.js: README requires Node 16.20+ or 18 LTS; frontend and current tooling require Node 18.17+.
- Platform: Express through `@nestjs/platform-express`.
- Main port: `3001`, configurable through `PORT`.
- Global route prefix: not found.
- API format: JSON REST.

### Startup setup

`main.ts` configures:

- Global validation pipe:
  - unknown properties removed
  - unknown properties rejected
  - DTO transformation enabled
- CORS:
  - origins from `CORS_ORIGINS`
  - methods `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
  - allowed headers `Authorization` and `Content-Type`
  - preflight max age `600`
- No `helmet` setup was found.
- No global prefix was found.
- No trust-proxy configuration was found.

### Modules

- Auth
- Users
- Tickets
- Solutions
- Equipment
- Equipment softs
- Contracts
- Sites
- Type supports
- Teams
- My tickets
- Invitations
- Password reset
- PMO succession
- Client invitations
- Client tickets
- Mail and mail settings
- Database

### API endpoints

All endpoints below are below the root URL unless a global prefix is externally added. No global prefix is configured in code.

#### Authentication

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/auth/login` | Authenticate email/password and return a JWT and user |
| `POST` | `/auth/bootstrap` | Create the initial account only when `users` is empty |
| `POST` | `/auth/forgot-password` | Request a password-reset email |
| `POST` | `/auth/reset-password` | Reset password using a reset token |

#### Users

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/users` | Direct user creation; disabled in production |
| `GET` | `/users` | List users |
| `GET` | `/users/:id` | Get a user |
| `PATCH` | `/users/:id` | Update a user |
| `DELETE` | `/users/:id` | Delete a user |

#### Tickets

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/tickets` | Create ticket |
| `GET` | `/tickets` | List tickets |
| `GET` | `/tickets/:id` | Get ticket |
| `PATCH` | `/tickets/:id` | Update ticket |
| `DELETE` | `/tickets/:id` | Delete ticket |
| `PATCH` | `/tickets/:id/status` | Change ticket status |
| `PATCH` | `/tickets/:id/team` | Assign ticket team |
| `POST` | `/tickets/:id/technicians` | Assign technician |
| `DELETE` | `/tickets/:id/technicians/:userId` | Remove technician |
| `PATCH` | `/tickets/:id/supervisor` | Set supervisor |
| `PATCH` | `/tickets/:id/solution` | Link solution |

#### Teams

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/teams` | Create team |
| `GET` | `/teams` | List teams |
| `GET` | `/teams/mine` | Get the authenticated technician's team |
| `GET` | `/teams/technicians` | List technicians |
| `GET` | `/teams/:id` | Get team |
| `PATCH` | `/teams/:id` | Rename team |
| `DELETE` | `/teams/:id` | Delete team |
| `POST` | `/teams/:id/members` | Add member |
| `DELETE` | `/teams/:id/members/:userId` | Remove member |
| `POST` | `/teams/:id/members/:userId/transfer` | Transfer member |
| `PATCH` | `/teams/:id/leader` | Set team leader |

#### Technician ticket workspace

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/me/tickets` | List tickets visible to the technician |
| `GET` | `/me/tickets/:id` | Get technician-visible ticket |
| `PATCH` | `/me/tickets/:id/status` | Change status when the technician is the team leader |
| `PUT` | `/me/tickets/:id/solution` | Save solution when the technician is the team leader |

#### Client tickets

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/client/tickets` | List read-only linked client tickets |
| `GET` | `/client/tickets/:id` | Get read-only linked client ticket |

#### Technician invitations

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/invitations` | Create technician invitation |
| `GET` | `/invitations` | List technician invitations |
| `GET` | `/invitations/validate` | Public, throttled invitation validation |
| `POST` | `/invitations/accept` | Public, throttled invitation acceptance |
| `POST` | `/invitations/:id/cancel` | Cancel invitation |

#### Client invitations

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/client-invitations` | Create client invitation |
| `GET` | `/client-invitations` | List client invitations |
| `GET` | `/client-invitations/validate` | Public, throttled invitation validation |
| `POST` | `/client-invitations/accept` | Public, throttled invitation acceptance |
| `POST` | `/client-invitations/:id/cancel` | Cancel invitation |

#### PMO succession

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/pmo/resignation` | Start PMO resignation/succession |
| `GET` | `/pmo/resignation` | Get current resignation |
| `POST` | `/pmo/resignation/cancel` | Cancel resignation |
| `GET` | `/pmo/succession/validate` | Public, throttled successor validation |
| `POST` | `/pmo/succession/accept` | Public, throttled successor acceptance |

#### Mail settings

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/settings/mail` | Get mail configuration status |
| `PUT` | `/settings/mail` | Save mail configuration |
| `POST` | `/settings/mail/test` | Send a test email to the connected PMO |

#### Reference and operational resources

Each of `/solutions`, `/equipment`, `/equipment-softs`, `/contracts`, `/sites`, and `/type-supports` implements PMO-only CRUD with `POST`, `GET`, `GET /:id`, `PATCH /:id`, and `DELETE /:id`.

Additional relation endpoints:

| Resource | Additional routes |
|---|---|
| `/equipment/:id/type-supports` | Add/remove type-support link |
| `/equipment-softs/:id/type-supports` | Add/remove type-support link |
| `/contracts/:id/clients` | Add/remove client link |
| `/contracts/:id/technicians` | Add/remove technician link |
| `/contracts/:id/type-supports` | Add/remove type-support link |
| `/sites/:id/equipment` | Add/remove hardware link |
| `/sites/:id/equipment-softs` | Add/remove software link |

### Authentication and authorization

- JWT-based bearer authentication using Passport.
- Local username/password strategy for login.
- JWT strategy re-reads the user from MySQL for each request.
- Deleted or invalidated users receive a 401.
- JWT contains only identity; role is read from the database.
- Tokens are stored in browser `localStorage`, not cookies.
- Sessions are stateless on the backend.
- Server-side sessions: not found.
- OAuth/OIDC: not found.
- Global JWT guard: all routes are protected unless decorated public.
- Global role guard: routes require an explicit role; routes without `@Roles(...)` are denied.
- PMO is the default administrative role for resource CRUD.

### State, caching, and storage

- Backend session state: not found.
- Server cache: not found.
- Throttling counters: in-memory, appropriate for one process only.
- Mail transporter cache: in-memory.
- Frontend API cache: browser memory.
- Local disk application storage: not found.
- File uploads: not found.
- The database contains path fields for images, signatures, logos, and similar values, but no upload or file-serving implementation was found.
- WebSockets/SSE/real-time push: not found.
- Background jobs/cron/schedulers/queues: not found.
- Mail is synchronous with the associated API request.

### Email and external services

- Email library: Nodemailer.
- Default provider configuration: SMTP; Gmail-compatible settings are in the code.
- Environment SMTP variables: `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`.
- Database mail configuration is supported and app passwords are AES-GCM encrypted.
- Log mode writes links to the backend console and is forbidden in production.
- SMS: not found.
- Push notifications: not found.
- External APIs: not found beyond configured SMTP delivery.

### Health checks

- Health check endpoint: not found.
- Readiness/liveness endpoints: not found.

### Backend build and run commands

- Development: `npm run start:dev`
- Debug: `npm run start:debug`
- Build: `npm run build`
- Production: `npm run start:prod`
- Unit tests: `npm test`
- Production code entry point: `dist/main`

### Backend environment variables

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `NODE_ENV`
- `CORS_ORIGINS`
- `LOGIN_RATE_LIMIT`
- `LOGIN_RATE_TTL`
- `FRONTEND_URL`
- `INVITATION_TTL_HOURS`
- `PASSWORD_RESET_TTL_MINUTES`
- `MAIL_MODE`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_SECURE`
- `MAIL_USER`
- `MAIL_PASSWORD`
- `MAIL_FROM`
- `PMO_SUCCESSION_TTL_HOURS`
- `ALLOW_DIRECT_USER_CREATION`
- `SETTINGS_ENCRYPTION_KEY`

## 4. Database (MySQL)

### Engine and ORM

- Database: MySQL 8.
- MariaDB compatibility is claimed for some migration scripts, but the supplied environment does not establish a production database engine guarantee.
- ORM: TypeORM `0.3.17`.
- Driver: `mysql2`.
- `synchronize: false`.
- No TypeORM migrations or seeding framework was found.
- SQL schema and manually ordered SQL migrations are authoritative.

### Schema creation

Required base:

1. `database/smartticket_schema_v1.sql`
2. `database/migrations/001_phase2_teams.sql`
3. `database/migrations/002_phase3_invitations.sql`
4. `database/migrations/003_ticket_team.sql`
5. `database/migrations/004_password_reset.sql`
6. `database/migrations/005_client_invitations.sql`
7. `database/migrations/006_user_location.sql`
8. `database/migrations/007_client_invitations_pending_unique.sql`
9. `database/migrations/008_pmo_succession_mail_settings.sql`

Migration `001_phase2_teams_smoketest.sql` is for smoke-test database setup, not part of the normal production migration sequence.

### Tables

- `type_supports`
- `users`
- `sites`
- `equipment`
- `equipmentsofts`
- `contracts`
- `solutions`
- `tickets`
- `ticket_technicians`
- `equipment_type_supports`
- `equipmentsoft_type_supports`
- `contract_clients`
- `contract_technicians`
- `contract_type_supports`
- `site_equipment`
- `site_equipmentsoft`
- `teams`
- `team_members`
- `team_leader_events`
- `user_invitations`
- `password_reset_tokens`
- `client_invitations`
- `pmo_resignations`
- `mail_settings`

### Core relations

- `users` can be clients, technicians, PMO, assistant, commercial, or helpdesk users.
- `tickets` links to solution, client, contract, site, hardware, software, and supervisor.
- `ticket_technicians` links tickets and technicians many-to-many.
- `contracts` links to commercial user, clients, technicians, and support types.
- `teams` links to a leader and team members.
- `team_members` is the team membership relation.
- `team_leader_events` stores team leadership history/reasons.
- `tickets.team_id` links tickets to teams.
- `sites` links to equipment and software.
- `equipment` and `equipmentsofts` link to support types.
- Invitations, password-reset tokens, resignation tokens, and mail settings are separate security and configuration tables.

### MySQL-specific features

- InnoDB.
- UTF-8/`utf8mb4`.
- Foreign keys and cascade/restrict actions.
- Enum columns for authorities, contract types/natures, ticket statuses, invitation statuses, and PMO succession statuses.
- Stored/generated columns used for unique pending-email/token state:
  - `pending_email`
  - `pending_flag`
- Migration scripts use `information_schema` and prepared SQL for repeatable additive changes.
- JSON columns: not found.
- Triggers: not found.
- Stored procedures: not found.
- Views: not found.
- Full-text indexes/search: not found.

### Connection configuration

Environment names:

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`

Connection pool settings: not found. TypeORM and `mysql2` defaults are in use unless a cloud runtime overrides them.

### Data volume and traffic pattern

- Estimated volume: not found.
- Read/write proportions: not found.
- CRUD writes dominate configuration and reference data.
- Ticket, team membership, contract-link, and invitation operations include relational writes and some transactions.
- Password and token operations add security-sensitive writes.
- No batching, bulk import, analytics workload, or partitioning strategy was found.

## 5. Infrastructure Files

### Found

- `backend/package.json`
- `frontend/package.json`
- `backend/package-lock.json`
- `frontend/package-lock.json`
- `database/*.sql`
- `startup.bat`
- `.env.example` files

### Not found

- Dockerfile
- docker-compose file
- Kubernetes manifests
- Terraform/CloudFormation/CDK
- GitHub Actions or other CI/CD
- Jenkins configuration
- GitLab CI
- nginx/Apache configuration
- Reverse-proxy configuration
- ECS/Elastic Beanstalk/AWS deployment configuration
- Infrastructure-as-code
- Deployment scripts
- Observability configuration

### Local/cloud-breaking values

- Frontend fallback `NEXT_PUBLIC_API_URL=http://localhost:3001`.
- Backend CORS fallback `http://localhost:3000`.
- Backend database fallback `DB_HOST=localhost`, `DB_PORT=3306`.
- Backend frontend URL fallback `http://localhost:3000`.
- The startup script references Laragon locally.
- The backend log line explicitly announces localhost for port binding.
- SMTP host defaults to a Gmail SMTP host.

## 6. Deployment Readiness

### Required AWS changes

1. Replace localhost frontend and API URLs with public HTTPS domains.
2. Set `NODE_ENV=production`.
3. Set required production variables through AWS Secrets Manager or ECS task environment configuration:
   - `JWT_SECRET`
   - `DB_USERNAME`
   - `DB_PASSWORD`
   - `CORS_ORIGINS`
   - `FRONTEND_URL`
   - `MAIL_MODE`
   - `MAIL_USER`
   - `MAIL_PASSWORD`
   - SMTP-related variables
   - `SETTINGS_ENCRYPTION_KEY`
4. Set `ALLOW_DIRECT_USER_CREATION=false`.
5. Deploy MySQL as Amazon RDS for MySQL or Aurora MySQL.
6. Initialize the RDS database with the base SQL and migrations in numeric order.
7. Add a deployment migration procedure; TypeORM will not modify the schema because `synchronize: false`.
8. Add a backend health endpoint and configure readiness/liveness checks.
9. Run rate limiting in a shared store or one instance only. The current in-memory limiter does not survive scaling or share limits across instances.
10. Run all instances with the same JWT secret and mail encryption key.
11. Replace or remove local console/log mail mode; production requires SMTP.
12. Configure TLS termination and public HTTPS.
13. Configure CORS with exact AWS/frontend origins.
14. Configure reverse-proxy trust settings only if real client IP forwarding is needed by the throttler.
15. Set appropriate database SSL/TLS configuration if required by RDS.
16. Add graceful shutdown handling and container health checks.
17. Add logging/metrics/tracing and structured request logs.
18. Add backup, restore, migration rollback, and database monitoring procedures.
19. Add CI/CD, tests, security scanning, and dependency update processes.
20. If more than one backend replica is used, validate that the database and SMTP configuration are shared and that in-memory rate limiting is replaced.

### No changes found for

- File uploads/local disk storage: not found.
- WebSockets/SSE: not found.
- Queues/workers: not found.
- Cron/scheduled jobs: not found.
- Redis/cache layer: not found.
- Server-side session storage: not found.

### Rough resource needs

No traffic or data-volume measurements were found, so sizing must start conservatively:

- Frontend: 0.25-0.5 vCPU and 256-512 MB RAM per process for small traffic.
- Backend: 0.25-0.5 vCPU and 256-512 MB RAM per process for small traffic.
- MySQL: start with a small RDS instance and 20-50 GB encrypted storage, then size from connection, CPU, and slow-query metrics.
- Start with one backend replica and one frontend replica for low traffic.
- Increase backend replicas only after shared rate limiting and database connection limits are addressed.

These are initial estimates, not capacity measurements.

### Security concerns

- JWTs are stored in browser `localStorage`, which creates XSS exposure.
- JWT expiration is defaulted to `3600s`.
- No CSRF protection was found, though JWT bearer storage and CORS reduce the standard cookie-CSRF pattern.
- No `helmet` or other HTTP security-header middleware was found.
- The in-memory throttle does not work consistently behind multiple replicas.
- CORS is environment-based but defaults to localhost outside production.
- Production validation forbids wildcard CORS and requires real SMTP.
- Direct user creation is forbidden in production.
- Mail app passwords are encrypted in the database, but no secrets should be included in code or environment files in source control.
- Database password, JWT secret, SMTP password, and mail encryption key must use AWS secret storage.
- No database SSL configuration was found.
- No explicit trust-proxy configuration was found.
- No health endpoint was found.
- No file upload authorization or S3 storage design is required in the current code because uploads are not implemented.
- Dependency installation reported deprecated packages and dependency vulnerability warnings, including a Next.js security warning for the pinned `14.2.15` version.
- The code should undergo an updated dependency audit and patch upgrade process before production.
- Public invitation/reset/succession routes exist and require rate limiting, short-lived tokens, and monitoring.
