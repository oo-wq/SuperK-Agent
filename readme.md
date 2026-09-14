# SuperK-Agent

一个可本地运行的个人全能 AI Agent，用 TypeScript 编写，基于 [Vercel AI SDK](https://sdk.vercel.ai/) + 阿里云百炼（DashScope / Qwen）。它不只是聊天，而是一套带「保险丝」的智能体运行时。

## ✨ 核心特性

| 模块 | 说明 |
|---|---|
| 🧠 记忆系统 | SQLite 持久化记忆，含格式校验与 `lint` 自检 |
| 📚 RAG 知识库 | `sqlite-vec` 向量检索，文档分块 + DashScope Embedding |
| ⏰ 定时任务 | 基于 cron 表达式，支持持久化、状态追踪、连续失败熔断、崩溃恢复 |
| 🤝 多 Agent | 独立上下文窗口的 Sub-Agent 并行执行，压缩结果回传父 Agent |
| 🔒 安全管线 | 角色权限、Bash 命令风险分类、Hook 管线 |
| 🛠️ 工具系统 | Bash / 文件 / 搜索 / Web 搜索 / MCP（GitHub）/ 子 Agent 生成 |
| 📏 防跑飞 | 死循环检测、Token 预算、指数退避重试 |
| 🧩 Skill & Plugin | 行为规范注入 + 插件化扩展工具 |

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 20（推荐 22+）
- **pnpm** ≥ 11

### 安装

```bash
git clone https://github.com/swords-arrivall/superk-agent.git
cd superk-agent
pnpm install
```

### 配置

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

编辑 `.env`，至少填入：

```bash
DASHSCOPE_API_KEY=sk-xxx    # 必填，阿里云百炼控制台获取
```

### 启动

```bash
pnpm start      # 进入交互式 Agent（默认）
pnpm init       # 交互式向导生成配置文件
pnpm continue   # 从上次会话继续
```

> 未配置 `DASHSCOPE_API_KEY` 时会降级为 mock 假模型，方便先跑通流程。

## ⌨️ 会话内命令

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

## 🛠 技术栈

- TypeScript（ESM）
- [Vercel AI SDK](https://sdk.vercel.ai/) + `@ai-sdk/openai`
- 模型：阿里云百炼 DashScope（Qwen，OpenAI 兼容接口）
- `better-sqlite3`、`sqlite-vec`、`croner`、`zod`

## 📖 更多文档

- [项目介绍与使用说明](项目介绍与使用说明.md)
- [设计笔记](docs/design-notes.md)

## 📄 License

[MIT](LICENSE)
