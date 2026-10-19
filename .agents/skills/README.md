# Portable review skills

These project-local skills use the shared `.agents/skills/` discovery path
supported by Cursor and VS Code/GitHub Copilot. No duplicate copies or editor
configuration are required.

- [bugbot-review](./bugbot-review/SKILL.md): concrete correctness and regression
  review focused on Next.js, React, forms, routing, and async behavior.
- [security-review](./security-review/SKILL.md): evidence-based vulnerability
  review focused on server/client boundaries and web application security.

## Usage

Open this repository as the workspace. Start a new chat or reload the editor
if the skills are not listed. Type `/` and select `bugbot-review` or
`security-review`, then specify a worktree, branch/PR target, commit range,
or code scope. Examples:

- `/bugbot-review review staged and unstaged changes`
- `/security-review review this branch against its PR target`

Both skills are explicitly invoked (`disable-model-invocation: true`), read-only
by default, and respect host instructions. Fixes require a separate request.
Existing frontend and brand skills remain unchanged.

## Provenance and limitations

These are original, project-specific portable adaptations, not verbatim
upstream installations or official vendor agents. Source links are included
in each skill. Research on 2026-10-09 identified Superpowers, Trail of Bits,
and Anthropic's security reviewer as established public review projects.

Cursor's built-in `/review-bugbot` and `/review-security` remain separate.
These skills do not enable hosted Bugbot, automatic GitHub PR reviews, CI
checks, or an external scanner. No installer, credentials, or dependencies
are added. Skills guide an agent and do not guarantee a vulnerability-free
codebase.
