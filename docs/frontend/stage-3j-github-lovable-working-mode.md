# Stage 3J — GitHub-first working mode for Lovable sync

## 1. Purpose

This document defines the working mode for Codex-authored changes that
must later appear in Lovable with minimal Lovable token usage.

The rule is simple: Codex changes GitHub, Lovable confirms synced
files. Lovable must not regenerate, expand, or rewrite the change unless
a separate prompt explicitly asks for that.

## 2. Responsibilities

Codex owns:

- creating the branch;
- editing scoped files;
- running local guards;
- committing only intended files;
- pushing the branch;
- creating the PR;
- checking GitHub Actions;
- merging the PR;
- producing the short Lovable confirmation prompt.

Lovable owns:

- syncing latest GitHub `main`;
- confirming exact files/sections exist;
- reporting sync conflicts if any;
- leaving synced code and docs unchanged unless explicitly instructed.

## 3. Standard Codex flow

Use this sequence for each small change:

```bash
git switch -c codex/<short-change-name>
# edit scoped files
node scripts/check-no-deno-locks.mjs
# run additional focused guards when relevant
git add <scoped files only>
git commit -m "<short change summary>"
git push -u origin codex/<short-change-name>
gh pr create --base main --head codex/<short-change-name>
gh pr view <number> --json mergeStateStatus,statusCheckRollup
gh pr merge <number> --squash --delete-branch
```

Do not stage the known local `package-lock.json` modification unless the
change intentionally updates dependencies and the lock file is part of
the reviewed scope.

## 4. Lovable confirmation prompt shape

Use short confirmation prompts. They should name files and facts to
verify, not ask Lovable to implement or improve anything.

Template:

```text
Sync latest GitHub main.

Confirm:
1. <file or section exists>.
2. <specific line/command/text exists>.
3. <no sync conflicts>.

Do not rewrite or regenerate files. Report sync conflicts only.
```

## 5. Token reduction rules

- Keep each PR to one purpose.
- Prefer file/section checks over broad review prompts.
- Avoid asking Lovable to summarize long diffs.
- Do not paste implementation code into Lovable after GitHub is already
  the source of truth.
- If Lovable confirms exact synced facts, stop; do not ask it to
  re-evaluate the same change.
- If Lovable returns extra product suggestions, triage them in
  [Stage 3K — Lovable suggestions backlog](./stage-3k-lovable-suggestions-backlog.md)
  instead of immediately expanding the current PR.

## 6. Failure handling

If Lovable reports a sync conflict:

- stop sending implementation prompts;
- inspect GitHub `main` and Lovable's reported conflict;
- create a new Codex branch for the smallest correction;
- merge through GitHub again;
- send a fresh confirmation-only prompt.

If GitHub Actions fail:

- inspect the failing run logs with `gh run view`;
- fix the smallest root cause;
- rerun the relevant local guard;
- amend or add a follow-up commit on the same PR branch;
- do not ask Lovable to work around a failing PR.

## 7. Acceptance criteria

The working mode is active when:

- GitHub PRs are the source of truth for Codex-authored changes.
- Lovable confirmation prompts only verify synced GitHub state.
- `package-lock.json` remains preserved unless intentionally scoped.
- `deno.lock` guards remain green.
- Sync conflicts are reported as blockers, not silently resolved by
  Lovable rewrites.
- Lovable's extra suggestions are tracked as backlog items before they
  become implementation scope.
