import { Image } from "expo-image";
import { Linking, View } from "react-native";
import { useEffect, useState } from "react";
import type { Exercise } from "@/lib/coaching-types";
import { CoachButton, CoachText, coachStyle } from "./coaching-ui";

export function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  const [error, setError] = useState("");
  useEffect(()=>setError(""),[exercise.id]);
  const media = (exercise.media ?? []).filter((m) =>
    m.url.startsWith("https://"),
  );
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setError("Medya açılamadı. Bağlantını kontrol et.");
    }
  };
  return (
    <View style={{ gap: 12 }}>
      {!media.length && (
        <View style={coachStyle.card}>
          <CoachText style={coachStyle.muted}>
            Hareket görseli henüz eklenmedi
          </CoachText>
        </View>
      )}
      {media.map((m) => (
        <View key={m.url} style={{ gap: 8 }}>
          {["image", "animation"].includes(m.media_type) ? (
            <Image
              source={{ uri: m.url }}
              accessibilityLabel={m.alt}
              accessible
              contentFit="contain"
              cachePolicy="disk"
              style={{ width: "100%", height: 220 }}
              onError={() =>
                setError("Görsel yüklenemedi. Bağlantını kontrol et.")
              }
            />
          ) : (
            <CoachButton
              title={
                m.media_type === "video"
                  ? "Hareket videosunu aç"
                  : "3B hareket dosyasını aç"
              }
              secondary
              onPress={() => void open(m.url)}
            />
          )}
          <CoachText style={coachStyle.muted}>{m.alt}</CoachText>
          <CoachText style={coachStyle.muted}>
            {m.attribution} · {m.license}
          </CoachText>
          <CoachButton
            title="Kaynak ve lisans"
            secondary
            onPress={() => void open(m.license_url)}
          />
        </View>
      ))}
      {!!error && (
        <CoachText accessibilityRole="alert" style={coachStyle.error}>
          {error}
        </CoachText>
      )}
    </View>
  );
}
