"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Circle, Plus, Trash2, X } from "lucide-react";
import * as store from "@/lib/store";
import { scheduleTaskNotification, cancelTaskNotification, requestNotificationPermission } from "@/lib/notifications-client";
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed, pushSupported } from "@/lib/push-client";
import { syncAlarm, deleteAlarmSync } from "@/lib/alarms-client";
import { PERSONAL_TASK_PRESETS, PersonalTask } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

function formatDueAt(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diffDays = Math.round(
    (new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000
  );
  const time = d.toLocaleTimeString("es-EC", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `Hoy · ${time}`;
  if (diffDays === 1) return `Mañana · ${time}`;
  if (diffDays < 0) return `Venció · ${d.toLocaleDateString("es-EC")}`;
  return `${d.toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" })} · ${time}`;
}

function defaultDueAt() {
  const d = new Date(Date.now() + 60 * 60 * 1000); // dentro de una hora
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PersonalTasksTab({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [preset, setPreset] = useState<string>(PERSONAL_TASK_PRESETS[0]);
  const [customTitle, setCustomTitle] = useState("");
  const [dueAt, setDueAt] = useState(defaultDueAt());
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  function load() {
    setTasks(store.getPersonalTasks(userId));
  }

  useEffect(load, [userId]);
  useEffect(() => {
    isPushSubscribed().then(setPushSubscribed);
  }, []);

  async function handleTogglePush() {
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushSubscribed(false);
      } else {
        const ok = await subscribeToPush(userId);
        setPushSubscribed(ok);
      }
    } finally {
      setPushBusy(false);
    }
  }

  function openForm() {
    setPreset(PERSONAL_TASK_PRESETS[0]);
    setCustomTitle("");
    setDueAt(defaultDueAt());
    setNotifyEnabled(true);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = preset === "otro" ? customTitle.trim() : preset;
    if (!title || !dueAt) return;

    let notify = notifyEnabled;
    if (notify) {
      const granted = await requestNotificationPermission();
      notify = granted;
    }

    const task = store.addPersonalTask({
      userId,
      title,
      dueAt: new Date(dueAt).toISOString(),
      notifyEnabled: notify,
    });
    if (user) scheduleTaskNotification(task, user.notificationPrefs);
    if (notify) syncAlarm(userId, task);

    setShowForm(false);
    load();
  }

  function handleComplete(id: string) {
    store.completePersonalTask(id);
    cancelTaskNotification(id);
    deleteAlarmSync(id);
    load();
  }

  function handleDelete(id: string) {
    store.deletePersonalTask(id);
    cancelTaskNotification(id);
    deleteAlarmSync(id);
    load();
  }

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div>
      {pushSupported() && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {pushSubscribed ? (
              <Bell className="text-primary shrink-0" size={18} />
            ) : (
              <BellOff className="text-text-muted shrink-0" size={18} />
            )}
            <p className="text-sm text-navy truncate">
              {pushSubscribed
                ? "Avisos activados: te avisa aunque cierres la app."
                : "Activa avisos para que te lleguen aunque cierres la app."}
            </p>
          </div>
          <button
            onClick={handleTogglePush}
            disabled={pushBusy}
            className={`shrink-0 text-xs font-semibold rounded-full px-3.5 py-1.5 transition-colors disabled:opacity-50 ${
              pushSubscribed ? "border border-border text-text-muted hover:text-red-600" : "bg-primary text-white hover:bg-primary-dark"
            }`}
          >
            {pushSubscribed ? "Desactivar" : "Activar"}
          </button>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button
          onClick={openForm}
          className="flex items-center gap-1.5 rounded-full bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary-dark transition-colors"
        >
          <Plus size={16} /> Nueva tarea personal
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
          Aún no tienes tareas personales. Cosas como limpiar, lavar o hacer las compras.
        </div>
      ) : (
        <div className="space-y-3">
          {[...pending, ...completed].map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-opacity ${
                t.completed ? "opacity-60" : ""
              }`}
            >
              <button
                aria-label={t.completed ? "Tarea completada" : "Marcar como completada"}
                onClick={() => !t.completed && handleComplete(t.id)}
                className="shrink-0"
              >
                {t.completed ? (
                  <CheckCircle2 className="text-success" size={26} />
                ) : (
                  <Circle className="text-text-muted" size={26} />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate ${t.completed ? "line-through text-text-muted" : "text-text"}`}>
                  {t.title}
                </p>
                <p className="text-xs text-text-muted truncate">{formatDueAt(t.dueAt)}</p>
              </div>

              {t.notifyEnabled ? (
                <Bell className="text-primary shrink-0" size={16} />
              ) : (
                <BellOff className="text-text-muted shrink-0" size={16} />
              )}

              <button
                aria-label="Eliminar tarea"
                onClick={() => handleDelete(t.id)}
                className="shrink-0 text-text-muted hover:text-red-600 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-3xl p-6 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-text-muted"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
            <h2 className="font-display text-lg font-bold text-navy mb-4">Nueva tarea personal</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-muted">¿Qué hay que hacer?</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {PERSONAL_TASK_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setPreset(p)}
                      className={`text-xs font-semibold rounded-xl py-2.5 px-2 border transition-colors ${
                        preset === p ? "bg-ink text-white border-ink" : "border-border text-text-muted hover:border-primary"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPreset("otro")}
                    className={`text-xs font-semibold rounded-xl py-2.5 px-2 border transition-colors ${
                      preset === "otro" ? "bg-ink text-white border-ink" : "border-border text-text-muted hover:border-primary"
                    }`}
                  >
                    Otro
                  </button>
                </div>
                {preset === "otro" && (
                  <input
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Describe la tarea"
                    className="mt-2 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted">Fecha y hora</label>
                <input
                  required
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <label className="flex items-center gap-2.5 text-sm text-navy pt-1">
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={(e) => setNotifyEnabled(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                Avisarme a esa hora
              </label>

              <button
                type="submit"
                className="w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary-dark transition-colors"
              >
                Agregar tarea
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
