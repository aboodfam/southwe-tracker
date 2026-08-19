import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTheme } from "../contexts/ThemeContext";
import { useSound } from "../contexts/SoundContext";
import { toast } from "sonner";
import { Icon } from "./icons";
import { useLocalDateKey } from "../hooks/useLocalDateKey";

interface Task {
  id: string;
  name: string;
  completed: boolean;
  order: number;
}

interface Routine {
  _id: Id<"routines">;
  name: string;
  timeSlot: string;
  tasks: Task[];
}

interface RoutineCardProps {
  routine: Routine;
  /** True when this block just got created, used for entry animation */
  appear?: boolean;
}

export function RoutineCard({ routine, appear }: RoutineCardProps) {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { play } = useSound();
  const dateKey = useLocalDateKey();

  // Animations: smooth add/delete without extra libs
  const [isRemovingBlock, setIsRemovingBlock] = useState(false);
  const [removingTaskIds, setRemovingTaskIds] = useState<Record<string, boolean>>({});
  const [newTaskIds, setNewTaskIds] = useState<Record<string, boolean>>({});
  const prevTaskIdsRef = useRef<string[]>(routine.tasks.map((t) => t.id));

  useEffect(() => {
    const prev = new Set(prevTaskIdsRef.current);
    const curr = routine.tasks.map((t) => t.id);
    const added = curr.filter((id) => !prev.has(id));
    if (added.length) {
      setNewTaskIds((m) => {
        const next = { ...m };
        for (const id of added) next[id] = true;
        return next;
      });
      window.setTimeout(() => {
        setNewTaskIds((m) => {
          const next = { ...m };
          for (const id of added) delete next[id];
          return next;
        });
      }, 1200);
    }
    prevTaskIdsRef.current = curr;
  }, [routine.tasks]);


  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);

  const toggleTask = useMutation(api.routines.toggleTask);
  const updateTask = useMutation(api.routines.updateTask);
  const addTask = useMutation(api.routines.addTask);
  const deleteTask = useMutation(api.routines.deleteTask);
  const deleteRoutine = useMutation(api.routines.deleteRoutine);
  const reorderTasks = useMutation(api.routines.reorderTasks);

  const completedTasks = routine.tasks.filter((t) => t.completed).length;
  const totalTasks = routine.tasks.length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

// Ensure tasks are shown in their saved order.
const routineSorted = useMemo(
  () => [...routine.tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  [routine.tasks]
);

// Local ordering so we can reorder instantly in the UI while dragging.
const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>(() =>
  routineSorted.map((t) => t.id)
);
const orderedTaskIdsRef = useRef<string[]>(orderedTaskIds);

useEffect(() => {
  orderedTaskIdsRef.current = orderedTaskIds;
}, [orderedTaskIds]);

// Sync local order with backend updates (keep current order, append new tasks).
useEffect(() => {
  const nextSortedIds = routineSorted.map((t) => t.id);
  setOrderedTaskIds((prev) => {
    const prevFiltered = prev.filter((id) => nextSortedIds.includes(id));
    const missing = nextSortedIds.filter((id) => !prevFiltered.includes(id));
    return [...prevFiltered, ...missing];
  });
}, [routineSorted]);

const tasksToRender = useMemo(() => {
  const map = new Map(routine.tasks.map((t) => [t.id, t]));
  const ordered = orderedTaskIds
    .map((id) => map.get(id))
    .filter(Boolean) as Task[];
  const missing = routineSorted.filter((t) => !orderedTaskIds.includes(t.id));
  return [...ordered, ...missing];
}, [routine.tasks, routineSorted, orderedTaskIds]);


  const handleTaskToggle = async (taskId: string) => {
    const task = routine.tasks.find((t) => t.id === taskId);
    const willComplete = task ? !task.completed : true;

    try {
      await toggleTask({ routineId: routine._id, taskId, dateKey });
      if (willComplete) play("success", 0.9);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save task progress");
    }
  };

  const handleEditStart = (task: Task) => {
    setEditingTask(task.id);
    setEditValue(task.name);
  };

  const handleEditSave = () => {
    if (editingTask && editValue.trim()) {
      updateTask({
        routineId: routine._id,
        taskId: editingTask,
        name: editValue.trim(),
      });
    }
    setEditingTask(null);
    setEditValue("");
  };

  const handleEditCancel = () => {
    setEditingTask(null);
    setEditValue("");
  };

  const handleAddTask = () => {
    if (newTaskName.trim()) {
      addTask({ routineId: routine._id, name: newTaskName.trim() });
      setNewTaskName("");
      setShowAddTask(false);

      // Small reward when creating something
      play("notification", 0.85);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    // play exit animation first, then delete
    setRemovingTaskIds((m) => ({ ...m, [taskId]: true }));
    window.setTimeout(() => {
      deleteTask({ routineId: routine._id, taskId });
      // cleanup flag (in case deletion fails / slow)
      setRemovingTaskIds((m) => {
        const next = { ...m };
        delete next[taskId];
        return next;
      });
    }, 320);
  };

  // ✅ Premium toast confirm (NO browser popup)
  const handleDeleteBlock = (e: React.MouseEvent) => {
    e.stopPropagation();

    toast.custom(
      (t) => (
        <div className="w-[340px] sm:w-[380px] rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Delete this block?</p>
              <p className="mt-1 text-xs text-white/60">
                It will be removed from your active blocks.
              </p>
            </div>

            <button
              onClick={() => toast.dismiss(t)}
              className="shrink-0 rounded-lg p-1.5 text-white/50 hover:text-white/80 hover:bg-white/5 transition"
              title="Close"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                try {
                  await deleteRoutine({ routineId: routine._id });
                  toast.dismiss(t);
                  toast.success("Block deleted");
                } catch (err: any) {
                  toast.dismiss(t);
                  toast.error(err?.message ?? "Failed to delete block");
                }
              }}
              className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-white bg-red-500/20 border border-red-400/30 hover:bg-red-500/25 transition"
            >
              Delete
            </button>

            <button
              onClick={() => toast.dismiss(t)}
              className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-white/85 bg-white/10 border border-white/10 hover:bg-white/15 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { duration: 100000 }
    );
  };

// -----------------------------
// Hold + drag reordering (NO deps)
// - Mouse: click + drag immediately
// - Touch: long-press 250ms to start (prevents scroll conflicts)
// - Smooth reordering + no weird bouncing
// -----------------------------
const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
const prevRectsRef = useRef<Record<string, DOMRect>>({});

const [dragActiveId, setDragActiveId] = useState<string | null>(null);
const [dragDy, setDragDy] = useState(0);
const [dragActivated, setDragActivated] = useState(false);

const dragRef = useRef<{
  activeId: string;
  pointerId: number;
  pointerType: string;
  startY: number;
  lastY: number;
  holdTimer: number | null;
  raf: number | null;
  activated: boolean;
  lastInsertAt: number | null;
} | null>(null);

const snapshotRects = (ids: string[]) => {
  const rects: Record<string, DOMRect> = {};
  for (const id of ids) {
    const el = rowRefs.current[id];
    if (!el) continue;
    rects[id] = el.getBoundingClientRect();
  }
  prevRectsRef.current = rects;
};

useLayoutEffect(() => {
  const rects = prevRectsRef.current;
  if (!rects || Object.keys(rects).length === 0) return;

  for (const id of orderedTaskIds) {
    const el = rowRefs.current[id];
    const from = rects[id];
    if (!el || !from) continue;
    const to = el.getBoundingClientRect();
    const dy = from.top - to.top;
    if (dy === 0) continue;

    el.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0px)" }],
      { duration: 120, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }

  prevRectsRef.current = {};
}, [orderedTaskIds]);

const cleanupDrag = () => {
  const d = dragRef.current;
  if (!d) return;

  if (d.holdTimer) window.clearTimeout(d.holdTimer);
  if (d.raf) cancelAnimationFrame(d.raf);

  dragRef.current = null;
  setDragActiveId(null);
  setDragDy(0);
  setDragActivated(false);

  window.removeEventListener("pointermove", onPointerMove, true);
  window.removeEventListener("pointerup", onPointerUp, true);
  window.removeEventListener("pointercancel", onPointerUp, true);
  window.removeEventListener("contextmenu", onContextMenu, true);

  document.body.style.userSelect = "";
};

useEffect(() => {
  return () => cleanupDrag();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const onContextMenu = (e: Event) => {
  // Prevent right-click menu from breaking pointer events while dragging
  e.preventDefault();
};

const scheduleDyUpdate = () => {
  const d = dragRef.current;
  if (!d) return;
  if (d.raf) return;

  d.raf = requestAnimationFrame(() => {
    const dd = dragRef.current;
    if (!dd) return;
    dd.raf = null;
    setDragDy(dd.lastY - dd.startY);
  });
};

const computeInsertAt = (clientY: number, activeId: string, ids: string[]) => {
  const others = ids.filter((id) => id !== activeId);

  for (let i = 0; i < others.length; i++) {
    const el = rowRefs.current[others[i]];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    if (clientY < mid) return i;
  }

  return others.length;
};

const maybeReorder = (clientY: number) => {
  const d = dragRef.current;
  if (!d || !d.activated) return;

  const activeId = d.activeId;
  const ids = orderedTaskIdsRef.current;
  if (!ids.includes(activeId)) return;

  const insertAt = computeInsertAt(clientY, activeId, ids);
  if (d.lastInsertAt === insertAt) return;
  d.lastInsertAt = insertAt;

  const next = ids.filter((id) => id !== activeId);
  next.splice(insertAt, 0, activeId);

  // Only update if something changed
  if (next.length === ids.length && next.every((v, i) => v === ids[i])) return;

  const activeEl = rowRefs.current[activeId];
  const dyBefore = d.lastY - d.startY;
  const naturalTopBefore =
    activeEl ? activeEl.getBoundingClientRect().top - dyBefore : null;

  snapshotRects(ids);
  orderedTaskIdsRef.current = next;
  setOrderedTaskIds(next);

  // Fix "bouncing": when list order changes, the active element's natural top changes.
  // Adjust startY so the active element stays under the pointer.
  if (naturalTopBefore != null) {
    requestAnimationFrame(() => {
      const dd = dragRef.current;
      if (!dd || !dd.activated) return;

      const el = rowRefs.current[activeId];
      if (!el) return;

      const dyNow = dd.lastY - dd.startY;
      const naturalTopAfter = el.getBoundingClientRect().top - dyNow;
      const delta = naturalTopAfter - naturalTopBefore;

      if (delta !== 0) {
        dd.startY += delta;
        setDragDy(dd.lastY - dd.startY);
      }
    });
  }
};

const onPointerMove = (e: PointerEvent) => {
  try {
    const d = dragRef.current;
    if (!d) return;
    if (e.pointerId !== d.pointerId) return;

    d.lastY = e.clientY;

    // Touch: allow scrolling until activated
    if (!d.activated && d.pointerType !== "mouse") {
      const preDy = Math.abs(d.lastY - d.startY);
      if (preDy > 12) cleanupDrag();
      return;
    }

    if (!d.activated) return;

    // Stop page scroll while dragging
    e.preventDefault?.();

    scheduleDyUpdate();
    maybeReorder(e.clientY);
  } catch {
    cleanupDrag();
  }
};

const onPointerUp = async (e: PointerEvent) => {
  const d = dragRef.current;
  if (!d) return;
  if (e.pointerId !== d.pointerId) return;

  const wasActivated = d.activated;
  cleanupDrag();

  if (!wasActivated) return;

  const next = orderedTaskIdsRef.current.slice();
  try {
    await reorderTasks({ routineId: routine._id, orderedTaskIds: next });
  } catch (err: any) {
    toast.error(err?.message ?? "Failed to reorder tasks");
    setOrderedTaskIds(routineSorted.map((t) => t.id));
  }
};

const startHoldDrag = (
  taskId: string,
  e: React.PointerEvent<HTMLButtonElement>
) => {
  if (editingTask === taskId) return;
  if (removingTaskIds[taskId]) return;

  // Desktop: only left click
  if (e.pointerType === "mouse" && e.button !== 0) return;

  e.preventDefault();
  e.stopPropagation();

  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {}

  dragRef.current = {
    activeId: taskId,
    pointerId: e.pointerId,
    pointerType: e.pointerType,
    startY: e.clientY,
    lastY: e.clientY,
    holdTimer: null,
    raf: null,
    activated: false,
    lastInsertAt: null,
  };

  document.body.style.userSelect = "none";
  setDragActiveId(taskId);

  window.addEventListener("pointermove", onPointerMove, {
    capture: true,
    passive: false,
  } as any);
  window.addEventListener("pointerup", onPointerUp, {
    capture: true,
    passive: true,
  } as any);
  window.addEventListener("pointercancel", onPointerUp, {
    capture: true,
    passive: true,
  } as any);
  window.addEventListener("contextmenu", onContextMenu, {
    capture: true,
  } as any);

  // Mouse: activate immediately
  if (e.pointerType === "mouse") {
    if (dragRef.current) {
      dragRef.current.activated = true;
      setDragActivated(true);
    }
    return;
  }

  // Touch: long-press to activate
  dragRef.current.holdTimer = window.setTimeout(() => {
    const d = dragRef.current;
    if (!d) return;
    d.activated = true;
    setDragActivated(true);
    try {
      (navigator as any).vibrate?.(12);
    } catch {}
  }, 250);
};

  return (
    <div
      className={`relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isRemovingBlock ? "opacity-0 -translate-y-2 scale-[0.98]" : "opacity-100 translate-y-0 scale-100"} ${appear ? "animate-pop-in" : ""} backdrop-blur-md border ${colors.border} ${colors.backgroundSecondary}`}
    >
      <div className="relative z-10">
        {/* Header */}
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[color:var(--sw-accent)] shadow-[0_0_10px_var(--sw-accent)]" />
                <h3 className={`text-lg sm:text-xl font-bold ${colors.text} truncate`}>
                  {routine.name}
                </h3>
              </div>

              <p className={`${colors.textSecondary} text-sm flex items-center gap-2`}>
                <Icon name="clock" className="h-4 w-4" />
                {routine.timeSlot}
              </p>

              {/* Quick stats */}
              <div className="mt-4 flex items-center justify-between text-xs sm:text-sm">
                <div className={`flex items-center gap-4 ${colors.textSecondary}`}>
                  <span className="flex items-center gap-1.5">
                    <Icon name="checkCircle" className="h-3.5 w-3.5" />
                    {completedTasks}/{totalTasks} tasks
                  </span>
                  {completionRate === 100 && (
                    <span className="flex items-center gap-1.5 text-green-400">
                      <Icon name="sparkles" className="h-3.5 w-3.5" />
                      Complete!
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 w-full bg-gray-800/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full bg-[image:var(--sw-gradient)] transition-all duration-700 ease-out`}
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={handleDeleteBlock}
                className="grid h-8 w-8 place-items-center rounded-lg text-red-400 transition-colors hover:bg-red-400/10 hover:text-red-300"
                title="Delete block"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>

              <div className="relative w-12 h-12 sm:w-16 sm:h-16">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.06)"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2"
                    strokeDasharray={`${completionRate}, 100`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xs sm:text-sm font-bold ${colors.text}`}>
                    {Math.round(completionRate)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className={`border-t ${colors.border} pt-4`}>
            <div className="space-y-2 sm:space-y-3">
              {tasksToRender.map((task, index) => {
                const isActive = dragActivated && dragActiveId === task.id;
                const style: React.CSSProperties | undefined = isActive
                  ? {
                      transform: `translateY(${dragDy}px) scale(1.02)`,
                      zIndex: 50,
                      position: "relative",
                      willChange: "transform",
                    }
                  : undefined;

                return (
                  <div
                    key={task.id}
                    ref={(el) => {
                      rowRefs.current[task.id] = el;
                    }}
                    style={style}
                  >
                    <TaskItem
                      task={task}
                      index={index}
                      editingTask={editingTask}
                      editValue={editValue}
                      onToggle={handleTaskToggle}
                      onEditStart={handleEditStart}
                      onEditSave={handleEditSave}
                      onEditCancel={handleEditCancel}
                      onDelete={handleDeleteTask}
                      setEditValue={setEditValue}
                      isNew={!!newTaskIds[task.id]}
                      isRemoving={!!removingTaskIds[task.id]}
                      isDragging={isActive}
                      dragActive={dragActivated}
                      onDragHandlePointerDown={(e) => startHoldDrag(task.id, e)}
                    />
                  </div>
                );
              })}

              {/* Add New Task */}
              {showAddTask ? (
                <div
                  className={`animate-scale-in flex flex-col sm:flex-row gap-2 p-3 sm:p-4 ${colors.backgroundTertiary} border border-gray-700/20 rounded-xl`}
                >
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="Enter new task..."
                    className={`min-w-0 flex-1 ${colors.backgroundTertiary} border ${colors.borderHover} rounded-lg px-3 py-2 ${colors.textSecondary} text-sm focus:outline-none`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTask();
                      if (e.key === "Escape") setShowAddTask(false);
                    }}
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                    <button
                      onClick={handleAddTask}
                      className="min-w-[72px] rounded-lg bg-[image:var(--sw-gradient)] px-4 py-2 text-sm font-medium text-black transition hover:brightness-110"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddTask(false)}
                      className="min-w-[72px] rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddTask(true)}
                  className="w-full p-3 sm:p-4 border-2 border-dashed border-white/10 rounded-xl text-white/60 hover:text-white/80 transition-all duration-200 text-sm font-medium hover:border-white/20"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add New Task
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskItem(props: {
  task: Task;
  index: number;
  editingTask: string | null;
  editValue: string;
  onToggle: (id: string) => void;
  onEditStart: (task: Task) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: (id: string) => void;
  setEditValue: (value: string) => void;
  isNew?: boolean;
  isRemoving?: boolean;
  isDragging?: boolean;
  dragActive?: boolean;
  onDragHandlePointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const { task, index, editingTask, editValue, onToggle, onEditStart, onEditSave, onEditCancel, onDelete, setEditValue, isNew, isRemoving, isDragging, dragActive, onDragHandlePointerDown } = props;

  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  return (
    <div
      className={`group flex min-w-0 items-center gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border transition-all duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isRemoving ? "opacity-0 -translate-y-1 scale-[0.98] pointer-events-none" : "opacity-100 translate-y-0 scale-100"} ${isNew ? "animate-pop-in" : ""} ${isDragging ? "ring-2 ring-white/20 shadow-2xl" : ""} ${
        task.completed
          ? `${colors.backgroundTertiary} ${colors.border} ${colors.textSecondary}`
          : `${colors.backgroundTertiary} border-gray-700/20 text-gray-300`
      }`}
      style={{ animationDelay: `${index * 0.05}s`, opacity: dragActive && !isDragging ? 0.92 : 1 }}
    >
      {/* Drag handle (hold on mobile, drag on desktop) */}
      <button
        type="button"
        onPointerDown={onDragHandlePointerDown}
        onContextMenu={(e) => e.preventDefault()}
        className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 transition flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${
          isDragging ? "bg-white/10 text-white/90" : ""
        }`}
        style={{ touchAction: "none" }}
        title="Hold to reorder"
        aria-label="Reorder task"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M7 4h2v2H7V4zm4 0h2v2h-2V4zM7 9h2v2H7V9zm4 0h2v2h-2V9zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
      <button
        onClick={() => onToggle(task.id)}
        className={`w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
          task.completed
            ? `bg-[image:var(--sw-gradient)] border-transparent text-black shadow-lg ${colors.shadow}`
            : `border-gray-500`
        }`}
      >
        {task.completed && <Icon name="check" className="h-3.5 w-3.5" />}
      </button>

      {editingTask === task.id ? (
        <div className="min-w-0 flex-1 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className={`min-w-0 flex-1 ${colors.backgroundTertiary} border ${colors.borderHover} rounded-lg px-3 py-2 ${colors.textSecondary} text-sm focus:outline-none`}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEditSave();
              if (e.key === "Escape") onEditCancel();
            }}
            autoFocus
          />
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onEditSave}
              className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--sw-gradient)] text-sm font-bold text-black transition hover:brightness-110"
              title="Save task"
              aria-label="Save task"
            >
              <Icon name="check" className="h-4 w-4" />
            </button>
            <button
              onClick={onEditCancel}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
              title="Cancel editing"
              aria-label="Cancel editing"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className={`min-w-0 flex-1 break-words text-sm sm:text-base font-medium ${task.completed ? "line-through opacity-60" : ""}`}>
            {task.name}
          </span>

          <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <button
              onClick={() => onEditStart(task)}
              className={`grid h-8 w-8 place-items-center rounded-lg ${colors.text} transition-colors hover:bg-white/5`}
              title="Edit task"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>

            <button
              onClick={() => onDelete(task.id)}
              className="grid h-8 w-8 place-items-center rounded-lg text-red-400 transition-colors hover:bg-red-400/10 hover:text-red-300"
              title="Delete task"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
