import { zonedDate } from "@/lib/coaching-performance";
import {
  CoachText as Text,
  brand,
  CoachButton,
  CoachCard,
  CoachField,
  coachStyle,
} from "@/components/coaching-ui";
import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useCoaching } from "@/hooks/use-coaching";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { localUuid } from "@/lib/offline-store";
import { offlineChanged } from "@/lib/offline-sync";
import { coachingRequest } from "@/lib/tenant-console";
const kinds = {
  water: "Su",
  coffee: "Kahve",
  sleep: "Uyku",
  wellbeing: "İyi hissetme",
};
export function ExpandedWellness() {
  const { user } = useAuth();
  const query = useCoaching();
  const [tab, setTab] = useState<keyof typeof kinds>("water");
  const [amount, setAmount] = useState("250");
  const [coffee, setCoffee] = useState("Filtre");
  const [caffeine, setCaffeine] = useState("");
  const [quality, setQuality] = useState("3");
  const [energy, setEnergy] = useState("3");
  const [mood, setMood] = useState("3");
  const [fatigue, setFatigue] = useState("3");
  const [recovery, setRecovery] = useState("3");
  const [notes, setNotes] = useState("");
  const [goal, setGoal] = useState("2000");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = query.data?.wellness ?? [];
  const today = zonedDate(new Date(), query.data?.timezone);
  const todayRows = rows.filter(
    (r) =>
      zonedDate(new Date(r.occurred_at), query.data?.timezone) === today &&
      r.sync_state !== "rejected",
  );
  const water = todayRows
    .filter((r) => r.kind === "water")
    .reduce((s, r) => s + (r.content.amount ?? 0), 0);
  const daily = query.data?.water_goal_ml ?? 2000;
  const save = async (kind: keyof typeof kinds, value?: number) => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const number = (s: string) =>
        s.trim() === "" ? null : Number(s.replace(",", "."));
      const quantity = value ?? number(amount);
      if (
        kind !== "wellbeing" &&
        (!quantity ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          quantity > 10000 ||
          (kind === "sleep" && quantity > 1440))
      )
        throw new Error("Geçerli miktar gir (uyku dakika, diğerleri ml).");
      if (kind === "coffee" && !coffee.trim())
        throw new Error("Kahve türünü gir.");
      for (const s of kind === "sleep"
        ? [quality]
        : kind === "wellbeing"
          ? [energy, mood, fatigue, recovery]
          : [])
        if (!Number.isInteger(number(s)) || Number(s) < 1 || Number(s) > 5)
          throw new Error("Değerlendirmeler 1–5 olmalı.");
      if (
        kind === "coffee" &&
        caffeine.trim() &&
        (!Number.isFinite(number(caffeine)) ||
          Number(caffeine) < 0 ||
          Number(caffeine) > 2000)
      )
        throw new Error("Kafein miktarı geçersiz.");
      const id = localUuid();
      await coachingStore.queueEntry(user!.id, id, "/coaching/wellness", {
        id,
        kind,
        occurred_at: new Date().toISOString(),
        notes,
        ...(kind === "water"
          ? { amount: quantity }
          : kind === "coffee"
            ? {
                amount: quantity,
                coffee_type: coffee,
                caffeine_mg: number(caffeine),
              }
            : kind === "sleep"
              ? { amount: quantity, quality: number(quality) }
              : {
                  energy: number(energy),
                  mood: number(mood),
                  fatigue: number(fatigue),
                  recovery: number(recovery),
                }),
      });
      offlineChanged(user!.id);
      setNotice("Telefona kaydedildi · Eşitleme bekliyor");
      setNotes("");
      void syncCoaching(user!.id).catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeGoal = async () => {
    const value = Number(goal);
    if (!Number.isInteger(value) || value < 1 || value > 10000) {
      setError("Hedef 1–10000 ml aralığında tam sayı olmalı.");
      return;
    }
    setBusy(true);setError('');
    try {
    await coachingStore.queueEntry(
      user!.id,
      localUuid(),
      "/coaching/wellness/goal",
      { water_goal_ml: value },
    );
    offlineChanged(user!.id);
    void syncCoaching(user!.id).catch(() => undefined);
      setNotice('Günlük su hedefi telefona kaydedildi · Eşitleme bekliyor');
    } catch (error) {setError(error instanceof Error ? error.message : 'Su hedefi kaydedilemedi.');}
    finally {setBusy(false);}

  };
  return (
    <View style={{ gap: 16 }}>
      {error !== "" && (
        <Text accessibilityRole="alert" style={coachStyle.error}>
          {error}
        </Text>
      )}
      {notice !== "" && (
        <Text accessibilityLiveRegion="polite" style={{ color: brand.lime }}>
          {notice}
        </Text>
      )}
      <CoachCard title="Günün su takibi">
        <Text style={coachStyle.text}>
          {water} / {daily} ml · {Math.max(0, daily - water)} ml kaldı
        </Text>
        <View
          style={{ height: 8, backgroundColor: brand.line, borderRadius: 8 }}
        >
          <View
            style={{
              height: 8,
              width: `${Math.min(100, (water / daily) * 100)}%`,
              backgroundColor: brand.lime,
              borderRadius: 8,
            }}
          />
        </View>
        <View style={coachStyle.row}>
          {[150, 250, 500].map((ml) => (
            <CoachButton
              key={ml}
              title={`+${ml} ml`}
              disabled={busy}
              onPress={() => void save("water", ml)}
            />
          ))}
        </View>
        <CoachField
          label="Günlük su hedefim (ml)"
          value={goal}
          onChange={setGoal}
          numeric
        />
        <CoachButton
          title="Hedefi güncelle"
          secondary
          onPress={() => void changeGoal().catch((e) => setError(e.message))}
        />
        <Text style={coachStyle.muted}>
          Hedef sana ait bir tercihtir. Kahve kayıtları su toplamına eklenmez.
        </Text>
      </CoachCard>
      <View style={coachStyle.row}>
        {(Object.keys(kinds) as (keyof typeof kinds)[]).map((k) => (
          <CoachButton
            key={k}
            title={kinds[k]}
            secondary={tab !== k}
            onPress={() => {
              setTab(k);
              setAmount(k === "sleep" ? "480" : "250");
            }}
          />
        ))}
      </View>
      <CoachCard title={`${kinds[tab]} kaydı`}>
        {tab !== "wellbeing" && (
          <CoachField
            label={tab === "sleep" ? "Uyku süresi (dakika)" : "Miktar (ml)"}
            numeric
            value={amount}
            onChange={setAmount}
          />
        )}{" "}
        {tab === "coffee" && (
          <>
            <CoachField
              label="Kahve türü"
              value={coffee}
              onChange={setCoffee}
            />
            <CoachField
              label="Kafein (mg, isteğe bağlı)"
              numeric
              value={caffeine}
              onChange={setCaffeine}
            />
          </>
        )}
        {tab === "sleep" && (
          <CoachField
            label="Uyku kalitesi (1–5)"
            numeric
            value={quality}
            onChange={setQuality}
          />
        )}{" "}
        {tab === "wellbeing" && (
          <>
            {[
              { label: "Enerji (1–5)", value: energy, set: setEnergy },
              { label: "Ruh hali (1–5)", value: mood, set: setMood },
              { label: "Yorgunluk (1–5)", value: fatigue, set: setFatigue },
              {
                label: "Toparlanma hissi (1–5)",
                value: recovery,
                set: setRecovery,
              },
            ].map((f) => (
              <CoachField
                key={f.label}
                label={f.label}
                numeric
                value={f.value}
                onChange={f.set}
              />
            ))}
          </>
        )}
        <CoachField
          label="Not (isteğe bağlı)"
          value={notes}
          onChange={setNotes}
        />
        <CoachButton
          title="Telefona kaydet"
          disabled={busy}
          onPress={() => void save(tab)}
        />
      </CoachCard>
      <CoachCard title="Son 7 gün">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today + "T12:00:00Z");
          d.setUTCDate(d.getUTCDate() - i);
          const date = d.toISOString().slice(0, 10);
          const entries = rows.filter(
            (r) =>
              r.kind === tab &&
              r.sync_state !== "rejected" &&
              zonedDate(new Date(r.occurred_at), query.data?.timezone) === date,
          );
          const total = entries.reduce(
            (s, r) => s + (r.content.amount ?? 0),
            0,
          );
          return (
            <Text key={date} style={coachStyle.muted}>
              {date}:{" "}
              {entries.length
                ? tab === "wellbeing"
                  ? `${entries.length} değerlendirme`
                  : `${total} ${tab === "sleep" ? "dakika" : "ml"}`
                : "Kayıt yok"}
            </Text>
          );
        })}
      </CoachCard>
      <CoachCard title="Kayıt geçmişi">
        {rows
          .filter((r) => r.kind === tab)
          .slice(0, 30)
          .map((r) => (
            <View key={r.id} style={{ gap: 5 }}>
              <Text style={coachStyle.text}>
                {new Date(r.occurred_at).toLocaleString("tr-TR")} ·{" "}
                {r.content.amount ?? ""}{" "}
                {r.kind === "sleep" ? "dk" : r.kind === "wellbeing" ? "" : "ml"}{" "}
                {r.content.coffee_type ?? ""}
              </Text>
              {r.kind === "wellbeing" && (
                <Text style={coachStyle.muted}>
                  Enerji {r.content.energy} · Ruh hali {r.content.mood} ·
                  Yorgunluk {r.content.fatigue} · Toparlanma{" "}
                  {r.content.recovery}
                </Text>
              )}
              {r.content.notes && (
                <Text style={coachStyle.muted}>{r.content.notes}</Text>
              )}
              <Text
                style={
                  r.sync_state === "rejected"
                    ? coachStyle.error
                    : coachStyle.muted
                }
              >
                {r.sync_state === "rejected"
                  ? r.sync_error
                  : r.sync_state === "pending"
                    ? "Eşitleme bekliyor"
                    : "Eşitlendi"}
              </Text>
            </View>
          ))}
      </CoachCard>
      <CoachCard title="Antrenörle paylaşım">
        <Text style={coachStyle.muted}>
          Başlangıçta tüm ölçütler özeldir. Paylaşım değişiklikleri için
          internet gerekir.
        </Text>
        {query.data?.links
          .filter((l) => l.athlete_id === query.data?.account_id)
          .map((l) => (
            <View key={l.id} style={{ gap: 8 }}>
              <Text style={coachStyle.text}>{l.name}</Text>
              {(Object.keys(kinds) as (keyof typeof kinds)[]).map((kind) => {
                const allowed = query.data?.consents.some(
                  (c) =>
                    c.trainer_id === l.trainer_id &&
                    c.kind === kind &&
                    c.allowed,
                );
                return (
                  <CoachButton
                    key={kind}
                    title={`${kinds[kind]}: ${allowed ? "Paylaşım açık · Kapat" : "Özel · Paylaş"}`}
                    secondary
                    onPress={() =>
                      void coachingRequest(user!.id, "/wellness/consent", {
                        trainer_id: l.trainer_id,
                        kind,
                        allowed: !allowed,
                      })
                        .then(() => syncCoaching(user!.id))
                        .catch((e) => setError(e.message))
                    }
                  />
                );
              })}
            </View>
          ))}
      </CoachCard>
    </View>
  );
}
