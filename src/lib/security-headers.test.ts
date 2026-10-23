import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CSP, SECURITY_HEADERS, withSecurityHeaders } from "./security-headers";

describe("security headers", () => {
  it("public/_headers applies the same headers to static files", () => {
    const file = readFileSync(resolve(__dirname, "../../public/_headers"), "utf8");
    const all = file.split(/\n(?=\/)/).find((block) => block.startsWith("/*\n")) ?? "";
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(all, name).toContain(`  ${name}: ${value}\n`);
    }
  });

  it("keeps Gemini off the client and blocks framing", () => {
    expect(CSP).not.toContain("generativelanguage");
    expect(CSP).toContain("frame-ancestors 'none'");
  });

  it("adds headers without overwriting ones the route set", () => {
    const res = withSecurityHeaders(new Response("x", { headers: { "X-Frame-Options": "SAMEORIGIN" } }));
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("assetlinks.json is valid and names the Android package", () => {
    const json = JSON.parse(readFileSync(resolve(__dirname, "../../public/.well-known/assetlinks.json"), "utf8"));
    expect(json[0].target.package_name).toBe("online.racik.app");
  });
});
