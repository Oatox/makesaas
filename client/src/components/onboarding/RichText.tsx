import { Fragment } from "react";

/** Text of the steps: `**bold**` is highlighted, `\n` breaks the line. */
export function RichText({ text, boldClassName = "font-semibold text-foreground" }: { text: string; boldClassName?: string }) {
  return (
    <>
      {text.split("\n").map((line, l) => (
        <Fragment key={l}>
          {l > 0 && <br />}
          {line.split(/\*\*(.+?)\*\*/g).map((part, i) =>
            i % 2 === 1 ? (
              <strong key={i} className={boldClassName}>
                {part}
              </strong>
            ) : (
              part
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
