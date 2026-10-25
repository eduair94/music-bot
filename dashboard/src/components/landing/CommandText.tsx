/**
 * A slash command set in mono. Only the slash takes the amber accent, so long
 * lists of commands stay quieter than the things you can press.
 */
export default function CommandText({ children }: { children: string }) {
  return (
    <code className="font-mono">
      <span className="text-amber">/</span>
      {children.slice(1)}
    </code>
  );
}
