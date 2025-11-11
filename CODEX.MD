T TALİMATI — “NFC Task Tracker” (React Native + Supabase)
0) Amaç ve Kapsam

Amaç: Kullanıcı giriş yapar → “Tasks” ekranında görevlerini görür ve durum günceller. “NFC” ekranında kart okur; backend/Supabase doğrulaması başarılıysa görev durumunu in_progress veya completed yapar.

Platform: React Native (Expo Router + EAS Dev Client), Android öncelik.

Backend: Supabase (Auth + DB). Tüm güvenlik RLS/Policies ile sağlanacak.

Zaman: Tek sprintte çalışır MVP.

1) Proje Kurulumu

Yeni RN projesi (TypeScript + Expo Router):

npx create-expo-app nfc-task-tracker -t expo-router@latest --template

cd nfc-task-tracker

Bağımlılıklar:

npm i @supabase/supabase-js @tanstack/react-query jotai

npm i react-native-nfc-manager

npx expo install expo-secure-store react-native-gesture-handler react-native-reanimated

npm i -D eas-cli

EAS & Prebuild:

eas init

npx expo prebuild

eas build:configure

Android izinleri (app.json / app.config.ts):

{
  "expo": {
    "android": {
      "permissions": ["android.permission.NFC"],
      "package": "com.org.nfctasktracker"
    }
  }
}


Dev Client Build (NFC için şart):

eas build -p android --profile development

Çıkan .apk gerçek cihaza kurulacak (Expo Go kullanılmayacak).

2) Ortam Değişkenleri ve Supabase Client

.env (public değerler):

EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY


/lib/supabase.ts

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

3) Supabase Şeması ve Güvenlik
3.1 Tablolar
-- users profilleri (opsiyonel, auth.users ile join edilebilir)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null check (status in ('not_started','in_progress','completed','canceled')) default 'not_started',
  nfc_tag_id text, -- bu görevle eşleşen kart kimliği (UID/ndef text)
  due_date date,
  created_at timestamptz default now()
);

-- NFC log (opsiyonel)
create table if not exists public.nfc_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  nfc_payload text,
  matched_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz default now()
);

3.2 RLS
alter table public.tasks enable row level security;
alter table public.nfc_events enable row level security;
alter table public.profiles enable row level security;

-- Sadece kendi kayıtlarını gör/güncelle
create policy "tasks_select_own" on public.tasks
for select using (auth.uid() = user_id);

create policy "tasks_insert_own" on public.tasks
for insert with check (auth.uid() = user_id);

create policy "tasks_update_own" on public.tasks
for update using (auth.uid() = user_id);

create policy "nfc_events_rw_own" on public.nfc_events
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "profiles_self" on public.profiles
for select using (auth.uid() = id);

3.3 RPC (verify_tag)

Amaç: NFC’den okunan payload/UID ile kullanıcıya ait uygun görevi bulup geri döndürmek (veya izin vermek).

create or replace function public.verify_tag(tag_text text)
returns table (task_id uuid, allowed boolean)
language plpgsql
security definer
as $$
begin
  return query
  select t.id, true
  from public.tasks t
  where t.user_id = auth.uid()
    and t.nfc_tag_id is not null
    and t.nfc_tag_id = tag_text
  limit 1;
end;
$$;

revoke all on function public.verify_tag(text) from public;
grant execute on function public.verify_tag(text) to anon, authenticated;


Not: SECURITY DEFINER kullanıldığı için fonksiyon içinde her zaman auth.uid() ile kullanıcı sınırı var. Ek filtre gerekirse ekleyin (ör. due_date).

4) Uygulama Yapısı (Expo Router)
app
 ├─ (auth)
 │   └─ sign-in.tsx          # email/password login
 ├─ (tabs)
 │   ├─ _layout.tsx          # Tabs: Tasks / NFC
 │   ├─ index.tsx            # Tasks List
 │   └─ nfc.tsx              # NFC Scan & Verify
 ├─ _layout.tsx
lib
 ├─ supabase.ts
 └─ api.ts

4.1 Root layout
// app/_layout.tsx
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const [qc] = useState(() => new QueryClient());
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={qc}>
        <Stack screenOptions={{ headerTitle: "NFC Task Tracker" }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

4.2 Auth
// app/(auth)/sign-in.tsx
import { useState } from "react";
import { View, TextInput, Button, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function SignIn() {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo1234");

  const onSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return Alert.alert("Login failed", error.message);
    router.replace("/(tabs)");
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <TextInput placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Sign In" onPress={onSignIn} />
    </View>
  );
}

4.3 Tabs
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Tasks" }} />
      <Tabs.Screen name="nfc" options={{ title: "NFC" }} />
    </Tabs>
  );
}

4.4 API katmanı
// lib/api.ts
import { supabase } from "./supabase";

export type Task = {
  id: string;
  user_id: string;
  title: string;
  status: "not_started" | "in_progress" | "completed" | "canceled";
  nfc_tag_id?: string | null;
  due_date?: string | null;
};

export async function fetchTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data as Task[];
}

export async function updateTaskStatus(id: string, status: Task["status"]) {
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function verifyTag(tagText: string) {
  const { data, error } = await supabase.rpc("verify_tag", { tag_text: tagText });
  if (error) throw error;
  return data as { task_id: string; allowed: boolean }[]; // boşsa eşleşme yok
}

4.5 Tasks ekranı
// app/(tabs)/index.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTasks, updateTaskStatus } from "../../lib/api";
import { View, Text, Button, FlatList } from "react-native";

export default function Tasks() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const mutate = useMutation({
    mutationFn: (vars: { id: string; status: any }) => updateTaskStatus(vars.id, vars.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  if (isLoading) return <Text>Loading…</Text>;
  if (error) return <Text>Failed to fetch tasks</Text>;

  return (
    <FlatList
      data={data}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <View style={{ padding: 12, borderBottomWidth: 1 }}>
          <Text>{item.title}</Text>
          <Text>Status: {item.status}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Button title="Start" onPress={() => mutate.mutate({ id: item.id, status: "in_progress" })} />
            <Button title="Done" onPress={() => mutate.mutate({ id: item.id, status: "completed" })} />
          </View>
        </View>
      )}
    />
  );
}

4.6 NFC ekranı
// app/(tabs)/nfc.tsx
import { useEffect, useState } from "react";
import { View, Text, Button, Alert } from "react-native";
import NfcManager, { Ndef, NfcEvents } from "react-native-nfc-manager";
import { useMutation } from "@tanstack/react-query";
import { updateTaskStatus, verifyTag } from "../../lib/api";

export default function NFC() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [tagText, setTagText] = useState<string>("");

  const updateStatus = useMutation({
    mutationFn: (vars: { id: string; status: any }) => updateTaskStatus(vars.id, vars.status),
    onSuccess: () => Alert.alert("Success", "Task updated"),
  });

  useEffect(() => {
    (async () => {
      const ok = await NfcManager.isSupported();
      setSupported(ok);
      if (ok) await NfcManager.start();
    })();

    const sub = NfcManager.addListener(NfcEvents.DiscoverTag, async (tag: any) => {
      try {
        const ndef = tag?.ndefMessage?.[0];
        const decoded = ndef ? Ndef.text.decodePayload(ndef.payload) : JSON.stringify(tag);
        setTagText(decoded);

        const res = await verifyTag(decoded);
        const match = res?.[0];
        if (match?.allowed && match?.task_id) {
          // Varsayılan: tarama ile "in_progress" yap
          await updateStatus.mutateAsync({ id: match.task_id, status: "in_progress" });
        } else {
          Alert.alert("No match", "This tag is not linked to your tasks.");
        }
      } catch (e) {
        Alert.alert("NFC error", String(e));
      } finally {
        NfcManager.setAlertMessageIOS?.("Tag read");
        NfcManager.unregisterTagEvent().catch(() => {});
      }
    });

    return () => sub.remove();
  }, []);

  const startScan = async () => {
    try {
      await NfcManager.registerTagEvent();
    } catch (e) {
      Alert.alert("NFC error", String(e));
    }
  };

  if (supported === false) return <Text>NFC not supported</Text>;

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Button title="Scan NFC Tag" onPress={startScan} />
      <Text>Last tag: {tagText || "—"}</Text>
    </View>
  );
}

5) Kabul Kriterleri (Acceptance)

Auth: Email/şifre ile giriş; session kalıcı. Giriş yoksa (auth)/sign-in gösterilir.

Tasks: Kullanıcı sadece kendi görevlerini görür/değiştirir (RLS aktif).

NFC: Dev Client ile gerçek cihazda kart okuma çalışır; eşleşen kayıt varsa in_progress yapılır. Eşleşme yoksa uyarı.

RLS: “Anon key” açıkta olsa bile başka kullanıcı verisi görüntülenemez.

Dokümantasyon: README’de kurulum komutları, .env örneği, EAS build adımları mevcut.

Lint/Build: npm run build / eas build hatasız.

6) Test Planı (Kısa)

Supabase: tasks içine kullanıcı A için 2 kayıt, nfc_tag_id alanını birine TEST123 yap.

Uygulama: Kullanıcı A ile giriş → Tasks list görünür.

NFC: TEST123 içeren NDEF kartını okut → ilgili görev in_progress olur.

Başka kullanıcı ile giriş yapınca A’nın görevleri görünmez (RLS doğrulaması).

7) Dikkat Edilecekler / Yapılmayacaklar

❌ Expo Go kullanılmayacak (NFC desteklemez).

❌ Service Role Key asla client’a konmayacak.

✅ Public key’ler .env’de EXPO_PUBLIC_ ile.

✅ RLS açık ve policy’ler uygulanmış olacak.

✅ verify_tag fonksiyonunda auth.uid() filtresi her zaman var.

8) Ekstralar (opsiyonel)

Task durum geçişleri kuralı: NFC ile sadece not_started → in_progress, manuel butonla → completed.

NFC güvenliği: NDEF yerine UID + imzalı payload (ilerleyen sürüm).

Sentry/Crash: Basit hata toplama.

