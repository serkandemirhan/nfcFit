import { isClubOperator } from "@/lib/club-roles";
import { StaffArea } from "@/components/staff-area";
import {
  CoachText as Text,
  CoachButton,
  CoachCard,
  CoachField,
  CoachShell,
  coachStyle,
} from "@/components/coaching-ui";
import { useRef, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTenantIdentity } from "@/hooks/use-tenant-identity";
import { useCoachingLibrary } from "@/hooks/use-coaching";
import {
  coachingRequest,
  fetchClubManagement,
  type ClubManagementData,
} from "@/lib/tenant-console";
import { localUuid } from "@/lib/offline-store";
import { ExerciseSelector } from "@/components/exercise-selector";
import { ManagementPicker } from "@/components/management-ui";
type Equipment = {
  id: string;
  name: string;
  equipment_type: string;
  tag_id: string | null;
  exercise_ids: string[];
  active: boolean;
};
export default function EquipmentManager() {
  return (
    <StaffArea management>
      <EquipmentManagerContent />
    </StaffArea>
  );
}
function EquipmentManagerContent() {
  const { user } = useAuth();
  const identity = useTenantIdentity();
  const library = useCoachingLibrary();
  const [tenant, setTenant] = useState("");
  const [resources, setResources] = useState<ClubManagementData | null>(null);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("machine");
  const [exercises, setExercises] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const id = useRef(localUuid());
  const [select, setSelect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["coaching-equipment", user?.id, tenant],
    queryFn: () =>
      coachingRequest<Equipment[]>(user!.id, `/tenants/${tenant}/equipment`),
    enabled: !!user?.id && !!tenant,
  });
  const admins =
    identity.data?.staff.filter(
      (s) => s.status === "active" && isClubOperator(s.role),
    ) ?? [];
  const load = async (tenant: string) => {
    setTenant(tenant);
    setResources(null);
    setError("");
    try {
      setResources(await fetchClubManagement(tenant, true));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const clear = () => {
    id.current = localUuid();
    setName("");
    setTag("");
    setType("machine");
    setExercises([]);
    setActive(true);
  };
  const edit = (e: Equipment) => {
    id.current = e.id;
    setName(e.name);
    setTag(e.tag_id ?? "");
    setType(e.equipment_type);
    setExercises(e.exercise_ids);
    setActive(e.active);
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await coachingRequest(user!.id, `/tenants/${tenant}/equipment`, {
        id: id.current,
        name,
        equipment_type: type,
        tag_id: tag || null,
        exercise_ids: exercises,
        active,
      });
      await query.refetch();
      setNotice(
        "Ekipman kaydedildi. Üyeler bağlantı geldiğinde eşleşmeyi indirir.",
      );
      clear();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <CoachShell title="Ekipman ve kart eşleştirme">
      {error !== "" && (
        <Text accessibilityRole="alert" style={coachStyle.error}>
          {error}
        </Text>
      )}
      {notice !== "" && <Text style={coachStyle.text}>{notice}</Text>}
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
      {!admins.length && (
        <Text style={coachStyle.muted}>Tesis yöneticisi yetkisi gerekir.</Text>
      )}
      {resources && (
        <>
          <CoachCard title="Ekipman tanımı">
            <CoachField label="Ekipman adı" value={name} onChange={setName} />
            <CoachField label="Ekipman türü" value={type} onChange={setType} />
            <ManagementPicker
              label="Kayıtlı NFC kartı"
              value={tag}
              onChange={setTag}
              options={[
                { label: "Kart bağlı değil", value: "" },
                ...resources.tags.map((t) => ({
                  label: t.name + " · " + t.uid,
                  value: t.id,
                })),
              ]}
            />
            <CoachButton
              title="Uyumlu egzersiz ekle"
              secondary
              onPress={() => setSelect(true)}
            />
            {exercises.map((eid) => (
              <View key={eid} style={coachStyle.row}>
                <Text style={coachStyle.text}>
                  {library.data?.find((e) => e.id === eid)?.name ?? eid}
                </Text>
                <CoachButton
                  title="Çıkar"
                  secondary
                  onPress={() =>
                    setExercises((a) => a.filter((id) => id !== eid))
                  }
                />
              </View>
            ))}
            <CoachButton
              title={active ? "Aktif · Pasife al" : "Pasif · Aktifleştir"}
              secondary
              onPress={() => setActive(!active)}
            />
            <CoachButton
              title="Ekipmanı kaydet"
              disabled={busy || name.trim().length < 2 || !exercises.length}
              onPress={() => void save()}
            />
            <CoachButton
              title="Yeni tanım / temizle"
              secondary
              onPress={clear}
            />
          </CoachCard>
          {query.data?.map((e) => (
            <CoachCard key={e.id} title={e.name}>
              <Text style={coachStyle.muted}>
                {e.active ? "Aktif" : "Pasif"} · {e.exercise_ids.length} uyumlu
                egzersiz
              </Text>
              <CoachButton title="Düzenle" secondary onPress={() => edit(e)} />
            </CoachCard>
          ))}
        </>
      )}
      {select && (
        <ExerciseSelector
          onClose={() => setSelect(false)}
          onSelect={(e) => {
            setExercises((a) => [...new Set([...a, e.id])]);
            setSelect(false);
          }}
        />
      )}
    </CoachShell>
  );
}
