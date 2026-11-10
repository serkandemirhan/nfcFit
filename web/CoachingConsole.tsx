import TrainerAssignmentHistory from "./TrainerAssignmentHistory";
import TrainerCancelAssignment from "./TrainerCancelAssignment";
import TrainerQuickAssignment from "./TrainerQuickAssignment";
import TrainerMemberSwitcher from "./TrainerMemberSwitcher";
import {attentionReasons,type TrainerMember,type MemberPage,type MemberView} from "./lib/trainer-workspace";
import TrainerAdminLayout from "./TrainerAdminLayout";
import TrainerExerciseLibrary from "./TrainerExerciseLibrary";
import { DataTable } from "./components/trainer-ui/data-table";
import {
  Button,
  Badge,
  Input,
  Label,
  NativeSelect,
} from "./components/trainer-ui/primitives";
import { toast } from "sonner";
import { recordedSetProgress } from "./lib/trainer-planning";
import TrainerPlanning from "./TrainerPlanning";
import { consoleTransport } from "../mobile/nfc-task-tracker/lib/console-transport";
import {
  exercisePerformance,
  zonedDate,
  lastFinishedMonday,
} from "../mobile/nfc-task-tracker/lib/coaching-performance";
import React, { useEffect, useRef, useState } from "react";
import type {
  CoachingOverview,
  Workout,
  Plan,
  Exercise,
} from "../mobile/nfc-task-tracker/lib/coaching-types";
const input =
  "min-h-12 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-white";
const action =
  "min-h-12 rounded-xl bg-lime-300 px-4 py-2 font-bold text-slate-950 disabled:opacity-40";
const secondary =
  "min-h-12 rounded-xl border border-slate-600 px-4 py-2 text-slate-100";
const card = "space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5";
const date = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="block space-y-2 text-sm text-slate-300">
      <Label htmlFor={id}>{label}</Label>
      {React.cloneElement(children as React.ReactElement<{ id?: string }>, {
        id,
      })}
    </div>
  );
}
type Summary = TrainerMember;
export default function CoachingConsole({
  token,
  tenantId,
}: {
  token: string;
  tenantId: string;
}) {
  const generation = useRef(0);
  const messageRequest = useRef<{ id: string; fingerprint: string } | null>(
    null,
  );
  const [data, setData] = useState<CoachingOverview | null>(null);
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [memberCache,setMemberCache] = useState<Record<string,Summary>>({});
  const [memberResult,setMemberResult] = useState<MemberPage|null>(null);
  const [memberLoading,setMemberLoading] = useState(false);
  const [memberError,setMemberError]=useState("");
  const [memberPage,setMemberPage] = useState(1);
  const [memberPageSize,setMemberPageSize] = useState(10);
  const [memberSort,setMemberSort] = useState({id:"name",desc:false});
  const [refreshTick,setRefreshTick] = useState(0);
  const [memberView,setMemberView] = useState<MemberView>("program");
  const [selectedWorkout,setSelectedWorkout] = useState("");
  const [selectedMembers,setSelectedMembers] = useState<string[]>([]);
  const [cancelAssignment,setCancelAssignment]=useState<Plan|null>(null);
  const [workoutResult,setWorkoutResult]=useState<{items:Workout[];total:number;page:number;summary:{completed_sessions:number}}|null>(null);
  const [historyPage,setHistoryPage]=useState(1),[historySize,setHistorySize]=useState(()=>window.innerWidth<768?5:10),[historyLoading,setHistoryLoading]=useState(false),[historyError,setHistoryError]=useState("");
  const [quickAssign,setQuickAssign] = useState<Summary[]|null>(null);
  const [athlete, setAthlete] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [createSignal, setCreateSignal] = useState(0);
  const [requestedPlanId, setRequestedPlanId] = useState("");
  const [workoutRequest, setWorkoutRequest] = useState<{
    id: string;
    exerciseId?: string;
  } | null>(null);
  const [editorFocused, setEditorFocused] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [attention, setAttention] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [reportFilter, setReportFilter] = useState("");
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [body, setBody] = useState("");
  const [context, setContext] = useState<{ type: string; id: string } | null>(
    null,
  );
  const [week, setWeek] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7);
    return date(d);
  });
  useEffect(() => {
    if (data?.timezone) setWeek(lastFinishedMonday(data.timezone));
  }, [data?.timezone, athlete]);
  const api = async <T,>(
    path: string,
    payload?: unknown,
    method?: string,
  ): Promise<T> => {
    return consoleTransport(
      `${(import.meta.env.VITE_CONSOLE_API_URL ?? "").replace(/\/+$/, "")}/api/console/coaching${path}`,
      {
        method: method ?? (payload ? "POST" : "GET"),
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      },
      async (response) => {
        if (!response.ok) {
          const value = await response.json().catch(() => null);
          throw new Error(
            typeof value?.detail === "string"
              ? value.detail
              : "İşlem tamamlanamadı. Alanları kontrol edip yeniden deneyin.",
          );
        }
        return await response.json();
      },
    );
  };

  const emptyOverview:CoachingOverview={account_id:"",athlete_id:"",links:[],plans:[],workouts:[],reports:[],messages:[],notifications:[],wellness:[],consents:[]};
  const needsOverview=!!athlete || tab==="plans" || tab==="workouts";
  const cacheMembers=(rows:Summary[])=>setMemberCache(old=>({...old,...Object.fromEntries(rows.map(m=>[m.athlete_id,m]))}));
  const refresh = async () => {
    const epoch=generation.current;
    const overview=needsOverview?await api<CoachingOverview>("/overview"+(athlete?"?include_workouts=false&athlete_id="+athlete:"")):emptyOverview;
    if(epoch!==generation.current)return;
    setData(overview);setRefreshTick(n=>n+1);
    if(athlete){const selected=await api<MemberPage>("/trainer/members?"+new URLSearchParams({tenant_id:tenantId,athlete_id:athlete}));if(epoch===generation.current)cacheMembers(selected.items);}
  };
  useEffect(()=>{
    let live=true; generation.current++; setError("");
    if(!needsOverview){setData(emptyOverview);setBusy(false);return;}
    setData(null);setBusy(true);
    api<CoachingOverview>("/overview"+(athlete?"?include_workouts=false&athlete_id="+athlete:"")).then(d=>{if(live)setData(d)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setBusy(false)});
    return()=>{live=false};
  },[token,athlete,tenantId,needsOverview]);
  useEffect(()=>{if(!athlete)return;let live=true;api<MemberPage>("/trainer/members?"+new URLSearchParams({tenant_id:tenantId,athlete_id:athlete})).then(d=>{if(live)cacheMembers(d.items)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[athlete,tenantId,token]);
  useEffect(()=>{let live=true;api<Exercise[]>("/library").then(d=>{if(live)setCatalog(d)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[token,tenantId]);
  useEffect(()=>{
    let live=true;setMemberLoading(true);setMemberError("");
    const timer=setTimeout(()=>{
      const params=new URLSearchParams({tenant_id:tenantId,q:search,page:String(memberPage),page_size:String(tab==="dashboard"?5:memberPageSize),review_filter:reviewFilter,attention:String(attention||tab==="attention"),sort:tab==="attention"?"attention":({completion_rate:"completion",active_plans:"programs",attention:"attention"}[memberSort.id]??"name"),direction:tab==="attention"?"desc":memberSort.desc?"desc":"asc"});
      void api<MemberPage>("/trainer/members?"+params).then(d=>{if(live){setMemberResult(d);setSummaries(d.items);cacheMembers(d.items);if(d.page!==memberPage)setMemberPage(d.page)}}).catch(e=>{if(live){setMemberError(e.message);setSummaries([])}}).finally(()=>{if(live)setMemberLoading(false)});
    },search?250:0);
    return()=>{live=false;clearTimeout(timer)};
  },[token,tenantId,search,reviewFilter,attention,memberPage,memberPageSize,memberSort,tab,refreshTick]);
  const openMember=(m:Summary,view:MemberView="program",destination="athletes")=>{cacheMembers([m]);setAthlete(m.athlete_id);setMemberView(view);setSelectedWorkout("");setContext(null);setBody("");setTab(destination);};
  const actOnMember=(m:Summary,view:MemberView|"messages"|"reports"|"assign")=>{if(view==="assign")setQuickAssign([m]);else if(view==="messages")openMember(m,"program","messages");else if(view==="reports")openMember(m,"progress","reports");else openMember(m,view);};
  const perform = async (
    fn: () => Promise<unknown>,
    message = "Değişiklik kaydedildi.",
  ) => {
    if (busy) return;
    const epoch = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (epoch !== generation.current) return;
      await refresh();
      setNotice(message);
    } catch (e) {
      if (epoch === generation.current) setError((e as Error).message);
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  };
  useEffect(()=>{setHistoryPage(1)},[athlete,from,until,planFilter,stateFilter]);
  useEffect(()=>{
    if(!athlete||!["progress","history"].includes(memberView)||!["athletes","reports"].includes(tab))return;
    let live=true;setHistoryLoading(true);setHistoryError("");setWorkoutResult(null);
    const params=new URLSearchParams({tenant_id:tenantId,athlete_id:athlete,page:String(memberView==="history"?historyPage:1),page_size:String(memberView==="history"?historySize:50)});
    if(from)params.set("from_date",from);if(until)params.set("until",until);if(planFilter)params.set("plan_id",planFilter);if(stateFilter)params.set("state",stateFilter);
    if(memberView==="progress"&&selectedWorkout)params.set("workout_id",selectedWorkout);
    api<NonNullable<typeof workoutResult>>("/trainer/workouts?"+params).then(d=>{if(live){setWorkoutResult(d);if(memberView==="history"&&d.page!==historyPage)setHistoryPage(d.page)}}).catch(e=>{if(live){setHistoryError(e.message);setWorkoutResult(null)}}).finally(()=>{if(live)setHistoryLoading(false)});
    return()=>{live=false};
  },[athlete,tenantId,token,memberView,tab,historyPage,historySize,from,until,planFilter,stateFilter,selectedWorkout,refreshTick]);
  const filteredWorkouts = (workoutResult?.items ?? []).filter(
    (w) =>
      (!tenantId ||
        data?.plans.some(
          (p) => p.id === w.plan_id && p.tenant_id === tenantId,
        )) &&
      (!from || w.scheduled_date >= from) &&
      (!until || w.scheduled_date <= until) &&
      (!planFilter || w.plan_id === planFilter) &&
      (!stateFilter || w.state === stateFilter),
  );
  const performance = exercisePerformance(
    filteredWorkouts,
    data?.timezone ?? "Europe/Istanbul",
  );
  const selectedPerformance =
    performance.find((s) => s.id === exerciseFilter) ?? performance[0];
  const performanceDays = selectedPerformance?.days.slice(-14) ?? [];
  const usesVolume = performanceDays.some((d) => d.volume != null);
  const performanceMax = Math.max(
    1,
    ...performanceDays.map((d) => (usesVolume ? (d.volume ?? 0) : d.sets)),
  );
  const plans = (data?.plans ?? []).filter(
    (p) => !tenantId || p.tenant_id === tenantId,
  );
  const memberToday = zonedDate(
    new Date(),
    data?.timezone ?? "Europe/Istanbul",
  );
  const selectedMember=memberCache[athlete];
  const chosenLink = data?.links.find(
    (l) =>
      l.athlete_id === athlete &&
      l.trainer_id === data.account_id &&
      (!tenantId || l.tenant_id === tenantId),
  );
  const navigate = (key: string) => {
    if (!window.dispatchEvent(new Event("trainer-leave", { cancelable: true })))
      return;
    if (key === tab && (key === "plans" || key === "workouts"))
      window.dispatchEvent(new Event("trainer-library"));
    if (["dashboard","attention","athletes"].includes(key)) {setAthlete("");setMemberPage(1);setSearch("");setReviewFilter("");setAttention(false);}
    if(key==="reports")setMemberView("progress");
    setTab(key);
  };
  useEffect(() => {
    if (notice) toast.success(notice);
  }, [notice]);
  return (
    <TrainerAdminLayout
      tab={tab}
      navigate={navigate}
      busy={busy}
      refresh={() => void perform(refresh, "Veriler yenilendi.")}
      editor={editorFocused}
      primaryAction={
        tab === "dashboard" ? (
          <Button
            className={action}
            onClick={() => {
              setAthlete("");
              setTab("plans");
              setCreateSignal((n) => n + 1);
            }}
          >
            ＋ Program oluştur
          </Button>
        ) : undefined
      }
    >
      <section
        className="trainer-area space-y-5"
        data-editor-open={editorFocused}
        aria-label="Antrenör çalışma alanı"
      >
        {error && (
          <p role="alert" className="rounded-xl bg-red-950 p-4 text-red-200">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-lime-200">
            {notice}
          </p>
        )}
        {busy && (
          <p role="status" className="text-slate-400">
            Yükleniyor…
          </p>
        )}
        {selectedMember && athlete && tab!=="plans"&&tab!=="workouts"&&<TrainerMemberSwitcher current={selectedMember} tenantId={tenantId} api={api} select={m=>{if(m)openMember(m,memberView,tab);else setAthlete("");}}/>}
        {data &&
          (tab === "dashboard" || tab === "athletes" || tab === "reports" || tab === "attention") && (
            <>
              {tab === "dashboard" && (
                <>
                  <div className="trainer-kpis">
                    {[
                      ["Atanmış üye",memberResult?.stats.assigned??"…",()=>{setTab("athletes");setAttention(false);setReviewFilter("");setMemberPage(1);}],
                      ["Programı olan",memberResult?.stats.with_program??"…",()=>{setTab("athletes");setAttention(false);setReviewFilter("");setMemberPage(1);}],
                      ["Program bekleyen",memberResult?.stats.needs_program??"…",()=>{setTab("attention");setReviewFilter("needs_program");setMemberPage(1);}],
                      ["İnceleme bekleyen",memberResult?.stats.attention??"…",()=>{setTab("attention");setReviewFilter("");setMemberPage(1);}],
                    ].map(([label, value, click]) => (
                      <Button
                        variant="outline"
                        key={String(label)}
                        onClick={click as () => void}
                      >
                        <strong>{value as number}</strong>
                        <span>{label as string} ↗</span>
                      </Button>
                    ))}
                  </div>
                  <details className="nfc-overview-secondary">
                    <summary>Son antrenmanlar ve program kısayolları</summary>
                    <div className="nfc-overview-lists">
                      <article className={card}>
                        <h3 className="text-lg font-bold">
                          Son tamamlanan antrenmanlar
                        </h3>
                        {(memberResult?.recent_activity??[])
                          .map(({name,athlete_id,workout})=>({a:{name,athlete_id},w:workout}))
                          .map(({ a, w }) => (
                            <Button
                              variant="outline"
                              key={w.id}
                              className={secondary + " nfc-overview-row"}
                              onClick={() => {
                                setAthlete(a.athlete_id);
                                setMemberView("progress");setSelectedWorkout(w.id);
                                setTab("athletes");
                              }}
                            >
                              <span>
                                <strong>{a.name}</strong>
                                <small>
                                  {w.snapshot.name} · {w.scheduled_date}
                                </small>
                              </span>
                              <span>
                                {
                                  w.actual.sets.filter(
                                    (s) => s.status === "completed",
                                  ).length
                                }{" "}
                                set ↗
                              </span>
                            </Button>
                          ))}
                        {!(memberResult?.recent_activity?.length) && (
                          <p className="text-slate-400">
                            Henüz tamamlanmış antrenman yok.
                          </p>
                        )}
                      </article>
                      <article className={card}>
                        <h3 className="text-lg font-bold">
                          Program kütüphanesi
                        </h3>
                        {!plans.length&&<Button variant="outline" onClick={()=>setTab("plans")}>Program kütüphanesini aç →</Button>}
                        {plans
                          .filter(
                            (p) =>
                              !p.athlete_id &&
                              (p.content.planning_status ?? "published") !==
                                "archived",
                          )
                          .slice(0, 3)
                          .map((p) => (
                            <Button
                              variant="outline"
                              className={secondary + " nfc-overview-row"}
                              key={p.id}
                              onClick={() => setTab("plans")}
                            >
                              {p.content.name} · {p.content.weeks} hafta ↗
                            </Button>
                          ))}
                        <Button
                          variant="outline"
                          className={secondary}
                          onClick={() => {
                            setTab("athletes");
                            setAttention(true);
                          setTab("attention");
                          }}
                        >
                          İnceleme gerektiren üyeleri aç ↗
                        </Button>
                      </article>
                    </div>
                  </details>
                  <div className="nfc-overview-member-title">
                    <h3 className="text-xl font-bold">Üye takibi</h3>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setTab("athletes");
                        setAthlete("");
                      }}
                    >
                      Tüm üyeleri gör →
                    </Button>
                  </div>
                </>
              )}
              {!athlete && (
                <>
                  <div className="nfc-member-toolbar">
                    <div className="flex flex-wrap gap-3">
                      <Input
                        aria-label="Sporcu ara"
                        className={input + " sm:max-w-sm"}
                        placeholder="Sporcu ara"
                        value={search}
                        onChange={(e) => {setSearch(e.target.value);setMemberPage(1);}}
                      />
                      <Button
                        variant="outline"
                        className={secondary}
                        onClick={() => {if(tab==="attention"){setTab("athletes");setAttention(false);}else setAttention(!attention);setMemberPage(1);}}
                      >
                        {attention || tab==="attention" ? "Tüm sporcular" : "İlgi bekleyenler"}
                      </Button>
                    </div>
                    <Field label="İnceleme filtresi">
                      <NativeSelect
                        className={input}
                        value={reviewFilter}
                        onChange={(e) => {setReviewFilter(e.target.value);setMemberPage(1);}}
                      >
                        <option value="">Tüm durumlar</option>
                        <option value="needs_program">Program bekleyen</option><option value="scheduled">Başlaması bekleniyor</option>
                        <option value="missed">Kaçırılan seans</option>
                        <option value="unreviewed_changes">
                          İncelenmemiş değişiklik
                        </option>
                        <option value="unread_messages">Okunmamış mesaj</option>
                        <option value="pending_reports">Bekleyen rapor</option>
                      </NativeSelect>
                    </Field>
                  </div>
                  {memberError&&<div role="alert" className="nfc-attention-intro"><p>{memberError}</p><Button variant="outline" onClick={()=>setRefreshTick(n=>n+1)}>Üyeleri yeniden yükle</Button></div>}
                  {tab==="attention"&&<div className="nfc-attention-intro"><strong>Önce ilgilenilmesi gerekenler</strong><p>Mesajlar, raporlar, program değişiklikleri ve programsız üyeler. Her satırda doğrudan ilgili adıma geçebilirsin.</p></div>}
                  {!!selectedMembers.length&&<div className="nfc-bulk-bar" role="status"><strong>{selectedMembers.length} üye seçili</strong><Button onClick={()=>setQuickAssign(selectedMembers.map(id=>memberCache[id]).filter(Boolean))}>Seçilenlere program ata</Button><Button variant="ghost" onClick={()=>setSelectedMembers([])}>Seçimi temizle</Button></div>}
                  <DataTable<Summary>
                    key={tab}
                    className={"nfc-members-table nfc-daily-members "+(tab==="attention"?"nfc-attention-table":"")}
                    initialPageSize={tab === "dashboard" ? 5 : 10}
                    compact={tab === "dashboard"}
                    label="Üye listesi"
                    remote={{page:memberPage,pageSize:tab==="dashboard"?5:memberPageSize,total:memberResult?.total??0,loading:memberLoading,onPage:setMemberPage,onPageSize:size=>{setMemberPageSize(size);setMemberPage(1);},onSort:(id,desc)=>{setMemberSort({id,desc});setMemberPage(1);}}}
                    columns={[
                      {id:"selection",header:()=> <label className="nfc-checkbox-hit"><input type="checkbox" className="nfc-row-checkbox" aria-label="Bu sayfadaki üyeleri seç" checked={!!summaries.length&&summaries.every(m=>selectedMembers.includes(m.athlete_id))} onChange={e=>setSelectedMembers(old=>e.target.checked?[...new Set([...old,...summaries.map(m=>m.athlete_id)])]:old.filter(id=>!summaries.some(m=>m.athlete_id===id)))}/></label>,cell:({row})=><label className="nfc-checkbox-hit"><input type="checkbox" className="nfc-row-checkbox" aria-label={row.original.name+" seç"} checked={selectedMembers.includes(row.original.athlete_id)} onChange={e=>setSelectedMembers(old=>e.target.checked?[...old,row.original.athlete_id]:old.filter(id=>id!==row.original.athlete_id))}/></label>},
                      {
                        accessorKey: "name",
                        header: "Üye",
                        cell: ({ row }) => (
                          <div>
                            <strong>{row.original.name}</strong>
                            <small>Atanmış üye</small>
                          </div>
                        ),
                      },
                      {
                        accessorKey: "active_plans",
                        header: "Program",
                        cell: ({ row }) => (
                          <div className="nfc-program-state"><Badge>{row.original.active_plans?`${row.original.active_plans} aktif`:row.original.upcoming_plans?"Başlaması bekleniyor":"Program bekliyor"}</Badge>{!!row.original.upcoming_plans&&<small>{row.original.next_start_date} · {row.original.upcoming_plans} gelecek program</small>}</div>
                        ),
                      },
                      {
                        accessorKey: "completion_rate",
                        header: "Haftalık tamamlama",
                        cell: ({ row }) => (
                          <span className="nfc-member-completion">
                            {row.original.completion_rate == null
                              ? "Henüz kayıt yok"
                              : "%" +
                                Math.round(row.original.completion_rate * 100) +
                                " tamamlandı"}
                          </span>
                        ),
                      },
                      {
                        id: "attention",header:"Takip nedeni",accessorFn:m=>m.attention_count??0,
                        cell:({row:{original:m}})=><div className="nfc-reasons">{attentionReasons(m).length?attentionReasons(m).map(reason=><span key={reason.key}>{reason.label}</span>):<span>Takip gerektiren konu yok</span>}</div>,
                      },
                      {
                        id: "action",
                        header: "İşlem",
                        cell: ({ row:{original:m} }) => <div className="nfc-member-actions"><Button variant="outline" aria-label="Sporcuyu incele" onClick={()=>openMember(m)}>İncele</Button>{tab==="attention"&&attentionReasons(m).filter(r=>r.view!=="assign").slice(0,1).map(reason=><Button key={reason.key} variant="outline" onClick={()=>actOnMember(m,reason.view)}>{reason.action}</Button>)}<Button variant="outline" onClick={()=>setQuickAssign([m])}>Program ata</Button></div>,
                      },
                    ]}
                    data={memberLoading?[]:summaries}
                  />
                  {!summaries.length && (
                    <p className="text-slate-400">
                      Yalnızca sana açıkça atanmış aktif sporcular gösterilir.
                      Tesis yöneticisi Yönetim → Personel bölümünden atama
                      yapabilir.
                    </p>
                  )}
                </>
              )}
              {athlete && (
                <>
                  <header className="trainer-member-header">
                    <Button
                      variant="outline"
                      className={secondary}
                      onClick={() => {
                        setAthlete("");
                        setFrom("");
                        setUntil("");
                        setPlanFilter("");
                        setStateFilter("");
                      }}
                    >
                      ← Üyelere dön
                    </Button>
                    <div>
                      <p className="text-xs text-lime-300">ÜYE DETAYI</p>
                      <h2>{selectedMember?.name}</h2>
                    </div>
                  </header>
                  <nav className="nfc-member-tabs" aria-label="Üye detay bölümleri">{([["program","Program"],["progress","İlerleme"],["history","Geçmiş"]] as const).map(([key,label])=><Button key={key} variant={memberView===key?"default":"outline"} aria-current={memberView===key?"page":undefined} onClick={()=>{setMemberView(key);setSelectedWorkout("");}}>{label}</Button>)}<Button variant="outline" disabled={!selectedMember} onClick={()=>{if(selectedMember)setQuickAssign([selectedMember])}}>Program ata</Button></nav>
                  {memberView==="progress"&&<>{selectedWorkout&&<Button variant="outline" onClick={()=>{setMemberView("history");setSelectedWorkout("");}}>← Antrenman geçmişine dön</Button>}<div
                    className="trainer-member-stats"
                    aria-label="Üye antrenman özeti"
                  >
                    <div>
                      <strong>{selectedMember?.active_plans ?? 0}</strong>
                      <span>Aktif program</span>
                    </div>
                    <div>
                      <strong>
                        {
                          workoutResult?.summary.completed_sessions??0
                        }
                      </strong>
                      <span>Tamamlanan seans</span>
                    </div>
                    <div>
                      <strong>{selectedMember?.missed ?? 0}</strong>
                      <span>Kaçırılan seans</span>
                    </div>
                  </div>
                  <section
                    className="trainer-week-summary"
                    aria-label="Haftalık ilerleme ve son antrenmanlar"
                  >
                    <div>
                      <h3>Haftalık tamamlama</h3>
                      {selectedMember?.completion_rate == null ? (
                        <p>Bu hafta için planlanmış seans yok.</p>
                      ) : (
                        <>
                          <div
                            className="trainer-week-progress"
                            role="progressbar"
                            aria-label="Haftalık tamamlanan antrenman oranı"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(
                              selectedMember.completion_rate * 100,
                            )}
                          >
                            <span
                              style={{
                                width:
                                  Math.min(
                                    100,
                                    selectedMember.completion_rate * 100,
                                  ) + "%",
                              }}
                            />
                          </div>
                          <p>
                            %{Math.round(selectedMember.completion_rate * 100)}{" "}
                            tamamlandı · {selectedMember?.missed ?? 0} kaçırılan
                            seans
                          </p>
                        </>
                      )}
                      <small>
                        Program hedefleri ve kaydedilmiş seanslara göre.
                      </small>
                    </div>
                    <div className="trainer-recent-history">
                      <h3>Son antrenmanlar</h3>
                      {filteredWorkouts.length ? (
                        [...filteredWorkouts]
                          .sort((a, b) =>
                            b.scheduled_date.localeCompare(a.scheduled_date),
                          )
                          .slice(0, 3)
                          .map((w) => (
                            <a href={"#workout-" + w.id} key={w.id} onClick={()=>{setMemberView("progress");setSelectedWorkout(w.id)}}>
                              <span>
                                {w.scheduled_date} · {w.snapshot.name}
                              </span>
                              <strong>
                                {
                                  w.actual.sets.filter(
                                    (s) => s.status === "completed",
                                  ).length
                                }{" "}
                                set
                              </strong>
                            </a>
                          ))
                      ) : (
                        <p>
                          {workoutResult?.total
                            ? "Bu filtrelerde antrenman kaydı yok. Filtreleri temizleyerek geçmişi görebilirsin."
                            : "Henüz antrenman kaydı yok. İlk seans kaydedildiğinde burada görünür."}
                        </p>
                      )}
                      <small>
                        Geçmiş hedefler tamamlanan antrenmanın kayıt anındaki
                        kopyasından gösterilir.
                      </small>
                    </div>
                  </section>
                  </>}
                  {memberView==="program"&&<div className={card}>
                    <h3 className="text-xl font-bold">Antrenman programları</h3>
                    {plans
                      .filter(
                        (p) =>
                          p.athlete_id === athlete &&
                          p.content.planning_status !== "archived" &&
                          p.content.start_date <= memberToday,
                      )
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-3"
                        >
                          <span>
                            {p.content.name} · {p.content.weeks} hafta ·{" "}
                            {Math.max(
                              1,
                              Math.min(
                                p.content.weeks,
                                Math.floor(
                                  (Date.now() -
                                    Date.parse(p.content.start_date)) /
                                    604800000,
                                ) + 1,
                              ),
                            )}
                            . hafta
                          </span>
                          <Button
                            variant="outline"
                            className={secondary}
                            onClick={() => {
                              setRequestedPlanId(p.id);
                              setTab("plans");
                            }}
                          >
                            Gelecek planı düzenle
                          </Button>
                        </div>
                      ))}
                    {plans.some(
                      (p) =>
                        p.athlete_id === athlete &&
                        p.content.planning_status !== "archived" &&
                        p.content.start_date > memberToday,
                    ) && (
                      <details className="trainer-scheduled-programs">
                        <summary>
                          Gelecek programlar (
                          {
                            plans.filter(
                              (p) =>
                                p.athlete_id === athlete &&
                                p.content.planning_status !== "archived" &&
                                p.content.start_date > memberToday,
                            ).length
                          }
                          )
                        </summary>
                        {plans
                          .filter(
                            (p) =>
                              p.athlete_id === athlete &&
                              p.content.planning_status !== "archived" &&
                              p.content.start_date > memberToday,
                          )
                          .map((p) => (
                            <div key={p.id} data-assignment-id={p.id} className="trainer-scheduled-row">
                              <span>
                                {p.content.name}
                                <small>
                                  {p.content.start_date} · {p.content.weeks}{" "}
                                  hafta · Planlanan başlangıç
                                </small>
                              </span>
                              <Button
                                variant="outline"
                                className={secondary}
                                onClick={() => {
                                  setRequestedPlanId(p.id);
                                  setTab("plans");
                                }}
                              >
                                Gelecek planı düzenle
                              </Button>
                              <Button variant="outline" onClick={()=>setCancelAssignment(p)}>Atamayı iptal et</Button>
                            </div>
                          ))}
                      </details>
                    )}
                    {!plans.some(
                      (p) =>
                        p.athlete_id === athlete &&
                        p.content.planning_status !== "archived" &&
                        p.content.start_date <= memberToday,
                    ) && (
                      <p className="text-slate-400">
                        Bu üyede henüz başlamış program bulunmuyor.
                      </p>
                    )}
                  </div>
                  }
                  {(memberView==="progress"||memberView==="history")&&<details className={card}>
                    <summary className="cursor-pointer font-bold">
                      Antrenman ve gelişim filtreleri
                    </summary>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Başlangıç">
                        <Input
                          className={input}
                          type="date"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                        />
                      </Field>
                      <Field label="Bitiş">
                        <Input
                          className={input}
                          type="date"
                          value={until}
                          onChange={(e) => setUntil(e.target.value)}
                        />
                      </Field>
                      <Field label="Program">
                        <NativeSelect
                          className={input}
                          value={planFilter}
                          onChange={(e) => setPlanFilter(e.target.value)}
                        >
                          <option value="">Tüm programlar</option>
                          {data?.plans
                            .filter((p) => p.tenant_id === tenantId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.content.name}
                              </option>
                            ))}
                        </NativeSelect>
                      </Field>
                      <Field label="Antrenman durumu">
                        <NativeSelect
                          className={input}
                          value={stateFilter}
                          onChange={(e) => setStateFilter(e.target.value)}
                        >
                          <option value="">Tüm durumlar</option>
                          {Object.entries({
                            not_started: "Başlanmadı",
                            in_progress: "Devam ediyor",
                            paused: "Duraklatıldı",
                            completed: "Tamamlandı",
                            partial: "Kısmen tamamlandı",
                            cancelled: "İptal edildi",
                          }).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                    </div>
                    <Button
                      variant="outline"
                      className={secondary}
                      onClick={() => {
                        setFrom("");
                        setUntil("");
                        setPlanFilter("");
                        setStateFilter("");
                      }}
                    >
                      Filtreleri temizle
                    </Button>
                  </details>
                  }
                  {memberView==="progress"&&<details className={card}>
                    <summary className="cursor-pointer font-bold">
                      Egzersiz gelişimi ve ayrıntılı analiz
                    </summary>
                    {!selectedPerformance ? (
                      <p>Karşılaştırma için henüz gerçekleşen set yok.</p>
                    ) : (
                      <>
                        <Field label="Egzersiz">
                          <NativeSelect
                            className={input}
                            value={selectedPerformance.id}
                            onChange={(e) => setExerciseFilter(e.target.value)}
                          >
                            {performance.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                        <p>
                          {usesVolume
                            ? "Kayıtlı hacim (kg × tekrar)"
                            : "Kaydedilen set sayısı"}{" "}
                          · {data?.timezone ?? "Europe/Istanbul"}
                        </p>
                        <div
                          className="flex h-48 items-end gap-2"
                          role="img"
                          aria-label="Son 14 kayıtlı günün gelişimi. Değerler aşağıdaki tabloda yer alır."
                        >
                          {performanceDays.map((d) => (
                            <div
                              key={d.date}
                              className="flex min-w-0 flex-1 flex-col items-center gap-2"
                            >
                              <span className="text-xs">
                                {usesVolume ? (d.volume ?? "—") : d.sets}
                              </span>
                              <div
                                className="w-full rounded-t bg-lime-300"
                                style={{
                                  height: Math.max(
                                    3,
                                    ((usesVolume ? (d.volume ?? 0) : d.sets) /
                                      performanceMax) *
                                      120,
                                  ),
                                }}
                              />
                              <span className="text-xs">{d.date.slice(5)}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-slate-400">
                          Gerçek set tarihine göre gruplanır. Eksik ağırlıklar
                          tahmin edilmez. Yukarıdaki tarihler planlanan seans
                          tarihini filtreler.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr>
                                <th>Tarih</th>
                                <th>Set</th>
                                <th>Tekrar</th>
                                <th>En yüksek kg</th>
                                <th>Hacim</th>
                                <th>Süre (sn)</th>
                                <th>Mesafe (m)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {performanceDays.map((d) => (
                                <tr key={d.date}>
                                  <td>{d.date}</td>
                                  <td>{d.sets}</td>
                                  <td>{d.reps ?? "—"}</td>
                                  <td>{d.maxKg ?? "—"}</td>
                                  <td>{d.volume ?? "—"}</td>
                                  <td>{d.seconds ?? "—"}</td>
                                  <td>{d.meters ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </details>}
                  {(memberView==="progress"||memberView==="history")&&historyError&&<div role="alert">{historyError}<Button variant="outline" onClick={()=>setRefreshTick(n=>n+1)}>Antrenmanları yeniden yükle</Button></div>}
                  {memberView==="progress"&&historyLoading&&<p role="status">Antrenmanlar yükleniyor…</p>}
                  {memberView==="progress"&&<p className="nfc-muted">{selectedWorkout?"Seçilen antrenman kaydı.":"Analiz, bu filtrelerdeki son 50 antrenmana göre gösterilir. Tüm kayıtlar Geçmiş bölümünden açılabilir."}</p>}
                  {memberView==="history"&&<TrainerAssignmentHistory key={athlete} api={api} tenantId={tenantId} athleteId={athlete} refreshTick={refreshTick}/>}
                  {memberView==="history"&&<DataTable label="Üye antrenman geçmişi" data={historyLoading?[]:filteredWorkouts}
                    remote={{page:historyPage,pageSize:historySize,total:workoutResult?.total??0,loading:historyLoading,onPage:setHistoryPage,onPageSize:n=>{setHistorySize(n);setHistoryPage(1)}}}
                    columns={[
                    {id:"date",header:"Tarih",cell:({row})=>row.original.scheduled_date},
                    {id:"name",header:"Antrenman",cell:({row})=>row.original.snapshot.name},
                    {id:"sets",header:"Kayıt",cell:({row})=>row.original.actual.sets.filter(s=>s.status==="completed").length+" tamamlanan set"},
                    {id:"action",header:"İşlem",cell:({row})=><Button variant="outline" onClick={()=>{setSelectedWorkout(row.original.id);setMemberView("progress");}}>Kaydı aç</Button>}
                  ]}/>}
                </>
              )}
              {athlete && memberView==="progress" &&
                (selectedWorkout?filteredWorkouts.filter(w=>w.id===selectedWorkout):filteredWorkouts.slice(0,3)).map((w) => (
                  <article
                    className={card + " trainer-workout-progress"}
                    id={"workout-" + w.id}
                    key={w.id}
                    data-workout-id={w.id}
                  >
                    <h3 className="font-bold">
                      {w.scheduled_date} · {w.snapshot.name}
                    </h3>
                    <p>
                      {
                        {
                          not_started: "Başlanmadı",
                          in_progress: "Devam ediyor",
                          paused: "Duraklatıldı",
                          completed: "Tamamlandı",
                          partial: "Kısmen tamamlandı",
                          skipped: "Atlandı",
                          cancelled: "İptal edildi",
                        }[w.state]
                      }
                    </p>
                    {[...w.snapshot.exercises, ...w.actual.added].map((e) => {
                      const progress = recordedSetProgress(w, e.id);
                      return (
                        <section
                          key={e.id}
                          className="trainer-exercise-progress"
                          data-extra={progress.extra}
                          data-completed={progress.completed}
                          data-planned={progress.planned}
                        >
                          <h4>
                            {e.name ??
                              catalog.find((x) => x.id === e.exercise_id)
                                ?.name ??
                              e.exercise_id}
                          </h4>
                          <dl className="trainer-set-counts">
                            <div>
                              <dt>Planlanan set</dt>
                              <dd>{progress.planned}</dd>
                            </div>
                            <div>
                              <dt>Tamamlanan set</dt>
                              <dd>{progress.completed}</dd>
                            </div>
                            <div className={progress.extra ? "has-extra" : ""}>
                              <dt>Ekstra set</dt>
                              <dd>
                                {progress.extra ? `+${progress.extra}` : 0}
                              </dd>
                            </div>
                          </dl>
                          <div
                            className="trainer-set-chart"
                            role="img"
                            aria-label={`${progress.planned} planlanan, ${progress.completed} tamamlanan, ${progress.extra} ekstra set`}
                          >
                            <div className="trainer-set-track">
                              <span
                                style={{
                                  width: progress.planned
                                    ? Math.min(
                                        100,
                                        (progress.completed /
                                          progress.planned) *
                                          100,
                                      ) + "%"
                                    : "0%",
                                }}
                              />
                            </div>
                            <small>
                              {progress.planned
                                ? "Planlanan hedef"
                                : "Eklenen hareket"}
                              {progress.extra
                                ? ` · +${progress.extra} ekstra`
                                : ""}
                            </small>
                          </div>
                          <p className="trainer-set-status">
                            {progress.completed}/{progress.planned} ·{" "}
                            {progress.extra
                              ? `+${progress.extra} ekstra · `
                              : ""}
                            {progress.achieved
                              ? "Hedefe ulaşıldı"
                              : progress.planned
                                ? "Hedef sürüyor"
                                : "Plansız kayıt"}
                          </p>
                          <details>
                            <summary className="cursor-pointer py-3 text-sm">
                              Kaydedilen setleri göster
                            </summary>
                            {w.actual.sets
                              .filter((s) => s.exercise_key === e.id)
                              .map((s) => (
                                <p key={s.id}>
                                  Set {s.set_number}: {s.reps ?? "—"} tekrar ·{" "}
                                  {s.kg ?? "—"} kg · {s.seconds ?? "—"} sn ·{" "}
                                  {s.meters ?? "—"} m ·{" "}
                                  {s.status === "completed"
                                    ? "Tamamlandı"
                                    : "Atlandı"}{" "}
                                  ·{" "}
                                  {s.method === "nfc"
                                    ? "NFC ile kayıt"
                                    : "Manuel giriş"}{" "}
                                  · {s.notes}
                                </p>
                              ))}
                          </details>
                        </section>
                      );
                    })}
                    <p>{w.actual.notes}</p>
                    <Button
                      variant="outline"
                      className={secondary}
                      onClick={() => {
                        setContext({ type: "workout", id: w.id });
                        setTab("messages");
                      }}
                    >
                      Antrenmana yorum yaz
                    </Button>
                  </article>
                ))}
            </>
          )}
        {tab === "exercises" && (
          <TrainerExerciseLibrary
            catalog={catalog}
            onWorkouts={(exerciseId) => {
              setAthlete("");
              setTab("workouts");
              setWorkoutRequest({ id: crypto.randomUUID(), exerciseId });
            }}
          />
        )}
        {(tab === "plans" || tab === "workouts") && (
          <TrainerPlanning
            key={tenantId}
            api={api}
            plans={plans}
            catalog={catalog}
            members={summaries}
            tenantId={tenantId}
            ownerId={data?.account_id??""}
            timezone={data?.timezone ?? "Europe/Istanbul"}
            mode={tab}
            comment={(revisionId) => {
              setContext({ type: "revision", id: revisionId });
              setTab("messages");
            }}
            reload={refresh}
            createSignal={createSignal}
            workoutRequest={workoutRequest}
            onWorkoutOpened={() => setWorkoutRequest(null)}
            onEditorFocusChange={setEditorFocused}
            openPlanId={requestedPlanId}
            onPlanOpened={() => setRequestedPlanId("")}
          />
        )}
        {tab === "reports" && athlete && (
          <>
            <div className={card}>
              <Field label="Bitmiş hafta başlangıcı (Pazartesi)">
                <Input
                  className={input}
                  type="date"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                />
              </Field>
              <Button
                variant="outline"
                className={action}
                disabled={!athlete || busy}
                onClick={() =>
                  void perform(() =>
                    api(`/athletes/${athlete}/reports`, {
                      week,
                      timezone: data?.timezone ?? "Europe/Istanbul",
                      tenant_id: tenantId,
                    }),
                  )
                }
              >
                Rapor oluştur / güncelle
              </Button>
            </div>
            <Field label="Rapor durumu">
              <NativeSelect
                className={input}
                value={reportFilter}
                onChange={(e) => setReportFilter(e.target.value)}
              >
                <option value="">Tüm raporlar</option>
                {Object.entries({
                  awaiting_review: "İnceleme bekliyor",
                  reviewed: "İncelendi",
                  revision_recommended: "Revizyon önerildi",
                  closed: "Kapatıldı",
                }).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {data?.reports
              .filter(
                (r) =>
                  (!tenantId || r.scope === tenantId) &&
                  (!reportFilter || r.status === reportFilter),
              )
              .map((r) => (
                <article key={r.id} className={card}>
                  <h3 className="text-xl font-bold">
                    {r.week} · {r.status}
                  </h3>
                  <p>
                    Seans {r.content.completed_sessions}/
                    {r.content.scheduled_sessions} · Kaçırılan{" "}
                    {r.content.missed_sessions} · Kısmi{" "}
                    {r.content.partial_sessions}
                  </p>
                  <p>
                    Set {r.content.completed_sets}/{r.content.planned_sets} ·
                    Tekrar {r.content.actual_reps}/{r.content.planned_reps}
                  </p>
                  <p>
                    Kayıtlı hacim:{" "}
                    {r.content.recorded_volume_kg_reps == null
                      ? "Yeterli veri yok"
                      : r.content.recorded_volume_kg_reps + " kg × tekrar"}
                  </p>
                  <p className="text-slate-400">
                    Tamamlama ile planlı set uyumu ayrı ölçülür. Eksik ağırlık
                    tahmin edilmez.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {["reviewed", "revision_recommended", "closed"].map(
                      (status, i) => (
                        <Button
                          variant="outline"
                          key={status}
                          className={secondary}
                          disabled={busy}
                          onClick={() =>
                            void perform(() =>
                              api(`/reports/${r.id}/review`, { status }),
                            )
                          }
                        >
                          {["İncelendi", "Revizyon öner", "Kapat"][i]}
                        </Button>
                      ),
                    )}
                    <Button
                      variant="outline"
                      className={action}
                      onClick={() => {
                        setContext({ type: "report", id: r.id });
                        setTab("messages");
                      }}
                    >
                      Geri bildirim yaz
                    </Button>
                  </div>
                </article>
              ))}
          </>
        )}
        {cancelAssignment&&<TrainerCancelAssignment plan={cancelAssignment} memberName={selectedMember?.name??"Üye"} api={api} close={()=>setCancelAssignment(null)} saved={refresh}/>}
        {tab === "messages" && (
          <article className={card}>
            <h3 className="font-bold">
              {chosenLink?.name ?? "Önce bir sporcu seç"}
            </h3>
            {context && (
              <p className="text-slate-400">
                Seçili kayda ilişkin geri bildirim{" "}
                <Button
                  variant="outline"
                  onClick={() => setContext(null)}
                  className={secondary}
                >
                  Genel mesaja dön
                </Button>
              </p>
            )}
            <textarea
              aria-label="Mesaj"
              className={input}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
            />
            <Button
              variant="outline"
              className={action}
              disabled={!chosenLink || !body.trim() || busy}
              onClick={() =>
                void perform(async () => {
                  const fingerprint = JSON.stringify([
                    chosenLink!.id,
                    body.trim(),
                    context,
                  ]);
                  if (messageRequest.current?.fingerprint !== fingerprint)
                    messageRequest.current = {
                      id: crypto.randomUUID(),
                      fingerprint,
                    };
                  await api("/messages", {
                    id: messageRequest.current.id,
                    link_id: chosenLink!.id,
                    body: body.trim(),
                    context_type: context?.type ?? "general",
                    context_id: context?.id ?? null,
                  });
                  messageRequest.current = null;
                  setBody("");
                })
              }
            >
              Gönder
            </Button>
            {data?.messages
              .filter(
                (m) =>
                  m.link_id === chosenLink?.id &&
                  (!context || m.context_id === context.id),
              )
              .map((m) => (
                <div
                  key={m.id}
                  className="space-y-2 border-t border-slate-700 pt-4"
                >
                  <p className="text-sm text-slate-400">
                    {m.author_id === data.account_id ? "Sen" : chosenLink?.name}{" "}
                    · {new Date(m.created_at).toLocaleString("tr-TR")} ·{" "}
                    {m.read_at ? "Okundu" : "Okunmadı"}
                  </p>
                  <p>{m.body}</p>
                  {m.author_id !== data.account_id && !m.read_at && (
                    <Button
                      variant="outline"
                      className={secondary}
                      onClick={() =>
                        void perform(() => api(`/messages/${m.id}/read`, {}))
                      }
                    >
                      Okundu
                    </Button>
                  )}
                </div>
              ))}
          </article>
        )}
        {quickAssign&&<TrainerQuickAssignment key={quickAssign.map(m=>m.athlete_id).join(":")} members={quickAssign} tenantId={tenantId} api={api} close={()=>setQuickAssign(null)} saved={async()=>{await refresh();setSelectedMembers([]);}}/>}
      </section>
    </TrainerAdminLayout>
  );
}
