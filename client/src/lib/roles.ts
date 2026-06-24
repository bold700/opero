import {
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  ClipboardList,
  HardHat,
  PackageSearch,
  ShieldCheck,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { getProjectMaterialReadiness } from "@/lib/workflow";
import { type Project, type Role, type Stage } from "@/lib/types";
import { STAGE_ORDER } from "@/lib/stages";

export const accountRoleIds = [
  "super_admin",
  "opdrachtgever",
  "projectmanager",
  "monteur",
  "voorraad",
  "sales",
  "administratie",
] as const;

export type AccountRole = (typeof accountRoleIds)[number];

export type RoleConfig = {
  description: string;
  deviceNote: string;
  icon: LucideIcon;
  label: string;
  primaryHref: string;
  primaryLabel: string;
  summary: string;
};

export type TestProfile = {
  customerId?: string;
  id: string;
  name: string;
  organization: string;
  role: AccountRole;
  teamMemberId?: string;
};

export const accountRoleConfig: Record<AccountRole, RoleConfig> = {
  administratie: {
    description: "Facturen, betaalstatus en opleverdossiers.",
    deviceNote: "Desktop voor facturatie, tablet voor opleveroverleg.",
    icon: Calculator,
    label: "Administratie",
    primaryHref: "/projects",
    primaryLabel: "Facturen bekijken",
    summary: "Van afgerond werk naar factuur en betaling.",
  },
  monteur: {
    description: "Vandaag, werkbon, checklist, fotos, issue melden.",
    deviceNote: "Mobiel-first met grote knoppen voor buiten en handschoenen.",
    icon: HardHat,
    label: "Monteur",
    primaryHref: "/execution",
    primaryLabel: "Open werkbon",
    summary: "Een simpele uitvoeringservaring voor onderweg.",
  },
  opdrachtgever: {
    description: "Projectstatus, planning, oplevering en contactmomenten.",
    deviceNote: "Mobiel en tablet voor snelle statuscontrole bij de opdrachtgever.",
    icon: UserRound,
    label: "Opdrachtgever",
    primaryHref: "/projects",
    primaryLabel: "Bekijk projectstatus",
    summary: "Transparant meekijken zonder interne operatie te tonen.",
  },
  projectmanager: {
    description: "Project lifecycle, planning, blokkades en teamoverdracht.",
    deviceNote: "Tablet en desktop voor planning; mobiel voor snelle checks.",
    icon: BriefcaseBusiness,
    label: "Projectmanager",
    primaryHref: "/projects",
    primaryLabel: "Beheer projecten",
    summary: "Grip op alle projecten van aanvraag tot betaling.",
  },
  sales: {
    description: "Nieuwe aanvragen, intake, offertes en akkoord opvolgen.",
    deviceNote: "Tablet voor intakegesprek, desktop voor offertewerk.",
    icon: ClipboardList,
    label: "Sales",
    primaryHref: "/projects",
    primaryLabel: "Aanvragen opvolgen",
    summary: "Van lead naar getekende offerte.",
  },
  super_admin: {
    description: "Alle projecten, rollen, blokkades, facturen en demo-instellingen.",
    deviceNote: "Desktop voor totaalbeheer, tablet voor direct meekijken in operatie.",
    icon: ShieldCheck,
    label: "Super admin",
    primaryHref: "/projects",
    primaryLabel: "Bekijk alles",
    summary: "Volledig overzicht en alle operationele rechten.",
  },
  voorraad: {
    description: "Materialencheck, ontbrekende voorraad en inkooplijsten.",
    deviceNote: "Tablet in magazijn, desktop voor inkoop en leveranciers.",
    icon: PackageSearch,
    label: "Voorraadbeheer",
    primaryHref: "/projects",
    primaryLabel: "Materialen controleren",
    summary: "Zeker weten dat uitvoering niet stilvalt.",
  },
};

export const testProfiles: TestProfile[] = [
  {
    id: "profile-super-admin",
    name: "Mila Smit",
    organization: "Opero beheer",
    role: "super_admin",
  },
  {
    id: "profile-projectmanager",
    name: "Martijn Kuiper",
    organization: "Opero projectteam",
    role: "projectmanager",
    teamMemberId: "tm-002",
  },
  {
    id: "profile-monteur",
    name: "Jamal El Idrissi",
    organization: "Team West",
    role: "monteur",
    teamMemberId: "tm-003",
  },
  {
    id: "profile-voorraad",
    name: "Sofia Bakker",
    organization: "Magazijn en inkoop",
    role: "voorraad",
    teamMemberId: "tm-001",
  },
  {
    id: "profile-sales",
    name: "Noor Vermeulen",
    organization: "Sales binnendienst",
    role: "sales",
  },
  {
    id: "profile-administratie",
    name: "Mila Smit",
    organization: "Administratie",
    role: "administratie",
    teamMemberId: "tm-008",
  },
  {
    customerId: "c-008",
    id: "profile-opdrachtgever",
    name: "Lisette Bouwman",
    organization: "Woningcorporatie Rijnzicht",
    role: "opdrachtgever",
  },
];

// Personeelsrollen: per rol in welke projectfases iemand belangrijk is en
// welke rechten daarbij horen. Een persoon kan meerdere rollen hebben.
export type TeamRoleConfig = {
  label: string;
  stages: Stage[];
  rights: string;
  icon: LucideIcon;
};

export const teamRoleConfig: Record<Role, TeamRoleConfig> = {
  Sales: {
    label: "Sales",
    stages: ["concept"],
    rights: "Maakt offertes en volgt akkoord van de klant op.",
    icon: ClipboardList,
  },
  Werkvoorbereider: {
    label: "Werkvoorbereider",
    stages: ["in_progress"],
    rights: "Stelt werkbonnen en materiaal samen en keurt de voorbereiding goed.",
    icon: PackageSearch,
  },
  Planner: {
    label: "Planner",
    stages: ["in_progress"],
    rights: "Plant projectdagen en wijst monteurs toe.",
    icon: CalendarDays,
  },
  Voorman: {
    label: "Voorman",
    stages: ["in_progress"],
    rights: "Leidt het werk op locatie, controleert kwaliteit en bewaakt de werkbon.",
    icon: HardHat,
  },
  Monteur: {
    label: "Monteur",
    stages: ["in_progress"],
    rights: "Voert taken uit, legt verbruik, fotos en meerwerk vast.",
    icon: Wrench,
  },
  Administratie: {
    label: "Administratie",
    stages: ["in_progress", "done"],
    rights: "Maakt facturen, bewaakt betaling en sluit projecten af.",
    icon: Calculator,
  },
  Projectleider: {
    label: "Projectleider",
    stages: ["concept", "in_progress", "done"],
    rights: "Volledige toegang en eindverantwoordelijk over het hele project.",
    icon: BriefcaseBusiness,
  },
};

export const teamRoleOrder: Role[] = [
  "Sales",
  "Werkvoorbereider",
  "Planner",
  "Voorman",
  "Monteur",
  "Administratie",
  "Projectleider",
];

// De projectfases waarin iemand belangrijk is, op basis van al zijn rollen.
export function memberStages(roles: Role[]): Stage[] {
  const set = new Set<Stage>();
  roles.forEach((role) => {
    teamRoleConfig[role].stages.forEach((stage) => set.add(stage));
  });
  return STAGE_ORDER.filter((stage) => set.has(stage));
}

export function canMoveProjectsInBoard(role: AccountRole) {
  return role === "super_admin" || role === "projectmanager";
}

export function canCreateProject(role: AccountRole) {
  return role === "super_admin" || role === "projectmanager" || role === "sales";
}

// Monteurs werken met de werkbon en hoeven geen prijzen te zien.
export function canSeePrices(role: AccountRole) {
  return role !== "monteur";
}

export function getVisibleProjectsForProfile(
  profile: TestProfile,
  projects: Project[],
) {
  if (profile.role === "super_admin" || profile.role === "projectmanager") {
    return projects;
  }

  if (profile.role === "opdrachtgever") {
    return projects.filter((project) => project.customerId === profile.customerId);
  }

  if (profile.role === "monteur") {
    return projects.filter(
      (project) =>
        project.teamLeaderId === profile.teamMemberId ||
        project.installerIds.includes(profile.teamMemberId ?? ""),
    );
  }

  if (profile.role === "sales") {
    return projects.filter((project) => project.status === "verkoop");
  }

  if (profile.role === "voorraad") {
    return projects.filter(
      (project) =>
        project.status === "operatie" ||
        getProjectMaterialReadiness(project) !== "available",
    );
  }

  return projects.filter(
    (project) =>
      project.status === "afronding" ||
      project.invoice.status !== "not_started",
  );
}
