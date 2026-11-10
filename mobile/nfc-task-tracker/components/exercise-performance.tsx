import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import type { Workout } from "@/lib/coaching-types";
import { exercisePerformance } from "@/lib/coaching-performance";
import {
  CoachText as Text,
  CoachCard,
  CoachButton,
  coachStyle,
  brand,
} from "./coaching-ui";
export function ExercisePerformance({
  workouts,
  timezone,
}: {
  workouts: Workout[];
  timezone?: string;
}) {
  const series = useMemo(
    () => exercisePerformance(workouts, timezone),
    [workouts, timezone],
  );
  const [selected, setSelected] = useState("");
  const entry = series.find((s) => s.id === selected) ?? series[0];
  const days = entry?.days.slice(-7) ?? [];
  const volume = days.some((d) => d.volume != null);
  const max = Math.max(
    1,
    ...days.map((d) => (volume ? (d.volume ?? 0) : d.sets)),
  );
  return (
    <CoachCard title="Egzersiz gelişimi">
      {!entry ? (
        <Text style={coachStyle.muted}>
          Karşılaştırma için henüz gerçekleşen set yok.
        </Text>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[coachStyle.row, { flexWrap: "nowrap" }]}
          >
            {series.map((s) => (
              <CoachButton
                key={s.id}
                title={s.name}
                secondary={s.id !== entry.id}
                onPress={() => setSelected(s.id)}
              />
            ))}
          </ScrollView>
          <Text style={coachStyle.text}>
            {entry.name} ·{" "}
            {volume ? "Kayıtlı hacim (kg × tekrar)" : "Kaydedilen set sayısı"}
          </Text>
          <Text style={coachStyle.muted}>
            Eksik ağırlıklar tahmin edilmez. Grafik yapılan setin tarihini
            kullanır; planlanan tarihten farklı olabilir.
          </Text>
          <View
            style={[
              coachStyle.row,
              { height: 130, alignItems: "flex-end", flexWrap: "nowrap" },
            ]}
          >
            {days.length >= 2 && (
              <View style={{ gap: 5 }}>
                <Text style={coachStyle.sub}>Önceki kayıtlı güne göre</Text>
                <Text style={coachStyle.muted}>
                  {days[days.length - 2].date} → {days[days.length - 1].date}
                </Text>
                {(
                  [
                    ["reps", "tekrar"],
                    ["maxKg", "kg"],
                    ["seconds", "sn"],
                    ["meters", "m"],
                  ] as const
                ).map(([key, unit]) => {
                  const before = days[days.length - 2][key],
                    after = days[days.length - 1][key];
                  if (before == null || after == null) return null;
                  const delta = after - before;
                  return (
                    <Text key={key} style={coachStyle.text}>
                      {key === "maxKg" ? "En yüksek ağırlık" : "Kayıtlı toplam"}
                      : {before} → {after} {unit} ({delta > 0 ? "+" : ""}
                      {delta.toLocaleString("tr-TR")} {unit})
                    </Text>
                  );
                })}
                <Text style={coachStyle.muted}>
                  Günlük toplamlar yapılan set sayısına göre değişebilir.
                </Text>
              </View>
            )}
            {days.map((d) => (
              <View
                key={d.date}
                style={{ flex: 1, alignItems: "center", gap: 6 }}
              >
                <Text style={coachStyle.muted}>
                  {volume ? (d.volume ?? "—") : d.sets}
                </Text>
                <View
                  style={{
                    height: Math.max(
                      3,
                      ((volume ? (d.volume ?? 0) : d.sets) / max) * 75,
                    ),
                    width: "65%",
                    borderRadius: 5,
                    backgroundColor:
                      volume && d.volume == null ? brand.line : brand.lime,
                  }}
                />
                <Text style={coachStyle.muted}>{d.date.slice(5)}</Text>
              </View>
            ))}
          </View>
          {days.map((d) => (
            <Text key={d.date} style={coachStyle.muted}>
              {d.date}: {d.sets} set · {d.reps ?? "—"} tekrar · En yüksek
              kayıtlı ağırlık {d.maxKg ?? "—"} kg
              {d.seconds != null ? " · " + d.seconds + " sn" : ""}
              {d.meters != null ? " · " + d.meters + " m" : ""}
            </Text>
          ))}
        </>
      )}
    </CoachCard>
  );
}
