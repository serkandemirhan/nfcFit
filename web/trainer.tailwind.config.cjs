module.exports = {
  content: [
    "./CoachingConsole.tsx",
    "./TrainerPlanning.tsx",
    "./TrainerPlanningUI.tsx",
    "./TrainerAdminLayout.tsx",
    "./TrainerExerciseLibrary.tsx",
    "./components/trainer-ui/**/*.{ts,tsx}",
  ],
  important: ".nfc-admin",
  corePlugins: { preflight: false },
  theme: { extend: {} },
};
