import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCoaching } from "@/hooks/use-coaching";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { localUuid } from "@/lib/offline-store";
import { offlineChanged } from "@/lib/offline-sync";
import {
  CoachButton,
  CoachCard,
  CoachField,
  CoachText,
  coachStyle,
} from "./coaching-ui";

export function AccountTimezone() {
  const { user } = useAuth();
  const query = useCoaching();
  const [zone, setZone] = useState("Europe/Istanbul");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (query.data?.timezone) setZone(query.data.timezone);
  }, [query.data?.timezone]);
  const save = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const timezone = zone.trim();
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
      await coachingStore.queueEntry(
        user.id,
        localUuid(),
        "/coaching/preferences",
        { timezone },
      );
      offlineChanged(user.id);
      setNotice("Telefona kaydedildi · Eşitleme bekliyor");
      void syncCoaching(user.id).catch(() => undefined);
    } catch {
      setNotice("Geçerli bir IANA saat dilimi gir.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <CoachCard title="Saat dilimi">
      <CoachText style={coachStyle.muted}>
        Raporlar ve günlük özetler bu saat dilimini kullanır. Mevcut
        programların takvimi değişmez.
      </CoachText>
      <CoachField
        label="IANA saat dilimi (ör. Europe/Istanbul)"
        value={zone}
        onChange={setZone}
      />
      <CoachButton
        title="Telefonun saat dilimini kullan"
        secondary
        onPress={() =>
          setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
        }
      />
      <CoachButton
        title={busy ? "Kaydediliyor…" : "Saat dilimini kaydet"}
        disabled={busy || !query.data}
        onPress={() => void save()}
      />
      {!!notice && (
        <CoachText accessibilityRole="alert" style={coachStyle.muted}>
          {notice}
        </CoachText>
      )}
    </CoachCard>
  );
}
