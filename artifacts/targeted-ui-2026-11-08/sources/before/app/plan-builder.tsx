import { initialPlanTenant, planTemplateTenants, planDraftError } from "@/lib/plan-draft";
import { KeyboardFrame } from "@/components/keyboard-frame";
import { fullWeekdays, sessionDisplayName } from "@/lib/session-presentation";
import { starterPrograms, starterTargets } from "@/lib/starter-programs";
import { StaffArea } from "@/components/staff-area";
import { zonedDate } from "@/lib/coaching-performance";
import { offlineChanged } from "@/lib/offline-sync";
import { useQueryClient } from "@tanstack/react-query";
import {
  CoachText as Text,
  brand,
  CoachButton,
  CoachCard,
  CoachField,
  coachStyle,
  localDate,
} from "@/components/coaching-ui";
import { useEffect, useRef, useState } from "react";
import { useHeaderHeight } from "@react-navigation/elements";
import { Alert, FlatList, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCoaching, useCoachingLibrary } from "@/hooks/use-coaching";
import { useAuth } from "@/hooks/use-auth";
import { useTenantIdentity } from "@/hooks/use-tenant-identity";
import { coachingRequest } from "@/lib/tenant-console";
import { localUuid } from "@/lib/offline-store";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import type {
  Exercise,
  Plan,
  PlanContent,
  PlanDay,
  Target,
} from "@/lib/coaching-types";
import { ExerciseSelector } from "@/components/exercise-selector";
const dayLabels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
function datesFor(start: string, weeks: number, weekday: number) {
  const dates: string[] = [];
  const dt = new Date(start + "T12:00:00Z");
  if (Number.isNaN(dt.getTime())) return dates;
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(dt);
    d.setUTCDate(dt.getUTCDate() + i);
    if ((d.getUTCDay() + 6) % 7 === weekday)
      dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
export default function PlanBuilder() {
  const { athlete } = useLocalSearchParams<{ athlete?: string }>();
  return athlete ? (
    <StaffArea>
      <PlanBuilderContent />
    </StaffArea>
  ) : (
    <PlanBuilderContent />
  );
}
function PlanBuilderContent() {
  const headerHeight = useHeaderHeight();
  const {
    id,
    copy,
    athlete,
    tenant: requestedTenant,
    preset_template,
    preset_goal,
    preset_level,
    preset_weeks,
    preset_days,
  } = useLocalSearchParams<{
    id?: string;
    copy?: string;
    athlete?: string;
    tenant?: string;
    preset_template?: string;
    preset_goal?: string;
    preset_level?: string;
    preset_weeks?: string;
    preset_days?: string;
  }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const identity = useTenantIdentity();
  const overview = useCoaching(athlete);
  const library = useCoachingLibrary();
  const source = overview.data?.plans.find((p) => p.id === id);
  const initialized = useRef(false);
  const draftId = useRef(localUuid());
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [start, setStart] = useState(localDate());
  const [weeks, setWeeks] = useState("4");
  const [difficulty, setDifficulty] =
    useState<PlanContent["difficulty"]>("beginner");
  const [days, setDays] = useState<PlanDay[]>([]);
  const [historical, setHistorical] = useState<PlanDay[]>([]);
  const [selected, setSelected] = useState("");
  const [selector, setSelector] = useState(false);
  const [tenant, setTenant] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [addingDay, setAddingDay] = useState(false);
  const [preview, setPreview] = useState(false);
  const [expandedTarget,setExpandedTarget]=useState("");
  const [targetNotes,setTargetNotes]=useState("");
  const [numberDrafts,setNumberDrafts] = useState<Record<string,string>>({});
  const assignmentId = useRef(localUuid());
  useEffect(() => {
    if (!source || initialized.current) return;
    initialized.current = true;
    const c = source.content;
    setName(copy ? c.name + " (kopya)" : c.name);
    setGoal(c.goal);
    setStart(c.start_date);
    setWeeks(String(c.weeks));
    setDifficulty(c.difficulty);
    setTenant(copy ? null : source.tenant_id);
    let items: PlanDay[] = JSON.parse(JSON.stringify(c.days));
    if (!copy && source.athlete_id) {
      const today = zonedDate(new Date(), source.content.timezone);
      setHistorical(
        items
          .filter((d) => d.dates.some((x) => x <= today))
          .map((d) => ({ ...d, dates: d.dates.filter((x) => x <= today) })),
      );
      items = items
        .filter((d) => d.dates.some((x) => x > today))
        .map((d) => ({
          ...d,
          id: d.dates.some((x) => x <= today) ? localUuid() : d.id,
          dates: d.dates.filter((x) => x > today),
        }));
    }
    setDays(items);
    setSelected(items[0]?.id ?? "");
  }, [source, copy]);
  useEffect(() => {
    if (!id && !initialized.current && identity.data) {
      setTenant(initialPlanTenant(identity.data, requestedTenant));
      initialized.current = true;
    }
  }, [id, identity.data, requestedTenant]);
  const presetApplied = useRef(false);
  useEffect(() => {
    if (id || copy || presetApplied.current || !preset_goal) return;
    presetApplied.current = true;
    const count = [4, 6, 8, 12].includes(Number(preset_weeks))
      ? Number(preset_weeks)
      : 4;
    const weekdays = [
      ...new Set(
        (preset_days ?? "")
          .split(",")
          .filter((x) => /^[0-6]$/.test(x))
          .map(Number),
      ),
    ];
    const initialDays = weekdays.map((index) => ({
      id: localUuid(),
      name:
        fullWeekdays[index] +
        " · " +
        (preset_template === "core"
          ? "Core"
          : preset_template
            ? "Tüm Vücut"
            : "Antrenman"),
      dates: datesFor(start, count, index),
      exercises: starterPrograms.some((p) => p.id === preset_template)
        ? starterTargets(preset_template!, localUuid)
        : [],
    }));
    setName(preset_goal.slice(0, 80) + " planım");
    setGoal(preset_goal.slice(0, 200));
    setWeeks(String(count));
    if (["beginner", "intermediate", "advanced"].includes(preset_level ?? ""))
      setDifficulty(preset_level as PlanContent["difficulty"]);
    setDays(initialDays);
    setSelected(initialDays[0]?.id ?? "");
  }, [
    id,
    copy,
    preset_goal,
    preset_level,
    preset_weeks,
    preset_days,
    preset_template,
    start,
  ]);
  const day = days.find((d) => d.id === selected);
  const update = (fn: (d: PlanDay) => PlanDay) =>
    setDays((values) => values.map((d) => (d.id === selected ? fn(d) : d)));
  const add = (e: Exercise) => {
    const targetId=localUuid();
    setExpandedTarget(targetId);
    update((d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        {
          id: targetId,
          exercise_id: e.id,
          sets: 3,
          reps: e.measurements.includes("reps") ? 10 : null,
          kg: e.measurements.includes("kg") ? 0 : null,
          seconds: e.measurements.includes("seconds") ? 30 : null,
          meters: e.measurements.includes("meters") ? 100 : null,
          rest_seconds: 60,
          notes: "",
        },
      ],
    }));
    setSelector(false);
  };
  const changeTarget = (id: string, key: keyof Target, value: string) => {
    if (!["notes", "superset"].includes(key)) setNumberDrafts(old=>({...old,[id+":"+key]:value}));
    update((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === id
          ? {
              ...e,
              [key]: ["notes", "superset"].includes(key)
                ? value
                : value.trim() === ""
                  ? null
                  : Number(value.replace(",", ".")),
            }
          : e,
      ),
    }));
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
        !Number.isInteger(Number(weeks))
      )
        throw new Error("Başlangıcı YYYY-AA-GG, hafta sayısını tam sayı gir.");
      if (!days.length && !historical.length)
        throw new Error("En az bir antrenman günü ekle.");
      const content: PlanContent = {
        name,
        goal,
        difficulty,
        start_date: start,
        weeks: Number(weeks),
        timezone:
          source?.content.timezone ??
          overview.data?.timezone ??
          "Europe/Istanbul",
        days: [...historical, ...days],
      };
      const validation = planDraftError(content);
      if (validation) throw new Error(validation);
      if (athlete && (!tenant || !overview.data?.links.some(l => l.tenant_id === tenant && l.athlete_id === athlete && l.trainer_id === overview.data?.account_id)))
        throw new Error("Bu tesiste üyeye aktif antrenör ataman bulunmuyor. Yönetim → Personel bölümünden kontrol edin.");
      let saved: Plan;
      if (id && !copy)
        saved = await coachingRequest<Plan>(
          user!.id,
          `/plans/${id}`,
          { expected_version: source!.version, reason, content },
          "PATCH",
        );
      else
        saved = await coachingRequest<Plan>(user!.id, "/plans", {
          id: draftId.current,
          tenant_id: tenant,
          content,
        });
      if (athlete && (!id || copy)) {
        await coachingRequest(user!.id, `/plans/${saved.id}/assign`, {athlete_ids:[athlete],request_id:assignmentId.current,start_date:content.start_date});
      }
      if (!athlete) {
        await coachingStore.upsertPlan(user!.id, saved);
        offlineChanged(user!.id);
      }
      void syncCoaching(user!.id).catch(() => undefined);
      if (athlete)
        await queryClient.invalidateQueries({
          queryKey: ["coaching", user!.id, athlete],
        });
      router.replace((athlete ? `/athlete?id=${athlete}&tenant=${tenant}` : "/(drawer)/plans") as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const header = (
    <View style={{ gap: 10 }}>
      <Text style={coachStyle.muted}>
        Gün ve egzersiz seç. Planı kaydetmek için internet gerekir.
      </Text>
      {athlete && <Text style={coachStyle.muted}>Bu plan seçtiğin üyeye atanacak. Geçmiş antrenman sonuçları korunur.</Text>}
      <CoachField compact label="Program adı" value={name} onChange={setName} />
      <CoachButton
        title={
          settingsExpanded ? "Plan ayarlarını gizle" : "Amaç, takvim ve seviye"
        }
        secondary
        onPress={() => setSettingsExpanded((v) => !v)}
      />
      {settingsExpanded && (
        <View style={{ gap: 10 }}>
          <CoachField compact label="Amaç" value={goal} onChange={setGoal} />
          <View style={coachStyle.row}>
            <View style={{ flex: 1 }}>
              <CoachField
                compact
                label="Başlangıç (YYYY-AA-GG)"
                value={start}
                onChange={setStart}
              />
            </View>
            <View style={{ width: 90 }}>
              <CoachField
                compact
                label="Hafta"
                numeric
                value={weeks}
                onChange={setWeeks}
              />
            </View>
          </View>
          <View style={coachStyle.row}>
            {(["beginner", "intermediate", "advanced"] as const).map((d, i) => (
              <CoachButton
                key={d}
                title={["Başlangıç", "Orta", "İleri"][i]}
                secondary={difficulty !== d}
                onPress={() => setDifficulty(d)}
              />
            ))}
          </View>
        </View>
      )}
      {(!id || copy) && !athlete && planTemplateTenants(identity.data).length > 0 && (
        <>
          <Text style={coachStyle.muted}>
            Kişisel program veya tesis şablonu
          </Text>
          <View style={coachStyle.row}>
            <CoachButton
              title="Kişisel"
              secondary={tenant !== null}
              onPress={() => setTenant(null)}
            />
            {planTemplateTenants(identity.data).map((s) => (
              <CoachButton
                key={s.tenant_id}
                title={s.tenant_name}
                secondary={tenant !== s.tenant_id}
                onPress={() => setTenant(s.tenant_id)}
              />
            ))}
          </View>
        </>
      )}
      <CoachCard compact title="Antrenman günleri">
        <Text style={coachStyle.muted}>
          Gün seç. Seans adı ve tarihler aşağıdan düzenlenebilir.
        </Text>
        {!!days.length && (
          <CoachButton
            title={
              addingDay ? "Gün seçeneklerini gizle" : "Antrenman günü ekle"
            }
            secondary
            onPress={() => setAddingDay((v) => !v)}
          />
        )}
        {(!days.length || addingDay) && (
          <View style={coachStyle.row}>
            {dayLabels.map((label, index) => (
              <CoachButton
                key={label}
                title={label + " ekle"}
                secondary
                onPress={() => {
                  const key = localUuid();
                  const dates = datesFor(start, Number(weeks), index);
                  if (!dates.length) {
                    setError("Geçerli başlangıç ve hafta sayısı gir.");
                    return;
                  }
                  setDays((d) => [
                    ...d,
                    {
                      id: key,
                      name: fullWeekdays[index] + " · Antrenman",
                      dates,
                      exercises: [],
                    },
                  ]);
                  setSelected(key);
                }}
              />
            ))}
          </View>
        )}
        <ScrollView
          horizontal
          contentContainerStyle={[coachStyle.row, { flexWrap: "nowrap" }]}
        >
          {days.map((d) => (
            <CoachButton
              key={d.id}
              title={`${sessionDisplayName(d, d.dates[0] ?? start, library.data)} (${d.exercises.length})`}
              secondary={d.id !== selected}
              onPress={() => setSelected(d.id)}
            />
          ))}
        </ScrollView>
      </CoachCard>
      {day && (
        <>
          <CoachField
            compact
            label="Seans adı"
            value={day.name}
            onChange={(value) => update((d) => ({ ...d, name: value }))}
          />
          <CoachField
            compact
            label="Tarihler (YYYY-AA-GG, virgülle ayır)"
            value={day.dates.join(", ")}
            onChange={(value) =>
              update((d) => ({
                ...d,
                dates: value.split(",").map((s) => s.trim()),
              }))
            }
          />
          <View style={coachStyle.row}>
            <CoachButton
              title="Egzersiz ekle"
              onPress={() => setSelector(true)}
            />
            <CoachButton
              title="Bu günü kaldır"
              secondary
              onPress={() => Alert.alert('Antrenman gününü kaldır', `${day.name} taslaktan çıkarılsın mı? Geçmiş kayıtlar korunur.`, [{text:'Vazgeç',style:'cancel'},{text:'Kaldır',style:'destructive',onPress:()=>{setDays(ds=>ds.filter(d=>d.id!==selected));setSelected(days.find(d=>d.id!==selected)?.id??'');}}])}
            />
          </View>
          <Text style={coachStyle.muted}>
            {day.exercises.length} egzersiz · Yukarı/aşağı ile sıralayabilirsin.
          </Text>
        </>
      )}
    </View>
  );
  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      style={[coachStyle.page, { padding: 18 }]}
    >
      <Stack.Screen
        options={{
          title: id && !copy ? "Programı düzenle" : "Program oluştur",
          headerStyle: { backgroundColor: brand.background },
          headerTintColor: brand.text,
        }}
      />
      <KeyboardFrame style={{ flex: 1 }} keyboardVerticalOffset={headerHeight}>
        <FlatList
          data={day?.exercises ?? []}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          style={{ flex: 1 }}
          ListHeaderComponent={header}
          renderItem={({ item: e, index }) => {
            const entry = library.data?.find((x) => x.id === e.exercise_id);
            const measurements = entry?.measurements ?? [
              "reps",
              "kg",
              "seconds",
              "meters",
            ];
            return (
              <CoachCard
                compact
                title={`${index + 1}. ${entry?.name ?? e.exercise_id}`}
              >
                <Text style={coachStyle.muted}>{e.sets} set{e.reps!=null?` · ${e.reps} tekrar`:''}{e.kg!=null?` · ${e.kg} kg`:''}{e.seconds!=null?` · ${e.seconds} sn`:''}{e.meters!=null?` · ${e.meters} m`:''} · {e.rest_seconds} sn dinlenme</Text>
                <CoachButton title={expandedTarget===e.id?'Hedefleri kapat':'Hedefleri düzenle'} secondary onPress={()=>setExpandedTarget(expandedTarget===e.id?'':e.id)}/>
                {expandedTarget===e.id && <>
                <View style={coachStyle.row}>
                  {(["sets", ...measurements, "rest_seconds"] as const).map(
                    (k) => (
                      <View key={k} style={{ width: 90 }}>
                        <CoachField
                          compact
                          numeric
                          label={
                            k === "sets"
                              ? "Set"
                              : k === "reps"
                                ? "Tekrar"
                                : k === "kg"
                                  ? "kg"
                                  : k === "seconds"
                                    ? "Saniye"
                                    : k === "meters"
                                      ? "Metre"
                                      : "Dinlenme sn"
                          }
                          value={numberDrafts[e.id+":"+k] ?? (e[k] == null ? "" : String(e[k]))}
                          onChange={(s) => changeTarget(e.id, k, s)}
                        />
                      </View>
                    ),
                  )}
                </View>
                <CoachButton title={targetNotes===e.id?'Notları kapat':'Not ve süperset (isteğe bağlı)'} secondary onPress={()=>setTargetNotes(targetNotes===e.id?'':e.id)}/>
                {targetNotes===e.id && <>
                <CoachField
                  compact
                  label="Antrenör notu"
                  value={e.notes}
                  onChange={(s) => changeTarget(e.id, "notes", s)}
                />
                <CoachField
                  compact
                  label="Süperset grubu (isteğe bağlı)"
                  value={e.superset ?? ""}
                  onChange={(s) => changeTarget(e.id, "superset", s)}
                />
                </>}
                <View style={coachStyle.row}>
                  <CoachButton
                    title="Yukarı"
                    secondary
                    disabled={index === 0}
                    onPress={() =>
                      update((d) => {
                        const a = [...d.exercises];
                        [a[index - 1], a[index]] = [a[index], a[index - 1]];
                        return { ...d, exercises: a };
                      })
                    }
                  />
                  <CoachButton
                    title="Aşağı"
                    secondary
                    disabled={index === (day?.exercises.length ?? 0) - 1}
                    onPress={() =>
                      update((d) => {
                        const a = [...d.exercises];
                        [a[index + 1], a[index]] = [a[index], a[index + 1]];
                        return { ...d, exercises: a };
                      })
                    }
                  />
                  <CoachButton
                    title="Çıkar"
                    secondary
                    onPress={() => Alert.alert('Egzersizi çıkar', `${entry?.name ?? 'Bu egzersiz'} bu günün taslağından çıkarılsın mı?`, [{text:'Vazgeç',style:'cancel'},{text:'Çıkar',style:'destructive',onPress:()=>update(d=>({...d,exercises:d.exercises.filter(x=>x.id!==e.id)}))}])}
                  />
                </View>
                </>}
              </CoachCard>
            );
          }}
          ListFooterComponent={
            <View style={{ gap: 14 }}>
              {!!days.length && <CoachButton title={preview ? 'Haftalık özeti gizle' : 'Haftalık özeti gör'} secondary onPress={()=>setPreview(v=>!v)}/>}
              {preview && <CoachCard compact title="Haftalık plan özeti">{days.map(d=><View key={d.id} style={{gap:4}}><Text style={coachStyle.text}>{d.name} · {d.exercises.length} egzersiz · {d.exercises.reduce((sum,e)=>sum+e.sets,0)} hedef set</Text><Text style={coachStyle.muted}>{d.dates.slice(0,3).join(' · ')}{d.dates.length>3?' · +'+(d.dates.length-3)+' seans':''}</Text></View>)}</CoachCard>}
              {id && !copy && (
                <CoachField
                  compact
                  label="Değişiklik nedeni"
                  value={reason}
                  onChange={setReason}
                />
              )}
            </View>
          }
        />
        <View
          style={{ paddingTop: 12, borderTopWidth: 1, borderColor: brand.line }}
        >
          {!!error && (
            <Text accessibilityRole="alert" style={coachStyle.error}>
              {error}
            </Text>
          )}
          <CoachButton
            title={busy ? "Kaydediliyor…" : athlete && (!id || copy) ? "Kaydet ve üyeye ata" : "Programı kaydet"}
            disabled={busy || (!!id && !source)}
            onPress={() => void save()}
          />
        </View>
      </KeyboardFrame>
      {selector && (
        <ExerciseSelector
          onClose={() => setSelector(false)}
          onSelect={add}
          onSelectMany={(items) => {
            for (const item of items) add(item);
            setSelector(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}
