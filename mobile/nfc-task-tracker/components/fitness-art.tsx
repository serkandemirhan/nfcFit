import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { View } from "react-native";

/** Original decorative vector artwork. It is not an exercise technique demonstration. */
export function MovementArt({
  muscle = "chest",
  size = 110,
}: {
  muscle?: string;
  size?: number;
}) {
  const leg = ["legs", "quadriceps", "glutes", "hamstrings", "calves"].includes(
    muscle,
  );
  const run = ["cardio", "full_body", "mobility"].includes(muscle);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 160 160">
        <Defs>
          <LinearGradient id="body" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#eef5f8" />
            <Stop offset="1" stopColor="#617883" />
          </LinearGradient>
          <LinearGradient id="halo" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#c9ff31" stopOpacity=".22" />
            <Stop offset="1" stopColor="#c9ff31" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Circle cx="80" cy="78" r="67" fill="url(#halo)" />
        <Ellipse cx="80" cy="141" rx="62" ry="7" fill="#071014" opacity=".6" />
        {leg ? (
          <G strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="82" cy="37" r="12" fill="url(#body)" />
            <Path
              d="M77 55 L66 82 L91 96"
              stroke="url(#body)"
              strokeWidth="21"
            />
            <Path
              d="M67 82 L47 107 L49 134 M90 96 L113 113 L109 136"
              stroke="#c6ff23"
              strokeWidth="14"
            />
            <Path
              d="M77 59 L53 54 L40 42 M82 59 L106 57 L120 43"
              stroke="url(#body)"
              strokeWidth="11"
            />
            <Line
              x1="23"
              y1="43"
              x2="139"
              y2="43"
              stroke="#d8e4e8"
              strokeWidth="5"
            />
            <Rect x="26" y="29" width="10" height="28" rx="3" fill="#81939e" />
            <Rect x="125" y="29" width="10" height="28" rx="3" fill="#81939e" />
          </G>
        ) : run ? (
          <G strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="92" cy="31" r="12" fill="url(#body)" />
            <Path d="M85 52 L70 82" stroke="#c6ff23" strokeWidth="23" />
            <Path
              d="M76 81 L47 106 L23 109 M76 86 L110 105 L115 136"
              stroke="url(#body)"
              strokeWidth="14"
            />
            <Path
              d="M84 53 L108 65 L126 51 M78 55 L56 61 L43 48"
              stroke="url(#body)"
              strokeWidth="10"
            />
            <Path
              d="M16 74 H38 M9 86 H28 M20 60 H42"
              stroke="#c6ff23"
              opacity=".5"
              strokeWidth="3"
            />
          </G>
        ) : muscle !== "chest" ? (
          <G strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="82" cy="30" r="12" fill="url(#body)" />
            <Path
              d="M72 51 L65 86 L99 86 L92 51 Z"
              fill={
                ["back", "core"].includes(muscle) ? "#c6ff23" : "url(#body)"
              }
            />
            <Path
              d="M72 91 L62 132 M93 91 L103 132"
              stroke="url(#body)"
              strokeWidth="15"
            />
            <Path
              d="M67 55 L51 79 L59 95 M97 55 L112 79 L104 95"
              stroke={
                ["arms", "shoulders"].includes(muscle)
                  ? "#c6ff23"
                  : "url(#body)"
              }
              strokeWidth="12"
            />
            <Line
              x1="31"
              y1="96"
              x2="132"
              y2="96"
              stroke="#dce5ea"
              strokeWidth="5"
            />
            <Rect x="32" y="81" width="10" height="30" rx="3" fill="#8ca0ab" />
            <Rect x="121" y="81" width="10" height="30" rx="3" fill="#8ca0ab" />
          </G>
        ) : (
          <G strokeLinecap="round" strokeLinejoin="round">
            <Rect x="30" y="109" width="94" height="10" rx="4" fill="#51646d" />
            <Path
              d="M40 118 L34 141 M111 118 L118 141"
              stroke="#51646d"
              strokeWidth="6"
            />
            <Circle cx="122" cy="96" r="12" fill="url(#body)" />
            <Path d="M109 103 L71 101" stroke="#c6ff23" strokeWidth="23" />
            <Path
              d="M69 104 L43 114 L31 136"
              stroke="url(#body)"
              strokeWidth="14"
            />
            <Path
              d="M96 96 L102 70 L91 48 M79 94 L67 70 L73 48"
              stroke="url(#body)"
              strokeWidth="11"
            />
            <Line
              x1="34"
              y1="46"
              x2="133"
              y2="46"
              stroke="#dce5ea"
              strokeWidth="5"
            />
            <Rect x="35" y="29" width="11" height="34" rx="4" fill="#8ca0ab" />
            <Rect x="122" y="29" width="11" height="34" rx="4" fill="#8ca0ab" />
            <Rect x="28" y="35" width="6" height="22" rx="2" fill="#5b707c" />
            <Rect x="135" y="35" width="6" height="22" rx="2" fill="#5b707c" />
          </G>
        )}
      </Svg>
    </View>
  );
}
export function MuscleMap({ muscle }: { muscle: string }) {
  const color = (group: string[]) =>
    group.includes(muscle) ? "#c6ff23" : "#536975";
  return (
    <Svg
      width="100%"
      height={230}
      viewBox="0 0 180 240"
      accessibilityLabel="Hedef kas grubunun şematik gösterimi"
    >
      <Circle cx="90" cy="24" r="17" fill="#8b9ca5" />
      <Path
        d="M72 46 Q90 39 108 46 L116 96 L103 140 L77 140 L64 96 Z"
        fill="#3b505c"
      />
      <Path
        d="M72 49 L88 55 L87 83 L68 75 Z M108 49 L92 55 L93 83 L112 75 Z"
        fill={color(["chest"])}
      />
      <Path
        d="M78 87 L102 87 L100 127 L80 127 Z"
        fill={color(["core", "abs"])}
      />
      <Path
        d="M64 48 L53 53 L43 83 L56 88 L71 61 M116 48 L127 53 L137 83 L124 88 L109 61"
        fill={color(["shoulders"])}
      />
      <Path
        d="M43 87 L56 91 L47 128 L36 126 Z M137 87 L124 91 L133 128 L144 126 Z"
        fill={color(["biceps", "triceps", "arms"])}
      />
      <Path
        d="M76 144 L88 144 L86 192 L70 192 Z M104 144 L92 144 L94 192 L110 192 Z"
        fill={color(["legs", "quadriceps", "hamstrings", "glutes"])}
      />
      <Path
        d="M70 197 L84 197 L80 231 L68 231 Z M110 197 L96 197 L100 231 L112 231 Z"
        fill={color(["calves", "legs"])}
      />
      {muscle === "back" && (
        <Path
          d="M72 58 L108 58 L101 122 L79 122 Z"
          fill="#c6ff23"
          opacity=".8"
        />
      )}
    </Svg>
  );
}
