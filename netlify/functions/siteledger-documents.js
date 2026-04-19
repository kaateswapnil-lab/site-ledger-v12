import {
  bad,
  decodeBase64,
  json,
  listDocumentMetadata,
  parseJson,
  stores,
  writeLog,
} from "./_shared/siteledger-store.js";

export default async (req) => {
  if (req.method === "GET") {
    const documents = await listDocumentMetadata();
    return json({ documents });
  }

  if (req.method !== "POST") {
    return bad("Method not allowed", 405);
  }

  const body = await parseJson(req);
  if (!body || typeof body !== "object") {
    return bad("Invalid JSON payload.");
  }

  const { name, type, contentBase64, user } = body;
  if (!name || !contentBase64) {
    return bad("Both 'name' and 'contentBase64' are required.");
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const uploadedAt = new Date().toISOString();
  const buffer = decodeBase64(contentBase64);
  const metadata = {
    id,
    name,
    contentType: type || "application/octet-stream",
    size: buffer.byteLength,
    uploadedAt,
    uploadedBy: user || "Unknown",
  };

  if (buffer.byteLength > 4 * 1024 * 1024) {
    return bad("File too large. Please upload files up to 4 MB.");
  }

  await stores.docs.set(`docs/${id}`, buffer, { metadata });
  await writeLog({
    user,
    action: "Uploaded document",
    details: name,
  });

  return json({
    ok: true,
    document: {
      id,
      name,
      type: metadata.contentType,
      size: metadata.size,
      uploadedAt,
      uploadedBy: metadata.uploadedBy,
    },
  });
};

export const config = {
  path: "/api/siteledger/documents",
  method: ["GET", "POST"],
};
