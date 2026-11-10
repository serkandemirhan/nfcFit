import { useSessionClock } from "@/hooks/use-session-clock";
import {
  sessionPeriodSummary,
  sessionTimezone,
} from "@/lib/session-presentation";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { CoachingOverview, Workout } from "@/lib/coaching-types";
import { activityTrend, durationLabel } from "@/lib/workout-experience";
import { zonedDate } from "@/lib/coaching-performance";
import { CoachText as Text } from "./coaching-ui";
import { FitCard, FitChip, f, fit } from "./fitness-ui";
export function ActivityTrends({
  workouts,
  timezone: preferredTimezone,
  overview,
}: {
  workouts: Workout[];
  timezone?: string;
  overview?: CoachingOverview;
}) {
  const timezone = sessionTimezone(preferredTimezone);
  const now = useSessionClock(timezone);
  const [explanation,setExplanation]=useState(false);
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const data = activityTrend(
    workouts,
    range,
    zonedDate(now, timezone),
    timezone,
  );
  const previousDate = new Date(zonedDate(now, timezone) + "T12:00:00Z");
  previousDate.setUTCDate(previousDate.getUTCDate() - range);
  const previous = activityTrend(
    workouts,
    range,
    previousDate.toISOString().slice(0, 10),
    timezone,
  );
  const summary = overview
    ? sessionPeriodSummary(
        overview,
        data.bins[0].date,
        zonedDate(now, timezone),
        zonedDate(now, timezone),
        timezone,
      )
    : null;
  const sparse = data.count < 3;
  const max = Math.max(1, ...data.bins.map((b) => b.count));
  return (
    <FitCard compact>
      <Text style={f.sectionTitle}>Antrenman gelişimin</Text>
      <View style={[f.row, { flexWrap: "wrap" }]}>
        {([7, 30, 90] as const).map((days, i) => (
          <FitChip
            key={days}
            label={["Haftalık", "30 gün", "90 gün"][i]}
            active={range === days}
            onPress={() => setRange(days)}
          />
        ))}
      </View>
      <View
        style={[f.row, { flexWrap: "wrap", justifyContent: "space-between" }]}
      >
        <View>
          <Text style={f.heading}>{data.count}</Text>
          <Text style={f.muted}>Sonlandırılan seans</Text>
        </View>
        <View>
          <Text style={f.heading}>{data.activeDays}</Text>
          <Text style={f.muted}>Aktif gün</Text>
        </View>
        <View>
          <Text style={f.heading}>{durationLabel(data.seconds)}</Text>
          <Text style={f.muted}>Aktif dk:sn</Text>
        </View>
      </View>
      <Text style={f.body}>
        {data.sets} set kaydedildi · Önceki aynı döneme göre{" "}
        {data.count - previous.count > 0 ? "+" : ""}
        {data.count - previous.count} antrenman
      </Text>
      <Text style={f.muted}>
        Sonlandırılan seanslar · Gerçek bitiş tarihine göre
      </Text>
      {summary && (
        <View style={{ gap: 4 }}>
          <Text style={f.body}>
            {summary.completed} tamamlanan · {summary.partial} kısmi ·{" "}
            {summary.missed} kaçırılan
          </Text>
          {!!summary.skipped && (
            <Text style={f.muted}>
              {summary.skipped} seans bilinçli atlandı.
            </Text>
          )}
          <Pressable accessibilityRole="button" accessibilityState={{expanded:explanation}} style={{minHeight:44,justifyContent:'center'}} onPress={()=>setExplanation(v=>!v)}><Text style={f.link}>{explanation?'Açıklamayı gizle':'Durumlar ne anlama geliyor?'}</Text></Pressable>
          {explanation && <Text style={f.muted}>Tamamlanan: seans bitirildi. Kısmi: bazı setler yapıldı. Kaçırılan: plan tarihi geçti, seans başlamadı. Yaklaşan seanslar kaçırılan sayılmaz; kısmi setler korunur.</Text>}
        </View>
      )}
      {data.count>0&&<View accessibilityLabel="Dönemin sonlandırılan seans grafiği" style={[f.row, { alignItems: "flex-end", minHeight: sparse ? 80 : 104, gap: 6 }]}>
        {data.bins.map((b) => (
          <View
            key={b.date}
            accessible
            accessibilityLabel={
              (b.end_date === b.date ? b.date : b.date + " – " + b.end_date) +
              " · " +
              b.count +
              " antrenman"
            }
            style={{ flex: 1, alignItems: "center", gap: 7 }}
          >
            <Text style={f.muted}>{b.count}</Text>
            <View
              style={{
                height: Math.max(4, (b.count / max) * (sparse ? 28 : 60)),
                width: "70%",
                borderRadius: 5,
                backgroundColor: b.count ? fit.lime : fit.line,
              }}
            />
            <Text
              style={[
                f.muted,
                { fontSize: 10, lineHeight: 14, textAlign: "center" },
              ]}
            >
              {b.date.slice(8) + "." + b.date.slice(5, 7)}
              {b.end_date !== b.date
                ? "\n– " + b.end_date.slice(8) + "." + b.end_date.slice(5, 7)
                : ""}
            </Text>
          </View>
        ))}
      </View>}
      {!data.count && (
        <Text style={f.muted}>
          Bu dönemde sonlandırılan seans yok. Kayıt ekledikçe grafik oluşur.
        </Text>
      )}
    </FitCard>
  );
}
