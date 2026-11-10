import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Crest from "@/components/Crest";
import { endSession, useAssociation, useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  testid: string;
  end?: boolean;
}

export default function AppShell({ nav, roleLabel, children }: { nav: NavItem[]; roleLabel: string; children: ReactNode }) {
  const { data: assoc } = useAssociation();
  const { data: me } = useMe();
  const navigate = useNavigate();

  async function logout() {
    await endSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-dvh bg-background pb-24 md:pb-12">
      <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 md:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3" data-testid="shell-home-link">
            <Crest logo={assoc?.logo} testid="shell-logo" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-navy">App Noi di Leyni</p>
              <p className="truncate text-xs text-muted-foreground" data-testid="shell-association-name">
                {assoc?.name ?? "Leinì Volley"}
              </p>
            </div>
          </Link>
          {nav.length > 1 && (
            <nav className="ml-6 hidden items-center gap-1 md:flex">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  data-testid={`nav-${item.testid}`}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent text-accent-foreground",
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Badge className="bg-gold-soft text-gold-ink" data-testid="shell-role-badge">
              {roleLabel}
            </Badge>
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground lg:inline" data-testid="shell-user-email">
              {me?.user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={logout} data-testid="logout-button">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Esci</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 md:py-8">{children}</main>

      {nav.length > 1 && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={`mobile-nav-${item.testid}`}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
                  isActive && "text-primary",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
