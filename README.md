# multi-tenant-saas-postgres-rls

Production-grade multi-tenant SaaS architecture reference: PostgreSQL Row-Level Security (RLS) tenant isolation, subdomain portal routing, multi-authentication middleware, and chunked video upload pipeline in TypeScript and Node.js.

## Overview
Architecting multi-tenant SaaS platforms requires strict data isolation and scalable data-access boundaries:
- **Shared-Schema Multi-Tenancy with RLS**: Enforces PostgreSQL Row-Level Security using tenant context (`SET LOCAL app.current_tenant_id = '...'`). Guarantees zero cross-tenant data leakage at the database engine level.
- **Subdomain Routing & Tenant Resolution**: Resolves tenant identifiers dynamically from request hostname (`{tenant}.platform.com` -> `tenant_id`).
- **Multi-Authentication Flow Handling**: Accommodates user JWT Bearer authentication, session cookies, and machine-to-machine API key authorization.
- **Large Video Upload Orchestrator**: Manages chunked, multipart direct-to-storage upload sessions with byte-range verification and upload completion state machines.

## Installation & Testing
```bash
npm install
npm test
```
