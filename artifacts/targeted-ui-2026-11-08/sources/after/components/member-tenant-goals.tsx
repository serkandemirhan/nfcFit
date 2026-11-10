import { useSessionClock } from "@/hooks/use-session-clock";
import { offlineStore } from "@/lib/offline-store";
import { offlineChanged, syncOffline } from "@/lib/offline-sync";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import {
  ManagementMessage as Message,
  ui,
  unitLabels,
  errorMessage,
} from "./management-ui";
import { CoachText as ThemedText } from "./coaching-ui";
import { FitButton, FitCard, f, fit } from "./fitness-ui";
import type { ReactNode } from "react";
import { useMemberFitness } from "@/hooks/use-member-fitness";
import { calendarLabel, sessionTimezone } from "@/lib/session-presentation";
import { zonedDate } from "@/lib/coaching-performance";
import { goalProgress } from "@/lib/activity-workflow";
import {
  MemberFitness,
  MemberFitnessExercise,
  tenantConsoleConfigured,
} from "@/lib/tenant-console";

export function MemberTenantGoals({focused=false}:{focused?:boolean}={}) {
  const now = useSessionClock();
  const query = useMemberFitness();
  if (!tenantConsoleConfigured) return null;
  return (
    <Card
      title="Günlük egzersiz hedefleri"
      hint={`Bugün · ${calendarLabel(zonedDate(now, sessionTimezone()))}${focused?"":" · Günlük kart/egzersiz kayıtlarıyla ilerler."}`}
    >
      {query.isLoading && <ActivityIndicator />}
      {query.error && (
        <Message
          error
          message="Salon hedefleri alınamadı. Yenilemeyi deneyin."
        />
      )}
      {!query.isLoading && !query.error && !query.data?.exercises.length && (
        <ThemedText>
          İlk salon egzersizinizi kaydettiğinizde burada hedef
          belirleyebilirsiniz.
        </ThemedText>
      )}
      {query.data?.exercises.map((row) => (
        <GoalRow
          key={`${row.exercise_id}:${row.unit}`}
          row={row}
          focused={focused}
          queryKey={query.fitnessKey}
        />
      ))}
      {query.error && (
        <Button
          title="Yeniden dene"
          secondary
          disabled={query.isFetching}
          onPress={() => void query.refetch()}
        />
      )}
    </Card>
  );
}

function GoalRow({
  row,
  queryKey,
  focused=false,
}: {
  row: MemberFitnessExercise;
  queryKey: readonly unknown[];
  focused?:boolean;
}) {
  const palette = {
    border: fit.line,
    mutedText: fit.muted,
    green: fit.lime,
    text: fit.text,
    cardRaised: fit.raised,
  };
  const client = useQueryClient();
  const { user } = useAuth();
  const [draft, setDraft] = useState(String(row.target_quantity ?? ""));
  useEffect(
    () => setDraft(String(row.target_quantity ?? "")),
    [row.target_quantity],
  );
  const [editing, setEditing] = useState(false);
  const amount = Number(draft.trim().replace(",", "."));
  const mutation = useMutation({
    mutationFn: () =>
      offlineStore.saveGoal(user?.id ?? "", row.exercise_id, row.unit, amount),
    onSuccess: async (saved) => {
      const previous = client.getQueryCache().find({ queryKey, exact: true });
      if (previous) {
        await client.cancelQueries({ queryKey, exact: true });
        if (client.getQueryCache().find({ queryKey, exact: true }) === previous)
          client.setQueryData<MemberFitness>(queryKey, (current) =>
            current
              ? {
                  ...current,
                  exercises: current.exercises.map((item) =>
                    item.exercise_id === saved.exercise_id &&
                    item.unit === saved.unit
                      ? { ...item, target_quantity: saved.target_quantity }
                      : item,
                  ),
                }
              : current,
          );
      }
      setEditing(false);
      offlineChanged(user?.id ?? "");
      void syncOffline(user?.id ?? "").catch(() => undefined);
      void client.invalidateQueries({
        queryKey,
        exact: true,
        refetchType: "none",
      });
    },
  });
  const unit = unitLabels[row.unit] ?? row.unit;
  const guidance = goalProgress(row.day.quantity, row.target_quantity);
  const progress = row.target_quantity
    ? Math.min(1, row.day.quantity / row.target_quantity)
    : 0;
  return (
    <View
      style={{
        gap: 6,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderColor: palette.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ThemedText style={[f.body, { flex: 1, fontWeight: "800" }]}>
          {row.name}
        </ThemedText>
        {row.can_edit && !editing && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${row.name} günlük hedefini düzenle`}
            onPress={() => setEditing(true)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <ThemedText style={f.link}>
              {row.target_quantity ? "Düzenle" : "Hedef belirle"}
            </ThemedText>
          </Pressable>
        )}
      </View>
      <ThemedText style={[ui.hint, { color: palette.mutedText }]}>
        {focused ? `${row.tenant_name} · Hedef ${row.target_quantity==null?'—':row.target_quantity.toLocaleString("tr-TR")} ${unit} · Yapılan ${row.day.quantity.toLocaleString("tr-TR")} ${unit}` : <>
        {row.tenant_name} · Bugün {row.day.quantity.toLocaleString("tr-TR")}{" "}
        {unit}
        {row.target_quantity
          ? ` / ${row.target_quantity.toLocaleString("tr-TR")} ${unit}`
          : ""}
        </>}
      </ThemedText>
      {row.target_quantity != null && (
        <View
          accessibilityLabel={`Hedef ilerlemesi yüzde ${Math.round(progress * 100)}`}
          style={{
            height: 7,
            borderRadius: 4,
            backgroundColor: palette.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 7,
              width: `${progress * 100}%`,
              backgroundColor: palette.green,
            }}
          />
        </View>
      )}
      {row.target_quantity != null && (
        <ThemedText style={{ color: palette.green }}>
          {focused ? `Kalan ${guidance.remaining.toLocaleString("tr-TR")} ${unit} · %${guidance.percent}${guidance.complete?" ✓":""}` : guidance.complete
            ? "Hedef tamamlandı ✓"
            : `${guidance.remaining.toLocaleString("tr-TR")} ${unit} kaldı · %${guidance.percent}`}
        </ThemedText>
      )}
      {row.can_edit && editing ? (
        <View style={ui.row}>
          <TextInput
            accessibilityLabel={`${row.name} günlük hedef (${unit})`}
            value={draft}
            onChangeText={setDraft}
            editable={!mutation.isPending}
            keyboardType="decimal-pad"
            placeholder={`Günlük hedef (${unit})`}
            placeholderTextColor={palette.mutedText}
            style={[
              ui.input,
              {
                flex: 1,
                color: palette.text,
                backgroundColor: palette.cardRaised,
                borderColor: palette.border,
              },
            ]}
          />
          <Button
            title={mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
            disabled={
              mutation.isPending ||
              !Number.isFinite(amount) ||
              amount <= 0 ||
              amount > 100000
            }
            onPress={() => mutation.mutate()}
          />
        </View>
      ) : !row.can_edit ? (
        <ThemedText style={ui.hint}>
          Bu egzersizde şu anda hedef değiştirilemiyor.
        </ThemedText>
      ) : null}
      {mutation.error && (
        <Message error message={errorMessage(mutation.error)} />
      )}
      {mutation.isSuccess && (
        <ThemedText style={{ color: palette.green }}>
          Hedef telefona kaydedildi. Eşitleme arka planda yapılır.
        </ThemedText>
      )}
    </View>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <FitCard compact>
      <ThemedText style={f.sectionTitle}>{title}</ThemedText>
      <ThemedText style={f.muted}>{hint}</ThemedText>
      {children}
    </FitCard>
  );
}
const Button = FitButton;
