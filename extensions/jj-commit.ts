import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const JJ_COMMIT_PROMPT = `Commit the current repository changes using jj in logical chunks.

Workflow:
1. Inspect the current changes before committing.
2. Group related changes into small, logical commits.
3. Use concise commit messages in the style "label: description"; keep the label and description lowercase except for special names.
4. Do not mix unrelated changes in the same commit.
5. If something is ambiguous or unsafe to commit, ask me before proceeding.
6. After committing, show a short summary of what was committed.

Useful jj command snippets:

\`\`\`bash
jj status
jj diff --stat
jj diff
\`\`\`

Commit all current working-copy changes:

\`\`\`bash
jj commit -m "feat: add useful thing"
\`\`\`

Commit only selected paths as one logical chunk:

\`\`\`bash
jj commit src/file-a.ts src/file-b.ts -m "refactor: simplify file handling"
\`\`\`

Interactively select part of the current changes:

\`\`\`bash
jj commit -i -m "fix: handle empty input"
\`\`\`

Please perform the workflow now.`;

export default function (pi: ExtensionAPI) {
  pi.registerCommand("jj-commit", {
    description: "Ask the agent to commit current changes with jj in logical chunks",
    handler: async (args, ctx) => {
      const note = args.trim() ? `\n\nAdditional user instruction:\n${args.trim()}` : "";
      const prompt = JJ_COMMIT_PROMPT + note;

      if (ctx.isIdle()) {
        pi.sendUserMessage(prompt);
      } else {
        pi.sendUserMessage(prompt, { deliverAs: "followUp" });
        ctx.ui.notify("Queued jj commit workflow prompt", "info");
      }
    },
  });
}
