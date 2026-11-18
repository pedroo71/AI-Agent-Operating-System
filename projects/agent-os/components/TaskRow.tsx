import type { Task } from "@/lib/client/types";
import { toneFor } from "@/lib/client/agentColors";
import { STR } from "@/lib/client/strings";

export function TaskRow({ task }: { task: Task }) {
  const tone = toneFor(task.owner);
  return (
    <li className="task-row" data-status={task.status}>
      <span className="task-mark" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-[var(--color-ink)]">{task.subject}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-mute)]">
          <span>
            {STR.owner}:{" "}
            {task.owner ? <span style={{ color: tone.color }}>{task.owner}</span> : <span>{STR.noOwner}</span>}
          </span>
          {task.blockedBy.length > 0 && (
            <span className="mono">
              {STR.blockedBy} #{task.blockedBy.join(", #")}
            </span>
          )}
        </p>
      </div>
      <span className="mono shrink-0 text-[11px] text-[var(--color-mute)]">#{task.id}</span>
      <span className="sr-only">{STR.taskStatus[task.status]}</span>
    </li>
  );
}
