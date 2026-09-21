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
- Local dev is `vite` with `@cloudflare/vite-plugin` (workerd), enabled for `serve` only. Never let it
  drive the build: celld rejects the wrangler config it generates.
- Worker vars reach celld only through the Wrangler config at deploy time
  (`WORKER_VAR_<NAME>` -> `scripts/celld-deploy.mjs`). `CELLD_VAR_*` no longer exists.
- `wrangler.json` stays strict JSON (`celld-deploy.mjs` parses it) and its `name` equals the directory name.
- Wire types live in `apps/<worker>/shared/` as Zod schemas used by both the worker and the client.
- Server state goes in TanStack Query, client-only state in zustand.
- All repo management goes through `pnpm manage <command>` (`scripts/manage/`). Add new operations there
  as a `Command`, not as loose scripts or package.json aliases. Add a worker with `pnpm manage new`.
- Root ESLint rules bind every app. App-specific rules go in `apps/<name>/eslint.rules.ts` and may only
  add or tighten; never create an `eslint.config.ts` inside an app, and never bypass the pre-push hook.
- Shell scripts must run on macOS system bash 3.2 and pass `shellcheck -x`.

## Verify

`pnpm check` (lint:strict, typecheck, test, manage check). For runtime behaviour also run
`pnpm --filter <worker> preview` (real celld).
