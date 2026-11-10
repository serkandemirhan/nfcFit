import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { coachingStore, loadCoachingOverview } from "@/lib/coaching";
export function useCoaching(athlete?: string) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["coaching", user?.id ?? "", athlete ?? "self"],
    queryFn: () => loadCoachingOverview(user!.id, athlete),
    enabled: !!user?.id,
    networkMode: athlete ? "online" : "always",
    staleTime: athlete ? 0 : Infinity,
    refetchOnMount: athlete ? "always" : true,
    retry: 1,
  });
  // A failed or revoked trainer read must not display an older private query result.
  return {
    ...query,
    data:
      athlete && (query.isFetching || query.isError) ? undefined : query.data,
  };
}
export function useCoachingLibrary() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coaching-library", user?.id ?? ""],
    queryFn: () => coachingStore.library(user!.id),
    enabled: !!user?.id,
    networkMode: "always",
    staleTime: Infinity,
  });
}
export function useCoachingWorkout(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coaching-workout", user?.id ?? "", id],
    queryFn: () => coachingStore.workout(user!.id, id),
    enabled: !!user?.id && !!id,
    networkMode: "always",
    staleTime: Infinity,
  });
}
