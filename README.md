# SiteLedger v8

React + Vite construction ERP app with shared cloud persistence on Netlify.

## What is stored

The app now supports:

- Shared transaction state (`data`, `masters`, `settings`)
- Shared document vault (images and PDFs)
- Shared change log
- Shared backup restore points

Cloud storage is implemented using:

- Netlify Functions (`netlify/functions`)
- Netlify Blobs (`@netlify/blobs`)

If cloud APIs are unavailable, the app falls back to local browser storage.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Frontend only (local fallback mode):

```bash
npm run dev
```

3. Frontend + Netlify Functions + Blobs (shared cloud mode):

```bash
netlify dev
```

Use `netlify dev` when testing shared storage behavior.

## Deploy to Netlify

1. Push this project to Git.
2. Create a new Netlify site from that repository.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy.

The API paths are already configured through function `config.path`:

- `GET/POST /api/siteledger/sync`
- `GET/POST /api/siteledger/documents`
- `GET/DELETE /api/siteledger/documents/:id`
- `GET /api/siteledger/backups/:id`

