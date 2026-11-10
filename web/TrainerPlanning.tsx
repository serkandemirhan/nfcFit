import {readRecovery,recoveryKey,type DraftSnapshot} from "./lib/trainer-draft-recovery";
import { HeaderAction } from "./components/trainer-ui/page-actions";
import { ExerciseMedia, ExerciseThumbnail } from "./ExerciseMedia";
import { DataTable } from "./components/trainer-ui/data-table";
import { RowActions } from "./components/trainer-ui/row-actions";
import {
  Dialog as UIDialog,
  Button,
  Input,
  Label,
  NativeSelect,
} from "./components/trainer-ui/primitives";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  PlanningSection,
  usePlanningViewport,
  TargetNumberInput,
  PlanningSaveState,
} from "./TrainerPlanningUI";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  Exercise,
  Plan,
  PlanContent,
  PlanDay,
  CoachingOverview,
  Target,
} from "../mobile/nfc-task-tracker/lib/coaching-types";
import { planDraftError } from "../mobile/nfc-task-tracker/lib/plan-draft";
import { zonedDate } from "../mobile/nfc-task-tracker/lib/coaching-performance";
import {
  starterPrograms,
  starterContent,
} from "../mobile/nfc-task-tracker/lib/starter-programs";
import {
  cloneWorkout,
  copyWeek,
  dayDate,
  detachDay,
  planningCoverage,
  assignmentImpact,
  exerciseSearchText,
} from "./lib/trainer-planning";
import "./trainer-planning.css";
import "./trainer-workspace.css";
import type { SaveOperation } from "./lib/trainer-save-state";
type Template = {
  id: string;
  tenant_id: string;
  version: number;
  content: PlanDay;
};
type Member = {
  id: string;
  athlete_id: string;
  tenant_id: string;
  name: string;
  active_plans: number;
  upcoming_plans?: number;
  next_start_date?: string|null;
};
type Props = {
  api: <T>(path: string, payload?: unknown, method?: string) => Promise<T>;
  plans: Plan[];
  catalog: Exercise[];
  members: Member[];
  tenantId: string;
  ownerId?: string;
  timezone: string;
  mode: string;
  reload: () => Promise<void>;
  createSignal: number;
  comment: (revisionId: string) => void;
  openPlanId?: string;
  onPlanOpened?: () => void;
  onEditorFocusChange?: (focused: boolean) => void;
  workoutRequest?: { id: string; exerciseId?: string } | null;
  onWorkoutOpened?: () => void;
  dialogOnly?: boolean;
  assignmentRequest?: {nonce:string;planId:string;memberIds:string[]};
  onAssignmentClosed?: () => void;
};
const status = (p: Plan) => p.content.planning_status ?? "published";
const statusLabel = {
  draft: "Taslak",
  published: "Yayında",
  archived: "Arşiv",
};
const levels = {
  beginner: "Başlangıç",
  intermediate: "Orta",
  advanced: "İleri",
};
const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="tp-field">
      <Label htmlFor={id}>{label}</Label>
      {React.cloneElement(children as React.ReactElement<{ id?: string }>, {
        id,
      })}
    </div>
  );
}
function Dialog({
  title,
  close,
  children,
  dismissible = true,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  dismissible?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <UIDialog
      open
      onOpenChange={(open) => {
        if (!open && dismissible) close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="nfc-admin nfc-dialog-overlay" />
        <div className="nfc-admin tp-dialog-scope">
          <div className="trainer-area">
            <DialogPrimitive.Content
              className="tp-dialog"
              onEscapeKeyDown={e=>{if(!dismissible)e.preventDefault()}}
              onPointerDownOutside={e=>{if(!dismissible)e.preventDefault()}}
              aria-describedby={undefined}
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                heading.current?.focus();
              }}
            >
              <header>
                <DialogPrimitive.Title asChild>
                  <h3 ref={heading} tabIndex={-1}>
                    {title}
                  </h3>
                </DialogPrimitive.Title>
                {dismissible&&<DialogPrimitive.Close asChild>
                  <Button variant="outline" aria-label="Pencereyi kapat">
                    ×
                  </Button>
                </DialogPrimitive.Close>}
              </header>
              <div className="tp-dialog-body">
                {React.Children.toArray(children).filter(
                  (child) =>
                    !React.isValidElement<{ className?: string }>(child) ||
                    child.props.className !== "tp-review-actions",
                )}
              </div>
              {React.Children.toArray(children).filter(
                (child) =>
                  React.isValidElement<{ className?: string }>(child) &&
                  child.props.className === "tp-review-actions",
              )}
            </DialogPrimitive.Content>
          </div>
        </div>
      </DialogPrimitive.Portal>
    </UIDialog>
  );
}

export default function TrainerPlanning({
  api,
  plans,
  catalog,
  members,
  tenantId,
  timezone,
  mode,
  reload,
  createSignal,
  comment,
  openPlanId,
  onPlanOpened,
  onEditorFocusChange,
  workoutRequest,
  onWorkoutOpened,
  ownerId = "",
  dialogOnly = false,
  assignmentRequest,
  onAssignmentClosed,
}: Props) {
  const [templates, setTemplates] = useState<Template[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [saveOperation, setSaveOperation] = useState<SaveOperation | null>(
    null,
  );
  const [saveFailure, setSaveFailure] = useState<{
    operation: SaveOperation;
    message: string;
  } | null>(null);
  const [saveDetail, setSaveDetail] = useState("");
  const [templateSnapshot, setTemplateSnapshot] = useState("");
  const [programView, setProgramView] = useState<"week" | "day" | "overview">(
    "week",
  );
  const lock = useRef(false),
    planId = useRef<string>(crypto.randomUUID()),
    workoutId = useRef<string>(crypto.randomUUID()),
    assignmentId = useRef<string>(crypto.randomUUID());
  const [content, setContent] = useState<PlanContent | null>(null),
    [editing, setEditing] = useState<Plan | null>(null),
    [dirty, setDirty] = useState(false);
  const [week, setWeek] = useState(0),
    [day, setDay] = useState(0),
    [copyTo, setCopyTo] = useState(1),
    [targetDate, setTargetDate] = useState("");
  const [workout, setWorkout] = useState<PlanDay | null>(null),
    [templateEditing, setTemplateEditing] = useState<Template | null>(null),
    [workoutDirty, setWorkoutDirty] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateSize, setTemplateSize] = useState("");
  const [query, setQuery] = useState(""),
    [goal, setGoal] = useState(""),
    [level, setLevel] = useState(""),
    [duration, setDuration] = useState(""),
    [filter, setFilter] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState(""),
    [muscle, setMuscle] = useState(""),
    [equipment, setEquipment] = useState(""),
    [category, setCategory] = useState(""),
    [libraryOpen, setLibraryOpen] = useState(false),
    [selectedExercise, setSelectedExercise] = useState("");
  const [assign, setAssign] = useState<Plan | null>(null),
    [memberQuery, setMemberQuery] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [start, setStart] = useState(""),
    [overlap, setOverlap] = useState(false),
    [preview, setPreview] = useState(false),
    [reason, setReason] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [removedExercise, setRemovedExercise] = useState<{
    target: Target;
    index: number;
  } | null>(null);
  const [editFeedback, setEditFeedback] = useState("");
  const focusNewExercise = useRef(false);
  const [assignmentStage, setAssignmentStage] = useState<"select" | "confirm">(
    "select",
  );
  const [memberPlans, setMemberPlans] = useState<Record<string, Plan[]>>({});
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState("");
  const [impactRefresh, setImpactRefresh] = useState(0);
  const [history, setHistory] = useState<{
    plan: Plan;
    versions: any[];
  } | null>(null);
  const showHistory = async (p: Plan) =>
    run(async () =>
      setHistory({
        plan: p,
        versions: await api<any[]>("/plans/" + p.id + "/versions"),
      }),
    );
  const [publishReview, setPublishReview] = useState(false),
    [acknowledgedGaps, setAcknowledgedGaps] = useState(false);
  const plannerRoot = usePlanningViewport(
    workout ? "workout" : content ? "program" : false,
  );
  const calendarRef = useRef<HTMLElement>(null);
  const openedPlanId = useRef("");
  const previousMode = useRef(mode);
  const today = zonedDate(new Date(), timezone);
  const [recovery,setRecovery]=useState<DraftSnapshot|null>(null);
  const [recoveryReady,setRecoveryReady]=useState("");
  const [recoveryError,setRecoveryError]=useState("");
  const recoveryStorageKey=ownerId?recoveryKey(ownerId,tenantId,mode):"";
  const clearRecovery=()=>{if(recoveryStorageKey){try{localStorage.removeItem(recoveryStorageKey)}catch{}}setRecovery(null);};
  useEffect(()=>{setRecoveryReady("");if(dialogOnly||!ownerId)return;try{setRecovery(readRecovery(localStorage,ownerId,tenantId,mode))}catch{setRecovery(null);setRecoveryError("Bu cihazda yerel kurtarma kullanılamıyor. Düzenlemelerini sunucuya kaydet.")}setRecoveryReady(recoveryStorageKey)},[recoveryStorageKey,dialogOnly]);
  useEffect(()=>{
    if(recoveryReady!==recoveryStorageKey||recovery||!recoveryStorageKey||dialogOnly)return;
    try{
      if(!(dirty||workoutDirty)){localStorage.removeItem(recoveryStorageKey);return;}
      const snapshot:DraftSnapshot={schema:1,owner:ownerId,tenant:tenantId,mode,savedAt:Date.now(),content,workout,dirty,workoutDirty,
        base:editing?{id:editing.id,version:editing.version,athlete_id:editing.athlete_id}:null,
        templateBase:templateEditing?{id:templateEditing.id,version:templateEditing.version}:null,
        planId:planId.current,workoutId:workoutId.current,week,day,programView,selectedExercise};
      localStorage.setItem(recoveryStorageKey,JSON.stringify(snapshot));setRecoveryError("");
    }catch{setRecoveryError("Bu cihazda kurtarma kopyası oluşturulamadı. Değişikliklerini programı veya şablonu kaydederek koru.")}
  },[recoveryReady,recovery,recoveryStorageKey,content,workout,dirty,workoutDirty,editing,templateEditing,week,day,programView,selectedExercise]);
  const restoreRecovery=async()=>{
    if(!recovery)return;
    const saved=recovery;
    await run(async()=>{
      let current:Plan|null=null,template:Template|null=null,changed=false;
      if(saved.base){
        const latest=await api<CoachingOverview>("/overview?include_workouts=false"+(saved.base.athlete_id?"&athlete_id="+saved.base.athlete_id:""));
        current=latest.plans.find(p=>p.id===saved.base!.id)??null;
        if(!current||current.version!==saved.base.version){changed=true;current=null;}
      }
      if(saved.templateBase){
        const latest=await api<Template[]>("/workout-templates?tenant_id="+encodeURIComponent(tenantId));
        template=latest.find(t=>t.id===saved.templateBase!.id)??null;
        if(!template||template.version!==saved.templateBase.version){changed=true;template=null;}
      }
      setEditing(current);setTemplateEditing(template);
      setContent(saved.content?{...saved.content,...(saved.base&&!current?{planning_status:"draft" as const,name:saved.content.name+" · Kurtarılan kopya"}:{})}:null);
      setWorkout(saved.workout);setDirty(saved.dirty||!!saved.content&&changed);setWorkoutDirty(saved.workoutDirty);
      planId.current=current?saved.planId:saved.base?crypto.randomUUID():saved.planId;
      workoutId.current=template?saved.workoutId:saved.templateBase?crypto.randomUUID():saved.workoutId;
      setWeek(saved.week);setDay(saved.day);setProgramView(saved.programView);setSelectedExercise(saved.selectedExercise);
      setLibraryOpen(!saved.workout?.exercises.length);setRecovery(null);setSaveFailure(null);setSaveDetail("");
      setNotice(changed?"Güncel kayıt değişmiş. Kurtarılan içerik bağımsız taslak olarak açıldı; mevcut kayıt değiştirilmedi.":"Cihazdaki düzenleme kurtarıldı. Henüz sunucuya kaydedilmedi veya yayınlanmadı.");
    });
  };

  const update = (c: PlanContent) => {
    setSaveDetail("");
    setContent(c);
    setDirty(true);
  };
  const updateWorkout = (d: PlanDay) => {
    setSaveDetail("");
    setWorkout(d);
    setWorkoutDirty(true);
  };
  const run = async (fn: () => Promise<void>, operation?: SaveOperation) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    if (operation) {
      setSaveOperation(operation);
      setSaveFailure(null);
    }
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      if (operation)
        setSaveFailure({ operation, message: (e as Error).message });
    } finally {
      lock.current = false;
      setSaveOperation(null);
      setBusy(false);
    }
  };
  const loadTemplates = async () =>
    setTemplates(
      await api<Template[]>(
        "/workout-templates?tenant_id=" + encodeURIComponent(tenantId),
      ),
    );
  useEffect(() => {
    if (!dialogOnly) void loadTemplates().catch((e) => setError(e.message));
  }, [tenantId]);
  const hasChanges = dirty || workoutDirty;
  const editorFocused = Boolean(content || workout);
  useEffect(() => {
    onEditorFocusChange?.(editorFocused);
    return () => onEditorFocusChange?.(false);
  }, [editorFocused, onEditorFocusChange]);
  useEffect(() => {
    const guard = (e: Event) => {
      if (lock.current) {
        e.preventDefault();
        return;
      }
      if(hasChanges){
        if(!window.confirm("Kaydedilmemiş değişiklikler var. Değişiklikleri bırakıp çıkılsın mı?"))e.preventDefault();
        else clearRecovery();
      }
    };
    window.addEventListener("trainer-leave", guard);
    return () => window.removeEventListener("trainer-leave", guard);
  }, [hasChanges,recoveryStorageKey]);
  useEffect(() => {
    const returnToLibrary = () => {
      setContent(null);
      setEditing(null);
      setWorkout(null);
      setTemplateEditing(null);
      setDirty(false);
      setWorkoutDirty(false);
      setSaveFailure(null);
      setSaveDetail("");
      setError("");
      setNotice("");
      setPublishReview(false);
      setPreview(false);
    };
    window.addEventListener("trainer-library", returnToLibrary);
    return () => window.removeEventListener("trainer-library", returnToLibrary);
  }, []);

  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    setContent(null);
    setWorkout(null);
    setDirty(false);
    setWorkoutDirty(false);
  }, [mode]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges]);
  const leave = () => {
    if(!hasChanges)return true;
    if(!window.confirm("Kaydedilmemiş değişiklikler var. Değişiklikleri bırakıp çıkılsın mı?"))return false;
    clearRecovery();return true;
  };
  const open = (p?: Plan, duplicate = false) => {
    if (!leave()) return;
    setEditing(duplicate ? null : (p ?? null));
    setSaveFailure(null);
    setSaveDetail("");
    setNotice("");
    setProgramView(p ? "week" : "overview");
    planId.current = crypto.randomUUID();
    setContent(
      p
        ? {
            ...structuredClone(p.content),
            ...(duplicate
              ? {
                  name: p.content.name + " · Kopya",
                  planning_status: "draft" as const,
                }
              : {}),
          }
        : {
            name: "",
            goal: "",
            difficulty: "beginner",
            start_date: today,
            weeks: 4,
            timezone,
            days: [],
            rest_dates: [],
            planning_status: "draft",
          },
    );
    const nextDate =
      p?.athlete_id && !duplicate
        ? p.content.days
            .flatMap((d) => d.dates)
            .filter((dt) => dt > today)
            .sort()[0]
        : null;
    const offset = nextDate
      ? Math.round(
          (Date.parse(nextDate) - Date.parse(p!.content.start_date)) / 86400000,
        )
      : 0;
    setWeek(Math.floor(offset / 7));
    setDay(offset % 7);
    setDirty(!p || duplicate);
    setWorkout(null);
    setWorkoutDirty(false);
    setError("");
    setReason("");
  };
  useEffect(() => {
    if (createSignal && !openPlanId && mode === "plans") open();
  }, [createSignal]);
  useEffect(() => {
    if (!openPlanId || openedPlanId.current === openPlanId) return;
    const plan = plans.find((p) => p.id === openPlanId);
    if (plan) {
      openedPlanId.current = openPlanId;
      open(plan);
      onPlanOpened?.();
    }
  }, [openPlanId, plans]);
  const coverage = content ? planningCoverage(content) : null;
  const selectedDate = content
    ? dayDate(content.start_date, week * 7 + day)
    : today;
  const scheduled =
    content?.days.filter((d) => d.dates.includes(selectedDate)) ?? [];
  const frozen = Boolean(editing?.athlete_id && selectedDate <= today);
  const saveProgram = async (publish: boolean) => {
    if (!content) return;
    await run(
      async () => {
        const next = {
          ...content,
          planning_status: publish
            ? ("published" as const)
            : ("draft" as const),
        };
        if (next.name.trim().length < 2)
          throw new Error("Program adı en az 2 karakter olmalı.");
        if (publish) {
          const err = planDraftError(next);
          if (err) throw new Error(err);
        }
        const saved = editing
          ? await api<Plan>(
              "/plans/" + editing.id,
              { expected_version: editing.version, content: next, reason },
              "PATCH",
            )
          : await api<Plan>("/plans", {
              id: planId.current,
              tenant_id: tenantId,
              content: next,
            });
        setEditing(saved);
        setContent(saved.content);
        setDirty(false);
        setSaveDetail(
          publish
            ? `«${saved.content.name}» yayınlandı · Sürüm ${saved.version}. Üyelere atayabilirsin; mevcut atamalar bağımsız kalır.`
            : `«${saved.content.name}» taslak olarak kaydedildi. Şablon yayında değil; mevcut üye atamaları korunur. Hazır olduğunda yayınla.`,
        );
        await reload().catch(() =>
          setNotice(
            "Program kaydedildi; kütüphane yenilenemedi. Sayfayı yenileyebilirsin.",
          ),
        );
        setPublishReview(false);
        setNotice(
          publish
            ? "Program yayınlandı. Üyelere atayabilirsin."
            : "Taslak kaydedildi.",
        );
      },
      publish ? "publish" : "draft",
    );
  };
  const requestPublish = () => {
    if (!content) return;
    setSaveFailure(null);
    const validation = planDraftError({
      ...content,
      planning_status: "published",
    });
    if (validation) {
      setError(validation);
      return;
    }
    if (!editing?.athlete_id && coverage?.unconfiguredDates.length) {
      setAcknowledgedGaps(false);
      setPublishReview(true);
      return;
    }
    void saveProgram(true);
  };
  const openWorkout = (d?: PlanDay, t?: Template) => {
    setSaveFailure(null);
    setSaveDetail("");
    setNotice("");
    setTemplateSnapshot(t ? JSON.stringify(d) : "");
    setPendingRemoval(null);
    setRemovedExercise(null);
    setEditFeedback("");
    setTemplateEditing(t ?? null);
    workoutId.current = t?.id ?? crypto.randomUUID();
    setWorkout(
      d
        ? structuredClone(d)
        : {
            id: crypto.randomUUID(),
            name: "",
            dates: [selectedDate],
            exercises: [],
          },
    );
    setWorkoutDirty(false);
    setSelectedExercise(d?.exercises[0]?.id ?? "");
    setLibraryOpen(!d?.exercises.length);
    setError("");
  };
  useEffect(() => {
    if (!workoutRequest || mode !== "workouts") return;
    const exercise = catalog.find((e) => e.id === workoutRequest.exerciseId);
    if (exercise) {
      const target: Target = {
        id: crypto.randomUUID(),
        exercise_id: exercise.id,
        sets: 3,
        reps: exercise.measurements.includes("reps") ? 10 : null,
        seconds: exercise.measurements.includes("seconds") ? 30 : null,
        meters: exercise.measurements.includes("meters") ? 100 : null,
        kg: null,
        rest_seconds: 60,
        notes: "",
      };
      openWorkout({
        id: crypto.randomUUID(),
        name: "",
        dates: [selectedDate],
        exercises: [target],
      });
      setWorkoutDirty(true);
      focusNewExercise.current = true;
      setSelectedExercise(target.id);
      setLibraryOpen(false);
    } else openWorkout();
    onWorkoutOpened?.();
  }, [workoutRequest?.id, mode]);
  const addExercise = (e: Exercise) => {
    if (!workout) return;
    setError("");
    const target: Target = {
      id: crypto.randomUUID(),
      exercise_id: e.id,
      sets: 3,
      reps: e.measurements.includes("reps") ? 10 : null,
      seconds: e.measurements.includes("seconds") ? 30 : null,
      meters: e.measurements.includes("meters") ? 100 : null,
      kg: null,
      rest_seconds: 60,
      notes: "",
    };
    focusNewExercise.current = true;
    updateWorkout({ ...workout, exercises: [...workout.exercises, target] });
    setEditFeedback(
      e.name + " eklendi. Set ve tekrar hedeflerini düzenleyebilirsin.",
    );
    setSelectedExercise(target.id);
    setLibraryOpen(false);
  };
  useLayoutEffect(() => {
    if (!focusNewExercise.current || libraryOpen || !selectedExercise) return;
    const node = plannerRoot.current?.querySelector<HTMLElement>(
      `[data-target-id="${selectedExercise}"]`,
    );
    const input = node?.querySelector<HTMLInputElement>("input");
    if (input) {
      focusNewExercise.current = false;
      input.focus({ preventScroll: true });
      input.scrollIntoView({ block: "center" });
    }
  }, [selectedExercise, libraryOpen]);
  const exerciseName = (target: Target) =>
    catalog.find((e) => e.id === target.exercise_id)?.name ??
    target.exercise_id;
  const removeExercise = () => {
    if (!workout || !pendingRemoval) return;
    const index = workout.exercises.findIndex((e) => e.id === pendingRemoval);
    const target = workout.exercises[index];
    if (!target) return;
    const remaining = workout.exercises.filter((e) => e.id !== pendingRemoval);
    updateWorkout({ ...workout, exercises: remaining });
    setRemovedExercise({ target: structuredClone(target), index });
    setSelectedExercise(
      remaining[Math.min(index, remaining.length - 1)]?.id ?? "",
    );
    setPendingRemoval(null);
    setEditFeedback(
      exerciseName(target) + " taslaktan kaldırıldı. Geri alabilirsin.",
    );
  };
  const undoRemoval = () => {
    if (!workout || !removedExercise) return;
    const exercises = [...workout.exercises];
    if (exercises.some((e) => e.id === removedExercise.target.id)) return;
    exercises.splice(
      Math.min(removedExercise.index, exercises.length),
      0,
      removedExercise.target,
    );
    updateWorkout({ ...workout, exercises });
    setSelectedExercise(removedExercise.target.id);
    setRemovedExercise(null);
    setEditFeedback("Egzersiz ve hedefleri geri alındı.");
  };
  const patchExercise = (id: string, patch: Partial<Target>) =>
    workout &&
    updateWorkout({
      ...workout,
      exercises: workout.exercises.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    });
  const reorder = (i: number, delta: number) => {
    if (!workout) return;
    if (i + delta < 0 || i + delta >= workout.exercises.length) return;
    const list = [...workout.exercises],
      moved = list[i];
    [list[i], list[i + delta]] = [list[i + delta], list[i]];
    updateWorkout({ ...workout, exercises: list });
    setSelectedExercise(moved.id);
    setEditFeedback(
      `${exerciseName(moved)}, ${i + delta + 1}/${list.length} sırasına taşındı.`,
    );
  };
  const workoutError = () =>
    !workout
      ? "Antrenman bulunamadı."
      : planDraftError({
          name: workout.name,
          start_date: workout.dates[0],
          weeks: 1,
          timezone,
          difficulty: "beginner",
          goal: "",
          days: [{ ...workout, dates: [workout.dates[0]] }],
        });
  const storeWorkout = async () =>
    run(async () => {
      const err = workoutError();
      if (err) throw new Error(err);
      const saved = await api<Template>("/workout-templates", {
        id: workoutId.current,
        tenant_id: tenantId,
        expected_version: templateEditing?.version,
        content: workout,
      });
      setTemplateEditing(saved);
      setWorkout(saved.content);
      setTemplateSnapshot(JSON.stringify(saved.content));
      if (!content) setWorkoutDirty(false);
      setSaveDetail(
        `Şablon kaydedildi · Sürüm ${saved.version}. ${content ? "Güne uygulanmadı; Güne uygula’dan sonra programı kaydet." : "Yeni hedefler antrenman kütüphanesinde kullanıma hazır."}`,
      );
      await loadTemplates().catch(() =>
        setNotice("Şablon kaydedildi; kütüphaneyi yenileyebilirsin."),
      );
      setNotice("Antrenman şablonu kaydedildi.");
    }, "template");
  const applyWorkout = () => {
    const err = workoutError();
    if (err) {
      setError(err);
      return;
    }
    if (!content || !workout) return;
    setError("");
    let next = content;
    const existing = content.days.find(
      (d) => d.id === workout.id && d.dates.includes(selectedDate),
    );
    if (existing) {
      const detached = detachDay(content, existing.id, selectedDate);
      next = {
        ...detached.content,
        days: detached.content.days.map((d) =>
          d.id === detached.day.id
            ? { ...workout, id: d.id, dates: [selectedDate] }
            : d,
        ),
      };
    } else
      next = {
        ...content,
        days: [...content.days, cloneWorkout(workout, [selectedDate])],
      };
    update({
      ...next,
      rest_dates: (next.rest_dates ?? []).filter((dt) => dt !== selectedDate),
    });
    setWorkout(null);
    setWorkoutDirty(false);
    setSaveFailure(null);
    setProgramView("day");
    setSaveDetail(
      `«${workout.name}» ${selectedDate} gününe uygulandı. Bu yerel değişikliği kalıcı yapmak için program taslağını kaydet veya yayınla.`,
    );
    setNotice("Antrenman güne eklendi. Programı kaydetmeyi unutma.");
  };
  const removeDate = (id: string, dt: string) => {
    if (!content) return;
    update({
      ...content,
      days: content.days
        .map((d) =>
          d.id === id ? { ...d, dates: d.dates.filter((x) => x !== dt) } : d,
        )
        .filter((d) => d.dates.length),
    });
  };
  const assignStart = (p: Plan) => {
    setNotice("");
    setError("");
    setAssign(p);
    setAssignmentStage("select");
    setMemberPlans({});
    setImpactError("");
    setSelected([]);
    setStart(today);
    setOverlap(false);
    setError("");
    assignmentId.current = crypto.randomUUID();
  };
  const assignmentOpened = useRef(false);
  useEffect(() => {
    if (!assignmentRequest) return;
    const plan = plans.find(p=>p.id===assignmentRequest.planId);
    if (plan) { assignStart(plan); setSelected(assignmentRequest.memberIds); }
  }, [assignmentRequest?.nonce]);
  useEffect(() => {
    if (assign) assignmentOpened.current = true;
    else if (dialogOnly && assignmentOpened.current) onAssignmentClosed?.();
  }, [assign]);
  const [assignmentMembers, setAssignmentMembers] = useState<Member[]>(members);
  const [assignmentMemberError, setAssignmentMemberError] = useState("");
  const memberMemory = useRef(new Map(members.map(m=>[m.athlete_id,m])));
  members.forEach(m=>memberMemory.current.set(m.athlete_id,m));
  useEffect(() => {
    if (!assign) return;
    let live=true;
    const timer=setTimeout(()=>void api<{items:Member[]}>("/trainer/members?"+new URLSearchParams({tenant_id:tenantId,q:memberQuery,page_size:"50"})).then(d=>{
      if(!live)return; d.items.forEach(m=>memberMemory.current.set(m.athlete_id,m));setAssignmentMembers(d.items);setAssignmentMemberError("");
    }).catch(e=>{if(live)setAssignmentMemberError(e.message)}),200);
    return()=>{live=false;clearTimeout(timer)};
  },[assign?.id,memberQuery,tenantId]);
  const resetAssignment = () => {
    assignmentId.current = crypto.randomUUID();
    setOverlap(false);
    setAssignmentStage("select");
  };
  useEffect(() => {
    let live = true;
    if (!assign || !selected.length) {
      setMemberPlans({});
      setImpactLoading(false);
      return;
    }
    setImpactLoading(true);
    setImpactError("");
    Promise.all(
      selected.map(async (id) => {
        const overview = await api<CoachingOverview>(
          "/overview?athlete_id=" + encodeURIComponent(id),
        );
        return [
          id,
          overview.plans.filter(
            (p) => p.athlete_id === id && p.tenant_id === assign.tenant_id,
          ),
        ] as const;
      }),
    )
      .then((rows) => {
        if (live) setMemberPlans(Object.fromEntries(rows));
      })
      .catch((e) => {
        if (live) {
          setImpactError(e.message);
          setMemberPlans({});
        }
      })
      .finally(() => {
        if (live) setImpactLoading(false);
      });
    return () => {
      live = false;
    };
  }, [assign?.id, selected.join("|"), tenantId, impactRefresh]);
  const impacts =
    assign && start
      ? selected.map((id) => ({
          id,
          name:
            memberMemory.current.get(id)
              ?.name ?? id,
          plans: assignmentImpact(
            memberPlans[id] ?? [],
            start,
            assign.content.weeks,
          ),
        }))
      : [];
  const conflicting = impacts.flatMap((m) =>
    m.plans.filter((p) => p.overlaps).map((p) => ({ ...p, member: m.name })),
  );
  const noImpactData = selected.some((id) => !(id in memberPlans));
  const goToDate = (date: string) => {
    if (!content) return;
    const offset = Math.round(
      (Date.parse(date) - Date.parse(content.start_date)) / 86400000,
    );
    setWeek(Math.floor(offset / 7));
    setDay(offset % 7);
    setProgramView("day");
    setPublishReview(false);
    requestAnimationFrame(() =>
      calendarRef.current?.scrollIntoView({ block: "start" }),
    );
  };
  const archive = async (p: Plan) =>
    run(async () => {
      await api(
        "/plans/" + p.id,
        {
          expected_version: p.version,
          content: {
            ...p.content,
            planning_status: status(p) === "archived" ? "draft" : "archived",
          },
          reason: "Şablon arşivi",
        },
        "PATCH",
      );
      await reload();
      setNotice("Şablon durumu güncellendi. Atanmış kopyalar korundu.");
    });
  const filtered = plans.filter(
    (p) =>
      p.content.name
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")) &&
      (!goal || p.content.goal === goal) &&
      (!level || p.content.difficulty === level) &&
      (!duration || p.content.weeks === Number(duration)) &&
      (!filter ? status(p) !== "archived" : status(p) === filter),
  );
  const filteredExercises = catalog.filter(
    (e) =>
      exerciseSearchText(e.name + " " + e.name_en).includes(
        exerciseSearchText(exerciseQuery),
      ) &&
      (!muscle || e.muscle === muscle) &&
      (!equipment || e.equipment === equipment) &&
      (!category || e.measurements.includes(category as any)),
  );
  const activeTarget = workout?.exercises.find(
      (e) => e.id === selectedExercise,
    ),
    activeLibrary = catalog.find((e) => e.id === activeTarget?.exercise_id);
  return (
    <div
      ref={plannerRoot}
      style={dialogOnly ? {display:"none"} : undefined}
      className="tp"
      data-view={workout ? "workout" : content ? "program" : "library"}
      data-program-view={programView}
      data-has-actions={Boolean(content || workout)}
      aria-label="Program planlama"
    >
      {recovery&&!dialogOnly&&<Dialog title="Yarım kalan düzenleme bulundu" close={()=>{}} dismissible={false}>
        <p>Bu cihazdaki {new Date(recovery.savedAt).toLocaleString("tr-TR")} tarihli düzenleme kurtarılabilir.</p>
        <p><strong>{recovery.content?.name||recovery.workout?.name||"İsimsiz taslak"}</strong></p>
        <p>Bu kopya henüz sunucuya kaydedilmedi. Güncel kayıt değişmişse bağımsız bir kopya açılır.</p>
        {error&&<p role="alert">{error}</p>}
        <div className="tp-review-actions"><Button disabled={busy} onClick={()=>void restoreRecovery()}>Yerel taslağı kurtar</Button><Button variant="outline" disabled={busy} onClick={()=>{clearRecovery();setError("");}}>Yerel kopyayı sil</Button></div>
      </Dialog>}
      {recoveryError&&<p role="alert" className="tp-alert">{recoveryError}</p>}
      {!dialogOnly&&hasChanges&&!recovery&&<p className="tp-recovery-hint" role="status">{recoveryError?"Kurtarma kopyası kullanılamıyor.":"Cihazda kurtarma kopyası tutuluyor. Kalıcı kayıt için Kaydet’i kullan."}</p>}

      {error && !(saveFailure && (content || workout)) && (
        <div className="tp-alert" role="alert">
          {error}
          {content && !workout && (
            <Button
              variant="outline"
              onClick={() => {
                if (!content.name.trim()) {
                  const settings =
                    plannerRoot.current?.querySelector<HTMLDetailsElement>(
                      ".tp-settings",
                    );
                  if (settings) settings.open = true;
                  requestAnimationFrame(() =>
                    plannerRoot.current
                      ?.querySelector<HTMLInputElement>(".tp-settings input")
                      ?.focus(),
                  );
                } else goToDate(selectedDate);
              }}
            >
              İlgili gün veya program ayarını düzenle
            </Button>
          )}
        </div>
      )}
      {notice && !content && !workout && (
        <div className="tp-notice" role="status">
          {notice}
        </div>
      )}
      {content && (
        <div
          className="tp-context-bar"
          role="region"
          aria-label="Seçili hafta ve gün"
        >
          <div>
            <strong>
              {week + 1}. hafta / {content.weeks}
            </strong>
            <span>
              {new Intl.DateTimeFormat("tr", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }).format(new Date(selectedDate + "T12:00Z"))}
            </span>
          </div>
          <span className="tp-context-status">
            {workout
              ? "Antrenman düzenleniyor"
              : scheduled.length
                ? `${scheduled.length} antrenman`
                : content.rest_dates?.includes(selectedDate)
                  ? "Dinlenme günü"
                  : "Planlanmadı"}
          </span>
        </div>
      )}
      {workout ? (
        <>
          <header className="tp-heading">
            <div>
              <p className="tp-eyebrow">
                {content
                  ? `${content.name || "Yeni program"} / Antrenman`
                  : "Antrenmanlar / Düzenle"}
              </p>
              <h2>{workout.name || "Yeni antrenman"}</h2>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  !workoutDirty ||
                  window.confirm("Antrenman değişikliklerinden vazgeçilsin mi?")
                ) {
                  setWorkout(null);
                  setWorkoutDirty(false);
                }
              }}
            >
              ← Geri
            </Button>
          </header>
          <div className="tp-workspace" inert={Boolean(saveOperation)}>
            <aside
              className={
                "tp-panel tp-exercise-library " + (libraryOpen ? "is-open" : "")
              }
            >
              <div className="tp-inline">
                <div>
                  <h3>Egzersiz kütüphanesi</h3>
                  {content && (
                    <small>
                      {week + 1}. hafta · {selectedDate} ·{" "}
                      {workout.name || "Yeni antrenman"}
                    </small>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="tp-mobile"
                  onClick={() => setLibraryOpen(false)}
                  aria-label="Kütüphaneyi kapat"
                >
                  ×
                </Button>
              </div>
              <Field label="Egzersiz ara">
                <Input
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={exerciseQuery}
                  placeholder="Ad veya hareket ara…"
                  onChange={(e) => setExerciseQuery(e.target.value)}
                />
              </Field>
              <PlanningSection
                title="Egzersiz filtreleri"
                desktopOpen={false}
                className="tp-library-filters"
              >
                {" "}
                <div className="tp-filter-pair">
                  <Field label="Kas grubu">
                    <NativeSelect
                      value={muscle}
                      onChange={(e) => setMuscle(e.target.value)}
                    >
                      <option value="">Tümü</option>
                      {[...new Set(catalog.map((e) => e.muscle))].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Ekipman">
                    <NativeSelect
                      value={equipment}
                      onChange={(e) => setEquipment(e.target.value)}
                    >
                      <option value="">Tümü</option>
                      {[...new Set(catalog.map((e) => e.equipment))].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </NativeSelect>
                  </Field>
                </div>
                <Field label="Hareket kategorisi">
                  <NativeSelect
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Tümü</option>
                    <option value="reps">Tekrar</option>
                    <option value="seconds">Süre</option>
                    <option value="meters">Mesafe</option>
                  </NativeSelect>
                </Field>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMuscle("");
                    setEquipment("");
                    setCategory("");
                  }}
                >
                  Filtreleri temizle
                </Button>
              </PlanningSection>
              <small>
                {filteredExercises.length} egzersiz ·{" "}
                {[muscle, equipment, category].filter(Boolean).length} etkin
                filtre
              </small>
              <div className="tp-exercise-results">
                {filteredExercises.map((e) => (
                  <Button
                    variant="outline"
                    key={e.id}
                    className="tp-exercise-pick"
                    aria-label={e.name + " egzersizini ekle"}
                    onClick={() => addExercise(e)}
                  >
                    <span className="tp-exercise-icon">
                      <ExerciseThumbnail exercise={e} />
                    </span>
                    <span>
                      <strong>{e.name}</strong>
                      <small>
                        {e.equipment} · {e.muscle}
                      </small>
                    </span>
                    <span aria-hidden>＋</span>
                  </Button>
                ))}
                {!filteredExercises.length && (
                  <p>Aramana uygun egzersiz yok. Filtreleri değiştir.</p>
                )}
              </div>
            </aside>
            <main className="tp-panel">
              <PlanningSection
                title="Antrenman bilgileri"
                className="tp-workout-name"
                mobileOpen={!workout.name}
              >
                <Field label="Antrenman adı">
                  <Input
                    value={workout.name}
                    onChange={(e) =>
                      updateWorkout({ ...workout, name: e.target.value })
                    }
                    placeholder="Örn. Üst vücut A"
                    maxLength={120}
                  />
                </Field>
              </PlanningSection>
              <div className="tp-inline tp-exercise-heading">
                <h3>
                  Egzersiz sırası <small>({workout.exercises.length})</small>
                </h3>
                <Button
                  variant="outline"
                  className="tp-mobile"
                  onClick={() => setLibraryOpen(true)}
                >
                  ＋ Egzersiz seç
                </Button>
              </div>
              {!workout.exercises.length && (
                <div className="tp-empty">
                  <h3>İlk egzersizini ekle</h3>
                  <p>Kütüphaneden bir hareket seçerek başla.</p>
                </div>
              )}
              {editFeedback && (
                <p
                  className="tp-edit-feedback"
                  role="status"
                  aria-live="polite"
                >
                  {editFeedback}
                  {removedExercise && (
                    <Button variant="outline" onClick={undoRemoval}>
                      Kaldırmayı geri al
                    </Button>
                  )}
                </p>
              )}
              {!!workout.exercises.length && (
                <div className="tp-mobile-focus-controls">
                  <Field label="Düzenlenen egzersiz">
                    <NativeSelect
                      value={selectedExercise}
                      onChange={(e) => setSelectedExercise(e.target.value)}
                    >
                      {workout.exercises.map((e, i) => (
                        <option key={e.id} value={e.id}>
                          {i + 1}. {exerciseName(e)}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <small>
                    Tek egzersizin hedeflerini düzenle; diğer egzersizler bu
                    listede korunur.
                  </small>
                </div>
              )}
              {workout.exercises.map((e, i) => (
                <article
                  className={
                    "tp-target " + (selectedExercise === e.id ? "selected" : "")
                  }
                  key={e.id}
                  data-target-id={e.id}
                >
                  <div className="tp-inline">
                    <Button
                      variant="outline"
                      className="tp-target-title"
                      aria-expanded={selectedExercise === e.id}
                      onClick={() => setSelectedExercise(e.id)}
                    >
                      <span className="tp-number">{i + 1}</span>
                      {catalog.find((x) => x.id === e.exercise_id)?.name ??
                        e.exercise_id}
                    </Button>
                    <div className="tp-order">
                      <Button
                        variant="outline"
                        disabled={i === 0}
                        aria-label="Egzersizi yukarı taşı"
                        onClick={() => reorder(i, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="outline"
                        disabled={i === workout.exercises.length - 1}
                        aria-label="Egzersizi aşağı taşı"
                        onClick={() => reorder(i, 1)}
                      >
                        ↓
                      </Button>
                    </div>
                  </div>
                  {selectedExercise === e.id ? (
                    <>
                      <div className="tp-target-fields">
                        <Field label="Set">
                          <TargetNumberInput
                            value={e.sets}
                            min={1}
                            max={100}
                            integer
                            onValue={(n) =>
                              patchExercise(e.id, { sets: n ?? Number.NaN })
                            }
                          />
                        </Field>
                        {(["reps", "kg", "seconds", "meters"] as const)
                          .filter((key) =>
                            catalog
                              .find((x) => x.id === e.exercise_id)
                              ?.measurements.includes(key),
                          )
                          .map((key) => (
                            <Field
                              key={key}
                              label={
                                {
                                  reps: "Tekrar",
                                  kg: "Ağırlık (kg)",
                                  seconds: "Süre (sn)",
                                  meters: "Mesafe (m)",
                                }[key]
                              }
                            >
                              <TargetNumberInput
                                value={e[key]}
                                min={key === "kg" ? 0 : 1}
                                max={
                                  {
                                    reps: 10000,
                                    kg: 2000,
                                    seconds: 86400,
                                    meters: 1000000,
                                  }[key]
                                }
                                integer={key === "reps"}
                                optional={key === "kg"}
                                placeholder={key === "kg" ? "İsteğe bağlı" : ""}
                                onValue={(n) =>
                                  patchExercise(e.id, { [key]: n })
                                }
                              />
                            </Field>
                          ))}
                        <Field label="Dinlenme (sn)">
                          <TargetNumberInput
                            value={e.rest_seconds}
                            min={0}
                            max={3600}
                            integer
                            onValue={(n) =>
                              patchExercise(e.id, {
                                rest_seconds: n ?? Number.NaN,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <details
                        className="tp-target-notes"
                        open={e.notes ? true : undefined}
                      >
                        <summary>
                          Talimat ve notlar
                          {e.notes ? " · 1 not" : " · İsteğe bağlı"}
                        </summary>
                        <Field label="Antrenör talimatı">
                          <textarea
                            rows={2}
                            maxLength={2000}
                            value={e.notes}
                            onChange={(x) =>
                              patchExercise(e.id, { notes: x.target.value })
                            }
                            placeholder="Teknik, tempo veya özel not…"
                          />
                        </Field>
                      </details>
                      <div className="tp-inline tp-target-actions">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const copy = {
                              ...structuredClone(e),
                              id: crypto.randomUUID(),
                            };
                            updateWorkout({
                              ...workout,
                              exercises: [...workout.exercises, copy],
                            });
                            setSelectedExercise(copy.id);
                            setEditFeedback(
                              exerciseName(e) +
                                " bağımsız hedeflerle çoğaltıldı.",
                            );
                          }}
                        >
                          Çoğalt
                        </Button>
                        <Button
                          variant="outline"
                          className="tp-danger-quiet"
                          onClick={() => setPendingRemoval(e.id)}
                        >
                          Egzersizi kaldır
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="tp-muted">
                      {Number.isFinite(e.sets) ? e.sets : "—"} ×{" "}
                      {e.reps ?? e.seconds ?? e.meters} · {e.rest_seconds} sn
                      dinlenme
                      {e.kg != null ? " · " + e.kg + " kg" : ""}
                    </p>
                  )}
                </article>
              ))}
            </main>
            <PlanningSection
              title="Antrenman özeti ve hareket rehberi"
              desktopOpen={true}
              className="tp-panel tp-summary"
            >
              <div className="tp-metrics">
                <div>
                  <strong>{workout.exercises.length}</strong>
                  <small>Egzersiz</small>
                </div>
                <div>
                  <strong>
                    {workout.exercises.reduce(
                      (n, e) => n + (Number.isFinite(e.sets) ? e.sets : 0),
                      0,
                    )}
                  </strong>
                  <small>Planlanan set</small>
                </div>
              </div>
              <p className="tp-muted">
                Dinlenme toplamı:{" "}
                {Math.round(
                  workout.exercises.reduce(
                    (n, e) =>
                      n +
                      (Number.isFinite(e.sets) &&
                      Number.isFinite(e.rest_seconds)
                        ? Math.max(0, e.sets - 1) * e.rest_seconds
                        : 0),
                    0,
                  ) / 60,
                )}{" "}
                dk. Hareket süresi bilinmediğinden toplam süre tahmin edilmez.
              </p>
              <ol>
                {workout.exercises.map((e) => (
                  <li key={e.id}>
                    {catalog.find((x) => x.id === e.exercise_id)?.name}
                  </li>
                ))}
              </ol>
              {activeLibrary && (
                <details>
                  <summary>Hareket rehberi</summary>
                  <ExerciseMedia exercise={activeLibrary} />
                  <p>{activeLibrary.description}</p>
                  {activeLibrary.instructions.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                </details>
              )}
              <p className="tp-muted">
                Her set aynı hedefi kullanır. Ağırlık isteğe bağlıdır.
              </p>
              {workoutError() && <p className="tp-warning">{workoutError()}</p>}
            </PlanningSection>
          </div>
          <footer className="tp-savebar">
            <PlanningSaveState
              savedTitle={
                templateSnapshot === JSON.stringify(workout)
                  ? "Şablon kaydedildi"
                  : "Gündeki hedefler kayıtlı"
              }
              dirty={
                (workoutDirty &&
                  templateSnapshot !== JSON.stringify(workout)) ||
                (!templateEditing && !content) ||
                Boolean(content && dirty && !templateSnapshot)
              }
              operation={saveOperation}
              failure={saveFailure}
              detail={
                saveDetail ||
                (content
                  ? workoutDirty
                    ? "Hedefler henüz güne uygulanmadı. Güne uygula’dan sonra programı kaydet."
                    : dirty
                      ? "Bu gün açık program taslağında. Kalıcı yapmak için programı kaydet."
                      : "Kayıtlı günün hedefleri. Güne uygula programın açık taslağını değiştirir."
                  : templateEditing
                    ? workoutDirty
                      ? "Bu düzenlemeler şablona henüz kaydedilmedi."
                      : "Antrenman şablonu kütüphanede kayıtlı."
                    : "Yeni antrenman. Tekrar kullanmak için şablon olarak kaydet.")
              }
              retry={() => void storeWorkout()}
            />
            <div className="tp-save-actions">
              <Button
                variant="outline"
                disabled={busy || templateSnapshot === JSON.stringify(workout)}
                onClick={() => void storeWorkout()}
              >
                Şablon olarak kaydet
              </Button>
              {content && (
                <Button
                  variant="outline"
                  className="tp-primary"
                  disabled={busy || frozen}
                  onClick={applyWorkout}
                >
                  Güne uygula
                </Button>
              )}
            </div>
          </footer>
        </>
      ) : content ? (
        <>
          <header className="tp-heading">
            <div>
              <p className="tp-eyebrow">
                {editing?.athlete_id
                  ? "ÜYEYE ÖZEL PROGRAM"
                  : "PROGRAMLAR / DÜZENLE"}
              </p>
              <h2>{content.name || "Yeni eğitim programı"}</h2>
            </div>
            <div
              className="tp-inline tp-program-actions"
              role="group"
              aria-label="Önizleme, atama ve kütüphane işlemleri"
            >
              <Button
                variant="outline"
                aria-label="Üye önizlemesi"
                onClick={() => setPreview(true)}
              >
                <span className="tp-desktop">Üye önizlemesi</span>
                <span className="tp-mobile">Önizle</span>
              </Button>
              {editing &&
                !editing.athlete_id &&
                status(editing) === "published" && (
                  <Button
                    variant="outline"
                    className="tp-header-assign tp-primary"
                    aria-label="Üyelere ata"
                    disabled={busy || dirty}
                    onClick={() => assignStart(editing)}
                  >
                    <span className="tp-desktop">Üyelere ata</span>
                    <span className="tp-mobile">Ata</span>
                  </Button>
                )}
              <Button
                variant="outline"
                aria-label="Kütüphaneye dön"
                disabled={busy}
                onClick={() => {
                  if (leave()) {
                    setContent(null);
                    setDirty(false);
                  }
                }}
              >
                <span className="tp-desktop">Kütüphaneye dön</span>
                <span className="tp-mobile">Geri</span>
              </Button>
            </div>
          </header>
          <div className="tp-publication-state" role="status">
            <span
              className={"tp-badge " + (editing ? status(editing) : "draft")}
            >
              {editing
                ? statusLabel[status(editing)] + ` · Sürüm ${editing.version}`
                : "Taslak · Henüz kaydedilmedi"}
            </span>
            <span>
              {dirty && editing && status(editing) === "published"
                ? "Yayınlanmamış değişiklikler"
                : `${content.weeks} hafta · ${content.days.reduce((n, d) => n + d.dates.length, 0)} seans`}
            </span>
            <div
              className="tp-program-context"
              role="region"
              aria-label="Seçili hafta ve gün"
            >
              <strong>
                {week + 1}. hafta / {content.weeks}
              </strong>
              <span>
                {new Intl.DateTimeFormat("tr", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                }).format(new Date(selectedDate + "T12:00Z"))}
              </span>
              <small>
                {scheduled.length
                  ? `${scheduled.length} antrenman`
                  : content.rest_dates?.includes(selectedDate)
                    ? "Dinlenme günü"
                    : "Planlanmadı"}
              </small>
            </div>
          </div>
          <nav
            className="tp-mobile tp-program-views"
            aria-label="Program görünümü"
          >
            {(
              [
                ["week", "Hafta"],
                ["day", "Seçili gün"],
                ["overview", "Genel bakış"],
              ] as const
            ).map(([key, label]) => (
              <Button
                variant="outline"
                key={key}
                aria-pressed={programView === key}
                onClick={() => setProgramView(key)}
              >
                {label}
              </Button>
            ))}
          </nav>
          <PlanningSection
            title={`Program ayarları · ${content.weeks} hafta`}
            desktopOpen={!content.name}
            className="tp-panel tp-settings"
            forceOpen={programView === "overview"}
            onOpenChange={(next) =>
              setProgramView(
                next
                  ? "overview"
                  : programView === "overview"
                    ? "week"
                    : programView,
              )
            }
            mobileOpen={!content.name}
          >
            <div className="tp-program-meta" inert={Boolean(saveOperation)}>
              <Field label="Program adı">
                <Input
                  value={content.name}
                  maxLength={160}
                  placeholder="Örn. Güç temelleri"
                  onChange={(e) => update({ ...content, name: e.target.value })}
                />
              </Field>
              <Field label="Amaç">
                <Input
                  value={content.goal}
                  maxLength={1000}
                  placeholder="Örn. Güç kazanımı"
                  onChange={(e) => update({ ...content, goal: e.target.value })}
                />
              </Field>
              <Field label="Seviye">
                <NativeSelect
                  value={content.difficulty}
                  onChange={(e) =>
                    update({ ...content, difficulty: e.target.value as any })
                  }
                >
                  {Object.entries(levels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Süre (hafta)">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={52}
                  value={content.weeks}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isInteger(n) || n < 1 || n > 52) return;
                    const end = dayDate(content.start_date, n * 7);
                    if (
                      content.days.some((d) => d.dates.some((dt) => dt >= end))
                    ) {
                      setError("Önce süre dışında kalan antrenmanları kaldır.");
                      return;
                    }
                    update({
                      ...content,
                      weeks: n,
                      rest_dates: content.rest_dates?.filter((dt) => dt < end),
                    });
                    setWeek(Math.min(week, n - 1));
                  }}
                />
              </Field>
              <Field label="Başlangıç">
                <Input
                  type="date"
                  disabled={!!editing?.athlete_id}
                  value={content.start_date}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const diff = Math.round(
                      (Date.parse(e.target.value) -
                        Date.parse(content.start_date)) /
                        86400000,
                    );
                    update({
                      ...content,
                      start_date: e.target.value,
                      days: content.days.map((d) => ({
                        ...d,
                        dates: d.dates.map((dt) => dayDate(dt, diff)),
                      })),
                      rest_dates: content.rest_dates?.map((dt) =>
                        dayDate(dt, diff),
                      ),
                    });
                  }}
                />
              </Field>
            </div>
            {editing &&
              !editing.athlete_id &&
              status(editing) === "published" && (
                <div className="tp-unpublish-action">
                  <p>
                    Şablonu taslağa çevirmek mevcut üye atamalarını değiştirmez.
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Bu şablon yayından kaldırılıp taslak olarak kaydedilecek. Mevcut üye atamaları ve geçmiş kayıtlar korunur. Devam edilsin mi?",
                        )
                      )
                        void saveProgram(false);
                    }}
                  >
                    Yayından kaldır ve taslağı kaydet
                  </Button>
                </div>
              )}
          </PlanningSection>
          <div className="tp-planner-layout" inert={Boolean(saveOperation)}>
            <main ref={calendarRef} className="tp-panel tp-calendar-panel">
              <div className="tp-week-calendar">
                <div className="tp-inline tp-week-tools">
                  <Field label="Hafta">
                    <NativeSelect
                      value={week}
                      onChange={(e) => setWeek(Number(e.target.value))}
                    >
                      {Array.from({ length: content.weeks }, (_, i) => (
                        <option key={i} value={i}>
                          {i + 1}. hafta
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <PlanningSection
                    title="Hafta işlemleri"
                    desktopOpen={false}
                    className="tp-week-actions"
                  >
                    <div className="tp-inline">
                      <Field label="Hedef hafta">
                        <NativeSelect
                          value={copyTo}
                          onChange={(e) => setCopyTo(Number(e.target.value))}
                        >
                          {Array.from({ length: content.weeks }, (_, i) => (
                            <option key={i} value={i}>
                              {i + 1}. hafta
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Button
                        variant="outline"
                        disabled={
                          copyTo === week ||
                          copyTo >= content.weeks ||
                          (!!editing?.athlete_id &&
                            dayDate(content.start_date, copyTo * 7) <= today)
                        }
                        onClick={() => {
                          if (
                            window.confirm(
                              "Hedef haftadaki planın yerini bu hafta alsın mı?",
                            )
                          )
                            update(copyWeek(content, week, copyTo));
                        }}
                      >
                        Haftayı kopyala
                      </Button>
                    </div>
                  </PlanningSection>
                </div>
                <p className="tp-muted tp-week-range">
                  {week + 1}. hafta · {dayDate(content.start_date, week * 7)} —{" "}
                  {dayDate(content.start_date, week * 7 + 6)}
                </p>
                <div className="tp-calendar">
                  {Array.from({ length: 7 }, (_, i) => {
                    const dt = dayDate(content.start_date, week * 7 + i),
                      sessions = content.days.filter((d) =>
                        d.dates.includes(dt),
                      ),
                      rest = content.rest_dates?.includes(dt);
                    return (
                      <Button
                        variant="outline"
                        key={dt}
                        aria-pressed={day === i}
                        className={
                          "tp-day " +
                          (rest
                            ? "is-rest "
                            : sessions.length
                              ? "is-training "
                              : "is-unconfigured ") +
                          (day === i ? "selected" : "")
                        }
                        aria-label={`${dt} · ${sessions.length ? `${sessions.length} antrenman` : rest ? "Dinlenme günü" : "Planlanmadı"}${day === i ? " · Seçili gün" : ""}`}
                        aria-current={day === i ? "date" : undefined}
                        onClick={() => {
                          setDay(i);
                          if (window.matchMedia("(max-width:767px)").matches)
                            setProgramView("day");
                        }}
                      >
                        <span>
                          {
                            weekdays[
                              (new Date(dt + "T12:00Z").getUTCDay() + 6) % 7
                            ]
                          }
                        </span>
                        <strong>{Number(dt.slice(-2))}</strong>
                        <div className="tp-day-content">
                          {sessions.map((d) => (
                            <span className="tp-mini-workout" key={d.id}>
                              {d.name}
                              <small>{d.exercises.length} egzersiz</small>
                            </span>
                          ))}
                          {!sessions.length && (
                            <small>{rest ? "Dinlenme" : "Planlanmadı"}</small>
                          )}
                        </div>
                        <span className="tp-mobile">
                          {sessions.length
                            ? "Antrenman"
                            : rest
                              ? "Dinlenme"
                              : "Boş"}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="tp-day-editor">
                <div className="tp-inline tp-selected-heading">
                  <div>
                    <p className="tp-eyebrow">SEÇİLİ GÜN</p>
                    <h3>
                      {new Intl.DateTimeFormat("tr", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      }).format(new Date(selectedDate + "T12:00Z"))}
                    </h3>
                  </div>
                  <span className="tp-badge">{scheduled.length} antrenman</span>
                </div>
                {frozen && (
                  <p className="tp-warning">
                    Bugün ve geçmiş hedefler korunur. Düzenlemek için gelecek
                    bir gün seç.
                  </p>
                )}
                {!scheduled.length && (
                  <div className="tp-empty">
                    <h3>
                      {content.rest_dates?.includes(selectedDate)
                        ? "Dinlenme günü"
                        : "Bu gün henüz planlanmadı"}
                    </h3>
                    <p>
                      {content.rest_dates?.includes(selectedDate)
                        ? "Toparlanma için ayrılmış gün."
                        : "Bir antrenman ekle veya dinlenme günü olarak işaretle."}
                    </p>
                  </div>
                )}
                {scheduled.map((d) => (
                  <article className="tp-scheduled" key={d.id}>
                    <div className="tp-inline">
                      <div>
                        <span className="tp-eyebrow">ANTRENMAN</span>
                        <h3>{d.name}</h3>
                        <p>
                          {d.exercises.length} egzersiz ·{" "}
                          {d.exercises.reduce((s, e) => s + e.sets, 0)} set
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        disabled={frozen}
                        onClick={() => openWorkout(d)}
                      >
                        Düzenle
                      </Button>
                    </div>
                    <div className="tp-exercise-chips">
                      {d.exercises.slice(0, 4).map((e) => (
                        <span key={e.id}>
                          {catalog.find((x) => x.id === e.exercise_id)?.name} ·{" "}
                          {Number.isFinite(e.sets) ? e.sets : "—"} ×{" "}
                          {e.reps ?? e.seconds ?? e.meters}
                        </span>
                      ))}
                    </div>
                    <details className="tp-session-actions">
                      <summary>Kopyala, taşı veya kaldır</summary>
                      <div className="tp-inline">
                        <Field label="Kopyala / taşı tarihi">
                          <Input
                            type="date"
                            min={
                              editing?.athlete_id
                                ? dayDate(today, 1)
                                : content.start_date
                            }
                            max={dayDate(
                              content.start_date,
                              content.weeks * 7 - 1,
                            )}
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                          />
                        </Field>
                        {["Kopyala", "Taşı"].map((label) => (
                          <Button
                            variant="outline"
                            key={label}
                            disabled={
                              frozen ||
                              !targetDate ||
                              targetDate === selectedDate
                            }
                            onClick={() => {
                              if (
                                targetDate < content.start_date ||
                                targetDate >=
                                  dayDate(content.start_date, content.weeks * 7)
                              ) {
                                setError("Tarih program aralığında olmalı.");
                                return;
                              }
                              const next =
                                label === "Taşı"
                                  ? content.days
                                      .map((x) =>
                                        x.id === d.id
                                          ? {
                                              ...x,
                                              dates: x.dates.filter(
                                                (dt) => dt !== selectedDate,
                                              ),
                                            }
                                          : x,
                                      )
                                      .filter((x) => x.dates.length)
                                  : content.days;
                              update({
                                ...content,
                                days: [...next, cloneWorkout(d, [targetDate])],
                                rest_dates: content.rest_dates?.filter(
                                  (dt) => dt !== targetDate,
                                ),
                              });
                            }}
                          >
                            {label}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          disabled={frozen}
                          onClick={() => removeDate(d.id, selectedDate)}
                        >
                          Kaldır
                        </Button>
                      </div>
                    </details>
                  </article>
                ))}
                <details className="tp-day-ops">
                  <summary>Gün işlemleri · Çoğalt</summary>
                  <div className="tp-inline">
                    <Field label="Günü çoğaltma tarihi">
                      <Input
                        type="date"
                        min={content.start_date}
                        max={dayDate(content.start_date, content.weeks * 7 - 1)}
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                      />
                    </Field>
                    <Button
                      variant="outline"
                      disabled={
                        frozen ||
                        !targetDate ||
                        targetDate === selectedDate ||
                        (!scheduled.length &&
                          !content.rest_dates?.includes(selectedDate))
                      }
                      onClick={() => {
                        if (
                          targetDate < content.start_date ||
                          targetDate >=
                            dayDate(content.start_date, content.weeks * 7)
                        ) {
                          setError("Hedef tarih program aralığında olmalı.");
                          return;
                        }
                        if (
                          content.days.some((d) =>
                            d.dates.includes(targetDate),
                          ) ||
                          content.rest_dates?.includes(targetDate)
                        ) {
                          setError(
                            "Günü çoğaltmak için boş bir hedef gün seç.",
                          );
                          return;
                        }
                        update({
                          ...content,
                          days: [
                            ...content.days,
                            ...scheduled.map((d) =>
                              cloneWorkout(d, [targetDate]),
                            ),
                          ],
                          rest_dates: content.rest_dates?.includes(selectedDate)
                            ? [...content.rest_dates, targetDate]
                            : content.rest_dates,
                        });
                      }}
                    >
                      Günü çoğalt
                    </Button>
                  </div>
                </details>
                <div className="tp-inline tp-day-primary-actions">
                  <Button
                    variant="outline"
                    className="tp-primary"
                    disabled={frozen}
                    onClick={() => openWorkout()}
                  >
                    ＋ Antrenman ekle
                  </Button>
                  <Button
                    variant="outline"
                    disabled={frozen || !!scheduled.length}
                    onClick={() =>
                      update({
                        ...content,
                        rest_dates: content.rest_dates?.includes(selectedDate)
                          ? content.rest_dates.filter(
                              (dt) => dt !== selectedDate,
                            )
                          : [...(content.rest_dates ?? []), selectedDate],
                      })
                    }
                  >
                    {content.rest_dates?.includes(selectedDate)
                      ? "Dinlenmeyi kaldır"
                      : "Dinlenme günü"}
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                className="tp-mobile tp-open-day"
                onClick={() => setProgramView("day")}
              >
                Seçili günü düzenle →
              </Button>
            </main>
            <aside className="tp-planner-sidebar">
              <PlanningSection
                title={`Antrenman şablonları (${templates.length})`}
                className="tp-panel tp-template-section"
              >
                <p className="tp-muted">
                  Şablon eklemek bağımsız bir kopya oluşturur.
                </p>
                {templates.map((t) => (
                  <Button
                    variant="outline"
                    className="tp-template-pick"
                    key={t.id}
                    disabled={frozen}
                    onClick={() =>
                      update({
                        ...content,
                        days: [
                          ...content.days,
                          cloneWorkout(t.content, [selectedDate]),
                        ],
                        rest_dates: content.rest_dates?.filter(
                          (dt) => dt !== selectedDate,
                        ),
                      })
                    }
                  >
                    <strong>{t.content.name}</strong>
                    <small>
                      {t.content.exercises.length} egzersiz · Güne ekle ＋
                    </small>
                  </Button>
                ))}
                {!templates.length && (
                  <p className="tp-muted">
                    Henüz şablon yok. Bir antrenman oluşturup şablon olarak
                    kaydet.
                  </p>
                )}
              </PlanningSection>
              <PlanningSection
                title="Program özeti ve değişiklik notu"
                desktopOpen={false}
                className="tp-panel tp-program-summary"
              >
                <h3>Program özeti</h3>
                <p>
                  {content.weeks} hafta ·{" "}
                  {content.days.reduce((n, d) => n + d.dates.length, 0)} seans
                </p>
                <p>{content.rest_dates?.length ?? 0} dinlenme günü</p>
                <p className="tp-muted">
                  Boş günler dinlenme sayılmaz. Her hafta farklı olabilir.
                </p>
                {editing && (
                  <Field label="Değişiklik nedeni">
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={1000}
                    />
                  </Field>
                )}
              </PlanningSection>
            </aside>
          </div>
          <footer className="tp-savebar">
            <PlanningSaveState
              savedTitle="Taslak kaydedildi · Yayında değil"
              dirty={dirty}
              published={Boolean(editing && status(editing) === "published")}
              operation={saveOperation}
              failure={saveFailure}
              detail={
                saveDetail ||
                (dirty
                  ? editing && status(editing) === "published"
                    ? "Üyeler kayıtlı sürümü görür. Düzenlemelerini yayınlayarak yeni sürüm oluştur."
                    : "Program henüz kaydedilmedi. Taslağı kaydet veya hazır olduğunda yayınla."
                  : editing && status(editing) === "published"
                    ? "Program yayında. Üyelere atayabilirsin; atanmış kopyalar bağımsız kalır."
                    : "Program taslağı kayıtlı. Üyelere atamak için önce yayınla.")
              }
              retry={() =>
                void saveProgram(saveFailure?.operation === "publish")
              }
            />
            <div className="tp-save-actions">
              {!editing?.athlete_id &&
                (!editing || status(editing) !== "published") && (
                  <Button
                    variant="outline"
                    disabled={
                      busy ||
                      (!dirty && editing?.content.planning_status === "draft")
                    }
                    onClick={() => void saveProgram(false)}
                  >
                    Taslağı kaydet
                  </Button>
                )}
              {(!editing || status(editing) !== "published" || dirty) && (
                <Button
                  variant="outline"
                  className="tp-primary"
                  disabled={busy}
                  onClick={requestPublish}
                >
                  {editing?.athlete_id
                    ? "Gelecek planı kaydet"
                    : editing && status(editing) === "published"
                      ? "Güncellemeyi yayınla"
                      : "Yayınla"}
                </Button>
              )}
            </div>
          </footer>
        </>
      ) : mode === "workouts" ? (
        <>
          <header className="tp-heading">
            <div>
              <p className="tp-eyebrow">ANTRENMAN KÜTÜPHANESİ</p>
              <h2>Antrenman kütüphanesi</h2>
              <p>
                Antrenman şablonlarını oluştur ve programındaki günlere ekle.
              </p>
            </div>
            <HeaderAction>
              <Button
                variant="outline"
                className="tp-primary"
                onClick={() => openWorkout()}
              >
                ＋ Antrenman oluştur
              </Button>
            </HeaderAction>
          </header>
          <div className="nfc-workout-tools">
            <Field label="Antrenman ara">
              <Input
                type="search"
                value={templateQuery}
                onChange={(e) => setTemplateQuery(e.target.value)}
                placeholder="Şablon adına göre ara…"
              />
            </Field>
            <Field label="Egzersiz sayısı">
              <NativeSelect
                value={templateSize}
                onChange={(e) => setTemplateSize(e.target.value)}
              >
                <option value="">Tümü</option>
                <option value="short">1–3 egzersiz</option>
                <option value="long">4+ egzersiz</option>
              </NativeSelect>
            </Field>
            <span className="tp-muted">{templates.length} şablon</span>
          </div>
          <DataTable<Template>
            className="nfc-workouts-table"
            label="Antrenman şablonları"
            columns={[
              {
                accessorFn: (t) => t.content.name,
                id: "name",
                header: "Antrenman",
                cell: ({ row: { original: t } }) => (
                  <div>
                    <h3>{t.content.name}</h3>
                    <small>Antrenman şablonu · Sürüm {t.version}</small>
                  </div>
                ),
              },
              {
                accessorFn: (t) => t.content.exercises.length,
                id: "exercises",
                header: "İçerik",
                cell: ({ row: { original: t } }) => (
                  <span>
                    {t.content.exercises.length} egzersiz ·{" "}
                    {t.content.exercises.reduce(
                      (n, e) => n + (Number.isFinite(e.sets) ? e.sets : 0),
                      0,
                    )}{" "}
                    set
                  </span>
                ),
              },
              {
                id: "action",
                header: "İşlem",
                cell: ({ row: { original: t } }) => (
                  <Button
                    variant="outline"
                    onClick={() => openWorkout(t.content, t)}
                  >
                    Antrenmanı düzenle
                  </Button>
                ),
              },
            ]}
            data={templates.filter(
              (t) =>
                exerciseSearchText(t.content.name).includes(
                  exerciseSearchText(templateQuery),
                ) &&
                (!templateSize ||
                  (templateSize === "short"
                    ? t.content.exercises.length <= 3
                    : t.content.exercises.length >= 4)),
            )}
          />
          {!templates.length && (
            <div className="tp-empty">
              <h3>İlk antrenmanını oluştur</h3>
              <p>
                Egzersiz hedeflerini bir kez belirle, farklı programlarda
                kullan.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <header className="tp-heading">
            <div>
              <p className="tp-eyebrow">PROGRAM KÜTÜPHANESİ</p>
              <h2>Program kütüphanesi</h2>
              <p>Çok haftalı programlar, üyelere özel bağımsız planlar.</p>
            </div>
            <HeaderAction>
              <Button
                variant="outline"
                className="tp-primary"
                disabled={busy}
                onClick={() => open()}
              >
                ＋ Program oluştur
              </Button>
            </HeaderAction>
          </header>
          <div className="tp-panel tp-library-tools">
            <Field label="Program ara">
              <Input
                placeholder="Program adına göre ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <PlanningSection
              title={`Filtreler${[goal, level, duration, filter].filter(Boolean).length ? " · " + [goal, level, duration, filter].filter(Boolean).length : ""}`}
              desktopOpen={false}
              className="tp-more-filters"
            >
              <div className="tp-filters-body">
                <Field label="Amaç filtresi">
                  <NativeSelect
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  >
                    <option value="">Tüm amaçlar</option>
                    {[
                      ...new Set(
                        plans.map((p) => p.content.goal).filter(Boolean),
                      ),
                    ].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Seviye filtresi">
                  <NativeSelect
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="">Tüm seviyeler</option>
                    {Object.entries(levels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Süre filtresi">
                  <NativeSelect
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  >
                    <option value="">Tüm süreler</option>
                    {[...new Set(plans.map((p) => p.content.weeks))]
                      .sort((a, b) => a - b)
                      .map((w) => (
                        <option key={w} value={w}>
                          {w} hafta
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
                <Field label="Durum filtresi">
                  <NativeSelect
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">Aktif kütüphane</option>
                    {Object.entries(statusLabel).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setGoal("");
                  setLevel("");
                  setDuration("");
                  setFilter("");
                }}
              >
                Filtreleri temizle
              </Button>
            </PlanningSection>
          </div>
          <div className="tp-inline">
            <h3>{filtered.length} program</h3>
            <span className="tp-muted">Şablonlar ve atanmış programlar</span>
          </div>
          <DataTable<Plan>
            className="nfc-programs-table"
            rowClassName={() => "tp-program-card"}
            label="Program listesi"
            columns={[
              {
                accessorFn: (p) => p.content.name,
                id: "name",
                header: "Program",
                cell: ({ row: { original: p } }) => (
                  <div>
                    <h3 title={p.content.goal || undefined}>
                      {p.content.name}
                    </h3>
                    <small>
                      {p.athlete_id ? "Üyeye özel" : "Program şablonu"} ·{" "}
                      {levels[p.content.difficulty]}
                    </small>
                  </div>
                ),
              },
              {
                accessorFn: (p) => status(p),
                id: "status",
                header: "Durum",
                cell: ({ row: { original: p } }) => (
                  <span className={"tp-badge " + status(p)}>
                    {statusLabel[status(p)]}
                  </span>
                ),
              },
              {
                accessorFn: (p) => p.content.weeks,
                id: "weeks",
                header: "Plan",
                cell: ({ row: { original: p } }) => (
                  <div>
                    {p.content.weeks} hafta ·{" "}
                    {Math.round(
                      (p.content.days.reduce((n, d) => n + d.dates.length, 0) /
                        p.content.weeks) *
                        10,
                    ) / 10}{" "}
                    seans/hafta
                    <small>
                      {
                        new Set(
                          p.content.days.flatMap((d) =>
                            d.exercises.map((e) => e.exercise_id),
                          ),
                        ).size
                      }{" "}
                      farklı egzersiz
                    </small>
                  </div>
                ),
              },
              {
                id: "action",
                header: "İşlemler",
                cell: ({ row: { original: p } }) => (
                  <div className="nfc-list-actions">
                    <Button variant="outline" onClick={() => open(p)}>
                      Düzenle
                    </Button>
                    {!p.athlete_id && status(p) === "published" && (
                      <Button
                        variant="outline"
                        className="tp-primary"
                        onClick={() => assignStart(p)}
                      >
                        Üyelere ata
                      </Button>
                    )}
                    <RowActions
                      label={p.content.name + " işlemleri"}
                      items={[
                        { label: "Çoğalt", onSelect: () => open(p, true) },
                        {
                          label: "Sürüm geçmişi",
                          disabled: busy,
                          onSelect: () => void showHistory(p),
                        },
                        ...(!p.athlete_id
                          ? [
                              {
                                label:
                                  status(p) === "archived"
                                    ? "Geri yükle"
                                    : "Arşivle",
                                disabled: busy,
                                onSelect: () => {
                                  if (
                                    status(p) === "archived" ||
                                    window.confirm(
                                      `“${p.content.name}” arşivlensin mi? Atanmış üye kopyaları korunur.`,
                                    )
                                  )
                                    void archive(p);
                                },
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                ),
              },
            ]}
            data={filtered}
          />
          {!filtered.length && (
            <div className="tp-empty">
              <h3>Program bulunamadı</h3>
              <p>Filtreleri değiştir veya ilk programını oluştur.</p>
            </div>
          )}
          <details className="tp-panel tp-starters">
            <summary>Örnek program taslakları</summary>
            <div className="tp-inline">
              <div>
                <p className="tp-eyebrow">BAŞLANGIÇ NOKTALARI</p>
                <h3>Örnek program taslakları</h3>
              </div>
              <span className="tp-badge">
                Örnek içerik · Üye verisi değildir
              </span>
            </div>
            <p className="tp-muted">
              Kopyalayarak başla; düzenleyip kaydetmeden kütüphanene eklenmez.
            </p>
            <div className="tp-grid">
              {starterPrograms.map((p) => (
                <Button
                  variant="outline"
                  className="tp-starter"
                  key={p.id}
                  onClick={() => {
                    open();
                    setContent({
                      ...starterContent(p.id, today, timezone, () =>
                        crypto.randomUUID(),
                      ),
                      planning_status: "draft",
                    });
                    setDirty(true);
                  }}
                >
                  <strong>{p.name}</strong>
                  <small>Örnek taslağı aç ↗</small>
                </Button>
              ))}
            </div>
          </details>
        </>
      )}
      {history && (
        <Dialog
          title={history.plan.content.name + " · Sürüm geçmişi"}
          close={() => setHistory(null)}
        >
          {history.versions.map((v) => (
            <section key={v.id} className="tp-preview-week">
              <h4>
                Sürüm {v.version} · {v.actor_role} · {v.review_status}
              </h4>
              <p>{v.reason || "İlk kayıt"}</p>
              <details>
                <summary>Hedefleri göster</summary>
                {v.content.days.map((d: PlanDay) => (
                  <div key={d.id}>
                    <strong>
                      {d.name} · {d.dates.join(", ")}
                    </strong>
                    {d.exercises.map((e) => (
                      <p key={e.id}>
                        {catalog.find((x) => x.id === e.exercise_id)?.name}:{" "}
                        {Number.isFinite(e.sets) ? e.sets : "—"} ×{" "}
                        {e.reps ?? e.seconds ?? e.meters}
                      </p>
                    ))}
                  </div>
                ))}
              </details>
              {v.previous && (
                <details>
                  <summary>Önceki program hedefleri</summary>
                  {v.previous.days.map((d: PlanDay) => (
                    <div key={d.id}>
                      <strong>{d.name}</strong>
                      {d.exercises.map((e) => (
                        <p key={e.id}>
                          {catalog.find((x) => x.id === e.exercise_id)?.name}:{" "}
                          {Number.isFinite(e.sets) ? e.sets : "—"} ×{" "}
                          {e.reps ?? e.seconds ?? e.meters}
                        </p>
                      ))}
                    </div>
                  ))}
                </details>
              )}
              {history.plan.athlete_id && (
                <div className="tp-inline">
                  <Button variant="outline" onClick={() => comment(v.id)}>
                    Programa yorum yaz
                  </Button>
                  {v.review_status === "unreviewed" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api(
                            "/plans/" +
                              history.plan.id +
                              "/versions/" +
                              v.version +
                              "/review",
                            {},
                            "POST",
                          );
                          setHistory({
                            ...history,
                            versions: await api<any[]>(
                              "/plans/" + history.plan.id + "/versions",
                            ),
                          });
                          await reload();
                        })
                      }
                    >
                      İncelendi olarak işaretle
                    </Button>
                  )}
                </div>
              )}
            </section>
          ))}
        </Dialog>
      )}
      {pendingRemoval && workout && (
        <Dialog title="Egzersizi kaldır?" close={() => setPendingRemoval(null)}>
          <h3>
            {workout.exercises.find((e) => e.id === pendingRemoval) &&
              exerciseName(
                workout.exercises.find((e) => e.id === pendingRemoval)!,
              )}
          </h3>
          <p>
            Egzersiz ve hedefleri bu antrenman taslağından kaldırılacak.
            Kaydedilene kadar şablon ve üye geçmişi değişmez.
          </p>
          <div className="tp-inline">
            <Button variant="outline" onClick={() => setPendingRemoval(null)}>
              Vazgeç
            </Button>
            <Button
              variant="outline"
              className="tp-danger"
              onClick={removeExercise}
            >
              Kaldırmayı onayla
            </Button>
          </div>
        </Dialog>
      )}
      {publishReview && content && coverage && (
        <Dialog
          title="Yayınlamadan önce takvimi kontrol et"
          close={() => !busy && setPublishReview(false)}
        >
          <p>
            <strong>{content.name}</strong> · {content.weeks} hafta
          </p>
          {coverage.emptyWeeks.length > 0 && (
            <p className="tp-warning" role="status">
              Tamamen boş haftalar: {coverage.emptyWeeks.join(", ")}. Bu
              haftalarda antrenman veya dinlenme günü tanımlı değil.
            </p>
          )}
          <p>
            {coverage.unconfiguredDates.length} gün henüz planlanmadı. Boş
            günler dinlenme günü olarak gösterilmez.
          </p>
          <div className="tp-coverage-list">
            {coverage.weeks.map((w) => (
              <div className="tp-coverage-week" key={w.week}>
                <div>
                  <strong>{w.week}. hafta</strong>
                  <small>
                    {w.trainingDays} antrenman günü · {w.restDays} dinlenme ·{" "}
                    {w.unconfiguredDates.length} planlanmamış
                  </small>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setWeek(w.week - 1);
                    setDay(0);
                    setPublishReview(false);
                    requestAnimationFrame(() =>
                      calendarRef.current?.scrollIntoView({ block: "start" }),
                    );
                  }}
                >
                  {w.week}. haftayı düzenle
                </Button>
                {!!w.unconfiguredDates.length && (
                  <details className="tp-day-issues">
                    <summary>
                      Planlanmamış günleri göster ({w.unconfiguredDates.length})
                    </summary>
                    <div>
                      {w.unconfiguredDates.map((date) => (
                        <Button
                          variant="outline"
                          key={date}
                          onClick={() => goToDate(date)}
                        >
                          {new Intl.DateTimeFormat("tr", {
                            day: "numeric",
                            month: "short",
                            weekday: "short",
                            timeZone: "UTC",
                          }).format(new Date(date + "T12:00Z"))}{" "}
                          · Düzenle
                        </Button>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
          <label className="tp-check">
            <Input
              type="checkbox"
              checked={acknowledgedGaps}
              onChange={(e) => setAcknowledgedGaps(e.target.checked)}
            />
            Boş hafta ve günleri inceledim; bu takvimle yayınlamayı onaylıyorum.
          </label>
          {error && (
            <p role="alert" className="tp-alert">
              {error}
            </p>
          )}
          <div className="tp-review-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPublishReview(false)}
            >
              Takvime dön
            </Button>
            <Button
              variant="outline"
              className="tp-primary"
              disabled={busy || !acknowledgedGaps}
              onClick={() => void saveProgram(true)}
            >
              Bu takvimle yayınla
            </Button>
          </div>
        </Dialog>
      )}
      {preview && content && (
        <Dialog title="Üye program önizlemesi" close={() => setPreview(false)}>
          {dirty && (
            <p className="tp-warning">
              Kaydedilmemiş düzenlemelerin önizlemesi. Üyelerin mevcut
              atamalarına uygulanmadı.
            </p>
          )}
          <p>
            {content.name} · {content.weeks} hafta
          </p>
          {Array.from({ length: content.weeks }, (_, w) => (
            <details className="tp-preview-week" key={w} open={w === week}>
              <summary>{w + 1}. hafta</summary>
              {Array.from({ length: 7 }, (_, i) => {
                const dt = dayDate(content.start_date, w * 7 + i);
                return (
                  <div key={dt}>
                    <strong>{dt}</strong>
                    <span>
                      {content.days
                        .filter((d) => d.dates.includes(dt))
                        .map((d) => d.name)
                        .join(" + ") ||
                        (content.rest_dates?.includes(dt)
                          ? "Dinlenme"
                          : "Planlanmadı")}
                    </span>
                  </div>
                );
              })}
            </details>
          ))}
        </Dialog>
      )}
      {assign && (
        <Dialog
          title={
            assignmentStage === "confirm"
              ? "Atamayı son kez kontrol et"
              : "Programı üyelere ata"
          }
          close={() => !busy && setAssign(null)}
        >
          <span className="tp-badge">Yayında · Sürüm {assign.version}</span>
          <h3>{assign.content.name}</h3>
          <p>
            {assign.content.weeks} hafta ·{" "}
            {assign.content.days.reduce((n, d) => n + d.dates.length, 0)} seans.
            Her üyeye bağımsız kopya oluşturulur.
          </p>
          {assignmentStage === "select" ? (
            <>
              <Field label="Başlangıç tarihi">
                <Input
                  type="date"
                  value={start}
                  disabled={busy}
                  onChange={(e) => {
                    setStart(e.target.value);
                    resetAssignment();
                  }}
                />
              </Field>
              <Field label="Üye ara">
                <Input
                  type="search"
                  value={memberQuery}
                  placeholder="İsimle ara…"
                  onChange={(e) => setMemberQuery(e.target.value)}
                />
              </Field>
              <div className="tp-member-picks">
                {assignmentMemberError && <p role="alert">{assignmentMemberError}</p>}
                {assignmentMembers
                  .filter(
                    (m) =>
                      m.tenant_id === tenantId,
                  )
                  .map((m) => (
                    <label key={m.id}>
                      <Input
                        type="checkbox"
                        checked={selected.includes(m.athlete_id)}
                        disabled={busy}
                        onChange={(e) => {
                          setSelected(
                            e.target.checked
                              ? [...selected, m.athlete_id]
                              : selected.filter((id) => id !== m.athlete_id),
                          );
                          resetAssignment();
                        }}
                      />
                      <span>
                        <strong>{m.name}</strong>
                        <small>
                          {m.active_plans
                            ? `${m.active_plans} aktif program · Tarihler kontrolden geçirilecek`
                            : m.upcoming_plans ? `${m.next_start_date} · Başlaması bekleniyor` : "Program bekliyor"}
                        </small>
                      </span>
                    </label>
                  ))}
              </div>
            </>
          ) : (
            <>
              <div className="tp-assignment-summary">
                <strong>Atama tarihleri ve üyeler</strong>
                <p>
                  Başlangıç: {start} · Bitiş:{" "}
                  {dayDate(start, assign.content.weeks * 7 - 1)}
                </p>
                <p>Üyeler: {impacts.map((m) => m.name).join(", ")}</p>
              </div>
              <h4>Mevcut atamalar ve etkisi</h4>
              {impacts.map((m) => (
                <section className="tp-member-impact" key={m.id}>
                  <h4>{m.name}</h4>
                  {!m.plans.length && <p>Mevcut yayınlanmış programı yok.</p>}
                  {m.plans.map((p) => (
                    <div
                      key={p.id}
                      className={
                        p.overlaps
                          ? "tp-impact-conflict"
                          : "tp-impact-preserved"
                      }
                    >
                      <strong>{p.name}</strong>
                      <small>
                        {p.start} — {p.end}
                      </small>
                      <span>
                        {p.overlaps
                          ? "Tarih çakışması · İki program aynı dönemde görünecek"
                          : "Tarih çakışmıyor · Atama korunacak"}
                      </span>
                    </div>
                  ))}
                </section>
              ))}
              {!!conflicting.length && (
                <>
                  <p className="tp-warning" role="alert">
                    {conflicting.length} mevcut atamayla tarih çakışması var.
                    Birlikte eklenirse üye iki programın seanslarını da görecek.
                    Mevcut hedefler ve tamamlanmış kayıtlar değişmeyecek.
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy || impactLoading}
                    onClick={() => {
                      const next = impacts
                        .flatMap((m) => m.plans.map((p) => p.endExclusive))
                        .sort()
                        .at(-1);
                      if (next) {
                        setStart(next);
                        resetAssignment();
                        setNotice(
                          "Başlangıç mevcut programlardan sonraya taşındı. Özeti yeniden incele.",
                        );
                      }
                    }}
                  >
                    Mevcut programlardan sonra başlat
                  </Button>
                  <label className="tp-check">
                    <Input
                      type="checkbox"
                      checked={overlap}
                      disabled={busy}
                      onChange={(e) => {
                        setOverlap(e.target.checked);
                        assignmentId.current = crypto.randomUUID();
                      }}
                    />
                    Çakışan programları koruyarak bu programı ayrıca eklemeyi
                    onaylıyorum.
                  </label>
                </>
              )}
              <p className="tp-muted">
                Bu işlem mevcut programları değiştirmez veya silmez. Şablondaki
                sonraki değişiklikler de bu üye kopyasını kendiliğinden
                güncellemez.
              </p>
            </>
          )}
          {impactLoading && (
            <p role="status">
              Yetkili üyelerin mevcut atamaları kontrol ediliyor…
            </p>
          )}
          {impactError && (
            <p className="tp-alert" role="alert">
              {impactError} · Atamalar yüklenmeden onay verilemez.
            </p>
          )}
          {notice && (
            <p className="tp-notice" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="tp-alert" role="alert">
              {error}
            </p>
          )}
          <div className="tp-review-actions">
            {assignmentStage === "select" ? (
              <Button
                variant="outline"
                className="tp-primary"
                disabled={
                  busy ||
                  impactLoading ||
                  !!impactError ||
                  noImpactData ||
                  !selected.length ||
                  !start
                }
                onClick={() => {
                  setError("");
                  setAssignmentStage("confirm");
                }}
              >
                Atama özetini incele
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setAssignmentStage("select");
                    setOverlap(false);
                  }}
                >
                  Seçimi düzenle
                </Button>
                <Button
                  variant="outline"
                  className="tp-primary"
                  disabled={
                    busy ||
                    impactLoading ||
                    !!impactError ||
                    noImpactData ||
                    !selected.length ||
                    !start ||
                    (!!conflicting.length && !overlap)
                  }
                  onClick={() =>
                    void run(async () => {
                      await api("/plans/" + assign.id + "/assign", {
                        request_id: assignmentId.current,
                        athlete_ids: selected,
                        start_date: start,
                        allow_overlap: overlap,
                      });
                      await reload();
                      setAssign(null);
                      setNotice(
                        "Program seçilen üyelere atandı. Üye programında seçilen tarihlerde görünür.",
                      );
                    })
                  }
                >
                  {busy
                    ? "Atanıyor…"
                    : `${selected.length} üyeye atamayı onayla`}
                </Button>
              </>
            )}
          </div>
          {!!selected.length && (
            <Button
              variant="outline"
              disabled={busy || impactLoading}
              onClick={() => {
                setOverlap(false);
                setImpactRefresh((n) => n + 1);
              }}
            >
              Güncel atamaları yeniden kontrol et
            </Button>
          )}
        </Dialog>
      )}
    </div>
  );
}
