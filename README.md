# Inventorius Frontend

[![Build](https://github.com/computemachines/inventorius-frontend/actions/workflows/build-push.yml/badge.svg)](https://github.com/computemachines/inventorius-frontend/actions/workflows/build-push.yml)

React web application for the Inventorius inventory management system. Features server-side rendering for fast QR code scans and a dynamic form system powered by the unified trigger schema.

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Start development server (with hot module replacement)
npm run start
```

The frontend will be available at http://localhost:8080

**Note:** The API must be running at http://localhost:8000 for full functionality.

## Project Structure

```
src/
├── components/
│   ├── App.tsx              # Main app with routing
│   ├── NewSkuForm.tsx       # SKU creation (schema-based)
│   ├── NewBatchForm.tsx     # Batch creation (schema-based)
│   ├── SchemaFields.tsx     # Reusable field components
│   ├── Sku.tsx              # SKU detail/edit view
│   ├── Batch.tsx            # Batch detail/edit view
│   └── ...
├── hooks/
│   ├── useSchemaForm.ts     # Schema evaluation hook
│   └── ...
├── api-client/
│   ├── api-client.ts        # API wrapper
│   └── data-models.ts       # TypeScript types
└── styles/
    └── tailwind.css         # Tailwind CSS
```

## Key Features

### Dynamic Forms with useSchemaForm

The `useSchemaForm` hook connects to the API's schema evaluation endpoint to provide dynamic form fields based on user input:

```typescript
const schema = useSchemaForm("sku", ["ItemTypeSelector"]);

// schema.availableFields - fields to render
// schema.fieldValues - current values
// schema.handleFieldChange - update handler
// schema.getSubmitValues() - clean values for submission
```

**WYSIWYG Architecture:** The visible form state equals the submission state. When fields disappear (e.g., switching from Resistor to Capacitor), their values are archived to a restoration cache for UX convenience but are never submitted.

### Server-Side Rendering

Pages are pre-rendered on the server so QR code scans display content immediately without waiting for JavaScript to load.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Development server with HMR (port 8080) |
| `npm run build` | Production build |
| `npm run server` | Run SSR server (port 3001) |
| `npm run lint` | Run ESLint |

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Home | Dashboard |
| `/new/sku` | NewSkuForm | Create SKU with dynamic fields |
| `/new/batch` | NewBatchForm | Create Batch with supplier fields |
| `/new/bin` | NewBin | Create storage location |
| `/sku/:id` | Sku | View/edit SKU |
| `/batch/:id` | Batch | View/edit Batch |
| `/search` | SearchForm | Full-text search |

## Docker Deployment

The frontend is deployed as a Docker container via GitHub Actions CI/CD:

```bash
docker pull ghcr.io/computemachines/inventorius-frontend:sha-<full-40-character-commit>
```

Images are published only under immutable `sha-<full-40-character-commit>`
tags. The `development` tag is a moving development-channel convenience tag;
promotion should deploy an immutable SHA image unchanged.

See [inventorius-deploy](https://github.com/computemachines/inventorius-deploy) for the full Docker Compose stack.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_HOSTNAME` | API server URL (for SSR, default: `http://localhost:8000`) |
| `PORT` | SSR server port (default: `3001`) |
| `PRODUCT_RELEASE` | Human product-release tag added to Sentry events and `/build.json` at runtime |
| `DEPLOYMENT_ENVIRONMENT` | Runtime environment name, such as `development`, `staging`, or `production` |
| `INVENTORIUS_RELEASE_MANIFEST_PATH` | Optional controller-written schema-1 manifest; it overrides `PRODUCT_RELEASE` only when it names the frontend and exactly matches this image revision |
| `SENTRY_BROWSER_DSN` | Public browser Sentry DSN; omitted disables browser reporting |
| `SENTRY_SSR_DSN` | Server Sentry DSN; omitted disables SSR reporting |

`/build.json` is a public-safe provenance endpoint. It returns the component
version, immutable Git revision, product release, runtime environment, and
build time. No Sentry DSNs, credentials, request data, or source maps are
served from the runtime image.

The publish workflow needs GitHub secret `SENTRY_AUTH_TOKEN` and repository
variables `SENTRY_ORG`, `SENTRY_CLIENT_PROJECT`, and `SENTRY_SERVER_PROJECT`
only to upload private source maps. It skips that upload when any is absent.
Runtime DSNs belong in the deployment environment, never in this repository or
the image.

The manifest is read for every `/build.json` and SSR response. It must have
`schema: 1`, `component: "frontend"`, the image's full immutable `revision`,
and a non-empty `product_release`. Missing, stale, or malformed manifests
safely fall back to `PRODUCT_RELEASE` (then the component version).

## Design System

Colors used throughout the UI:

| Color | Hex | Usage |
|-------|-----|-------|
| Deep black | `#04151f` | Headers, text |
| Dark navy | `#082441` | Dropdowns, badges |
| Medium blue | `#0c3764` | Hover, focus states |
| Amber | `#c0771f` | Accents, required indicators |
| Light gray | `#cdd2d6` | Borders, dividers |
| Dark green | `#26532b` | Primary buttons, success |
