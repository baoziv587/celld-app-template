# celld-app-template

一个仓库，多个小 [celld](https://github.com/denoland/celld) worker，从本地开发一路到 Kubernetes。

celld 是自托管的 Cloudflare Workers / Durable Objects 运行时。它的部署边界是固定的：

```text
一个 worker = 一个 bucket 前缀 = 一个 celld fleet = N 个 celld 节点
```

这是 celld 的硬约束：每次 `celld deploy` 都会移动整个 fleet 的主应用指针，所以一组 celld 进程只能服务
一个 worker。模板在这个约束下把两件事彻底分开：

| | 做什么 | 频率 |
| --- | --- | --- |
| **Infra** | `kubectl apply -k deployments/k8s`：共享 RustFS、一个 bucket、一份凭据，每个 worker 一个十几行的 kustomize overlay | 很少 |
| **发布代码** | `pnpm deploy:worker <name>`：只把 worker 写进 bucket，运行中的节点约 30 秒内原地切换 | 每次上线 |

发布代码不构建镜像、不跑 Job、不动任何 Pod。

## 目录

```text
apps/
  counter/                 示例：纯 API worker + Durable Object（SQLite）
  notes/                   示例：React SPA + worker + Durable Object
    worker/                Worker 入口与 cell
    shared/                前后端共用的 Zod 协议
    src/                   React 客户端
    wrangler.json          celld 读取的部署配置
    compose.yaml           本 worker 的 Compose 服务
packages/
  worker-kit/              worker 共用的小工具（JSON 响应、错误、Zod 解析）
deployments/
  versions.env             celld 版本（Compose 与镜像构建读取）
  deploy.example.env       发布目标：bucket、endpoint、凭据
  k8s/
    kustomization.yaml     整个集群侧的入口
    platform/              namespace、RustFS、共享 bucket、共享凭据
    fleet/                 一个 fleet 的 base：Deployment、Service、PDB、NetworkPolicy、Ingress
    workers/<name>/        每个 worker 的 overlay：名称前缀、bucket 前缀、域名、副本数
  docker-compose.yaml      本地平台：RustFS + bucket
  Dockerfile.worker        Compose 用的 worker 镜像
  worker-entrypoint.mjs    合并变量后执行 celld deploy（Compose 和发布脚本共用）
  check-infra.sh           离线一致性检查
scripts/
  create-worker.ts         pnpm new:worker
  deploy-worker.ts         pnpm deploy:worker
```

## 准备

- Node 24+、pnpm 10+、Docker
- celld CLI（`celld dev` 和发布代码需要）：`curl -fsSL https://celld.dev/install.sh | sh`

```bash
pnpm install
```

## 三层开发循环

| 层 | 命令 | 用途 |
| --- | --- | --- |
| 1. `celld dev` | `pnpm --filter notes dev` | 最快。单节点、本地存储、改代码自动重建，无需 Docker |
| 2. Compose | `docker compose --profile notes up --build` | 真实链路：镜像构建、`celld deploy`、S3（RustFS）、celld 节点 |
| 3. Kubernetes | `pnpm k8s:apply` 一次，之后 `pnpm deploy:worker notes` | 多节点 fleet、Ingress |

### 1. celld dev

```bash
pnpm --filter counter dev     # http://127.0.0.1:8701
pnpm --filter notes dev       # Vite http://localhost:5173 ，/api 代理到 celld dev :8702
pnpm dev                      # 同时启动所有 worker
```

本地变量写在 `apps/<worker>/.dev.vars`（从 `.dev.vars.example` 复制，已被 gitignore）。
状态保存在 `apps/<worker>/.celld/dev`；配置变更后状态异常时用 `celld dev --clean`。

```bash
curl -X POST localhost:8701/api/counters/visits/increment -d '{"by":2}'
```

### 2. Docker Compose

```bash
docker compose up -d                              # 只起平台：RustFS + bucket
docker compose --profile counter up --build       # 平台 + 一个 worker  -> :8801
docker compose --profile all up --build           # 全部               -> :8801 :8802
```

每个 worker 有两个服务：`<worker>-deploy`（一次性，把 worker 发布进 bucket）和
`<worker>-celld`（运行节点）。所有 worker 共用 bucket `cells`，各占一个前缀 `s3://cells/<worker>`，
和集群里的布局一致。重新发布不需要重启节点，celld 会在下一次轮询时原地切换版本：

```bash
docker compose --profile counter run --rm counter-deploy
```

端口和 RustFS 凭据在 `deployments/compose.env`；shell 里导出的同名变量优先。

### 3. Kubernetes

**Infra，一次性：**

```bash
cp deployments/k8s/platform/credentials.example.env deployments/k8s/platform/credentials.env
$EDITOR deployments/k8s/platform/credentials.env        # bucket 凭据
$EDITOR deployments/k8s/workers/notes/kustomization.yaml # 域名、副本数
pnpm k8s:apply                                           # = kubectl apply -k deployments/k8s
```

`pnpm k8s:diff` 可以先看改动。只想动一个 worker 时：`kubectl apply -k deployments/k8s/workers/notes`。
fleet 在首次发布之前没有可服务的代码：节点会等待（日志 `awaiting_initial_deployment`），Pod 保持
未就绪，首次 `pnpm deploy:worker` 后几秒内自动就绪。

使用 S3 / R2 / GCS：从 `platform/kustomization.yaml` 去掉 `rustfs.yaml` 和 `bucket-init.yaml`，把
`S3_ENDPOINT` 改成外部地址（AWS S3 则删掉这一项）。

集群级的调整都在 kustomize 里完成，例如 Ingress class 和 TLS 写成 `fleet/` 上的 patch，单个 worker
的资源上限写成该 overlay 里的 patch。

**发布代码，每次上线：**

```bash
cp deployments/deploy.example.env deployments/deploy.env
$EDITOR deployments/deploy.env                           # 与集群相同的 bucket 和 endpoint
pnpm deploy:worker notes
```

脚本依次执行 typecheck、build、合并变量、`celld deploy` 到 `s3://cells/notes`。集群内的 RustFS 没有
公网入口时，先 `kubectl -n cells port-forward svc/rustfs 19200:9000`。`deploy.env` 的值优先于 shell
环境变量，避免其他项目导出的 `AWS_*` 把发布带到错误的账号。CI 用 `--env <file>` 指定另一份配置。

## 新增 worker

```bash
pnpm new:worker                     # 交互式
pnpm new:worker billing --kind api  # 脚本化；kind: api | web
```

它复制一个活的示例（`api` 来自 `counter`，`web` 来自 `notes`），改名，分配不冲突的端口，并把
`apps/<name>/compose.yaml` 追加到根 `docker-compose.yaml`，并生成 `deployments/k8s/workers/<name>/`
overlay。示例本身就是模板：它们和全仓一起被 lint、typecheck、测试，模板不会悄悄腐烂。之后把示例 cell 和路由改成你自己的即可。

## 变量与 Secret

celld 只在 **deploy 时** 从 Wrangler 配置的 `vars` 读取变量，运行节点没有环境变量覆盖机制
（旧版的 `CELLD_VAR_*` 已被移除）。模板的做法：

| 场景 | 来源 |
| --- | --- |
| 默认值 | `wrangler.json` 的 `vars` |
| `celld dev` | `apps/<worker>/.dev.vars` |
| Compose | `<worker>-deploy` 服务的 `WORKER_VAR_<NAME>` 环境变量 |
| 生产发布 | `apps/<worker>/.prod.vars`（gitignore）|

`worker-entrypoint.mjs` 把所有 `WORKER_VAR_<NAME>` 合并进一份临时的 `wrangler.deploy.json` 再执行
`celld deploy`。改了变量后重新 `pnpm deploy:worker <name>` 即可，节点会原地采用新版本。

注意：变量随 deployment 写入 bucket，请把 bucket 凭据当作管理员凭据保护。

## 升级 celld

改两处，`pnpm check:infra` 会拒绝它们不一致：

```text
deployments/versions.env                  CELLD_IMAGE=ghcr.io/denoland/celld:<tag>
deployments/k8s/fleet/kustomization.yaml  images[0].newTag: <tag>
```

然后 `pnpm k8s:apply`。celld 不允许同一 fleet 内混跑不同版本，所以 fleet 的 Deployment 使用
`Recreate` 策略：模板变化时整组节点一起替换，会有短暂中断。这只发生在升级 runtime 或调整资源时，
发布代码永远不会触发。

## 运维要点

- **两个监听端口**：8080 是公共 Worker 端口，只保留 `/.well-known/celld/health`；8081 是 peer 与
  无鉴权的 operator API，节点以 Pod IP 互相发现，NetworkPolicy 只允许同 fleet 的 Pod 访问。不要用
  Service、NodePort 或 LoadBalancer 暴露 8081。
- **节点是无状态的**：bucket 是持久化真相，fleet 用普通 Deployment + `emptyDir`。节点重启后按需从
  bucket 恢复 cell，代价是冷启动多一次读取。
- **至少 2 个副本**：单节点每次写入都要等 bucket；两个节点后写入落到 peer 磁盘即确认，快得多。
- **优雅下线**：`terminationGracePeriodSeconds: 60` 大于 celld 默认 40 s 的停机上限，cell 才能在
  SIGKILL 之前完成交接。
- **小 worker**：默认 100m CPU / 256Mi 内存起步，按 worker 在自己的 overlay 里 patch 调大。
- **共享 bucket 的代价**：所有 fleet 共用一份凭据，而 bucket 凭据等同于 fleet 管理员权限。需要在
  worker 之间做权限隔离时，给该 worker 单独的 bucket 和 Secret。

```bash
kubectl -n cells get pods,svc,ingress
kubectl -n cells logs deploy/notes-celld
kubectl -n cells exec deploy/notes-celld -- celld diagnose --listen 127.0.0.1:18080
```

## 质量检查

```bash
pnpm check        # lint + typecheck + test + check:infra
```

- ESLint：[@antfu/eslint-config](https://github.com/antfu/eslint-config) +
  [eslint-plugin-slop](https://www.npmjs.com/package/eslint-plugin-slop)
- `check:infra` 无需集群：渲染每个 worker 的 overlay，校验 bucket 前缀与发布脚本一致、Compose 与
  集群的 celld 版本一致、`wrangler.json` 的 `name` 与目录名一致

## 技术栈

Worker：TypeScript、Zod、Durable Objects（SQLite + RPC）。
Web：Vite、React、TanStack Router、TanStack Query、zustand、Tailwind CSS v4、shadcn/ui
（`pnpm dlx shadcn@latest add <component>`，在 `apps/<worker>` 目录下执行）。
