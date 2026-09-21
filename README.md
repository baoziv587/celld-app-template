# celld-app-template

**English** | [简体中文](README.zh-CN.md)

A template for building many small workers in one repo and running them on
[celld](https://github.com/denoland/celld) in your own Kubernetes cluster.

Everything is done with one tool: **`pnpm manage`**.

## Get started

You need [Node 24+](https://nodejs.org) and [pnpm 10+](https://pnpm.io).

```bash
pnpm install
pnpm manage dev notes
```

Open <http://localhost:8702>. The page, the API and the database all run on your machine.
Edit a file and the page updates by itself.

## `pnpm manage`

Run `pnpm manage` with no arguments to pick a command from a menu, or name it directly:

| Command | What it does |
| --- | --- |
| `pnpm manage new` | Create a worker. Asks a few questions, then copies a working example |
| `pnpm manage dev [worker...]` | Develop workers locally. No names: pick from a list. `--all`: every worker |
| `pnpm manage preview [worker...]` | Run workers on the real celld runtime, to verify before a release |
| `pnpm manage list` | Show every worker: ports, bucket prefix, public host |
| `pnpm manage check` | Check that each worker and its Kubernetes settings agree |
| `pnpm manage deploy <worker>` | Release a worker's code |
| `pnpm manage k8s <apply\|diff\|render> [worker]` | Manage the cluster side. `diff` shows changes, `apply` makes them, `render` only prints |

`pnpm manage --help` prints this list.

## Workflow

Two things are kept separate:

| | How often | Command |
| --- | --- | --- |
| Set up the cluster | Rarely | `pnpm manage k8s apply` |
| Release code | Every time you ship | `pnpm manage deploy <worker>` |

A release only uploads code to the worker's bucket prefix. The running celld nodes pick it up within
about 30 seconds. Nothing is restarted and Kubernetes is not touched.

### 1. Create a worker

```bash
pnpm manage new
```

Pick a name and a kind:

- **api**: code that answers requests. Copied from `apps/counter`.
- **web**: a web page plus the code behind it. Copied from `apps/notes`.

The worker is created in `apps/<name>/` and runs right away. Edit `apps/<name>/worker/` to make it yours.

### 2. Develop

```bash
pnpm manage dev billing          # one worker
pnpm manage dev billing notes    # several at once
pnpm dev                         # all of them
```

Every worker has its own port. `pnpm manage list` shows them.

For local settings and secrets, copy `apps/<name>/.dev.vars.example` to `.dev.vars` and add
`NAME=value` lines. Git ignores this file.

### 3. Verify on the real runtime

Local development uses workerd, which is fast and needs nothing installed. Before a release, run the
worker on celld itself:

```bash
curl -fsSL https://celld.dev/install.sh | sh    # install celld, one time
pnpm manage preview billing
```

### 4. Set up the cluster (one time)

You need `kubectl` pointed at your cluster.

```bash
cp deployments/k8s/platform/credentials.example.env deployments/k8s/platform/credentials.env
# edit credentials.env: the bucket access key and secret
# edit deployments/k8s/workers/<name>/kustomization.yaml: public host, number of replicas

pnpm manage k8s diff
pnpm manage k8s apply
```

This starts the shared object storage and the celld nodes for every worker. Until the first release,
the nodes wait and their pods show "not ready". That is expected.

After adding a worker later: `pnpm manage k8s apply <name>`.

### 5. Release

```bash
cp deployments/deploy.example.env deployments/deploy.env
# edit deploy.env: the bucket endpoint, access key and secret

pnpm manage deploy billing
```

It typechecks, builds, and uploads the worker. Run it every time you want to ship.

Production settings and secrets go in `apps/<name>/.prod.vars` (`NAME=value` lines, ignored by git).
After changing one, run `pnpm manage deploy` again.

If the object storage runs inside the cluster with no public address, open a tunnel first:
`kubectl -n cells port-forward svc/rustfs 19200:9000`.

## Project layout

```text
apps/<name>/                  one worker
  worker/                     request handling and Durable Objects
  src/                        the web page (web workers only)
  shared/                     types and schemas used by both the page and the worker
  wrangler.json               worker config: name, bindings, default vars
  eslint.rules.ts             extra ESLint rules for this worker only (optional)
packages/worker-kit/          helpers shared by all workers
deployments/k8s/              the cluster side (kustomize)
  platform/                   namespace, object storage, shared bucket and credentials
  fleet/                      base manifests for one worker's celld nodes
  workers/<name>/             per-worker overlay: name, bucket prefix, host, replicas
scripts/manage/               the code behind `pnpm manage`
```

## Code rules

One ESLint config, `eslint.config.ts`, covers the whole repo.

- Every worker must follow it.
- A worker may add stricter rules in `apps/<name>/eslint.rules.ts`.
  See [apps/notes/eslint.rules.ts](apps/notes/eslint.rules.ts).
- A worker cannot turn a root rule off. If it tries, ESLint refuses to run.

A pre-push git hook runs ESLint on the whole repo and blocks the push if it fails. `pnpm install`
sets the hook up. `pnpm lint:fix` repairs most problems.

Run every check at once:

```bash
pnpm check    # ESLint + types + tests + pnpm manage check
```

## Good to know

- **Run at least 2 replicas per worker.** With one node, every write waits for the bucket. With two,
  a write is confirmed by the second node, which is much faster.
- **Nodes hold no important data.** All state lives in the bucket. If a node is lost, another takes over.
- **All workers share one set of bucket credentials.** Treat them as admin credentials. To isolate a
  worker, give it its own bucket and its own credentials.
- **Upgrading celld** is one line: `newTag` in `deployments/k8s/fleet/kustomization.yaml`, then
  `pnpm manage k8s apply`. Workers are briefly unavailable, because celld versions must not mix.
  Releasing code never causes this.
- **Using S3, R2 or GCS**: remove `rustfs.yaml` and `bucket-init.yaml` from
  `deployments/k8s/platform/kustomization.yaml` and point `S3_ENDPOINT` at your service.

## Troubleshooting

| You see | Try |
| --- | --- |
| `celld: command not found` | Only `preview` and `deploy` need celld. Install it with the command in step 3 |
| Pods stay "not ready" | No code has been released yet. Run `pnpm manage deploy <name>` |
| `pnpm manage check` fails | It names the file and the mismatch. Usually a worker was renamed in only one place |
| `git push` is refused | Run `pnpm lint:fix`, fix what is left, push again |
| Need to look inside the cluster | `kubectl -n cells get pods` and `kubectl -n cells logs deploy/<name>-celld` |

## Stack

Worker: TypeScript, Zod, Durable Objects with SQLite.
Web: Vite, React, TanStack Router and Query, zustand, Tailwind CSS, shadcn/ui
(add a component with `pnpm dlx shadcn@latest add <component>` inside `apps/<name>`).
