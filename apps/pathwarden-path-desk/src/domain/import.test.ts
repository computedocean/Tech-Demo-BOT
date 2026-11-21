import { describe, expect, test } from "bun:test";
import { zipSync } from "fflate";
import { fileURLToPath } from "node:url";
import { analyze } from "./engine.ts";
import { IMPORT_MAX_BYTES, IMPORT_MAX_OBJECTS, parseCollectionBytes, parseCollectionText } from "./import.ts";

const samplePath = fileURLToPath(new URL("../../public/samples/valid-collection.json", import.meta.url));
const missingMetaPath = fileURLToPath(new URL("./samples/missing-meta.json", import.meta.url));
const malformedPath = fileURLToPath(new URL("./samples/malformed.json", import.meta.url));

describe("import validation", () => {
  test("accepts the bundled SharpHound-style sample and builds paths", async () => {
    const raw = await Bun.file(samplePath).text();
    const result = parseCollectionText(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.nodes.length).toBe(5);
    expect(result.graph.edges.some((edge) => edge.kind === "GenericAll")).toBe(true);
    expect(result.graph.edges.some((edge) => edge.kind === "AdminTo")).toBe(true);
    expect(result.graph.edges.some((edge) => edge.kind === "Owns" as never)).toBe(false);
    const analysis = analyze(result.graph);
    expect(analysis.accountsWithPath).toBeGreaterThan(0);
    expect(analysis.paths.length).toBeGreaterThan(0);
    expect(result.graph.sourceNote.toLowerCase()).toContain("simulation");
  });

  test("accepts the same sample inside a small zip", async () => {
    const raw = await Bun.file(samplePath).text();
    const zipped = zipSync({ "mixed.json": new TextEncoder().encode(raw) });
    const result = parseCollectionBytes(zipped);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(analyze(result.graph).accountsWithPath).toBeGreaterThan(0);
  });

  test("rejects malformed JSON without throwing", async () => {
    const raw = await Bun.file(malformedPath).text();
    const result = parseCollectionText(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.toLowerCase()).toContain("json");
  });

  test("rejects a collection with no meta", async () => {
    const raw = await Bun.file(missingMetaPath).text();
    const result = parseCollectionText(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.toLowerCase()).toContain("meta");
  });

  test("rejects an oversized payload", () => {
    const padding = "A".repeat(IMPORT_MAX_BYTES);
    const raw = JSON.stringify({
      meta: { version: 6, type: "users", count: 1 },
      data: [
        {
          ObjectIdentifier: "U-BIG",
          Properties: { name: padding, domain: "EXAMPLE.LAB", highvalue: false },
        },
      ],
    });
    expect(raw.length).toBeGreaterThan(IMPORT_MAX_BYTES);
    const result = parseCollectionText(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.toLowerCase()).toContain("larger");
  });

  test("rejects too many objects and a mismatched count", () => {
    const data = Array.from({ length: IMPORT_MAX_OBJECTS + 1 }, (_, index) => ({
      ObjectIdentifier: `U-${index}`,
      Properties: { name: `USER${index}@EXAMPLE.LAB`, domain: "EXAMPLE.LAB", highvalue: false },
    }));
    const tooMany = parseCollectionText(
      JSON.stringify({ meta: { version: 5, type: "users", count: data.length }, data }),
    );
    expect(tooMany.ok).toBe(false);

    const mismatch = parseCollectionText(
      JSON.stringify({
        meta: { version: 6, type: "users", count: 2 },
        data: [
          {
            ObjectIdentifier: "U-1",
            Properties: { name: "ONE@EXAMPLE.LAB", domain: "EXAMPLE.LAB", highvalue: false },
          },
        ],
      }),
    );
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.error.toLowerCase()).toContain("count");
  });

  test("does not recommend cutting Domain Users membership", () => {
    const result = parseCollectionText(
      JSON.stringify({
        meta: { version: 5, type: "mixed", count: 2 },
        data: [
          {
            ObjectIdentifier: "U-1",
            Properties: { name: "ONE@EXAMPLE.LAB", domain: "EXAMPLE.LAB", highvalue: false },
          },
          {
            ObjectIdentifier: "G-DU",
            Properties: { name: "DOMAIN USERS@EXAMPLE.LAB", domain: "EXAMPLE.LAB", highvalue: false },
            Members: [{ ObjectIdentifier: "U-1", ObjectType: "User" }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const membership = result.graph.edges.find((edge) => edge.kind === "MemberOf");
    expect(membership?.removable).toBe(false);
  });
});
