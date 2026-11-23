import { Fragment, memo, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gus's answers: the bit of Markdown the coach pipeline asks for (paragraphs, **bold**, *italic*,
 * `code`, links, bulleted and numbered lists, one level of nesting), plus headings, quotes and code
 * blocks in case the model writes some. Rendered as React elements: never raw HTML, and links only
 * to http(s) or mailto. Partial text (while streaming) renders fine: an unclosed mark shows as is.
 */

type ListItem = { text: string; sublist?: ListBlock };
type ListBlock = { type: "list"; ordered: boolean; start: number; items: ListItem[] };
type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "heading"; text: string }
  | { type: "quote"; lines: string[] }
  | { type: "code"; text: string }
  | { type: "rule" }
  | ListBlock;

const LIST_ITEM = /^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const FENCE = /^\s{0,3}```/;

function matchItem(line: string | undefined) {
  const match = line?.match(LIST_ITEM);
  if (!match) return null;
  const ordered = /\d/.test(match[2]);
  return {
    indent: match[1].replace(/\t/g, "    ").length,
    ordered,
    number: ordered ? Number.parseInt(match[2], 10) : 1,
    text: match[3],
  };
}

const indentOf = (line: string) => (line.match(/^\s*/)?.[0] ?? "").replace(/\t/g, "    ").length;

const startsBlock = (line: string) =>
  FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || matchItem(line) !== null;

/** A list from `start`; deeper items make the sublist of the item above them. */
function parseList(lines: string[], start: number): { block: ListBlock; next: number } {
  const first = matchItem(lines[start])!;
  const block: ListBlock = { type: "list", ordered: first.ordered, start: first.number, items: [] };
  const last = () => block.items[block.items.length - 1];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const item = matchItem(line);

    if (item) {
      if (item.indent < first.indent - 1) break; // back to the parent list
      if (item.indent > first.indent + 1 && block.items.length) {
        const sub = parseList(lines, i);
        const parent = last();
        if (parent.sublist && parent.sublist.ordered === sub.block.ordered) parent.sublist.items.push(...sub.block.items);
        else parent.sublist = sub.block;
        i = sub.next;
        continue;
      }
      if (item.ordered !== block.ordered) break;
      block.items.push({ text: item.text });
      i++;
      continue;
    }

    if (!line.trim()) {
      // A blank line inside the list: it goes on if the next line is an item or indented text.
      const nextLine = lines[i + 1];
      const nextItem = matchItem(nextLine);
      if (nextItem ? nextItem.indent >= first.indent - 1 : nextLine?.trim() && indentOf(nextLine) > first.indent) {
        i++;
        continue;
      }
      break;
    }

    // Text under an item (indented, or right below it) continues that item.
    if (block.items.length && !startsBlock(line) && (indentOf(line) > first.indent || lines[i - 1]?.trim())) {
      last().text += `\n${line.trim()}`;
      i++;
      continue;
    }
    break;
  }

  return { block, next: i };
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (FENCE.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence (absent while streaming)
      blocks.push({ type: "code", text: code.join("\n") });
    } else if (HEADING.test(line)) {
      blocks.push({ type: "heading", text: line.match(HEADING)![1] });
      i++;
    } else if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      i++;
    } else if (QUOTE.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) quote.push(lines[i++].match(QUOTE)![1]);
      blocks.push({ type: "quote", lines: quote });
    } else if (matchItem(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
    } else {
      const paragraph = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) paragraph.push(lines[i++].trim());
      blocks.push({ type: "paragraph", lines: paragraph });
    }
  }

  return blocks;
}

// **bold** | `code` | [label](url) | *italic* (not inside words, so 2*3*4 stays as is).
const INLINE = /\*\*(.+?)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)|(?<![\w*])\*(?![\s*])([^*\n]+?)(?<!\s)\*(?![\w*])/g;

function renderInline(text: string, keyPrefix = ""): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(INLINE); // own lastIndex: renderInline recurses
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const index = match.index;
    if (index > last) nodes.push(text.slice(last, index));
    const key = `${keyPrefix}${index}`;
    const [, bold, code, label, href, italic] = match;
    if (bold !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {renderInline(bold, `${key}-`)}
        </strong>,
      );
    } else if (code !== undefined) {
      nodes.push(
        <code key={key} className="rounded-[6px] bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]">
          {code}
        </code>,
      );
    } else if (label !== undefined) {
      nodes.push(
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {renderInline(label, `${key}-`)}
        </a>,
      );
    } else {
      nodes.push(<em key={key}>{renderInline(italic, `${key}-`)}</em>);
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Lines of one paragraph or item: each source line break is kept. */
function renderLines(lines: string[]) {
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(line)}
    </Fragment>
  ));
}

function List({ block }: { block: ListBlock }) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag
      start={block.ordered && block.start !== 1 ? block.start : undefined}
      className={cn("space-y-1.5 pl-5", block.ordered ? "list-decimal marker:text-muted-foreground" : "list-disc marker:text-primary/70")}
    >
      {block.items.map((item, i) => (
        <li key={i} className="pl-1">
          {renderLines(item.text.split("\n"))}
          {item.sublist && (
            <div className="mt-1.5">
              <List block={item.sublist} />
            </div>
          )}
        </li>
      ))}
    </Tag>
  );
}

function renderBlock(block: Block, key: number) {
  switch (block.type) {
    case "paragraph":
      return <p key={key}>{renderLines(block.lines)}</p>;
    case "heading":
      return (
        <p key={key} className="font-semibold text-foreground">
          {renderInline(block.text)}
        </p>
      );
    case "quote":
      return (
        <blockquote key={key} className="border-l-2 border-primary/50 pl-3 text-muted-foreground">
          {renderLines(block.lines)}
        </blockquote>
      );
    case "code":
      return <CodeBlock key={key} text={block.text} />;
    case "rule":
      return <hr key={key} className="border-border" />;
    case "list":
      return <List key={key} block={block} />;
  }
}

/** A code block, with a button to copy it (Gus gives prompts to paste elsewhere in them). */
function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard refused (insecure page, permission): the text can still be selected by hand.
    }
  };

  return (
    <div className="overflow-hidden rounded-[10px] bg-background/70">
      <div className="flex justify-end border-b border-border/60 px-2 py-1">
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap p-3 font-mono text-[13px] leading-relaxed">{text}</pre>
    </div>
  );
}

export const CoachMarkdown = memo(function CoachMarkdown({ text, className }: { text: string; className?: string }) {
  return <div className={cn("space-y-3 break-words", className)}>{parseBlocks(text).map(renderBlock)}</div>;
});
