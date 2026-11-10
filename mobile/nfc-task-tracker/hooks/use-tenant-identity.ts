import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { offlineStore } from "@/lib/offline-store";
import { hasConnection } from "@/lib/offline-sync";
import {
  ConsoleApiError,
  type ConsoleIdentity,
  fetchConsoleIdentityForUser,
  tenantConsoleConfigured,
} from "@/lib/tenant-console";
export {
  canOpenManagement,
  canOpenCoachArea,
  isCoach,
} from "@/lib/console-access";

export function useTenantIdentity() {
  const { user } = useAuth();
  const id = user?.id ?? "";
  const query = useQuery({
    queryKey: ["console-identity", id],
    queryFn: async () => {
      const local = await offlineStore.getDoc<ConsoleIdentity>(id, "identity");
      if (await hasConnection()) {
        try {
          const remote = await fetchConsoleIdentityForUser(id);
          await offlineStore.putDoc(id, "identity", remote);
          return remote;
        } catch (error) {
          // Authentication failures must not revive previously cached staff rights.
          if (
            error instanceof ConsoleApiError &&
            [401, 403].includes(error.status)
          )
            throw error;
          if (!local) throw error;
        }
      }
      if (local) return local;
      throw new Error("Hesap yetkilerini doğrulamak için internete bağlan.");
    },
    enabled: Boolean(id) && tenantConsoleConfigured,
    networkMode: "always",
    staleTime: 30_000,
    retry: 1,
  });
  return { ...query, data: query.isError ? undefined : query.data };
}
