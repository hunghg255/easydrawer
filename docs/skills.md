# AI Skills

EasyDrawer ships an **Agent Skill**: a folder of instructions that teaches AI coding assistants
(Claude Code, Claude.ai, and other tools that support the [Agent Skills](https://agentskills.io) format)
how to use the library correctly — the current API, tablet setup, framework integration and common recipes.

With the skill installed, you can ask things like:

- *"Add a whiteboard page with a pen, highlighter, eraser and undo toolbar"*
- *"Make the drawing canvas work well with Apple Pencil"*
- *"Autosave the drawing to localStorage and restore it on load"*
- *"Add a signature pad to the checkout form"*

and the assistant will use `editor.tools.use(...)`, `configure(...)`, `setBackground(...)` and friends
instead of guessing or using legacy patterns.

## What's inside

```
skills/easydrawer/
├── SKILL.md                 # when to use it, setup, core API, pitfalls, tablets
└── references/
    ├── api.md               # full settings, tool options and method tables
    └── recipes.md           # React / Vue / vanilla components, autosave, signature pad…
```

The skill is [in the repository](https://github.com/hunghg255/easydrawer/tree/main/skills/easydrawer)
and is also included in the npm package (`node_modules/easydrawer/skills/easydrawer`).

## Install

### Claude Code

Copy the folder into your project's skills (shared with your team through git):

```bash
mkdir -p .claude/skills
cp -r node_modules/easydrawer/skills/easydrawer .claude/skills/
```

or into your personal skills, available in every project:

```bash
mkdir -p ~/.claude/skills
cp -r node_modules/easydrawer/skills/easydrawer ~/.claude/skills/
```

Without installing the package first:

```bash
npx degit hunghg255/easydrawer/skills/easydrawer .claude/skills/easydrawer
```

Claude Code picks up the skill automatically when a task involves drawing or `easydrawer`.
You can also invoke it explicitly with `/easydrawer`.

### Claude.ai

Zip the `skills/easydrawer` folder and upload it under **Settings → Capabilities → Skills**.

### Other assistants

Most assistants accept project instructions (`AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`…).
Point them at the skill:

```md
When working with the `easydrawer` library, follow node_modules/easydrawer/skills/easydrawer/SKILL.md.
```

## Keep it up to date

The skill is versioned with the library. After upgrading `easydrawer`, copy the folder again.
