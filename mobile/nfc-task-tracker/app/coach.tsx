import { planTemplateTenants } from "@/lib/plan-draft";
import { isClubOperator } from "@/lib/club-roles";
import { StaffArea } from "@/components/staff-area";
import {
  CoachText as Text,
  brand,
  CoachButton,
  CoachCard,
  CoachField,
  CoachShell,
  coachStyle,
  percent,
} from "@/components/coaching-ui";
import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  canOpenManagement,
  useTenantIdentity,
} from "@/hooks/use-tenant-identity";
import {
  coachingRequest,
  fetchClubManagement,
  type ClubManagementData,
} from "@/lib/tenant-console";
import { ManagementPicker } from "@/components/management-ui";
export type AthleteSummary = {
  id: string;
  athlete_id: string;
  tenant_id: string;
  name: string;
  active_plans: number;
  completion_rate: number | null;
  missed: number;
  unreviewed_changes: number;
  unread_messages: number;
  pending_reports: number;
};
export default function CoachDashboard() {
  return (
    <StaffArea>
      <CoachDashboardContent />
    </StaffArea>
  );
}
function CoachDashboardContent() {
  const { user } = useAuth();
  const identity = useTenantIdentity();
  const query = useQuery({
    queryKey: ["coaching-dashboard", user?.id],
    queryFn: () => coachingRequest<AthleteSummary[]>(user!.id, "/dashboard"),
    enabled: !!user?.id,
    staleTime: 30000,
  });
  const [filter, setFilter] = useState("");
  const [attention, setAttention] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("");
  const [tenant, setTenant] = useState("");
  const [resources, setResources] = useState<ClubManagementData | null>(null);
  const [trainer, setTrainer] = useState("");
  const [athlete, setAthlete] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const admins =
    identity.data?.staff.filter(
      (s) => s.status === "active" && isClubOperator(s.role),
    ) ?? [];
  const load = async (id: string) => {
    setTenant(id);
    setResources(null);
    setError("");
    setBusy(true);
    try {
      const r = await fetchClubManagement(id, true);
      setResources(r);
      setTrainer(r.staff[0]?.account_id ?? "");
      setAthlete(
        r.members.find((m) => m.status === "active")?.account_id ?? "",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const assign = async () => {
    setBusy(true);
    setError("");
    try {
      await coachingRequest(user!.id, `/tenants/${tenant}/assignments`, {
        trainer_id: trainer,
        athlete_id: athlete,
        active: true,
      });
      await query.refetch();
      setResources(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const rows = (query.data ?? []).filter(
    (a) =>
      (!filter ||
        a.name
          .toLocaleLowerCase("tr")
          .includes(filter.toLocaleLowerCase("tr"))) &&
      (!reviewFilter || Number(a[reviewFilter as keyof AthleteSummary]) > 0) &&
      (!attention ||
        a.missed +
          a.unreviewed_changes +
          a.unread_messages +
          a.pending_reports >
          0),
  );
  return (
    <CoachShell title="Antrenör paneli" bottom>
      {error !== "" && <Text style={coachStyle.error}>{error}</Text>}
      {query.error && (
        <Text style={coachStyle.error}>{query.error.message}</Text>
      )}
      <View style={coachStyle.row}>
        <CoachButton
          title="Programlar"
          onPress={() => router.push("/(drawer)/plans" as never)}
        />
        <CoachButton
          title="Yenile"
          secondary
          onPress={() => void query.refetch()}
        />
        {canOpenManagement(identity.data) && (
          <CoachButton
            title="Tesis yönetimi"
            secondary
            onPress={() => router.push("/(drawer)/management" as never)}
          />
        )}
      </View>
      <CoachCard title="Plan şablonları">{planTemplateTenants(identity.data).map(s=><CoachButton key={s.tenant_id} title={`${s.tenant_name} · Şablon oluştur`} onPress={()=>router.push(`/plan-builder?tenant=${s.tenant_id}` as never)}/>)}</CoachCard>
      <CoachField label="Sporcu ara" value={filter} onChange={setFilter} />
      <CoachButton
        title={attention ? "Tüm sporcular" : "İlgi bekleyen sporcular"}
        secondary
        onPress={() => setAttention(!attention)}
      />
      <ManagementPicker
        label="İnceleme filtresi"
        value={reviewFilter}
        onChange={setReviewFilter}
        options={[
          { label: "Tüm durumlar", value: "" },
          { label: "Kaçırılan seans", value: "missed" },
          { label: "İncelenmemiş değişiklik", value: "unreviewed_changes" },
          { label: "Okunmamış mesaj", value: "unread_messages" },
          { label: "Bekleyen rapor", value: "pending_reports" },
        ]}
      />
      {query.isPending && (
        <Text style={coachStyle.muted}>Atanmış sporcular yükleniyor…</Text>
      )}
      {!query.isPending && !rows.length && (
        <CoachCard title="Sporcu bulunamadı">
          <Text style={coachStyle.muted}>
            Yalnızca aktif olarak sana atanmış sporcular görünür. Tesis
            yöneticisi Yönetim → Personel bölümünden atama yapabilir.
          </Text>
        </CoachCard>
      )}
      {rows.map((a) => (
        <CoachCard key={a.id} title={a.name}>
          <Text style={coachStyle.text}>
            {a.active_plans} program · Haftalık tamamlama{" "}
            {percent(a.completion_rate)}
          </Text>
          <Text style={{ color: a.missed ? brand.danger : brand.muted }}>
            {a.missed} kaçırılan seans · {a.unreviewed_changes} incelenmemiş
            değişiklik
          </Text>
          <Text style={coachStyle.muted}>
            {a.unread_messages} okunmamış mesaj · {a.pending_reports} rapor
            bekliyor
          </Text>
          <CoachButton
            title="Sporcu detayını aç"
            onPress={() =>
              router.push(
                `/athlete?id=${a.athlete_id}&tenant=${a.tenant_id}` as never,
              )
            }
          />
        </CoachCard>
      ))}
      {admins.length > 0 && (
        <CoachCard title="Antrenör–sporcu ataması">
          <Text style={coachStyle.muted}>
            Bu yönetim yetkisi özel kayıtlara kendiliğinden erişim vermez. Tesis
            üyeliği ve personel hesabı aktif olmalı.
          </Text>
          <View style={coachStyle.row}>
            {admins.map((s) => (
              <CoachButton
                key={s.tenant_id}
                title={s.tenant_name}
                secondary
                disabled={busy}
                onPress={() => void load(s.tenant_id)}
              />
            ))}
          </View>
          {resources && (
            <>
              <ManagementPicker
                label="Antrenör"
                value={trainer}
                onChange={setTrainer}
                options={resources.staff
                  .filter((s) => s.status === "active")
                  .map((s) => ({ label: s.name, value: s.account_id }))}
              />
              <ManagementPicker
                label="Sporcu"
                value={athlete}
                onChange={setAthlete}
                options={resources.members
                  .filter((s) => s.status === "active")
                  .map((s) => ({ label: s.name, value: s.account_id }))}
              />
              <CoachButton
                title="Atamayı kaydet"
                disabled={busy || !trainer || !athlete}
                onPress={() => void assign()}
              />
            </>
          )}
        </CoachCard>
      )}
    </CoachShell>
  );
}
