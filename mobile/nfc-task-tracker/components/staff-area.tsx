import { useCallback, useState, type ReactNode } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import {
  canOpenCoachArea,
  canOpenManagement,
  useTenantIdentity,
} from "@/hooks/use-tenant-identity";
import { CoachButton, CoachShell, CoachText, coachStyle } from "./coaching-ui";

/** The child component (and its data hooks) never mounts for an ordinary member. */
export function StaffArea({
  children,
  management = false,
}: {
  children: ReactNode;
  management?: boolean;
}) {
  const identity = useTenantIdentity();
  const { refetch: refetchIdentity } = identity;
  const [checked, setChecked] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      setChecked(false);
      void refetchIdentity().finally(() => {
        if (live) setChecked(true);
      });
      return () => {
        live = false;
      };
    }, [refetchIdentity]),
  );
  const allowed =
    !identity.isError &&
    (management
      ? canOpenManagement(identity.data)
      : canOpenCoachArea(identity.data));
  if (checked && allowed) return <>{children}</>;
  return (
    <CoachShell title="Hesap yetkisi" bottom>
      <CoachText accessibilityRole="alert" style={coachStyle.text}>
        {!checked
          ? "Hesap yetkileri kontrol ediliyor…"
          : identity.isError
            ? "Hesap yetkileri doğrulanamadı. Bağlantını kontrol et."
            : management
              ? "Bu alan yalnızca tesis yöneticilerine açıktır."
              : "Bu alan yalnızca antrenör ve tesis yöneticilerine açıktır."}
      </CoachText>
      {checked && identity.isError && (
        <CoachButton
          title="Yeniden dene"
          onPress={() => {
            setChecked(false);
            void refetchIdentity().finally(() => setChecked(true));
          }}
        />
      )}
      <CoachButton
        title="Ana sayfaya dön"
        secondary
        onPress={() => router.replace("/(drawer)" as never)}
      />
    </CoachShell>
  );
}
