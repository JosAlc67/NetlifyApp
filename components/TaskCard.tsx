import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { DELIVERY_TYPE_LABEL, DeliveryType } from "@/lib/types";

const DELIVERY_DOT: Record<DeliveryType, string> = {
  quiz: "bg-success",
  tarea: "bg-accent-yellow",
  proyecto_parcial: "bg-accent-yellow",
  examen: "bg-accent-coral",
  proyecto_final: "bg-accent-coral",
};

export interface TaskCardItem {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  points: number;
  deliveryType: DeliveryType;
  completed: boolean;
  htmlUrl?: string | null;
}

function formatDue(dateIso: string) {
  const d = new Date(dateIso);
  const today = new Date();
  const diffDays = Math.round(
    (new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) /
      86400000
  );
  const time = d.toLocaleTimeString("es-EC", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `Hoy · ${time}`;
  if (diffDays === 1) return `Mañana · ${time}`;
  if (diffDays < 0) return `Venció · ${d.toLocaleDateString("es-EC")}`;
  return `${d.toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" })} · ${time}`;
}

/** Tarjeta de solo lectura: el estado de completado viene de Canvas, no de un click del usuario. */
export function TaskCard({ task }: { task: TaskCardItem }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-opacity ${
        task.completed ? "opacity-60" : ""
      }`}
    >
      {task.completed ? (
        <CheckCircle2 className="text-success shrink-0" size={26} />
      ) : (
        <Circle className="text-text-muted shrink-0" size={26} />
      )}

      <span className={`w-2 h-2 rounded-full shrink-0 ${DELIVERY_DOT[task.deliveryType]}`} />

      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm truncate ${task.completed ? "line-through text-text-muted" : "text-text"}`}>
          {task.title}
        </p>
        <p className="text-xs text-text-muted truncate">
          {task.subject} · {DELIVERY_TYPE_LABEL[task.deliveryType]} · {formatDue(task.dueDate)}
        </p>
      </div>

      <span className="shrink-0 text-xs font-bold text-primary bg-primary-soft rounded-full px-2.5 py-1">
        +{task.points} pts
      </span>

      {task.htmlUrl && (
        <a
          href={task.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver en Canvas"
          className="shrink-0 text-text-muted hover:text-primary transition-colors"
        >
          <ExternalLink size={16} />
        </a>
      )}
    </div>
  );
}
