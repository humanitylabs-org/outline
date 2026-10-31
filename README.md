# Outline

A minimal, Obsidian-like nested outline you can type or dictate into through Wizard's shared microphone.

- Wizard app id: `outline` (it was `outline-streaming-demo`; installed boxes move with `wizard.md` `renamed_from`).
- The repo root is the Wizard package: `wizard.md`, `runtipi/`, `skill/`, `openapi.json`. It connects Wizard to
  the owner-supervised Outline runtime (a loopback proxy, no credentials in source).
- `runtime/` is the Outline web runtime itself (server, web UI, QA). It moved here from
  `humanitylabs-org/wizard-ux` `apps/voice-outline` (feature/outline-minimal-notes-20261019 @ b6f0daff).
  Its browser recovery store keeps the name `outline-streaming-demo-recovery` so takes saved before the rename still recover.

Install: `wam install humanitylabs-org/outline`. Rename an existing install: `wam app-rename outline-streaming-demo outline`.
