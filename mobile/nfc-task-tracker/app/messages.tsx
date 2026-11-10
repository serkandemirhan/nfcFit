import { StaffArea } from "@/components/staff-area";
import {
  CoachText as Text,
  brand,
  CoachButton,
  CoachCard,
  CoachField,
  CoachShell,
  CoachQueryState,
  coachStyle,
} from "@/components/coaching-ui";
import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useCoaching } from "@/hooks/use-coaching";
import { useAuth } from "@/hooks/use-auth";
import { coachingRequest } from "@/lib/tenant-console";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { localUuid } from "@/lib/offline-store";
import { offlineChanged } from "@/lib/offline-sync";
export default function Messages() {
  const { athlete } = useLocalSearchParams<{ athlete?: string }>();
  return athlete ? (
    <StaffArea>
      <MessagesContent />
    </StaffArea>
  ) : (
    <MessagesContent />
  );
}
function MessagesContent() {
  const { athlete, context_type, context_id, link_id } = useLocalSearchParams<{
    athlete?: string;
    context_type?: string;
    context_id?: string;
    link_id?: string;
  }>();
  const { user } = useAuth();
  const query = useCoaching();
  const [linkId, setLinkId] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const data = query.data;
  const links =
    data?.links.filter((l) => !athlete || l.athlete_id === athlete) ?? [];
  const selected =
    links.find((l) => l.id === (linkId || link_id)) ??
    (link_id ? undefined : links[0]);
  const messages = (data?.messages ?? []).filter(
    (m) =>
      m.link_id === selected?.id &&
      (!context_id ||
        (m.context_id === context_id &&
          (!context_type || m.context_type === context_type))),
  );
  const send = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const id = localUuid();
      await coachingStore.queueEntry(user!.id, id, "/coaching/messages", {
        id,
        link_id: selected.id,
        body: body.trim(),
        context_type: context_type ?? "general",
        context_id: context_id ?? null,
      });
      setBody("");
      setNotice("Mesaj telefona kaydedildi · Eşitleme bekliyor");
      offlineChanged(user!.id);
      void syncCoaching(user!.id).catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <CoachShell title="Mesajlar ve bildirimler" bottom>
      {error !== "" && (
        <Text accessibilityRole="alert" style={coachStyle.error}>
          {error}
        </Text>
      )}
      {notice !== "" && <Text style={{ color: brand.lime }}>{notice}</Text>}
      <CoachQueryState pending={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
      {!!link_id && !selected && (
        <Text style={coachStyle.error}>
          Bu program için aktif antrenör ilişkisi bulunamadı.
        </Text>
      )}
      {!link_id && (
        <View style={coachStyle.row}>
          {links.map((l) => (
            <CoachButton
              key={l.id}
              title={l.name}
              secondary={l.id !== selected?.id}
              onPress={() => setLinkId(l.id)}
            />
          ))}
        </View>
      )}
      {!!data && !links.length && (
        <CoachCard title="Aktif antrenör ilişkisi yok">
          <Text style={coachStyle.muted}>
            Mesajlaşma için tesis yöneticisinin antrenör ataması yapması
            gerekir.
          </Text>
        </CoachCard>
      )}
      {selected && (
        <CoachCard
          title={context_id ? "Bu kayda ilişkin mesajlar" : selected.name}
        >
          <CoachField
            label="Mesajın"
            value={body}
            onChange={setBody}
            multiline
          />
          <CoachButton
            title={busy ? "Kaydediliyor…" : "Mesajı gönder"}
            disabled={busy || !body.trim()}
            onPress={() => void send()}
          />
          {!messages.length && (
            <Text style={coachStyle.muted}>Henüz mesaj yok.</Text>
          )}
          {messages.map((m) => (
            <View
              key={m.id}
              style={{
                gap: 7,
                borderTopWidth: 1,
                borderColor: brand.line,
                paddingTop: 12,
              }}
            >
              <Text style={coachStyle.muted}>
                {m.author_id === data?.account_id ? "Sen" : selected.name} ·{" "}
                {new Date(m.created_at).toLocaleString("tr-TR")}
                {m.context_type !== "general"
                  ? " · " +
                    ({
                      workout: "Antrenman",
                      report: "Rapor",
                      revision: "Program sürümü",
                      exercise: "Egzersiz",
                    }[m.context_type] ?? "Yorum")
                  : ""}
              </Text>
              <Text style={coachStyle.text}>{m.body}</Text>
              <Text style={coachStyle.muted}>
                {m.sync_state === "rejected"
                  ? "Gönderilemedi: " + m.sync_error
                  : m.sync_state === "pending"
                    ? "Eşitleme bekliyor"
                    : m.read_at
                      ? "Okundu"
                      : "Okunmadı"}
              </Text>
              {m.author_id !== data?.account_id &&
                !m.read_at &&
                !m.sync_state && (
                  <CoachButton
                    title="Okundu olarak işaretle"
                    secondary
                    onPress={() =>
                      void coachingRequest(
                        user!.id,
                        `/messages/${m.id}/read`,
                        {},
                      )
                        .then(() => syncCoaching(user!.id))
                        .catch((e) => setError(e.message))
                    }
                  />
                )}
            </View>
          ))}
        </CoachCard>
      )}
      <CoachCard title="Bildirimler">
        {!!data && !data.notifications.length && (
          <Text style={coachStyle.muted}>Yeni bildirim yok.</Text>
        )}
        {data?.notifications.map((n) => (
          <View key={n.id} style={{ gap: 8, marginBottom: 8 }}>
            <Text style={n.read ? coachStyle.muted : coachStyle.text}>
              {n.body}
            </Text>
            {!n.read && (
              <CoachButton
                title="Okundu"
                secondary
                onPress={() =>
                  void coachingRequest(
                    user!.id,
                    `/notifications/${n.id}/read`,
                    {},
                  )
                    .then(() => syncCoaching(user!.id))
                    .catch((e) => setError(e.message))
                }
              />
            )}
          </View>
        ))}
      </CoachCard>
    </CoachShell>
  );
}
