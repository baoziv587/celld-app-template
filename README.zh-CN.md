# celld-app-template

[English](README.md) | **简体中文**

一个模板：在同一个仓库里开发多个小 worker，并用 [celld](https://github.com/denoland/celld) 把它们运行在
你自己的 Kubernetes 集群上。

所有操作都通过一个工具完成：**`pnpm manage`**。

## 开始

需要 [Node 24+](https://nodejs.org) 和 [pnpm 10+](https://pnpm.io)。

```bash
pnpm install
pnpm manage new notes --kind web    # 从模板创建你的第一个 worker
pnpm manage dev notes
```

打开 <http://localhost:8701>。网页、API 和数据库都运行在你的电脑上。改一个文件，页面会自动更新。

## `pnpm manage`

不带参数运行 `pnpm manage` 会出现菜单，也可以直接指定命令：

| 命令 | 作用 |
| --- | --- |
| `pnpm manage new` | 从 `templates/` 中的模板新建 worker。会问几个问题 |
| `pnpm manage remove <worker>` | 从仓库中删除 worker 及其 Kubernetes overlay |
| `pnpm manage dev [worker...]` | 本地开发 worker。不写名字：从列表里选。`--all`：全部 |
| `pnpm manage preview [worker...]` | 在真实的 celld 运行时上运行，用于发布前验证 |
| `pnpm manage list` | 列出所有 worker：端口、bucket 前缀、公网域名 |
| `pnpm manage check` | 检查每个 worker 和它的 Kubernetes 设置是否一致 |
| `pnpm manage deploy <worker>` | 发布 worker 的代码 |
| `pnpm manage k8s <apply\|diff\|render> [worker]` | 管理集群侧。`diff` 查看改动，`apply` 应用改动，`render` 只打印 |

`pnpm manage --help` 会打印这张表。

## 流程

有两件事是分开的：

| | 频率 | 命令 |
| --- | --- | --- |
| 搭建集群 | 很少 | `pnpm manage k8s apply` |
| 发布代码 | 每次上线 | `pnpm manage deploy <worker>` |

发布只是把代码上传到该 worker 的 bucket 前缀。运行中的 celld 节点会在约 30 秒内采用新版本，不重启任何
东西，也不改动 Kubernetes。

### 1. 新建 worker

```bash
pnpm manage new
```

选一个名字和一种类型：

- **api**：处理请求的代码。从 `templates/api` 复制。
- **web**：一个网页加上它背后的代码。从 `templates/web` 复制。

worker 会创建在 `apps/<name>/`，并且马上可以运行。修改 `apps/<name>/worker/` 把它变成你自己的。

`apps/` 完全归你所有：可以随意新增、修改、删除 worker。用 `pnpm manage remove <name>` 删除，它会同时
清理对应的 Kubernetes overlay。模板放在 `templates/`，和普通 worker 一样被 `pnpm check` 检查，所以仓库
演进时模板始终可用。想改变新 worker 的起点，直接修改模板。

### 2. 开发

```bash
pnpm manage dev billing          # 一个
pnpm manage dev billing notes    # 同时多个
pnpm dev                         # 全部
```

每个 worker 有自己的端口，用 `pnpm manage list` 查看。

本地配置和密钥：把 `apps/<name>/.dev.vars.example` 复制为 `.dev.vars`，在里面写 `NAME=value`。
Git 会忽略这个文件。

### 3. 在真实运行时上验证

本地开发使用 workerd，速度快，且不需要安装任何东西。发布前，在 celld 上运行一次：

```bash
curl -fsSL https://celld.dev/install.sh | sh    # 安装 celld，只需一次
pnpm manage preview billing
```

### 4. 搭建集群（只做一次）

需要 `kubectl` 已连接到你的集群。

```bash
cp deployments/k8s/platform/credentials.example.env deployments/k8s/platform/credentials.env
# 编辑 credentials.env：bucket 的 access key 和 secret
# 编辑 deployments/k8s/workers/<name>/kustomization.yaml：公网域名、副本数

pnpm manage k8s diff
pnpm manage k8s apply
```

这一步会启动共享的对象存储，以及每个 worker 的 celld 节点。首次发布之前，节点会处于等待状态，Pod 显示
"not ready"，这是预期行为。

之后新增了 worker：`pnpm manage k8s apply <name>`。

### 5. 发布

```bash
cp deployments/deploy.example.env deployments/deploy.env
# 编辑 deploy.env：bucket 的 endpoint、access key 和 secret

pnpm manage deploy billing
```

它会做类型检查、构建，然后上传 worker。每次上线都运行这条命令。

生产环境的配置和密钥写在 `apps/<name>/.prod.vars`（`NAME=value`，Git 会忽略）。修改后重新运行
`pnpm manage deploy` 即可生效。

如果对象存储运行在集群内、没有公网地址，先建立隧道：
`kubectl -n cells port-forward svc/rustfs 19200:9000`。

## 项目结构

```text
apps/<name>/                  一个 worker
  worker/                     请求处理和 Durable Objects
  src/                        网页（仅 web 类型）
  shared/                     网页和 worker 共用的类型与 schema
  wrangler.json               worker 配置：名称、bindings、默认变量
  eslint.rules.ts             仅对该 worker 生效的额外 ESLint 规则（可选）
templates/                    `pnpm manage new` 的复制来源
  api/  web/                  两种 worker 模板
  k8s/                        Kubernetes overlay 模板
packages/worker-kit/          所有 worker 共用的工具函数
deployments/k8s/              集群侧（kustomize）
  platform/                   namespace、对象存储、共享 bucket 和凭据
  fleet/                      单个 worker 的 celld 节点的基础清单
  workers/<name>/             每个 worker 的 overlay：名称、bucket 前缀、域名、副本数
scripts/manage/               `pnpm manage` 的实现
```

## 代码规范

整个仓库使用同一份 ESLint 配置 `eslint.config.ts`。

- 每个 worker 必须遵守。
- worker 可以在 `apps/<name>/eslint.rules.ts` 中追加更严格的规则。
  示例见 [templates/web/eslint.rules.ts](templates/web/eslint.rules.ts)。
- worker 不能关闭 root 规则。一旦这么写，ESLint 会拒绝运行。

pre-push git hook 会对整个仓库运行 ESLint，失败则阻止 push。`pnpm install` 会自动安装这个 hook。
`pnpm lint:fix` 可以自动修复大部分问题。

一次运行所有检查：

```bash
pnpm check    # ESLint + 类型 + 测试 + pnpm manage check
```

## 注意事项

- **每个 worker 至少运行 2 个副本。** 单节点时每次写入都要等待 bucket；有两个节点时，写入由第二个节点
  确认，快得多。
- **节点上不保存重要数据。** 所有状态都在 bucket 里。某个节点丢失后，其他节点会接管。
- **所有 worker 共用一份 bucket 凭据。** 请按管理员凭据保护。需要隔离某个 worker 时，给它单独的 bucket
  和凭据。
- **升级 celld** 只改一行：`deployments/k8s/fleet/kustomization.yaml` 中的 `newTag`，然后
  `pnpm manage k8s apply`。worker 会短暂不可用，因为不同版本的 celld 不能混合运行。发布代码不会导致中断。
- **使用 S3、R2 或 GCS**：从 `deployments/k8s/platform/kustomization.yaml` 中移除 `rustfs.yaml` 和
  `bucket-init.yaml`，并把 `S3_ENDPOINT` 指向你的服务。

## 排错

| 现象 | 处理 |
| --- | --- |
| `celld: command not found` | 只有 `preview` 和 `deploy` 需要 celld。用第 3 步的命令安装 |
| Pod 一直 "not ready" | 还没有发布过代码。运行 `pnpm manage deploy <name>` |
| `pnpm manage check` 失败 | 它会指出具体文件和不一致之处。通常是 worker 只在一处改了名 |
| `git push` 被拒绝 | 运行 `pnpm lint:fix`，修复剩余问题后重新 push |
| 需要查看集群内部 | `kubectl -n cells get pods` 和 `kubectl -n cells logs deploy/<name>-celld` |

## 技术栈

Worker：TypeScript、Zod、Durable Objects（SQLite）。
Web：Vite、React、TanStack Router 和 Query、zustand、Tailwind CSS、shadcn/ui
（在 `apps/<name>` 目录下用 `pnpm dlx shadcn@latest add <component>` 添加组件）。
