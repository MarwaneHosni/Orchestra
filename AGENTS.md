# Commit Safety Rules

1. **Never use `git add -A` or `git add .`** before a commit. Always specify explicit paths.
2. **Pre-flight**: Run the linter (`pnpm lint` or `npx eslint --fix <files>`) before attempting a commit, so failures surface before git hooks touch untracked files.
3. **If hooks fail**, immediately restore affected files with `git checkout` and `git stash pop` before any other action.
4. **Always check `git status` and `git diff --cached`** before running `git commit` to verify exactly what will be committed.
5. **New/untracked files**: Stage them only after verifying all lint/type checks pass, so hooks can't revert them.
