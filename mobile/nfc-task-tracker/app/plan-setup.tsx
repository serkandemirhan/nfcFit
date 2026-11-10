import { useTenantIdentity } from "@/hooks/use-tenant-identity";
import { starterPrograms } from "@/lib/starter-programs";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  BrandHeader,
  FitButton,
  FitCard,
  FitChip,
  ProgressBar,
  f,
  fit,
  type FitnessIcon,
} from "@/components/fitness-ui";
import { CoachText as Text } from "@/components/coaching-ui";
import { MovementArt } from "@/components/fitness-art";
const goals: { name: string; icon: FitnessIcon }[] = [
  { name: "Kas gelişimi", icon: "barbell-outline" },
  { name: "Güç", icon: "flash-outline" },
  { name: "Kondisyon", icon: "walk-outline" },
  { name: "Hareketlilik", icon: "body-outline" },
  { name: "Düzenli hareket", icon: "heart-outline" },
  { name: "Genel fitness", icon: "fitness-outline" },
];
const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export default function PlanSetup() {
  const identity=useTenantIdentity();
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState("");
  const [goal, setGoal] = useState("Güç");
  const [level, setLevel] = useState("beginner");
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState<number[]>([0, 2, 4]);
  if(identity.data && !identity.data.memberships.some(m=>m.status==='active')) return <SafeAreaView style={f.page}><ScrollView contentContainerStyle={f.content}><BrandHeader/><Text style={f.heading}>Kulüp üyeliği gerekli</Text><Text style={f.muted}>Kişisel program oluşturmak için kulüp üyeliğin onaylanmış olmalı. Antrenörler tesis şablonlarını Antrenör alanından oluşturabilir.</Text><FitButton title="Kulüp kartını okut" onPress={()=>router.push('/(drawer)/nfc' as never)}/><FitButton title="Programıma dön" secondary onPress={()=>router.replace('/(drawer)/plans' as never)}/></ScrollView></SafeAreaView>;
  return (
    <SafeAreaView style={f.page}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[f.content, { paddingBottom: 35 }]}>
        <BrandHeader />
        <View
          style={[f.row, { justifyContent: "space-between", flexWrap: "wrap" }]}
        >
          <Text style={f.eyebrow}>PLANINI OLUŞTUR</Text>
          <Text style={f.muted}>{step + 1}/3 · Plan hazırlığı</Text>
        </View>
        <ProgressBar value={(step + 1) / 3} label="Plan hazırlığı" />
        <Text style={f.heading}>
          {step === 0
            ? "Nereden başlayalım?"
            : step === 1
              ? "Hedef & seviye"
              : "Haftanı planla"}
        </Text>
        <Text style={f.muted}>
          {step === 0
            ? "Hazır bir taslağı düzenle veya kendi planını oluştur. Kaydetmeden önce tüm hedefleri değiştirebilirsin."
            : step === 1
              ? "Hedefini seç. Planının egzersizlerini ve yüklerini sonraki adımda sen belirleyeceksin."
              : "Sana uygun günleri belirle. Günler ve tarihler plan oluşturucuda düzenlenebilir."}
        </Text>
        {step === 0 ? (
          <>
            {starterPrograms.map((p) => (
              <FitCard key={p.id}>
                <Text style={f.sectionTitle}>{p.name}</Text>
                <Text style={f.muted}>{p.description}</Text>
                <FitButton
                  title="Bu taslağı düzenle"
                  onPress={() => {
                    setTemplate(p.id);
                    setGoal(p.goal);
                    setLevel("beginner");
                    setDays([0, 3]);
                    setStep(2);
                  }}
                />
              </FitCard>
            ))}
            <FitButton
              title="Kendi planımı oluştur"
              secondary
              icon="add"
              onPress={() => {
                setTemplate("");
                setStep(1);
              }}
            />
          </>
        ) : step === 1 ? (
          <>
            <Text style={f.sectionTitle}>Ana hedefin nedir?</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {goals.map((g) => (
                <Pressable
                  key={g.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: goal === g.name }}
                  onPress={() => setGoal(g.name)}
                  style={{
                    width: "31%",
                    minHeight: 100,
                    padding: 10,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: goal === g.name ? fit.lime : fit.line,
                    backgroundColor: goal === g.name ? fit.lime : fit.card,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name={g.icon}
                    size={28}
                    color={goal === g.name ? fit.bg : fit.lime}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: 17,
                      fontWeight: "800",
                      textAlign: "center",
                      color: goal === g.name ? fit.bg : fit.text,
                    }}
                  >
                    {g.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={f.sectionTitle}>Seviyen</Text>
            <View style={[f.row, { flexWrap: "wrap" }]}>
              {["beginner", "intermediate", "advanced"].map((l, i) => (
                <FitChip
                  key={l}
                  label={["Başlangıç", "Orta", "İleri"][i]}
                  active={level === l}
                  onPress={() => setLevel(l)}
                />
              ))}
            </View>
            <FitButton title="Devam et" onPress={() => setStep(2)} />
          </>
        ) : (
          <>
            <FitCard>
              <View style={f.row}>
                <MovementArt size={82} muscle="cardio" />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={f.sectionTitle}>{goal}</Text>
                  <Text style={f.muted}>
                    {
                      (
                        {
                          beginner: "Başlangıç",
                          intermediate: "Orta",
                          advanced: "İleri",
                        } as Record<string, string>
                      )[level]
                    }{" "}
                    · {weeks} hafta
                  </Text>
                  <Text style={f.badge}>
                    {template
                      ? "Hazır egzersizleri düzenleyebilirsin"
                      : "Egzersizleri sen seçersin"}
                  </Text>
                </View>
              </View>
            </FitCard>
            <Text style={f.sectionTitle}>Hangi günler?</Text>
            <View style={[f.row, { flexWrap: "wrap" }]}>
              {weekdays.map((d, i) => (
                <FitChip
                  key={d}
                  label={d}
                  active={days.includes(i)}
                  onPress={() =>
                    setDays((old) =>
                      old.includes(i)
                        ? old.filter((x) => x !== i)
                        : [...old, i].sort(),
                    )
                  }
                />
              ))}
            </View>
            <Text style={f.sectionTitle}>Kaç hafta?</Text>
            <View style={[f.row, { flexWrap: "wrap" }]}>
              {[4, 6, 8, 12].map((n) => (
                <FitChip
                  key={n}
                  label={n + " hf"}
                  active={weeks === n}
                  onPress={() => setWeeks(n)}
                />
              ))}
            </View>
            <Text style={f.muted}>
              {days.length} gün / hafta · {weeks} hafta. Seçili günler takvimine
              eklenecek. Egzersizlerini sonraki adımda ekleyebilirsin.
            </Text>
            <FitButton
              title="Egzersizlerini belirle"
              icon="barbell-outline"
              disabled={!days.length}
              onPress={() =>
                router.push({
                  pathname: "/plan-builder",
                  params: {
                    preset_template: template,
                    preset_goal: goal,
                    preset_level: level,
                    preset_weeks: String(weeks),
                    preset_days: days.join(","),
                  },
                } as never)
              }
            />
          </>
        )}
        <View style={[f.row, { justifyContent: "space-between" }]}>
          {step > 0 && (
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 44, justifyContent: "center" }}
              onPress={() => setStep(step === 1 || template ? 0 : 1)}
            >
              <Text style={f.link}>← Geri</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: "center" }}
            onPress={() => router.replace("/(drawer)/plans" as never)}
          >
            <Text style={f.muted}>Programıma dön</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
