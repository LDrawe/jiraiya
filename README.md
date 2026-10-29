<div align="center">

<img src="./public/logo.svg" alt="Jiraiya Logo" width="160" />

# 🐸 Jiraiya

### *Local-First Engineering Workspace & Markdown Kanban for Developers & AI Agents*

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Unified / Remark](https://img.shields.io/badge/AST-Unified%20%2F%20Remark-black?style=for-the-badge&logo=markdown&logoColor=white)](https://unifiedjs.com/)
[![Local--First](https://img.shields.io/badge/Storage-Local--First%20FS%20Access-993A41?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
[![Theme](https://img.shields.io/badge/Theme-Gruvbox%20Dark-B8BB26?style=for-the-badge)](https://github.com/morhetz/gruvbox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<br/>

**Jiraiya** is a high-performance, **100% local-first** issue tracker, Kanban board, and Architecture Decision Record (ADR) workspace powered by **plain Markdown files with YAML frontmatter**.

Designed for modern software engineers working alongside autonomous AI coding agents (Antigravity, Claude Code, Cursor, Aider), Jiraiya eliminates closed cloud databases, heavy SaaS lock-in, and fragile API tokens: **your Git repository is your single source of truth**.

---

</div>

## 🌟 Why Jiraiya?

Traditional project management tools (Jira, Linear, Trello) store development context in proprietary remote databases. When using AI coding agents, these tools introduce unnecessary friction: agents need API credentials, webhooks, and complex networking permissions just to read or update a task status.

**Jiraiya shifts the paradigm:**
1. **Git Tracks Everything:** Every ticket and decision lives as a readable `.md` file inside `.jiraiya/` directly at your project's root. Tickets branch, diff, and merge alongside your source code.
2. **AI-First by Design:** Autonomous agents interact with your board naturally by editing Markdown files — zero APIs, zero tokens, zero rate limits.
3. **Absolute Data Privacy:** Your data never leaves your computer. The application runs entirely client-side using the native Web File System Access API.

---

## ⚡ Key Features

- 📋 **Dense, Reactive Kanban Board:** 5-column engineering workflow (`Backlog`, `Ready`, `In Progress`, `Review`, `Done`), intuitive drag-and-drop, and crisp status badges with Gruvbox contrast.
- 🔍 **Real-Time Multi-Dimensional Filters:** Instant filtering by ticket type (`Epic`, `Story`, `Task`, `Bug`, `Lab`), tags, priority levels (`Low`, `Medium`, `High`, `Critical`), and full-text search.
- 🛡️ **Optimistic Concurrency & Conflict Detection (`FileConflictError`):** Prevents accidental overwrites if an AI agent, git pull, or external editor modifies a ticket file while you have it open in the inspection drawer.
- 📐 **Architecture Decision Records (ADRs):** Dedicated view (`DecisionsView`) to document and track key architectural choices (`proposed`, `accepted`, `deprecated`, `superseded`) tied directly to tickets and concepts.
- 📝 **Non-Destructive AST Parser (Unified + Remark):** Surgical frontmatter and AST updates that modify metadata (status, checklist criteria, tags) while preserving custom Markdown comments, formatting, and body content intact.
- 💾 **Persistent Workspace Handles:** Remembers authorized project directory handles across browser sessions using IndexedDB (`handleStore`), allowing seamless multi-workspace switching without repeated file pickers.
- 🎨 **Gruvbox Dark Design System:** Immersive, high-density interface built on authentic Gruvbox dark tones (`#1C1B1A`, `#993A41`, `#B8BB26`, `#F4EBE1`), paired with `Inter` for UI clarity and `JetBrains Mono` for code and identifiers.

---

## 🏗️ Directory Architecture & Data Model

When you register a project in Jiraiya, it creates and manages a `.jiraiya/` directory in your repository root:

```bash
my-project/
├── .jiraiya/
│   ├── config.json          # Workspace metadata and settings
│   ├── tickets/             # Tickets stored as Markdown files
│   │   ├── JIR-101.md
│   │   ├── JIR-102.md
│   │   └── ...
│   ├── decisions/           # Architecture Decision Records (ADRs)
│   │   ├── ADR-001.md
│   │   └── ...
│   └── reviews/             # Code reviews and inspection summaries
├── src/
├── package.json
└── README.md
```

### Sample Ticket (`.jiraiya/tickets/JIR-101.md`)

```markdown
---
id: JIR-101
title: Implement Passkeys authentication via WebAuthn
type: story
status: in_progress
priority: high
tags: [security, auth, web-api]
concepts: [Passkeys, FIDO2]
dependencies: [JIR-099]
decisions: [ADR-004]
---

# Summary
Add native support for passwordless authentication using browser Passkeys.

## Acceptance Criteria
- [x] Register new credentials with `navigator.credentials.create`
- [ ] Verify signature against backend public key
- [ ] Implement graceful fallback for legacy browsers
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **UI Framework** | [React 19](https://react.dev/) | Modern concurrent rendering and hooks |
| **Language** | [TypeScript 5.6](https://www.typescriptlang.org/) | Strict static typing across domain models and FS APIs |
| **Bundler & Dev** | [Vite 6](https://vitejs.dev/) | Sub-millisecond HMR and optimized production builds |
| **Styling** | BeerCSS + Custom CSS | Gruvbox Dark design system with tokenized variables |
| **Markdown & AST** | Unified, Remark, YAML | Safe, non-destructive frontmatter parsing and AST mutations |
| **Local Storage** | File System Access API | Direct local OS directory reading and writing in-browser |
| **Handle Cache** | IndexedDB | Secure directory handle persistence across sessions |
| **Unit Testing** | [Vitest](https://vitest.dev/) | Unit test suite for AST parser and file concurrency |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.0.0
- A modern browser with support for the [File System Access API](https://caniuse.com/native-filesystem-api) (Chrome, Edge, Brave, Opera).

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/jiraiya.git
cd jiraiya
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open `http://localhost:5173` in your browser.

5. Click **"Adicionar Projeto"** (Add Project) and select any local project folder. Jiraiya will initialize the `.jiraiya/` workspace automatically!

---

## 🧪 Testing

Jiraiya includes a focused unit test suite validating parser safety, AST mutations, and frontmatter preservation:

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npx vitest
```

---

## 🤖 Teaming Up with AI Coding Agents

To allow autonomous agents (Antigravity, Claude Code, Cursor, Aider) to collaborate smoothly with Jiraiya, add this rule to your project's `AGENTS.md` or `CLAUDE.md`:

> *"Tasks in this project are tracked by Jiraiya in `.jiraiya/tickets/`. Before starting work on an item, read its corresponding `.md` file, update its YAML `status` to `in_progress`, and check off acceptance criteria (`- [x]`) as you complete each phase."*

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

<div align="center">
<sub>Engineered for local data sovereignty, developer velocity, and seamless human-agent collaboration. 🐸⚡</sub>
</div>
