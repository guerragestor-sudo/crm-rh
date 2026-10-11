import { formatShortDate, relativeDayLabel } from "@/lib/format";
import type { MemberOption } from "@/modules/candidates/types";

import type { TaskRow } from "../types";
import { TaskItem } from "./task-item";

type Props = {
  tasks: TaskRow[];
  today: string;
  nowTime: string;
  timezone: string;
  members: MemberOption[];
  defaultResponsibleId: string;
  groupByDate?: boolean;
  showCandidate?: boolean;
};

export function TaskList({ tasks, groupByDate = false, ...itemProps }: Props) {
  if (!groupByDate) {
    return (
      <ul className="space-y-2">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} {...itemProps} />
        ))}
      </ul>
    );
  }

  const groups = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    const list = groups.get(task.due_date) ?? [];
    list.push(task);
    groups.set(task.due_date, list);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([date, items]) => {
        const relative = relativeDayLabel(date, itemProps.today);
        const full = formatShortDate(date);
        return (
          <section key={date} className="space-y-2">
            <h3 className="text-sm font-semibold capitalize">
              {relative === full ? full : `${relative} · ${full}`}
              <span className="ml-2 font-normal text-muted-foreground">{items.length}</span>
            </h3>
            <ul className="space-y-2">
              {items.map((task) => (
                <TaskItem key={task.id} task={task} {...itemProps} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
