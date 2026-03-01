import { complete, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";

const DEFAULT_MODEL_PROVIDER = "github-copilot";
const DEFAULT_MODEL_ID = "grok-code-fast-1";

const COMMIT_STYLE_PROMPT = `You generate jj/git commit messages. Follow these rules strictly:

1. Format: "prefix: short description"
2. ALWAYS a single line. NEVER multiline. NEVER bullet points. NEVER explanations.
3. The prefix is ALWAYS lowercase. Common prefixes: add, fix, feat, refactor, docs, test, chore, style, perf
4. The short description starts lowercase after the colon
5. Keep it under 72 characters total
6. Be concise and specific

Examples:
- add: github issue extension to pi
- fix: scrolling issue
- feat: add task list v-selection with yellow highlights
- refactor: split TUI into feature-focused modules

Output ONLY the single line. Nothing else.`;

export default function (pi: ExtensionAPI) {
  pi.registerCommand("jj-commit", {
    description: "Generate a commit message from current jj changes",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("jj-commit requires interactive mode", "error");
        return;
      }

      const requestedModel = (args ?? "").trim();
      let model = ctx.model;
      let modelName = "current session model";

      if (requestedModel) {
        const slash = requestedModel.indexOf("/");
        if (slash <= 0 || slash >= requestedModel.length - 1) {
          ctx.ui.notify("Usage: /jj-commit [provider/model]", "error");
          return;
        }
        const provider = requestedModel.slice(0, slash).trim();
        const id = requestedModel.slice(slash + 1).trim();
        modelName = `${provider}/${id}`;
        model = ctx.modelRegistry.find(provider, id);
        if (!model) {
          ctx.ui.notify(`Model ${modelName} is not available`, "error");
          return;
        }
      }

      if (!model) {
        model = ctx.modelRegistry.find(DEFAULT_MODEL_PROVIDER, DEFAULT_MODEL_ID);
        modelName = `${DEFAULT_MODEL_PROVIDER}/${DEFAULT_MODEL_ID}`;
      }

      if (!model) {
        ctx.ui.notify(`No model selected and fallback ${DEFAULT_MODEL_PROVIDER}/${DEFAULT_MODEL_ID} is unavailable`, "error");
        return;
      }

      const fetchResult = await ctx.ui.custom<{ diff: string; stat: string; log: string; conversation: string } | null>((tui, theme, _kb, done) => {
        const loader = new BorderedLoader(tui, theme, "Reading jj changes and conversation...");
        loader.onAbort = () => done(null);

        Promise.all([
          pi.exec("jj", ["diff"]),
          pi.exec("jj", ["diff", "--stat"]),
          pi.exec("jj", ["log", "--no-graph", "-r", "ancestors(@-, 15)", "-T", 'description ++ "\\n---\\n"']),
        ]).then(([diffResult, statResult, logResult]) => {
          if (diffResult.code !== 0) {
            ctx.ui.notify("Failed to get jj diff: " + diffResult.stderr, "error");
            done(null);
            return;
          }

          if (statResult.code !== 0) {
            ctx.ui.notify("Failed to get jj diff --stat: " + statResult.stderr, "error");
            done(null);
            return;
          }

          if (statResult.stdout.trim() === "" && diffResult.stdout.trim() === "") {
            ctx.ui.notify("No changes in working copy", "info");
            done(null);
            return;
          }

          const entries = ctx.sessionManager.getBranch();
          const conversationParts: string[] = [];

          for (const entry of entries) {
            if (entry.type !== "message") continue;
            const msg = (entry as any).message;
            if (!msg) continue;

            if (msg.role === "user") {
              const text = typeof msg.content === "string"
                ? msg.content
                : (msg.content?.map((c: any) => c.text ?? "").join("") ?? "");
              if (text.trim()) conversationParts.push(`USER: ${text}`);
            } else if (msg.role === "assistant") {
              const texts: string[] = [];
              for (const block of msg.content ?? []) {
                if (block.type === "text") texts.push(block.text);
                if (block.type === "toolCall") {
                  texts.push(`[TOOL: ${block.name}(${JSON.stringify(block.arguments).slice(0, 200)})]`);
                }
              }
              if (texts.length) conversationParts.push(`ASSISTANT: ${texts.join("\n")}`);
            } else if (msg.role === "toolResult") {
              const text = msg.content?.map((c: any) => c.text ?? "").join("") ?? "";
              const preview = text.length > 200 ? text.slice(0, 200) + "..." : text;
              conversationParts.push(`TOOL_RESULT (${msg.toolName}): ${preview}`);
            }
          }

          done({
            diff: diffResult.stdout,
            stat: statResult.stdout,
            log: logResult.code === 0 ? logResult.stdout : "",
            conversation: conversationParts.join("\n\n"),
          });
        }).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.notify("Failed to read jj changes: " + message, "error");
          done(null);
        });

        return loader;
      });

      if (!fetchResult) return;

      const { diff, stat, log, conversation } = fetchResult;
      const maxDiffLen = 30000;
      const truncatedDiff = diff.length > maxDiffLen
        ? diff.slice(0, maxDiffLen) + "\n\n... (diff truncated, see stat for full scope)"
        : diff;

      const generatedMessage = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
        const loader = new BorderedLoader(tui, theme, `Generating commit message with ${modelName}...`);
        loader.onAbort = () => done(null);

        const doGenerate = async () => {
          const apiKey = await ctx.modelRegistry.getApiKey(model);
          const userMessage: UserMessage = {
            role: "user",
            content: [{ type: "text", text: `Here are the current uncommitted changes:\n\n**Stat:**\n${stat}\n\n**Diff:**\n${truncatedDiff}\n\n**Recent commit messages for style reference:**\n${log}\n\n**Conversation context:**\n${conversation}\n\nGenerate a commit message for these changes. Output ONLY the commit message, nothing else.` }],
            timestamp: Date.now(),
          };

          const response = await complete(
            model,
            { systemPrompt: COMMIT_STYLE_PROMPT, messages: [userMessage] },
            { apiKey, signal: loader.signal },
          );

          if (response.stopReason === "aborted") return null;

          return response.content
            .filter((c): c is { type: "text"; text: string } => c.type === "text")
            .map((c) => c.text)
            .join("\n")
            .trim()
            .split("\n")[0]
            .trim();
        };

        doGenerate().then(done).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.notify("Failed to generate message: " + message, "error");
          done(null);
        });

        return loader;
      });

      if (!generatedMessage) {
        ctx.ui.notify("Could not generate a commit message", "warning");
        return;
      }

      const action = await ctx.ui.custom<{ action: "commit"; message: string } | null>((tui, theme, _kb, done) => {
        let currentMessage = generatedMessage;
        let editing = false;
        let editBuffer = generatedMessage;
        let editCursorLine = 0;
        let editCursorCol = 0;
        const cachedState = { lines: undefined as string[] | undefined, width: undefined as number | undefined };

        function invalidate() {
          cachedState.lines = undefined;
          cachedState.width = undefined;
        }

        function getEditLines(): string[] {
          return editBuffer.split("\n");
        }

        return {
          render(width: number): string[] {
            if (cachedState.lines && cachedState.width === width) return cachedState.lines;

            const lines: string[] = [];
            const t = theme;
            const border = t.fg("accent", "─".repeat(width));

            lines.push(border);
            lines.push(truncateToWidth(` ${t.fg("accent", t.bold("jj commit"))} ${t.fg("dim", "─")} ${t.fg("muted", "commit message")}`, width));
            lines.push("");

            const statLines = stat.trim().split("\n");
            for (const sl of statLines) {
              lines.push(truncateToWidth(` ${t.fg("dim", sl)}`, width));
            }
            lines.push("");

            if (editing) {
              lines.push(truncateToWidth(` ${t.fg("warning", t.bold("EDITING"))} ${t.fg("dim", "─ type to edit, enter on empty last line to finish, esc to cancel")}`, width));
              lines.push("");

              const editLines = getEditLines();
              editLines.forEach((el, li) => {
                const isCursorLine = li === editCursorLine;
                const prefix = isCursorLine ? t.fg("accent", "❯ ") : "  ";
                lines.push(truncateToWidth(` ${prefix}${t.fg("text", el)}`, width));
              });
            } else {
              lines.push(truncateToWidth(` ${t.fg("success", t.bold("MESSAGE:"))}`, width));
              lines.push("");
              for (const ml of currentMessage.split("\n")) {
                lines.push(truncateToWidth(`   ${t.fg("text", ml)}`, width));
              }
            }

            lines.push("");
            if (!editing) {
              lines.push(truncateToWidth(` ${t.fg("dim", "enter")} ${t.fg("muted", "commit")}  ${t.fg("dim", "e")} ${t.fg("muted", "edit")}  ${t.fg("dim", "esc")} ${t.fg("muted", "cancel")}`, width));
            }

            lines.push(border);
            cachedState.lines = lines;
            cachedState.width = width;
            return lines;
          },

          handleInput(data: string): void {
            if (editing) {
              if (matchesKey(data, Key.escape)) {
                editing = false;
                editBuffer = currentMessage;
                invalidate();
                tui.requestRender();
                return;
              }

              const editLines = getEditLines();

              if (matchesKey(data, Key.enter)) {
                if (editCursorLine === editLines.length - 1 && editLines[editCursorLine].trim() === "") {
                  currentMessage = editLines.slice(0, -1).join("\n").trim();
                  editBuffer = currentMessage;
                  editing = false;
                  invalidate();
                  tui.requestRender();
                  return;
                }

                const line = editLines[editCursorLine];
                const before = line.slice(0, editCursorCol);
                const after = line.slice(editCursorCol);
                editLines[editCursorLine] = before;
                editLines.splice(editCursorLine + 1, 0, after);
                editBuffer = editLines.join("\n");
                editCursorLine++;
                editCursorCol = 0;
                invalidate();
                tui.requestRender();
                return;
              }

              if (matchesKey(data, Key.backspace)) {
                if (editCursorCol > 0) {
                  const line = editLines[editCursorLine];
                  editLines[editCursorLine] = line.slice(0, editCursorCol - 1) + line.slice(editCursorCol);
                  editBuffer = editLines.join("\n");
                  editCursorCol--;
                } else if (editCursorLine > 0) {
                  const prevLine = editLines[editCursorLine - 1];
                  editCursorCol = prevLine.length;
                  editLines[editCursorLine - 1] = prevLine + editLines[editCursorLine];
                  editLines.splice(editCursorLine, 1);
                  editBuffer = editLines.join("\n");
                  editCursorLine--;
                }
                invalidate();
                tui.requestRender();
                return;
              }

              if (matchesKey(data, Key.up)) {
                if (editCursorLine > 0) {
                  editCursorLine--;
                  editCursorCol = Math.min(editCursorCol, editLines[editCursorLine].length);
                }
                invalidate();
                tui.requestRender();
                return;
              }

              if (matchesKey(data, Key.down)) {
                if (editCursorLine < editLines.length - 1) {
                  editCursorLine++;
                  editCursorCol = Math.min(editCursorCol, editLines[editCursorLine].length);
                }
                invalidate();
                tui.requestRender();
                return;
              }

              if (matchesKey(data, Key.left)) {
                if (editCursorCol > 0) editCursorCol--;
                invalidate();
                tui.requestRender();
                return;
              }

              if (matchesKey(data, Key.right)) {
                if (editCursorCol < editLines[editCursorLine].length) editCursorCol++;
                invalidate();
                tui.requestRender();
                return;
              }

              if (data.length === 1 && data.charCodeAt(0) >= 32) {
                const line = editLines[editCursorLine];
                editLines[editCursorLine] = line.slice(0, editCursorCol) + data + line.slice(editCursorCol);
                editBuffer = editLines.join("\n");
                editCursorCol++;
                invalidate();
                tui.requestRender();
              }
              return;
            }

            if (matchesKey(data, Key.enter)) {
              done({ action: "commit", message: currentMessage });
              return;
            }

            if (data === "e" || data === "E") {
              editing = true;
              editBuffer = currentMessage;
              const editLines = getEditLines();
              editCursorLine = editLines.length - 1;
              editCursorCol = editLines[editCursorLine].length;
              invalidate();
              tui.requestRender();
              return;
            }

            if (matchesKey(data, Key.escape)) {
              done(null);
            }
          },

          invalidate,
        };
      });

      if (!action) {
        ctx.ui.notify("Commit cancelled", "info");
        return;
      }

      const commitResult = await pi.exec("jj", ["commit", "-m", action.message]);
      if (commitResult.code !== 0) {
        ctx.ui.notify("jj commit failed: " + commitResult.stderr, "error");
        return;
      }

      ctx.ui.notify("Committed: " + action.message.split("\n")[0], "success");
    },
  });
}
