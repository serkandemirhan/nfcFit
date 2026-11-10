import { fit } from "@/constants/fitness";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import {
  canOpenManagement,
  isCoach,
  useTenantIdentity,
} from "@/hooks/use-tenant-identity";

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  href: string;
  match: (path: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Bugün",
    icon: "calendar-outline",
    activeIcon: "calendar",
    href: "/(drawer)",
    match: (path) => path === "/" || path === "/(drawer)",
  },
  {
    label: "Programım",
    icon: "barbell-outline",
    activeIcon: "barbell",
    href: "/(drawer)/plans",
    match: (path) => path.includes("/plans") || path.includes("/workout"),
  },
  {
    label: "Kart okut",
    icon: "radio-outline",
    activeIcon: "radio",
    href: "/(drawer)/nfc",
    match: (path) => path.includes("/nfc"),
  },
  {
    label: "İlerleme",
    icon: "stats-chart-outline",
    activeIcon: "stats-chart",
    href: "/progress",
    match: (path) =>
      path.includes("/progress") ||
      path.includes("/fitness") ||
      path === "/goals",
  },
  {
    label: "Profil",
    icon: "person-outline",
    activeIcon: "person",
    href: "/(drawer)/settings",
    match: (path) =>
      path.includes("/settings") ||
      path.includes("/wellness") ||
      path.includes("/sync") ||
      path === "/messages" ||
      path.includes("/history"),
  },
];

export function AppBottomNav() {
  const pathname = usePathname();
  const identity = useTenantIdentity();
  const management = canOpenManagement(identity.data);
  const trainer = isCoach(identity.data);
  const trainerItems: typeof NAV_ITEMS = [
    {
      label: "Panel",
      icon: "grid-outline",
      activeIcon: "grid",
      href: "/coach",
      match: (path) => path === "/coach",
    },
    {
      label: "Sporcular",
      icon: "people-outline",
      activeIcon: "people",
      href: "/athletes",
      match: (path) => path === "/athletes" || path === "/athlete",
    },
    {
      label: "Programlar",
      icon: "barbell-outline",
      activeIcon: "barbell",
      href: "/(drawer)/plans",
      match: (path) => path.includes("/plans"),
    },
    {
      label: "Raporlar",
      icon: "stats-chart-outline",
      activeIcon: "stats-chart",
      href: "/coach-reports",
      match: (path) => path.includes("reports") || path.includes("/progress"),
    },
    {
      label: "Mesajlar",
      icon: "chatbubbles-outline",
      activeIcon: "chatbubbles",
      href: "/messages",
      match: (path) => path === "/messages",
    },
  ];
  const items = trainer
    ? trainerItems
    : management
      ? [
          {
            label: "Yönetim",
            icon: "business-outline" as const,
            activeIcon: "business" as const,
            href: "/(drawer)/management",
            match: (path: string) => path.includes("/management"),
          },
          ...NAV_ITEMS.slice(1),
        ]
      : NAV_ITEMS;

  return (
    <View
      style={[styles.wrap, { backgroundColor: fit.bg, borderColor: fit.line }]}
    >
      {items.map((item) => {
        const active = item.match(pathname);
        const isScan = item.href.endsWith("/nfc");
        return (
          <Pressable
            key={item.label}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={styles.item}
            onPress={() => router.navigate(item.href as never)}
          >
            <View
              style={[
                styles.iconWrap,
                isScan && styles.scanBubble,
                isScan && {
                  backgroundColor: active ? fit.lime : `${fit.lime}E8`,
                },
              ]}
            >
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={20}
                color={isScan ? fit.bg : active ? fit.lime : fit.muted}
              />
            </View>
            <ThemedText
              numberOfLines={1}
              style={[
                styles.label,
                { color: active ? fit.lime : fit.muted },
                active && styles.labelActive,
              ]}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const bottomNavHeight = 72;

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: bottomNavHeight,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 54,
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  scanBubble: {
    borderRadius: 12,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
  },
  labelActive: {
    fontWeight: "800",
  },
});
