import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useCoaching } from "@/hooks/use-coaching";
import type { Plan } from "@/lib/coaching-types";
import { coachingRequest } from "@/lib/tenant-console";
import { offlineStore } from "@/lib/offline-store";
import { CoachText as Text } from "./coaching-ui";
import { FitButton, f } from "./fitness-ui";

type Revision = {
  id: string;
  version: number;
  created_at: string;
  reason: string;
  actor_id: string;
};
export function PlanCoachContext({ plan }: { plan: Plan }) {
  const { user } = useAuth();
  const { data } = useCoaching();
  const link = data?.links.find(
    (l) =>
      l.athlete_id === plan.athlete_id &&
      l.tenant_id === plan.tenant_id &&
      l.trainer_id === plan.owner_id,
  );
  const query = useQuery({
    queryKey: ["member-plan-context", user?.id, plan.id, plan.version],
    enabled: !!user && !!link,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const key = `plan-context:${plan.id}:${plan.version}`;
      try {
        const versions = await coachingRequest<Revision[]>(
          user!.id,
          `/plans/${plan.id}/versions`,
        );
        const latest = versions.find((v) => v.version === plan.version) ?? null;
        if (latest) await offlineStore.putDoc(user!.id, key, latest);
        return latest;
      } catch {
        return await offlineStore.getDoc<Revision>(user!.id, key);
      }
    },
  });
  if (!link) return null;
  const latest = query.data;
  const comments = latest
    ? (data?.messages ?? []).filter(
        (m) =>
          m.link_id === link.id &&
          m.context_type === "revision" &&
          m.context_id === latest.id &&
          m.sync_state !== "rejected",
      )
    : [];
  return (
    <View style={{ gap: 8 }}>
      <Text style={f.body}>Antrenörün: {link.name}</Text>
      <Text style={f.muted}>
        Sürüm {plan.version}
        {latest
          ? " · Son güncelleme: " +
            new Date(latest.created_at).toLocaleDateString("tr-TR")
          : ""}
      </Text>
      {!!latest?.reason && <Text style={f.muted}>{latest.reason}</Text>}
      <Text style={f.muted}>
        Kendi düzenlemelerin antrenör incelemesine gönderilir. Geçmiş ve bugünkü
        set hedeflerin korunur.
      </Text>
      {comments.slice(0, 1).map((m) => (
        <Text key={m.id} style={f.body}>
          {m.author_id === data?.account_id ? "Sen" : link.name}: {m.body}
        </Text>
      ))}
      <FitButton
        title={
          latest ? "Bu program hakkında yaz" : "Program sürümleri ve yorumlar"
        }
        secondary
        icon="chatbubble-outline"
        onPress={() =>
          router.push(
            (latest
              ? `/messages?link_id=${link.id}&context_type=revision&context_id=${latest.id}`
              : `/plan-versions?id=${plan.id}`) as never,
          )
        }
      />
    </View>
  );
}
