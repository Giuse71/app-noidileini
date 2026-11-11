import { LAST_SYNC_KEY } from "@/lib/offline";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { Association, Category, Me, Merchant, Role } from "@/lib/types";

export const ME_KEY = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => apiGet<Me | null>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

/** Call after a successful login/registration: drops any previous account's cache. */
export function beginSession(me: Me) {
  queryClient.clear();
  queryClient.setQueryData(ME_KEY, me);
}

/** Every sign-out goes through here. */
export async function endSession() {
  await apiPost("/auth/logout").catch(() => undefined);
  if ("caches" in window) await caches.delete("lv-cache").catch(() => undefined);
  localStorage.removeItem(LAST_SYNC_KEY);
  queryClient.clear();
  queryClient.setQueryData(ME_KEY, null);
}

export function homeFor(role: Role): string {
  return role === "athlete" ? "/atleta" : role === "merchant" ? "/commerciante" : "/admin";
}

export function useAssociation() {
  return useQuery({
    queryKey: ["association"],
    queryFn: () => apiGet<Association>("/association"),
    staleTime: 5 * 60_000,
  });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => apiGet<Category[]>("/categories") });
}

export function useMerchants() {
  return useQuery({ queryKey: ["merchants"], queryFn: () => apiGet<Merchant[]>("/merchants") });
}
