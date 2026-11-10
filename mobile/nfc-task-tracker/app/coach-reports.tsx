import { StaffArea } from "@/components/staff-area";
import {
  CoachText as Text,
  CoachButton,
  CoachCard,
  CoachShell,
  coachStyle,
} from "@/components/coaching-ui";

import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { coachingRequest } from "@/lib/tenant-console";
import type { AthleteSummary } from "./coach";
export default function CoachReports() {
  return (
    <StaffArea>
      <CoachReportsContent />
    </StaffArea>
  );
}
function CoachReportsContent() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["coaching-dashboard", user?.id],
    queryFn: () => coachingRequest<AthleteSummary[]>(user!.id, "/dashboard"),
    enabled: !!user?.id,
    staleTime: 30000,
  });
  return (
    <CoachShell title="Sporcu raporları" bottom>
      {query.error && (
        <Text style={coachStyle.error}>{query.error.message}</Text>
      )}
      {query.isPending && <Text style={coachStyle.muted}>Yükleniyor…</Text>}
      {query.data && !query.error && !query.data.length && (
        <Text style={coachStyle.muted}>Henüz atanmış sporcu yok.</Text>
      )}
      {query.data?.map((a) => (
        <CoachCard key={a.id} title={a.name}>
          <Text style={coachStyle.text}>
            {a.pending_reports} rapor inceleme bekliyor
          </Text>
          <CoachButton
            title="Raporları aç / yeni hafta hesapla"
            onPress={() =>
              router.push(
                `/progress?athlete=${a.athlete_id}&tenant=${a.tenant_id}` as never,
              )
            }
          />
        </CoachCard>
      ))}
    </CoachShell>
  );
}
