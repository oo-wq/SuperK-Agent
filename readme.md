# SuperK-Agent

一个可本地运行的个人全能 AI Agent，用 TypeScript 编写，基于 [Vercel AI SDK](https://sdk.vercel.ai/) + 阿里云百炼（DashScope / Qwen）。它不只是聊天，而是一套带「保险丝」的智能体运行时：记忆、RAG 知识库、定时任务、多 Agent 并行、安全管线一应俱全。

## 项目介绍

### 核心特性

| 模块 | 说明 |
|---|---|
| 🧠 记忆系统 | SQLite 持久化记忆，含格式校验与 `lint` 自检 |
| 📚 RAG 知识库 | `sqlite-vec` 向量检索，文档分块 + DashScope Embedding |
| ⏰ 定时任务 | 基于 cron 表达式，支持持久化、状态追踪、连续失败熔断、崩溃恢复 |
| 🤝 多 Agent | 独立上下文窗口的 Sub-Agent 并行执行，压缩结果回传父 Agent |
| 🔒 安全管线 | 角色权限（owner/developer/collaborator/guest）、Bash 命令风险分类、Hook 管线 |
| 🛠️ 工具系统 | Bash / 文件 / 搜索 / Web 搜索 / MCP（GitHub）/ 子 Agent 生成 |
| 📏 防跑飞 | 死循环检测（指纹 + 滑动窗口）、Token 预算、指数退避重试 |
| 🧩 Skill 机制 | 用 Markdown + YAML frontmatter 注入行为规范，约束 Agent 行为 |
| 🔌 Plugin 机制 | 插件化扩展工具，动态注册/卸载与生命周期管理 |

### 技术栈

- **语言**：TypeScript（ESM）
- **模型**：阿里云百炼 DashScope（Qwen 系列，OpenAI 兼容接口）
- **核心依赖**：`ai`（Vercel AI SDK）、`@ai-sdk/openai`、`better-sqlite3`、`sqlite-vec`、`croner`、`zod`

## 使用说明

### 1. 环境要求

- **Node.js** ≥ 20（推荐 22+）
- **pnpm** ≥ 11（项目已配置 `devEngines`，版本不符会自动提示）

### 2. 下载代码

方式一：git clone（推荐）

```bash
git clone https://github.com/oo-wq/SuperK-Agent.git
cd SuperK-Agent
```

方式二：直接下载

仓库页右上角 **Code → Download ZIP** → 解压后 `cd` 进入目录。

### 3. 安装依赖

```bash
pnpm install
```

> 依赖含原生模块 `better-sqlite3`、`sqlite-vec`。项目已在 `pnpm-workspace.yaml` 中通过 `allowBuilds` 让它们直接使用内置的预编译二进制、跳过本地编译，因此安装**无需** Visual Studio Build Tools / gcc。

### 4. 配置

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

编辑 `.env`，至少填入：

```bash
DASHSCOPE_API_KEY=sk-xxx    # 必填，阿里云百炼控制台获取
```

其余可选变量见 `.env.example` 内的注释（`TAVILY_API_KEY` 用于 Web 搜索、`GITHUB_PERSONAL_ACCESS_TOKEN` 用于 MCP GitHub 服务）。

### 5. 启动

```bash
pnpm start      # 进入交互式 Agent（默认）
pnpm init       # 或：交互式向导生成配置文件
pnpm continue   # 或：从上次会话继续
```

### 6. 会话内命令

启动后直接输入斜杠命令：

| 命令 | 说明 |
|---|---|
| `/agents` | 查看子 Agent 状态 |
| `/context` / `/usage` | 查看上下文窗口 / Token 用量 |
| `/cron` | 定时任务管理 |
| `/memory` | 记忆查看 / 校验 |
| `/rag ingest` | 将 `docs/` 文档入库 |
| `/plugin` | 插件管理 |
| `/hooks` | Hook 管线状态 |
| `/skill` | 技能管理 |

其余直接提问即可，Agent 会自主决定是否调用工具（读文件、跑 Bash、联网搜索、检索知识库、派生子 Agent 等）。

### 7. 常见问题

- **原生模块能直接装吗**：能。`better-sqlite3` / `sqlite-vec` 已内置 Windows/macOS/Linux 的 x64 与 arm64 预编译二进制，且项目已配置为跳过本地编译，无需安装 Visual Studio Build Tools。
- **没填 `DASHSCOPE_API_KEY`**：Agent 会降级为 mock 假模型（仅用于调试），填入真实 Key 即可调用真实模型。
- **`.env` 会泄露吗**：不会，`.env` 已被 `.gitignore` 忽略，密钥只存在本机，仓库只提供 `.env.example` 模板。
- **GitHub MCP 连不上**：需要配置 `GITHUB_PERSONAL_ACCESS_TOKEN`；未配置或连接失败时 Agent 会自动跳过该服务，不影响启动。

## License

[MIT](LICENSE)
