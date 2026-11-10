import { Image } from "expo-image";
import { AccessibilityInfo, AppState, Linking, View } from "react-native";
import { useEffect, useState, type ReactNode } from "react";
import type { Exercise } from "@/lib/coaching-types";
import { imageFrames, positionLabel, thumbnail, type ExerciseAsset } from "@/lib/exercise-media-presentation";
import { CoachButton, CoachText, coachStyle } from "./coaching-ui";

export function ExerciseThumbnail({ exercise, fallback }: { exercise: Exercise; fallback: ReactNode }) {
  const asset = thumbnail(exercise);
  const [failed, setFailed] = useState("");
  return asset && failed !== asset.url ? <Image source={{ uri: asset.url }} style={{ width: 66, height: 66, backgroundColor: "#ffffff" }} contentFit="contain" cachePolicy="disk" accessibilityLabel={asset.alt} onError={() => setFailed(asset.url)} /> : <>{fallback}</>;
}
export function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  return <ExercisePositions key={exercise.id} exercise={exercise} />;
}

function AnimationPreview({ asset }: { asset: ExerciseAsset }) {
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduced(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { setReduced(value); setPlaying(false); });
    const app = AppState.addEventListener("change", (state) => { if (state !== "active") setPlaying(false); });
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  return <View style={{ gap: 8 }}>
    <Image key={String(playing && !reduced)} source={{ uri: asset.url }} autoplay={playing && !reduced} cachePolicy="disk" contentFit="contain" accessibilityLabel={asset.alt} style={{ width: "100%", height: 220 }} />
    <CoachButton title={playing ? "Animasyonu durdur" : "Animasyonu oynat"} disabled={reduced} secondary onPress={() => setPlaying(!playing)} />
    {reduced && <CoachText style={coachStyle.muted}>Hareket azaltma ayarı nedeniyle animasyon oynatılmıyor.</CoachText>}
  </View>;
}
function ExercisePositions({ exercise }: { exercise: Exercise }) {
  const [error, setError] = useState("");
  const [position, setPosition] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const media = (exercise.media ?? []).filter((m) => m.url.startsWith("https://"));
  const frames = imageFrames(exercise);
  const current = frames[position] ?? frames[0];
  const credits = [...new Map(frames.map((m) => [m.attribution + m.license_url, m])).values()];
  const open = async (url: string) => {
    if (!url.startsWith("https://")) return;
    try { await Linking.openURL(url); } catch { setError("Medya açılamadı. Bağlantını kontrol et."); }
  };
  return <View style={{ gap: 12 }}>
    {!current ? <View style={coachStyle.card}><CoachText style={coachStyle.muted}>Bu hareket için doğrulanmış görsel henüz eklenmedi.</CoachText></View> : <>
      {failed.includes(current.url) ? <View style={coachStyle.card}>
        <CoachText accessibilityRole="alert">Görsel yüklenemedi. Egzersizi düzenlemeye devam edebilirsin.</CoachText>
        <CoachButton title="Yeniden dene" secondary onPress={() => setFailed((urls) => urls.filter((u) => u !== current.url))} />
      </View> : <Image source={{ uri: current.url }} accessibilityLabel={current.alt} accessible contentFit="contain" cachePolicy="disk" style={{ width: "100%", height: 240, backgroundColor: "#ffffff", borderRadius: 12 }} onError={() => setFailed((urls) => [...urls, current.url])} />}
      <CoachText>{positionLabel(current, position)}</CoachText>
      {frames.length > 1 && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {frames.map((m, i) => <CoachButton key={m.url} title={positionLabel(m, i)} selected={position === i} secondary={position !== i} onPress={() => setPosition(i)} />)}
      </View>}
      <CoachText style={coachStyle.muted}>{current.role === "pose" ? "Sabit duruş görseli." : "Pozisyon gösterimi · hareket animasyonu değildir."}</CoachText>
      {credits.map((m) => <View key={m.url} style={{ gap: 6 }}>
        <CoachText style={coachStyle.muted}>{m.attribution} · {m.license}</CoachText>
        <CoachButton title="Görsel kaynağı" secondary onPress={() => void open(m.source)} />
        <CoachButton title="Kaynak lisansı" secondary onPress={() => void open(m.license_url)} />
      </View>)}
    </>}
    {media.filter((m) => ["animation", "video", "model3d"].includes(m.media_type)).map((m) => <View key={m.url} style={{ gap: 8 }}>
      {m.media_type === "animation" && <AnimationPreview asset={m} />}
      <CoachButton title={m.media_type === "video" ? "Hareket videosunu aç" : m.media_type === "animation" ? "Hareket animasyonunu aç" : "3B hareket dosyasını aç"} secondary onPress={() => void open(m.url)} />
      <CoachText style={coachStyle.muted}>{m.attribution} · {m.license}</CoachText>
      <CoachButton title="Kaynak ve lisans" secondary onPress={() => void open(m.license_url)} />
    </View>)}
    {!!error && <CoachText accessibilityRole="alert" style={coachStyle.error}>{error}</CoachText>}
  </View>;
}
