import { describe, it, expect } from "vitest";
import { TenantContextManager } from "../src/tenant-context.js";
import { VideoUploadManager } from "../src/storage-uploader.js";

describe("TenantContextManager", () => {
  it("resolves valid subdomain tenant slugs", () => {
    expect(TenantContextManager.resolveTenantFromHostname("tenant1.collabify.app", "collabify.app")).toBe("tenant1");
    expect(TenantContextManager.resolveTenantFromHostname("enterprise-corp.collabify.app:443", "collabify.app")).toBe("enterprise-corp");
  });

  it("rejects apex domain or nested subdomains", () => {
    expect(TenantContextManager.resolveTenantFromHostname("collabify.app", "collabify.app")).toBeNull();
    expect(TenantContextManager.resolveTenantFromHostname("a.b.collabify.app", "collabify.app")).toBeNull();
    expect(TenantContextManager.resolveTenantFromHostname("other-domain.io", "collabify.app")).toBeNull();
  });

  it("builds sanitized PostgreSQL RLS session query", () => {
    const query = TenantContextManager.buildTenantSessionQuery("tenant_acme_12");
    expect(query).toBe("SET LOCAL app.current_tenant_id = 'tenant_acme_12';");
  });

  it("prevents SQL injection in tenant IDs", () => {
    expect(() => TenantContextManager.buildTenantSessionQuery("'; DROP TABLE users; --")).toThrowError(/Invalid tenant ID format/);
  });

  it("resolves JWT Bearer auth context", () => {
    const payload = Buffer.from(JSON.stringify({ tenant_id: "tenant_alpha", sub: "user_42" })).toString("base64");
    const fakeJwt = `header.${payload}.signature`;
    const auth = TenantContextManager.resolveAuthContext({ authorization: `Bearer ${fakeJwt}` });
    expect(auth).toEqual({
      tenantId: "tenant_alpha",
      authMethod: "bearer",
      userId: "user_42",
    });
  });

  it("resolves API key auth context", () => {
    const auth = TenantContextManager.resolveAuthContext({ "x-tenant-api-key": "acme-corp_secretkey123" });
    expect(auth).toEqual({
      tenantId: "acme-corp",
      authMethod: "api_key",
    });
  });
});

describe("VideoUploadManager", () => {
  it("creates chunked upload sessions with exact byte distributions", () => {
    const totalBytes = 25 * 1024 * 1024; // 25MB
    const chunkSize = 10 * 1024 * 1024; // 10MB
    const session = VideoUploadManager.createSession("tenant_alpha", "demo.mp4", totalBytes, chunkSize);

    expect(session.parts.length).toBe(3);
    expect(session.parts[0].expectedSize).toBe(10 * 1024 * 1024);
    expect(session.parts[1].expectedSize).toBe(10 * 1024 * 1024);
    expect(session.parts[2].expectedSize).toBe(5 * 1024 * 1024);
    expect(session.status).toBe("pending");
  });

  it("completes upload session after all parts are verified", () => {
    const session = VideoUploadManager.createSession("tenant_alpha", "clip.mp4", 15 * 1024 * 1024, 10 * 1024 * 1024);
    expect(VideoUploadManager.completeSession(session)).toBe(false);

    VideoUploadManager.verifyAndRecordChunk(session, 1, "sha256_mock_hash_1");
    expect(session.status).toBe("uploading");
    expect(VideoUploadManager.completeSession(session)).toBe(false);

    VideoUploadManager.verifyAndRecordChunk(session, 2, "sha256_mock_hash_2");
    expect(VideoUploadManager.completeSession(session)).toBe(true);
    expect(session.status).toBe("completed");
  });
});
