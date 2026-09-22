# celld-app-template

pnpm monorepo of small celld workers. One worker = one bucket = one celld fleet.
Read README.md for the dev-to-deploy flow.

## Rules

- Style with Tailwind classes and the shadcn tokens in `src/styles.css`, not hand-written CSS.
- Infra and releases are separate. Kubernetes (`deployments/k8s`, kustomize) is applied rarely;
  releasing code is only `pnpm manage deploy`, which writes to the bucket. Never couple them again
  with deployer images, Jobs or rollouts.
- A worker's Kubernetes side is only its overlay in `deployments/k8s/workers/<worker>/`. Change
  `deployments/k8s/fleet/` when every worker should change.
- The celld version lives only in `deployments/k8s/fleet/kustomization.yaml`.
- A worker's bucket prefix is its name: `<BUCKET_ROOT>/<worker>` in both the overlay and the release script.
- Local dev is `vite` with `@cloudflare/vite-plugin` (workerd). The `api` template uses it for `serve`
  only; celld bundles `worker/index.ts` itself. The `web` template (TanStack Start) builds through it:
  `vite build` leaves `dist/server/index.js` + `dist/client/`, and `scripts/celld.mjs` renders the
  source `wrangler.json` against them. Never hand celld the wrangler config the plugin writes: it rejects it.
- Worker vars reach celld only through the Wrangler config at deploy time
  (`WORKER_VAR_<NAME>` -> `scripts/celld.mjs`). `CELLD_VAR_*` no longer exists.
- `wrangler.json` stays strict JSON (`celld.mjs` parses it) and its `name` equals the directory name.
- Wire types live in `apps/<worker>/shared/` as Zod schemas used by both the worker and the client.
- HTTP in `api` workers is Hono on `createApp()` from worker-kit (`jsonBody` for validated bodies,
  thrown `HttpError`s become JSON). `web` workers are TanStack Start: pages and `/api` routes are files
  in `src/routes/`, pages call server functions in `src/server/`, and `worker/notes.ts`-style modules
  are the single place that touches cells. Do not add Hono or a second router to a web worker.
- Server state goes in TanStack Query, client-only state in zustand.
- All repo management goes through `pnpm manage <command>` (`scripts/manage/`). Add new operations there
  as a `Command`, not as loose scripts or package.json aliases. Add a worker with `pnpm manage new`,
  delete one with `pnpm manage remove`.
- `apps/` belongs to the user and may be empty. `pnpm manage new` copies from `templates/` (`api`, `web`,
  `k8s`), which are workspace packages covered by lint, typecheck and tests. Keep templates local: they
  depend on this repo's worker-kit, tsconfig and fleet base, so a remote template would drift.
- Root ESLint rules bind every app. App-specific rules go in `apps/<name>/eslint.rules.ts` and may only
  add or tighten; never create an `eslint.config.ts` inside an app, and never bypass the pre-push hook.
- Git hooks are defined in `lefthook.yml` (installed by lefthook's postinstall). Add hooks there,
  never as files under `.git/hooks` or a custom `core.hooksPath`.
- Shell scripts must run on macOS system bash 3.2 and pass `shellcheck -x`.

## Verify

`pnpm check` (lint:strict, typecheck, test, manage check). For runtime behaviour also run
`pnpm --filter <worker> preview` (real celld).
