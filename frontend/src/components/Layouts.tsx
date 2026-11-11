import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { CreditCard, History, Loader2, Receipt, ScanLine, Store, Tag, UserRound, Users } from "lucide-react";
import AppShell, { type NavItem } from "@/components/AppShell";
import { homeFor, useMe } from "@/lib/session";
import type { Role } from "@/lib/types";

const ATHLETE_NAV: NavItem[] = [
  { to: "/atleta", label: "Tessera", icon: CreditCard, testid: "tessera", end: true },
  { to: "/atleta/convenzioni", label: "Convenzioni", icon: Tag, testid: "convenzioni" },
  { to: "/atleta/famiglia", label: "Famiglia", icon: Users, testid: "famiglia" },
  { to: "/atleta/movimenti", label: "Movimenti", icon: Receipt, testid: "movimenti" },
  { to: "/atleta/profilo", label: "Profilo", icon: UserRound, testid: "profilo" },
];

const MERCHANT_NAV: NavItem[] = [
  { to: "/commerciante", label: "Cassa", icon: ScanLine, testid: "cassa", end: true },
  { to: "/commerciante/storico", label: "Storico", icon: History, testid: "storico" },
  { to: "/commerciante/profilo", label: "Attività", icon: Store, testid: "attivita" },
];

const ADMIN_NAV: NavItem[] = [];

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { data, isLoading, isError } = useMe();
  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center" data-testid="auth-loading">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (isError || !data) return <Navigate to="/login" replace />;
  if (data.user.role !== role) return <Navigate to={homeFor(data.user.role)} replace />;
  return <>{children}</>;
}

export function AthleteLayout() {
  return (
    <RequireRole role="athlete">
      <AppShell nav={ATHLETE_NAV} roleLabel="Atleta">
        <Outlet />
      </AppShell>
    </RequireRole>
  );
}

export function MerchantLayout() {
  return (
    <RequireRole role="merchant">
      <AppShell nav={MERCHANT_NAV} roleLabel="Commerciante">
        <Outlet />
      </AppShell>
    </RequireRole>
  );
}

export function AdminLayout() {
  return (
    <RequireRole role="admin">
      <AppShell nav={ADMIN_NAV} roleLabel="Direttivo">
        <Outlet />
      </AppShell>
    </RequireRole>
  );
}
