import { StaffArea } from "@/components/staff-area";
import { useState } from "react";
import {
  CoachText as Text,
  CoachButton,
  CoachCard,
  CoachShell,
  coachStyle,
} from "@/components/coaching-ui";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useCoachingLibrary } from "@/hooks/use-coaching";
import { coachingRequest } from "@/lib/tenant-console";
import type { PlanContent } from "@/lib/coaching-types";
type Version = {
  id: string;
  version: number;
  actor_id: string;
  actor_role: string;
  reason: string;
  review_status: string;
  content: PlanContent;
  previous: PlanContent | null;
  created_at: string;
};
export default function Versions() {
  const { athlete } = useLocalSearchParams<{ athlete?: string }>();
  return athlete ? (
    <StaffArea>
      <VersionsContent />
    </StaffArea>
  ) : (
    <VersionsContent />
  );
}
function VersionsContent() {
  const { id, athlete } = useLocalSearchParams<{
    id: string;
    athlete?: string;
  }>();
  const { user } = useAuth();
  const library = useCoachingLibrary();
  const [reviewError, setReviewError] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [showPrevious, setShowPrevious] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["coaching-versions", user?.id, id],
    queryFn: () =>
      coachingRequest<Version[]>(user!.id, `/plans/${id}/versions`),
    enabled: !!user?.id,
    staleTime: 0,
  });
  return (
    <CoachShell title="Program sürümleri">
      {reviewError !== "" && (
        <Text accessibilityRole="alert" style={coachStyle.error}>
          {reviewError}
        </Text>
      )}
      {query.error && (
        <Text style={coachStyle.error}>{query.error.message}</Text>
      )}
      {query.isPending && (
        <Text style={coachStyle.muted}>Sürümler yükleniyor…</Text>
      )}
      {query.data?.map((v) => (
        <CoachCard key={v.id} title={`Sürüm ${v.version}`}>
          <Text style={coachStyle.muted}>
            {new Date(v.created_at).toLocaleString("tr-TR")} ·{" "}
            {v.actor_role === "athlete" ? "Sporcu" : "Antrenör"} ·{" "}
            {v.review_status === "reviewed" ? "İncelendi" : "İnceleme bekliyor"}
          </Text>
          {v.reason !== "" && (
            <Text style={coachStyle.text}>Neden: {v.reason}</Text>
          )}
          {v.content.days.map((d) => (
            <View key={d.id} style={{ gap: 6 }}>
              <Text style={coachStyle.sub}>
                {d.name} · {d.dates.join(", ")}
              </Text>
              {d.exercises.map((e) => {
                const previousDay =
                  v.previous?.days.find((old) => old.id === d.id) ??
                  v.previous?.days.find((old) =>
                    old.dates.some((dt) => d.dates.includes(dt)),
                  );
                const old = previousDay?.exercises.find((x) => x.id === e.id);
                return (
                  <Text key={e.id} style={coachStyle.muted}>
                    {library.data?.find((x) => x.id === e.exercise_id)?.name ??
                      e.exercise_id}
                    :{" "}
                    {old
                      ? `${old.sets} × ${old.reps ?? old.seconds ?? old.meters} / ${old.kg ?? "—"} kg → `
                      : "Yeni: "}
                    {e.sets} × {e.reps ?? e.seconds ?? e.meters} / {e.kg ?? "—"}{" "}
                    kg
                  </Text>
                );
              })}
            </View>
          ))}
          {athlete && v.review_status === "unreviewed" && (
            <CoachButton
              title="İncelendi olarak işaretle"
              disabled={reviewBusy}
              onPress={() => {
                setReviewBusy(true);
                setReviewError("");
                void coachingRequest(
                  user!.id,
                  `/plans/${id}/versions/${v.version}/review`,
                  {},
                )
                  .then(() => query.refetch())
                  .catch((e) => setReviewError(e.message))
                  .finally(() => setReviewBusy(false));
              }}
            />
          )}
          {v.previous && (
            <>
              <CoachButton
                title={
                  showPrevious.includes(v.id)
                    ? "Önceki hedefleri gizle"
                    : "Önceki hedeflerin tamamını göster"
                }
                secondary
                onPress={() =>
                  setShowPrevious((ids) =>
                    ids.includes(v.id)
                      ? ids.filter((id) => id !== v.id)
                      : [...ids, v.id],
                  )
                }
              />
              {showPrevious.includes(v.id) &&
                v.previous.days.map((d) => (
                  <View key={d.id} style={{ gap: 6 }}>
                    <Text style={coachStyle.sub}>
                      Önce: {d.name} · {d.dates.join(", ")}
                    </Text>
                    {d.exercises.map((e) => (
                      <Text key={e.id} style={coachStyle.muted}>
                        {library.data?.find((x) => x.id === e.exercise_id)
                          ?.name ?? e.exercise_id}
                        : {e.sets} set · {e.reps ?? "—"} tekrar · {e.kg ?? "—"}{" "}
                        kg · {e.seconds ?? "—"} sn · {e.meters ?? "—"} m
                      </Text>
                    ))}
                  </View>
                ))}
            </>
          )}
          <CoachButton
            title="Bu sürüm hakkında yaz"
            secondary
            onPress={() =>
              router.push(
                `/messages?${athlete ? "athlete=" + athlete + "&" : ""}context_type=revision&context_id=${v.id}` as never,
              )
            }
          />
        </CoachCard>
      ))}
    </CoachShell>
  );
}
