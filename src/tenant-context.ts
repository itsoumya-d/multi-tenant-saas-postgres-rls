export interface TenantAuthContext {
  tenantId: string;
  authMethod: "bearer" | "api_key";
  userId?: string;
}

export class TenantContextManager {
  private static readonly TENANT_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

  /**
   * Resolves tenant slug from request hostname subdomain.
   * e.g., "acme.platform.io" with baseDomain "platform.io" -> "acme"
   */
  static resolveTenantFromHostname(hostname: string, baseDomain: string = "platform.io"): string | null {
    if (!hostname) return null;
    const cleanHost = hostname.split(":")[0].toLowerCase();
    const cleanBase = baseDomain.toLowerCase();

    if (!cleanHost.endsWith(cleanBase) || cleanHost === cleanBase) {
      return null;
    }

    const subdomainPart = cleanHost.slice(0, -(cleanBase.length + 1));
    if (!subdomainPart || subdomainPart.includes(".")) {
      return null;
    }

    return this.TENANT_ID_REGEX.test(subdomainPart) ? subdomainPart : null;
  }

  /**
   * Generates sanitized PostgreSQL session variable SQL command for Row-Level Security (RLS).
   * Prevents SQL injection via strict regex enforcement.
   */
  static buildTenantSessionQuery(tenantId: string): string {
    if (!this.TENANT_ID_REGEX.test(tenantId)) {
      throw new Error(`Invalid tenant ID format: ${tenantId}`);
    }
    return `SET LOCAL app.current_tenant_id = '${tenantId}';`;
  }

  /**
   * Resolves authentication credentials across multiple auth flows (Bearer JWT vs Tenant API key).
   */
  static resolveAuthContext(headers: Record<string, string | undefined>): TenantAuthContext | null {
    const authHeader = headers["authorization"] || headers["Authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      // Parse payload from JWT structure (token.header.payload)
      const parts = token.split(".");
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
          if (payload.tenant_id) {
            return {
              tenantId: payload.tenant_id,
              authMethod: "bearer",
              userId: payload.sub,
            };
          }
        } catch {
          return null;
        }
      }
    }

    const apiKey = headers["x-tenant-api-key"] || headers["X-Tenant-Api-Key"];
    if (apiKey && apiKey.includes("_")) {
      const tenantPrefix = apiKey.split("_")[0];
      if (this.TENANT_ID_REGEX.test(tenantPrefix)) {
        return {
          tenantId: tenantPrefix,
          authMethod: "api_key",
        };
      }
    }

    return null;
  }
}
