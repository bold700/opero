"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronUp,
  Contact,
  Layers,
  Package,
  RotateCcw,
  Settings,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { accountRoleConfig, type AccountRole } from "@/lib/roles";
import { useOperoStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: BarChart3, label: "Dashboard" },
  { href: "/projects", icon: BriefcaseBusiness, label: "Projecten" },
  { href: "/planning", icon: CalendarDays, label: "Planning" },
  { href: "/artikelen", icon: Package, label: "Artikelen" },
  { href: "/werksoorten", icon: Layers, label: "Werksoorten" },
  { href: "/klanten", icon: Users, label: "Klanten" },
  { href: "/personeel", icon: Contact, label: "Personeel" },
];

// Welke navigatie elke rol ziet. Monteur en opdrachtgever werken vanuit hun
// eigen projecten, dus die zien alleen Dashboard en Projecten. De opdrachtgever
// krijgt op Projecten zijn klantportaal-view.
const navByRole: Record<AccountRole, string[]> = {
  super_admin: navItems.map((item) => item.href),
  projectmanager: ["/", "/projects", "/planning", "/artikelen", "/werksoorten", "/klanten", "/personeel"],
  sales: ["/", "/projects", "/klanten"],
  voorraad: ["/", "/projects", "/artikelen", "/werksoorten"],
  administratie: ["/", "/projects", "/klanten"],
  monteur: ["/", "/projects"],
  opdrachtgever: ["/", "/projects"],
};

const bottomTabsByRole: Record<AccountRole, string[]> = {
  administratie: ["/", "/projects", "/klanten"],
  monteur: ["/", "/projects"],
  opdrachtgever: ["/", "/projects"],
  projectmanager: ["/", "/projects", "/planning"],
  sales: ["/", "/projects", "/klanten"],
  super_admin: ["/", "/projects", "/planning"],
  voorraad: ["/", "/projects", "/artikelen"],
};

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeProfileId = useOperoStore((state) => state.activeProfileId);
  const profiles = useOperoStore((state) => state.profiles);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const allowed = navByRole[activeProfile.role] ?? navItems.map((i) => i.href);
  const items = navItems.filter((item) => allowed.includes(item.href));

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950",
              isActive && "bg-zinc-950 text-white hover:bg-zinc-900 hover:text-white",
            )}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileList() {
  const activeProfileId = useOperoStore((state) => state.activeProfileId);
  const profiles = useOperoStore((state) => state.profiles);
  const setActiveProfile = useOperoStore((state) => state.setActiveProfile);

  function chooseProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;

    setActiveProfile(profileId);
    toast.success(`Testprofiel: ${profile.name}`);
  }

  return (
    <div className="grid gap-1.5">
      {profiles.map((profile) => {
        const config = accountRoleConfig[profile.role];
        const Icon = config.icon;
        const active = profile.id === activeProfileId;

        return (
          <button
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md border px-2 text-left text-xs font-medium transition",
              active
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950",
            )}
            key={profile.id}
            onClick={() => chooseProfile(profile.id)}
            type="button"
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{profile.name}</span>
              <span className="block truncate text-[11px] font-normal opacity-75">
                {config.label}
              </span>
            </span>
            {active ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function DevSettingsSheet({ compact = false }: { compact?: boolean }) {
  const activeProfileId = useOperoStore((state) => state.activeProfileId);
  const profiles = useOperoStore((state) => state.profiles);
  const resetDemo = useOperoStore((state) => state.resetDemo);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const activeConfig = accountRoleConfig[activeProfile.role];
  const ActiveIcon = activeConfig.icon;

  return (
    <Sheet>
      <SheetTrigger asChild>
        {compact ? (
          <button
            aria-label="Profiel openen"
            className="flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-emerald-700 transition hover:bg-zinc-50"
            type="button"
          >
            <ActiveIcon className="size-4" />
          </button>
        ) : (
          <button
            className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-left transition hover:bg-zinc-50"
            type="button"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <ActiveIcon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-950">
                {activeProfile.name}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {activeConfig.label}
              </p>
            </div>
            <ChevronUp className="size-4 shrink-0 text-zinc-400" />
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="size-4" />
            Instellingen (dev)
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Ingelogd als</p>
            <p className="mt-2 text-sm font-semibold text-zinc-950">
              {activeProfile.name}
            </p>
            <p className="text-xs text-zinc-500">
              {activeConfig.label} · {activeProfile.organization}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Testprofiel wisselen</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              In productie komt dit uit login, account en rechten.
            </p>
            <div className="mt-3">
              <ProfileList />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-medium text-zinc-950">Demo data</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Wijzigingen blijven lokaal bewaard.
            </p>
            <Button
              className="mt-3 w-full"
              onClick={() => {
                resetDemo();
                toast.success("Demo teruggezet naar mock data");
              }}
              size="sm"
              variant="outline"
            >
              <RotateCcw className="size-4" />
              Reset demo
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">Accountrechten</Badge>
            <Badge variant="outline">Super admin</Badge>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BottomTabs() {
  const pathname = usePathname();
  const activeProfileId = useOperoStore((state) => state.activeProfileId);
  const profiles = useOperoStore((state) => state.profiles);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const allowed = bottomTabsByRole[activeProfile.role] ?? ["/", "/projects"];
  const tabs = navItems.filter((item) => allowed.includes(item.href));

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {tabs.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition",
              isActive ? "text-emerald-700" : "text-zinc-500 hover:text-zinc-950",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon className={cn("size-5", isActive && "text-emerald-700")} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white/90 p-4 backdrop-blur lg:block">
        <div className="flex h-full flex-col">
          <Link href="/" className="mb-8 flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              OP
            </div>
            <div>
              <p className="font-semibold tracking-normal text-zinc-950">Opero</p>
              <p className="text-xs text-zinc-500">Isolatie operations</p>
            </div>
          </Link>
          <Navigation />
          <div className="mt-auto">
            <DevSettingsSheet />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
            OP
          </div>
          <span className="font-semibold text-zinc-950">Opero</span>
        </Link>
        <DevSettingsSheet compact />
      </header>

      <main className="lg:pl-64">
        <div className="min-h-screen w-full px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-6">
          {children}
        </div>
      </main>

      <BottomTabs />
    </div>
  );
}
