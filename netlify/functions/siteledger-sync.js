import {
  bad,
  json,
  listBackups,
  listDocumentMetadata,
  listLogs,
  parseJson,
  stores,
  writeBackup,
  writeLog,
} from "./_shared/siteledger-store.js";

const latestStateKey = "state/latest.json";

const getSharedPayload = async () => {
  const state = await stores.state.get(latestStateKey, { type: "json" });
  const [documents, logs, backups] = await Promise.all([
    listDocumentMetadata(),
    listLogs(),
    listBackups(),
  ]);
  return {
    state: state || null,
    documents,
    logs,
    backups,
  };
};

export default async (req) => {
  if (req.method === "GET") {
    return json(await getSharedPayload());
  }

  if (req.method !== "POST") {
    return bad("Method not allowed", 405);
  }

  const body = await parseJson(req);
  if (!body || typeof body !== "object") {
    return bad("Invalid JSON payload.");
  }

  if (!body.data || !body.masters) {
    return bad("Both 'data' and 'masters' are required.");
  }

  const updatedAt = new Date().toISOString();
  const snapshot = {
    data: body.data,
    masters: body.masters,
    settings: body.settings || {},
    updatedAt,
    updatedBy: body.user || "Unknown",
  };

  await stores.state.setJSON(latestStateKey, snapshot);
  await Promise.all([
    writeLog({
      user: body.user,
      action: body.action || "Synchronized shared state",
      details: body.details || "",
    }),
    writeBackup({
      user: body.user,
      reason: body.reason || body.action || "Auto backup",
      data: body.data,
      masters: body.masters,
      settings: body.settings || {},
    }),
  ]);

  return json({
    ok: true,
    updatedAt,
    ...(await getSharedPayload()),
  });
};

export const config = {
  path: "/api/siteledger/sync",
  method: ["GET", "POST"],
};

