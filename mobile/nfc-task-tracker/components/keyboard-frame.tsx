import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keyboardViewportLimit } from "@/lib/keyboard-frame";

export function KeyboardFrame({
  children,
  style,
  keyboardVerticalOffset = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}) {
  const ref = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const navigationInset = useRef(insets.bottom);
  const keyboard = useRef<KeyboardEvent["endCoordinates"] | null>(null);
  const [limit, setLimit] = useState<number | undefined>();
  if (!keyboard.current) navigationInset.current = insets.bottom;
  const measure = () => {
    const metrics = keyboard.current;
    if (!metrics) return;
    ref.current?.measureInWindow((_x, y) => {
      // Ignore a delayed measurement after the keyboard has closed or changed.
      if (keyboard.current !== metrics) return;
      setLimit(
        keyboardViewportLimit(
          Dimensions.get("screen").height,
          metrics.height,
          navigationInset.current,
          // Android measureInWindow uses the visible window origin below the status bar.
          y + insets.top,
        ),
      );
    });
  };
  const measureRef = useRef(measure);
  measureRef.current = measure;
  useEffect(() => {
    if (Platform.OS !== "android") return;
    keyboard.current = Keyboard.metrics() ?? null;
    if (keyboard.current) measureRef.current();
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboard.current = event.endCoordinates;
      requestAnimationFrame(() => measureRef.current());
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboard.current = null;
      setLimit(undefined);
    });
    return () => {
      keyboard.current = null;
      show.remove();
      hide.remove();
    };
  }, []);
  if (Platform.OS !== "android")
    return (
      <KeyboardAvoidingView
        style={[{ flex: 1 }, style]}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    );
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[{ flex: 1 }, style, limit != null && { maxHeight: limit }]}
      onLayout={() => measureRef.current()}
    >
      {children}
    </View>
  );
}
