import { router } from "expo-router";
import { ExerciseSelector } from "@/components/exercise-selector";

export default function ExerciseLibrary() {
  return (
    <ExerciseSelector
      browseOnly
      onSelect={() => undefined}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(drawer)" as never);
      }}
    />
  );
}
