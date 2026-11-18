import type { ReactNode } from "react";

interface Props {
  title: string;
  hint: string;
  action?: ReactNode;
}

/** Estado vazio: diz o que falta e o que fazer a seguir. */
export function EmptyState({ title, hint, action }: Props) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1.5 px-8 py-10 text-center" role="status">
      <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
      <p className="max-w-[34ch] text-xs leading-relaxed text-[var(--color-mute)]">{hint}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
