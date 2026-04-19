const API_BASE = "/api/siteledger";

const parseErrorBody = async (res) => {
  try {
    const data = await res.json();
    return data?.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
};

const request = async (url, options = {}) => {
  const res = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(await parseErrorBody(res));
  }
  if (res.status === 204) return null;
  return res.json();
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });

export const loadCloudBundle = async () => request(`${API_BASE}/sync`, { method: "GET" });

export const syncCloudBundle = async ({
  data,
  masters,
  settings,
  user,
  action,
  details,
  reason,
}) =>
  request(`${API_BASE}/sync`, {
    method: "POST",
    body: JSON.stringify({
      data,
      masters,
      settings,
      user,
      action,
      details,
      reason,
    }),
  });

export const uploadCloudDocuments = async (files, user) => {
  const uploaded = [];
  for (const file of files) {
    const contentBase64 = await fileToBase64(file);
    const payload = await request(`${API_BASE}/documents`, {
      method: "POST",
      body: JSON.stringify({
        name: file.name,
        type: file.type || "application/octet-stream",
        contentBase64,
        user,
      }),
    });
    uploaded.push(payload.document);
  }
  return uploaded;
};

export const listCloudDocuments = async () =>
  (await request(`${API_BASE}/documents`, { method: "GET" })).documents || [];

export const fetchCloudDocumentBlob = async (id) => {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseErrorBody(res));
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  let name = "";
  const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (nameMatch) name = nameMatch[1];
  return { blob, name };
};

export const deleteCloudDocument = async (id) =>
  request(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {},
  });

export const getCloudBackup = async (id) =>
  (await request(`${API_BASE}/backups/${encodeURIComponent(id)}`, { method: "GET" }))
    .backup;

