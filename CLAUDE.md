# @ametie/vue-muza-use — Claude Instructions

## Planning — OpenSpec

OpenSpec (`openspec/`) is the planning and spec system for this repo. Invoke its skills
automatically for any new feature or behaviour change — `openspec-explore` / `openspec-propose`
before code, `openspec-apply-change` while implementing, `openspec-archive-change` when done.
The trigger rule, its skip list and the flow are in `@.agents/claude/behavior.md`.

The superpowers `brainstorming` and `writing-plans` skills are **not used in this repo**. When
they would trigger, use `openspec-explore` / `openspec-propose` instead. This instruction outranks
the plugin's. All other superpowers skills (systematic-debugging, TDD,
verification-before-completion, …) remain in force. `.agents/plans/` and `docs/superpowers/`
are historical — new plans go into `openspec/changes/<change>/`.

## Instructions

@.agents/instructions/project.md
@.agents/instructions/conventions.md
@.agents/instructions/typescript.instructions.md
@.agents/instructions/library-architecture.instructions.md
@.agents/instructions/testing.instructions.md
@.agents/instructions/workflow.md

## Agent Behavior

@.agents/claude/behavior.md
