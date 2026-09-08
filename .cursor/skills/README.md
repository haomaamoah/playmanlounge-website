# Skills installed in this repo

Agent Skills live in `.cursor/skills/<name>/SKILL.md` and are committed, so they travel with the repo and work in Cloud Agents.

| Skill | Source | License |
| --- | --- | --- |
| `frontend-design` | [anthropics/claude-code](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) | Anthropic |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT |
| `brand` | same repo, shipped alongside `ui-ux-pro-max` | MIT |

`ui-ux-pro-max` and `brand` were authored for Claude under `.claude/skills/`; they were copied into `.cursor/skills/` because Cursor discovers skills there. Test fixtures were dropped; the searchable data under `ui-ux-pro-max/data/` was kept.

## Using them

Cursor loads these automatically. To call one explicitly in chat, type `/` and pick the skill name.

`ui-ux-pro-max` ships Python helpers you can run directly:

```bash
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py "dark street food ordering site" --domain style
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py "playman lounge" --design-system --stack nextjs
python3 .cursor/skills/ui-ux-pro-max/scripts/validate_data.py
```

## Updating

Re-copy from upstream:

```bash
git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git /tmp/uupm
cp -r /tmp/uupm/.claude/skills/ui-ux-pro-max .cursor/skills/
cp -r /tmp/uupm/.claude/skills/brand .cursor/skills/
find .cursor/skills -type d -name tests -prune -exec rm -rf {} +
```
