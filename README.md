# Inventorius Frontend

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
docker pull ghcr.io/computemachines/inventorius-frontend:latest
```

See [inventorius-deploy](https://github.com/computemachines/inventorius-deploy) for the full Docker Compose stack.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_HOSTNAME` | API server URL (for SSR, default: `http://localhost:8000`) |
| `PORT` | SSR server port (default: `3001`) |

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
