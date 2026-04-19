import { bad, stores, writeLog } from "./_shared/siteledger-store.js";

export default async (req, context) => {
  const id = context?.params?.id;
  if (!id) return bad("Document id is required.");

  const key = `docs/${id}`;

  if (req.method === "GET") {
    const [meta, data] = await Promise.all([
      stores.docs.getMetadata(key),
      stores.docs.get(key, { type: "arrayBuffer" }),
    ]);

    if (!meta || !data) {
      return bad("Document not found.", 404);
    }

    const name = (meta.metadata && meta.metadata.name) || `document-${id}`;
    const contentType =
      (meta.metadata && meta.metadata.contentType) || "application/octet-stream";

    return new Response(data, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": contentType,
        "content-disposition": `inline; filename="${name.replace(/"/g, "")}"`,
      },
    });
  }

  if (req.method === "DELETE") {
    const meta = await stores.docs.getMetadata(key);
    if (!meta) return bad("Document not found.", 404);
    await stores.docs.delete(key);
    await writeLog({
      user: "Unknown",
      action: "Deleted document",
      details: (meta.metadata && meta.metadata.name) || id,
    });
    return new Response(null, { status: 204 });
  }

  return bad("Method not allowed", 405);
};

export const config = {
  path: "/api/siteledger/documents/:id",
  method: ["GET", "DELETE"],
};

