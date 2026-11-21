import { unzipSync } from "fflate";
import type { EdgeKind, Graph, GraphEdge, GraphNode, NodeKind } from "./types.ts";

/** Tens of objects, well under a megabyte. */
export const IMPORT_MAX_BYTES = 256 * 1024;
export const IMPORT_MAX_OBJECTS = 40;

const ALLOWED_RIGHTS = new Map<string, EdgeKind>([
  ["genericall", "GenericAll"],
  ["genericwrite", "GenericWrite"],
  ["dcsync", "DCSync"],
  ["addmember", "AddMember"],
  ["adminto", "AdminTo"],
]);

export type ImportResult = { ok: true; graph: Graph } | { ok: false; error: string };

export function parseCollectionBytes(bytes: Uint8Array): ImportResult {
  try {
    if (bytes.byteLength > IMPORT_MAX_BYTES) {
      return {
        ok: false,
        error: `File is larger than ${IMPORT_MAX_BYTES} bytes. Import a small sample instead.`,
      };
    }
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
      return parseZip(bytes);
    }
    return parseCollectionText(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, error: "Could not read that file. The bundled graph is unchanged." };
  }
}

export function parseCollectionText(raw: string): ImportResult {
  try {
    if (byteLength(raw) > IMPORT_MAX_BYTES) {
      return {
        ok: false,
        error: `File is larger than ${IMPORT_MAX_BYTES} bytes. Import a small sample instead.`,
      };
    }
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) return parsed;
    return graphFromFiles([parsed.file]);
  } catch {
    return { ok: false, error: "Could not read that file. The bundled graph is unchanged." };
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function parseZip(bytes: Uint8Array): ImportResult {
  const declared = declaredUncompressedTotal(bytes);
  if (declared === null) {
    return {
      ok: false,
      error: "Zip is too large, nested, or not a simple archive of JSON files.",
    };
  }
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { ok: false, error: "Could not read that zip. The bundled graph is unchanged." };
  }
  const jsonNames = Object.keys(files).filter(
    (name) => name.toLowerCase().endsWith(".json") && !name.includes("..") && !name.startsWith("__MACOSX"),
  );
  if (jsonNames.length === 0) {
    return { ok: false, error: "Zip does not contain a JSON collection file." };
  }
  if (jsonNames.length > 8) {
    return { ok: false, error: "Zip has too many JSON files. Keep it to a few collection files." };
  }
  const parsedFiles: ParsedFile[] = [];
  for (const name of jsonNames) {
    const file = files[name];
    if (!file) continue;
    if (file.byteLength > IMPORT_MAX_BYTES) {
      return { ok: false, error: `${name} is larger than the import cap.` };
    }
    const parsed = parseEnvelope(new TextDecoder().decode(file));
    if (!parsed.ok) return { ok: false, error: `${name}: ${parsed.error}` };
    parsedFiles.push(parsed.file);
  }
  return graphFromFiles(parsedFiles);
}

function declaredUncompressedTotal(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let total = 0;
  let files = 0;
  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break;
    const flags = view.getUint16(offset + 6, true);
    const compressed = view.getUint32(offset + 18, true);
    const uncompressed = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    if (flags & 0x8) return null;
    if (uncompressed > IMPORT_MAX_BYTES) return null;
    total += uncompressed;
    files += 1;
    if (files > 8 || total > IMPORT_MAX_BYTES) return null;
    const next = offset + 30 + nameLength + extraLength + compressed;
    if (next > bytes.length) return null;
    offset = next;
  }
  return files === 0 ? null : total;
}

interface ParsedFile {
  nodes: GraphNode[];
  data: unknown[];
}

function graphFromFiles(files: ParsedFile[]): ImportResult {
  const nodes: GraphNode[] = [];
  const seen = new Set<string>();
  const data: unknown[] = [];
  for (const file of files) {
    data.push(...file.data);
    for (const item of file.nodes) {
      if (seen.has(item.id)) {
        return { ok: false, error: `Duplicate ObjectIdentifier ${item.id} across files.` };
      }
      seen.add(item.id);
      nodes.push({ ...item, x: (nodes.length % 4) * 240, y: Math.floor(nodes.length / 4) * 90 });
    }
  }
  if (nodes.length > IMPORT_MAX_OBJECTS) {
    return {
      ok: false,
      error: `Too many objects (${nodes.length}). The cap is ${IMPORT_MAX_OBJECTS}.`,
    };
  }
  return {
    ok: true,
    graph: {
      id: "import",
      name: "Imported file",
      sourceNote: "Simulation on the file you provided. This was not a live collection.",
      nodes,
      edges: readEdges(data, nodes),
    },
  };
}

function parseEnvelope(raw: string): { ok: true; file: ParsedFile } | { ok: false; error: string } {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Expected a JSON object with data and meta." };
  }
  const record = parsed as Record<string, unknown>;
  if (!("meta" in record) || !record.meta || typeof record.meta !== "object" || Array.isArray(record.meta)) {
    return {
      ok: false,
      error: "Missing meta. A BloodHound CE collection needs meta.version 5 or 6.",
    };
  }
  const meta = record.meta as Record<string, unknown>;
  if (meta.version !== 5 && meta.version !== 6) {
    return { ok: false, error: "Unsupported meta.version. Only BloodHound CE v5 or v6 is accepted." };
  }
  const typeName = typeof meta.type === "string" ? meta.type.toLowerCase() : "mixed";
  if (!["users", "groups", "computers", "mixed"].includes(typeName)) {
    return {
      ok: false,
      error: "meta.type must be users, groups, computers, or mixed for this desk.",
    };
  }
  if (!Array.isArray(record.data)) {
    return { ok: false, error: "Missing data array." };
  }
  if (record.data.length === 0) {
    return { ok: false, error: "data array is empty." };
  }
  if (record.data.length > IMPORT_MAX_OBJECTS) {
    return {
      ok: false,
      error: `Too many objects (${record.data.length}). The cap is ${IMPORT_MAX_OBJECTS}.`,
    };
  }
  if (typeof meta.count === "number" && meta.count !== record.data.length) {
    return { ok: false, error: "meta.count does not match the data array length." };
  }

  const nodes: GraphNode[] = [];
  const seen = new Set<string>();
  for (const item of record.data) {
    const built = readNode(item, typeName, nodes.length);
    if (!built.ok) return built;
    if (seen.has(built.node.id)) {
      return { ok: false, error: `Duplicate ObjectIdentifier ${built.node.id}.` };
    }
    seen.add(built.node.id);
    nodes.push(built.node);
  }

  return { ok: true, file: { nodes, data: record.data } };
}

function readNode(
  item: unknown,
  fileType: string,
  index: number,
): { ok: true; node: GraphNode } | { ok: false; error: string } {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return { ok: false, error: "Each data entry must be an object." };
  }
  const record = item as Record<string, unknown>;
  if (typeof record.ObjectIdentifier !== "string" || record.ObjectIdentifier.length === 0) {
    return { ok: false, error: "An object is missing ObjectIdentifier." };
  }
  const properties = record.Properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return { ok: false, error: `${record.ObjectIdentifier} is missing Properties.` };
  }
  const props = properties as Record<string, unknown>;
  if (typeof props.name !== "string" || props.name.length === 0) {
    return { ok: false, error: `${record.ObjectIdentifier} is missing Properties.name.` };
  }
  const domain = typeof props.domain === "string" && props.domain.length > 0 ? props.domain : "IMPORTED";
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    ok: true,
    node: {
      id: record.ObjectIdentifier,
      name: props.name,
      kind: kindFor(record, props.name, fileType),
      tierZero: props.highvalue === true,
      domain,
      x: column * 240,
      y: row * 90,
    },
  };
}

function kindFor(record: Record<string, unknown>, name: string, fileType: string): NodeKind {
  if (fileType === "users") return "user";
  if (fileType === "groups") return "group";
  if (fileType === "computers") return "computer";
  if (Array.isArray(record.Members)) return "group";
  if (record.LocalAdmins || record.Sessions || record.RemoteDesktopUsers) return "computer";
  if (name.endsWith("$")) return "computer";
  return "user";
}

function readEdges(data: unknown[], nodes: GraphNode[]): GraphEdge[] {
  const ids = new Set(nodes.map((item) => item.id));
  const names = new Map(nodes.map((item) => [item.id, item.name]));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const push = (source: string, target: string, kind: EdgeKind, removable: boolean) => {
    if (!ids.has(source) || !ids.has(target) || source === target) return;
    const id = `${kind}:${source}:${target}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ id, source, target, kind, removable });
  };

  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const objectId = record.ObjectIdentifier;
    if (typeof objectId !== "string") continue;

    if (Array.isArray(record.Members)) {
      const groupName = names.get(objectId) ?? "";
      const classMembership = /domain users/i.test(groupName);
      for (const member of record.Members) {
        if (!member || typeof member !== "object") continue;
        const memberId = (member as Record<string, unknown>).ObjectIdentifier;
        if (typeof memberId !== "string") continue;
        push(memberId, objectId, "MemberOf", !classMembership);
      }
    }

    if (Array.isArray(record.Aces)) {
      for (const ace of record.Aces) {
        if (!ace || typeof ace !== "object") continue;
        const aceRecord = ace as Record<string, unknown>;
        const right = typeof aceRecord.RightName === "string" ? aceRecord.RightName.toLowerCase() : "";
        const mapped = ALLOWED_RIGHTS.get(right);
        const principal =
          typeof aceRecord.PrincipalSID === "string"
            ? aceRecord.PrincipalSID
            : typeof aceRecord.PrincipalId === "string"
              ? aceRecord.PrincipalId
              : "";
        if (!mapped || !principal) continue;
        push(principal, objectId, mapped, true);
      }
    }

    const localAdmins = resultsOf(record.LocalAdmins);
    for (const admin of localAdmins) {
      const adminId = identifierOf(admin);
      if (adminId) push(adminId, objectId, "AdminTo", true);
    }

    const sessions = resultsOf(record.Sessions);
    for (const session of sessions) {
      if (!session || typeof session !== "object") continue;
      const sessionRecord = session as Record<string, unknown>;
      const userId = typeof sessionRecord.UserSID === "string" ? sessionRecord.UserSID : "";
      const computerId =
        typeof sessionRecord.ComputerSID === "string" ? sessionRecord.ComputerSID : objectId;
      if (userId) push(computerId, userId, "HasSession", false);
    }
  }

  return edges;
}

function resultsOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const results = (value as Record<string, unknown>).Results;
  return Array.isArray(results) ? results : [];
}

function identifierOf(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const id = (value as Record<string, unknown>).ObjectIdentifier;
  return typeof id === "string" ? id : "";
}

