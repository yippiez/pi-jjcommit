import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const GIT_COMMIT_PROMPT = `Commit the current repository changes using git in logical chunks.

Workflow:
1. Inspect the current changes before committing.
2. Group related changes into small, logical commits.
3. Use concise commit messages in the style "label: description"; keep the label and description lowercase except for special names.
4. Do not mix unrelated changes in the same commit.
5. If something is ambiguous or unsafe to commit, ask me before proceeding.
6. After committing, show a short summary of what was committed.

Useful git command snippets:

\`\`\`bash
git status --short
git diff --stat
git diff
\`\`\`

Stage and commit one logical chunk by path:

\`\`\`bash
git add src/file-a.ts src/file-b.ts
git commit -m "refactor: simplify file handling"
\`\`\`

Interactively stage part of the current changes:

\`\`\`bash
git add -p
git commit -m "fix: handle empty input"
\`\`\`

Check remaining changes before the next chunk:

\`\`\`bash
git status --short
git diff --stat
\`\`\`

Please perform the workflow now.`;

export default function (pi: ExtensionAPI) {
  pi.registerCommand("git-commit", {
    description: "Ask the agent to commit current changes with git in logical chunks",
    handler: async (args, ctx) => {
      const note = args.trim() ? `\n\nAdditional user instruction:\n${args.trim()}` : "";
      const prompt = GIT_COMMIT_PROMPT + note;

      if (ctx.isIdle()) {
        pi.sendUserMessage(prompt);
      } else {
        pi.sendUserMessage(prompt, { deliverAs: "followUp" });
        ctx.ui.notify("Queued git commit workflow prompt", "info");
      }
    },
  });
}
