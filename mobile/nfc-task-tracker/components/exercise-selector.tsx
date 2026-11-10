import { KeyboardFrame } from "./keyboard-frame";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MovementArt, MuscleMap } from "./fitness-art";
import {
  FitButton,
  FitChip,
  FitSection,
  IconAction,
  f,
  fit,
} from "./fitness-ui";
import {
  muscleLabels,
  equipmentLabels,
  difficultyLabels,
} from "@/lib/athlete-presentation";
import { ExerciseMedia, ExerciseThumbnail } from "./exercise-media";
import {
  CoachText as Text,
  CoachButton,
  CoachField,
  coachStyle,
} from "@/components/coaching-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  View,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCoachingLibrary } from "@/hooks/use-coaching";
import { coachingRequest } from "@/lib/tenant-console";
import { useAuth } from "@/hooks/use-auth";
import { coachingStore } from "@/lib/coaching";
import { offlineChanged } from "@/lib/offline-sync";
import type { Exercise } from "@/lib/coaching-types";
export function ExerciseSelector({
  onSelect,
  onClose,
  browseOnly = false,
  onSelectMany,
}: {
  onSelect: (e: Exercise) => void;
  onClose: () => void;
  browseOnly?: boolean;
  onSelectMany?: (exercises: Exercise[]) => void;
}) {
  const library = useCoachingLibrary();
  const { fontScale } = useWindowDimensions();
  const filterHeight = Math.max(52, Math.ceil(26 + 22 * fontScale));
  const { refetch: refetchLibrary } = library;
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const initialDownload = useRef("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "muscles" | "variations">(
    "info",
  );
  const [chosen, setChosen] = useState<string[]>([]);
  const toggleChosen = (id: string) =>
    setChosen((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    );
  const [error, setError] = useState("");
  const [custom, setCustom] = useState(false);
  const [savingCustom,setSavingCustom]=useState(false);
  const customFlight=useRef(false);
  const [name, setName] = useState("");
  const [measurement, setMeasurement] = useState<"reps" | "seconds" | "meters">(
    "reps",
  );
  const data = useMemo(
    () =>
      (library.data ?? []).filter(
        (e) =>
          (!q ||
            `${e.name} ${e.name_en}`
              .toLocaleLowerCase("tr")
              .includes(q.toLocaleLowerCase("tr"))) &&
          (!muscle || e.muscle === muscle) &&
          (!equipment || e.equipment === equipment) &&
          (!favorites || e.favorite),
      ),
    [library.data, q, muscle, equipment, favorites],
  );
  const refreshLibrary = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    setError("");
    try {
      const items = await coachingRequest<Exercise[]>(user.id, "/library");
      await coachingStore.saveLibrary(user.id, items);
      offlineChanged(user.id);
      await refetchLibrary();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, refetchLibrary]);
  useEffect(() => {
    if (
      library.isSuccess &&
      !library.data?.length &&
      user?.id &&
      initialDownload.current !== user.id
    ) {
      initialDownload.current = user.id;
      void refreshLibrary();
    }
  }, [library.isSuccess, library.data?.length, user?.id, refreshLibrary]);
  const favorite = async (e: Exercise) => {
    try {
      await coachingRequest(
        user!.id,
        `/library/${e.id}/favorite?favorite=${!e.favorite}`,
        {},
      );
      await coachingStore.saveLibrary(
        user!.id,
        (library.data ?? []).map((x) =>
          x.id === e.id ? { ...x, favorite: !e.favorite } : x,
        ),
      );
      offlineChanged(user!.id);
      setDetail((current) =>
        current?.id === e.id ? { ...current, favorite: !e.favorite } : current,
      );
    } catch (err) {
      setError(String((err as Error).message));
    }
  };
  const addCustom = async () => {
    if(customFlight.current)return;
    if(name.trim().length<2 || name.trim().length>120){setError("Egzersiz adı 2–120 karakter olmalı.");return;}
    customFlight.current=true;setSavingCustom(true);setError("");
    try {
      const e = await coachingRequest<Exercise>(user!.id, "/library", {
        name:name.trim(),
        muscle: muscle || "other",
        equipment: equipment || "none",
        measurements: measurement === "reps" ? ["reps", "kg"] : [measurement],
      });
      await coachingStore.saveLibrary(user!.id, [...(library.data ?? []), e]);
      offlineChanged(user!.id);
      if (browseOnly) {
        setCustom(false);
        setDetail(e);
      } else onSelect(e);
    } catch (err) {
      setError((err as Error).message);
    } finally {customFlight.current=false;setSavingCustom(false);}
  };
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (detail) setDetail(null);
        else if (custom) setCustom(false);
        else onClose();
      }}
    >
      <SafeAreaView style={[f.page, { padding: 18 }]}><KeyboardFrame style={{flex:1,gap:12}}>
        <StatusBar style="light" />
        <View style={[f.row, { justifyContent: "space-between" }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={f.sectionTitle}>Egzersiz kütüphanesi</Text>
            <Text style={[f.muted, { fontSize: 11 }]}>
              {library.isPending || refreshing ? 'Kütüphane hazırlanıyor…' : `${data.length}/${library.data?.length??0} egzersiz · Telefonda kayıtlı`}
            </Text>
          </View>
          <IconAction
            icon="refresh-outline"
            label={refreshing ? "Kütüphane yükleniyor…" : "Kütüphaneyi yenile"}
            onPress={() => {
              if (!refreshing) void refreshLibrary();
            }}
          />
          <IconAction icon="close" label="Kapat" onPress={onClose} />
        </View>
        {error !== "" && (
          <Text accessibilityRole="alert" style={coachStyle.error}>
            {error}
          </Text>
        )}
        {detail ? (
          <>
            <Text style={f.heading}>{detail.name}</Text>
            <Text style={f.muted}>
              {muscleLabels[detail.muscle] ?? detail.muscle} ·{" "}
              {equipmentLabels[detail.equipment] ?? detail.equipment}
            </Text>
            <View style={f.row}>
              {(["info", "muscles", "variations"] as const).map((tab, i) => (
                <FitChip
                  key={tab}
                  label={["Bilgi", "Kaslar", "Varyasyon"][i]}
                  active={detailTab === tab}
                  onPress={() => setDetailTab(tab)}
                />
              ))}
            </View>
            <ScrollView contentContainerStyle={{ gap: 15, paddingBottom: 12 }}>
              <View style={[f.card, { alignItems: "center", padding: 0 }]}>
                {detailTab === "muscles" ? (
                  <MuscleMap muscle={detail.muscle} />
                ) : (
                  <MovementArt size={210} muscle={detail.muscle} />
                )}
                <Text style={[f.muted, { fontSize: 10, paddingBottom: 10 }]}>
                  Kategori çizimi · Teknik gösterim değildir.
                </Text>
              </View>
              {detailTab === "info" ? (
                <>
                  <View style={f.card}>
                    <Metadata
                      label="Hedef kas"
                      value={muscleLabels[detail.muscle] ?? detail.muscle}
                    />
                    <Metadata
                      label="Ekipman"
                      value={
                        equipmentLabels[detail.equipment] ?? detail.equipment
                      }
                    />
                    <Metadata
                      label="Seviye"
                      value={
                        difficultyLabels[detail.difficulty] ?? detail.difficulty
                      }
                    />
                  </View>
                  <Text style={f.body}>{detail.description}</Text>
                  <FitSection title="Uygulama notları" />
                  {detail.instructions.map((item, i) => (
                    <Text key={i} style={f.muted}>
                      {i + 1}. {item}
                    </Text>
                  ))}
                  {detail.safety.map((item, i) => (
                    <Text
                      key={"s" + i}
                      style={[f.muted, { color: fit.orange }]}
                    >
                      {item}
                    </Text>
                  ))}
                  <ExerciseMedia exercise={detail} />
                </>
              ) : detailTab === "muscles" ? (
                <View style={f.card}>
                  <Text style={f.sectionTitle}>
                    {muscleLabels[detail.muscle] ?? detail.muscle}
                  </Text>
                  <Text style={f.muted}>
                    Kütüphanede kayıtlı hedef kas grubu
                  </Text>
                  {detail.secondary_muscles.length > 0 && (
                    <Text style={f.body}>
                      İkincil:{" "}
                      {detail.secondary_muscles
                        .map((m) => muscleLabels[m] ?? m)
                        .join(", ")}
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  {(library.data ?? [])
                    .filter((e) => detail.variations.includes(e.id))
                    .map((e) => (
                      <Pressable
                        key={e.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setDetail(e);
                          setDetailTab("info");
                        }}
                        style={[f.card, f.row]}
                      >
                        <MovementArt size={62} muscle={e.muscle} />
                        <View style={{ flex: 1 }}>
                          <Text style={[f.body, { fontWeight: "800" }]}>
                            {e.name}
                          </Text>
                          <Text style={f.muted}>
                            {equipmentLabels[e.equipment] ?? e.equipment}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          color={fit.lime}
                          size={20}
                        />
                      </Pressable>
                    ))}
                  {!detail.variations.length && (
                    <Text style={f.muted}>
                      Bu egzersiz için kayıtlı varyasyon yok.
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
            <View style={f.row}>
              <View style={{ flex: 1 }}>
                <FitButton
                  title={detail.favorite ? "Favoride" : "Favoriye ekle"}
                  icon={detail.favorite ? "star" : "star-outline"}
                  secondary
                  onPress={() => void favorite(detail)}
                />
              </View>
              {!browseOnly && (
                <View style={{ flex: 1 }}>
                  <FitButton
                    title={
                      onSelectMany
                        ? chosen.includes(detail.id)
                          ? "Seçimden çıkar"
                          : "Listeye ekle"
                        : "Egzersizi seç"
                    }
                    icon="checkmark"
                    onPress={() => {
                      if (onSelectMany) {
                        toggleChosen(detail.id);
                        setDetail(null);
                      } else onSelect(detail);
                    }}
                  />
                </View>
              )}
            </View>
            <CoachButton
              title="Listeye dön"
              secondary
              onPress={() => setDetail(null)}
            />
          </>
        ) : custom ? (
          <>
            <CoachField label="Egzersiz adı" value={name} onChange={setName} />
            <CoachField label="Kas grubu" value={muscle} onChange={setMuscle} />
            <CoachField
              label="Ekipman"
              value={equipment}
              onChange={setEquipment}
            />
            <View style={coachStyle.row}>
              {(["reps", "seconds", "meters"] as const).map((x) => (
                <CoachButton
                  key={x}
                  title={
                    x === "reps"
                      ? "Tekrar / kg"
                      : x === "seconds"
                        ? "Süre"
                        : "Mesafe"
                  }
                  secondary={measurement !== x}
                  onPress={() => setMeasurement(x)}
                />
              ))}
            </View>
            <Text style={coachStyle.muted}>
              Özel egzersiz oluşturmak için internet gerekir.
            </Text>
            <CoachButton
              title={savingCustom ? "Kaydediliyor…" : browseOnly ? "Egzersizi oluştur" : "Oluştur ve seç"}
              disabled={savingCustom || name.trim().length < 2}
              onPress={() => void addCustom()}
            />
            <CoachButton
              title="Vazgeç"
              secondary
              onPress={() => setCustom(false)}
            />
          </>
        ) : (
          <>
            <View
              style={[
                f.row,
                {
                  borderWidth: 1,
                  borderColor: fit.line,
                  borderRadius: 14,
                  backgroundColor: fit.card,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <Ionicons name="search-outline" size={20} color={fit.muted} />
              <TextInput
                accessibilityLabel="Egzersiz ara"
                placeholder="Egzersiz ara (örn. Bench press)"
                placeholderTextColor={fit.muted}
                value={q}
                onChangeText={setQ}
                style={{
                  flex: 1,
                  minHeight: 48,
                  color: fit.text,
                  fontSize: 15,
                }}
              />
            </View>
            <View style={coachStyle.row}>
              <CoachButton
                title={favorites ? "Tümü" : "Favoriler"}
                secondary
                onPress={() => setFavorites(!favorites)}
              />
              <CoachButton
                title="Özel egzersiz"
                secondary
                onPress={() => setCustom(true)}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 0, height: filterHeight }}
              contentContainerStyle={{
                gap: 8,
                paddingBottom: 3,
                alignItems: "center",
              }}
            >
              <FitChip
                label="Tümü"
                active={!muscle}
                onPress={() => setMuscle("")}
              />
              {[...new Set((library.data ?? []).map((e) => e.muscle))].map(
                (m) => (
                  <FitChip
                    key={m}
                    label={muscleLabels[m] ?? m}
                    active={muscle === m}
                    onPress={() => setMuscle(muscle === m ? "" : m)}
                  />
                ),
              )}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 0, height: filterHeight }}
              contentContainerStyle={{
                gap: 8,
                paddingBottom: 3,
                alignItems: "center",
              }}
            >
              <FitChip
                label="Tüm ekipmanlar"
                active={!equipment}
                onPress={() => setEquipment("")}
              />
              {[...new Set((library.data ?? []).map((e) => e.equipment))].map(
                (m) => (
                  <FitChip
                    key={m}
                    label={equipmentLabels[m] ?? m}
                    active={equipment === m}
                    onPress={() => setEquipment(equipment === m ? "" : m)}
                  />
                ),
              )}
            </ScrollView>

            <FlatList
              data={data}
              keyExtractor={(e) => e.id}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={12}
              renderItem={({ item: e }) => {
                const picked = chosen.includes(e.id);
                return (
                  <View
                    style={[
                      f.row,
                      {
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: picked ? fit.lime : fit.line,
                        backgroundColor: fit.card,
                        padding: 9,
                        marginBottom: 9,
                      },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={e.name + " bilgilerini aç"}
                      onPress={() => {
                        setDetail(e);
                        setDetailTab("info");
                      }}
                      style={[f.row, { flex: 1 }]}
                    >
                      <View
                        style={{
                          backgroundColor: fit.raised,
                          borderRadius: 12,
                          overflow: "hidden",
                        }}
                      >
                        <ExerciseThumbnail exercise={e} fallback={<MovementArt muscle={e.muscle} size={66} />} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[f.body, { fontWeight: "800" }]}>
                          {e.name}
                        </Text>
                        <Text style={[f.muted, { fontSize: 11 }]}>
                          {muscleLabels[e.muscle] ?? e.muscle} ·{" "}
                          {equipmentLabels[e.equipment] ?? e.equipment}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        onSelectMany
                          ? (picked ? "Seçimden çıkar: " : "Seç: ") + e.name
                          : (e.favorite
                              ? "Favorilerden çıkar: "
                              : "Favoriye ekle: ") + e.name
                      }
                      accessibilityState={
                        onSelectMany ? { selected: picked } : undefined
                      }
                      onPress={() =>
                        onSelectMany ? toggleChosen(e.id) : void favorite(e)
                      }
                      style={{
                        minWidth: 44,
                        minHeight: 48,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name={
                          onSelectMany
                            ? picked
                              ? "checkmark-circle"
                              : "add-circle-outline"
                            : e.favorite
                              ? "star"
                              : "star-outline"
                        }
                        size={24}
                        color={picked || e.favorite ? fit.lime : fit.muted}
                      />
                    </Pressable>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={coachStyle.muted}>
                  {library.isPending
                    ? "Kütüphane yükleniyor…"
                    : "Egzersiz bulunamadı. İlk indirme için internete bağlan."}
                </Text>
              }
            />
            {onSelectMany && (
              <FitButton
                title={
                  chosen.length
                    ? "Seçilenleri ekle (" + chosen.length + ")"
                    : "Eklemek için egzersiz seç"
                }
                icon="checkmark"
                disabled={!chosen.length}
                onPress={() =>
                  onSelectMany(
                    chosen
                      .map((id) =>
                        (library.data ?? []).find((e) => e.id === id),
                      )
                      .filter((e): e is Exercise => !!e),
                  )
                }
              />
            )}
          </>
        )}
      </KeyboardFrame></SafeAreaView>
    </Modal>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <View style={[f.row, { justifyContent: "space-between", minHeight: 28 }]}>
      <Text style={f.muted}>{label}</Text>
      <Text
        style={[
          f.body,
          { fontWeight: "700", flexShrink: 1, textAlign: "right" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
