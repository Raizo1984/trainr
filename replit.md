# Trainr on Replit

Trainr is a client-side React, TypeScript, and Vite application. It does not need a backend, database, external service, or secret. User data is stored in the browser's `localStorage`.

## Run

Use the **Start application** workflow. It runs:

```bash
npm run dev
```

The Vite development server listens on `0.0.0.0:5000` and allows Replit's proxied preview host.

## Checks

```bash
npm test
npm run build
```

Browser tests require a built app running through `npm run preview`; see `README.md` for the commands.