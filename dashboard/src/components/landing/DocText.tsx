import CommandText from "@/components/landing/CommandText";

/**
 * Manual prose with `backtick` spans: a span that starts with "/" is a slash
 * command (CommandText), anything else is set as plain code. Server-only
 * markup, no client JS.
 */
export default function DocText({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        return part.startsWith("/") ? (
          <CommandText key={i}>{part}</CommandText>
        ) : (
          <code key={i} className="font-mono text-[0.92em] text-cream/90">
            {part}
          </code>
        );
      })}
    </>
  );
}
