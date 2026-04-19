import { bad, json, stores } from "./_shared/siteledger-store.js";

export default async (_req, context) => {
  const id = context?.params?.id;
  if (!id) return bad("Backup id is required.");

  const backup = await stores.backups.get(`backups/${id}.json`, { type: "json" });
  if (!backup) return bad("Backup not found.", 404);
  return json({ backup });
};

export const config = {
  path: "/api/siteledger/backups/:id",
  method: ["GET"],
};

