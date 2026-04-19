import { getStore } from "@netlify/blobs";

const STATE_STORE = "siteledger-shared-state";
const DOCS_STORE = "siteledger-shared-documents";
const LOGS_STORE = "siteledger-shared-logs";
const BACKUPS_STORE = "siteledger-shared-backups";

export const stores = {
  state: getStore({ name: STATE_STORE, consistency: "strong" }),
  docs: getStore({ name: DOCS_STORE, consistency: "strong" }),
  logs: getStore({ name: LOGS_STORE, consistency: "strong" }),
  backups: getStore({ name: BACKUPS_STORE, consistency: "strong" }),
};

export const LIMITS = {
  logs: 200,
  backups: 20,
};

export const nowIso = () => new Date().toISOString();

export const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export const bad = (message, status = 400) => json({ error: message }, status);

export const parseJson = async (req) => {
  try {
    return await req.json();
  } catch {
    return null;
  }
};

export const decodeBase64 = (input) => {
  const clean = (input || "").includes(",")
    ? input.split(",").pop()
    : input || "";
  return Buffer.from(clean, "base64");
};

export const listJson = async (store, prefix) => {
  const { blobs } = await store.list({ prefix });
  const rows = await Promise.all(
    blobs.map(async (b) => {
      const data = await store.get(b.key, { type: "json" });
      return data ? { ...data, _key: b.key } : null;
    }),
  );
  return rows.filter(Boolean);
};

export const sortByDateDesc = (items, field) =>
  [...items].sort((a, b) => {
    const da = new Date(a?.[field] || 0).getTime();
    const db = new Date(b?.[field] || 0).getTime();
    return db - da;
  });

export const trimStore = async (store, prefix, limit, dateField) => {
  const rows = await listJson(store, prefix);
  const sorted = sortByDateDesc(rows, dateField);
  const stale = sorted.slice(limit);
  await Promise.all(stale.map((s) => store.delete(s._key)));
};

export const listDocumentMetadata = async () => {
  const { blobs } = await stores.docs.list({ prefix: "docs/" });
  const docs = await Promise.all(
    blobs.map(async (blob) => {
      const meta = await stores.docs.getMetadata(blob.key);
      if (!meta) return null;
      const info = meta.metadata || {};
      return {
        id: info.id || blob.key.replace("docs/", ""),
        name: info.name || "document",
        type: info.contentType || "application/octet-stream",
        size: Number(info.size || 0),
        uploadedAt: info.uploadedAt || "",
        uploadedBy: info.uploadedBy || "Unknown",
      };
    }),
  );
  return sortByDateDesc(docs.filter(Boolean), "uploadedAt");
};

export const listLogs = async () => {
  const logs = await listJson(stores.logs, "logs/");
  return sortByDateDesc(logs, "at").slice(0, LIMITS.logs);
};

export const listBackups = async () => {
  const backups = await listJson(stores.backups, "backups/");
  return sortByDateDesc(backups, "createdAt")
    .slice(0, LIMITS.backups)
    .map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      user: b.user,
      reason: b.reason,
    }));
};

export const writeLog = async ({ user, action, details }) => {
  const entry = {
    id: makeId(),
    at: nowIso(),
    user: user || "Unknown",
    action: action || "Updated data",
    details: details || "",
  };
  await stores.logs.setJSON(`logs/${entry.id}.json`, entry);
  await trimStore(stores.logs, "logs/", LIMITS.logs, "at");
  return entry;
};

export const writeBackup = async ({ user, reason, data, masters, settings }) => {
  const backup = {
    id: makeId(),
    createdAt: nowIso(),
    user: user || "Unknown",
    reason: reason || "Auto backup",
    data: data || {},
    masters: masters || {},
    settings: settings || {},
  };
  await stores.backups.setJSON(`backups/${backup.id}.json`, backup);
  await trimStore(stores.backups, "backups/", LIMITS.backups, "createdAt");
  return backup;
};

