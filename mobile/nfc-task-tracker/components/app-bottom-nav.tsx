import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  href: string;
  match: (path: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Bugün',
    icon: 'today-outline',
    activeIcon: 'today',
    href: '/(drawer)',
    match: (path) => path === '/' || path === '/index',
  },
  {
    label: 'Tara',
    icon: 'radio-outline',
    activeIcon: 'radio',
    href: '/(drawer)/nfc',
    match: (path) => path.includes('/nfc'),
  },
  {
    label: 'Fitness',
    icon: 'fitness-outline',
    activeIcon: 'fitness',
    href: '/(drawer)/fitness',
    match: (path) => path.includes('/fitness'),
  },
  {
    label: 'Wellness',
    icon: 'add-circle-outline',
    activeIcon: 'add-circle',
    href: '/(drawer)/wellness',
    match: (path) => path.includes('/wellness'),
  },
  {
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
    href: '/(drawer)/settings',
    match: (path) => path.includes('/settings'),
  },
];

export function AppBottomNav() {
  const pathname = usePathname();
  const surface = getSurfaceColors(useColorScheme());

  return (
    <View style={[styles.wrap, { backgroundColor: surface.card, borderColor: surface.border }]}>
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        const isScan = item.label === 'Tara';
        return (
          <Pressable
            key={item.label}
            style={[styles.item, isScan && styles.scanItem]}
            onPress={() => router.push(item.href as never)}>
            <View style={[
              isScan && styles.scanBubble,
              isScan && { backgroundColor: active ? '#35D353' : 'rgba(53,211,83,0.92)' },
            ]}>
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={isScan ? 24 : 20}
                color={isScan ? '#fff' : active ? '#35D353' : surface.mutedText}
              />
            </View>
            <ThemedText
              numberOfLines={1}
              style={[
                styles.label,
                { color: active ? (isScan ? '#35D353' : '#35D353') : surface.mutedText },
                active && styles.labelActive,
              ]}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const bottomNavHeight = 74;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: bottomNavHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 48,
  },
  scanItem: {
    marginTop: -22,
  },
  scanBubble: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#35D353',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '800',
  },
});
