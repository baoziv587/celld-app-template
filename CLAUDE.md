# celld-app-template

pnpm monorepo of small celld workers. One worker = one bucket = one celld fleet.
Read README.md for the dev-to-deploy flow.

## Rules

- Style with Tailwind classes and the shadcn tokens in `src/styles.css`, not hand-written CSS.
- Infra and releases are separate. Kubernetes (`deployments/k8s`, kustomize) is applied rarely;
  releasing code is only `pnpm deploy:worker`, which writes to the bucket. Never couple them again
  with deployer images, Jobs or rollouts.
- A worker's Kubernetes side is only its overlay in `deployments/k8s/workers/<worker>/`. Change
  `deployments/k8s/fleet/` when every worker should change.
- The celld version lives in `deployments/versions.env` and `deployments/k8s/fleet/kustomization.yaml`;
  keep them equal (`pnpm check:infra` enforces it).
- A worker's bucket prefix is its name: `<BUCKET_ROOT>/<worker>` in the overlay, Compose and release script.
- Worker vars reach celld only through the Wrangler config at deploy time
  (`WORKER_VAR_<NAME>` -> `worker-entrypoint.mjs`). `CELLD_VAR_*` no longer exists.
- `wrangler.json` stays strict JSON (the entrypoint parses it) and its `name` equals the directory name.
- Wire types live in `apps/<worker>/shared/` as Zod schemas used by both the worker and the client.
- Server state goes in TanStack Query, client-only state in zustand.
- Add a worker with `pnpm new:worker`, not by hand.
- Shell scripts must run on macOS system bash 3.2 and pass `shellcheck -x`.

## Verify

`pnpm check` (lint, typecheck, test, check:infra). For deployment changes also run
`docker compose --profile all up --build`.
