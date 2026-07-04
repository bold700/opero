// Design tokens — the single source of spacing, radius, color and surface values.
// Use these everywhere instead of magic numbers so every screen is consistent.

// Page surface (neutral grey) and white card.
export const SURFACE = "#F5F5F5";
export const CARD_BG = "#FFFFFF";

// One soft card shadow, used by every elevated surface.
export const CARD_SHADOW =
  "0px 1px 2px rgba(0,0,0,0.04), 0px 4px 12px rgba(0,0,0,0.04)";

// Hairline used for table rows, dividers inside cards, etc.
export const HAIRLINE = "#F0EDF1";

// Radius scale (MUI spacing units → px via shape.borderRadius=8... but we use
// explicit px for clarity). Three sizes, by component type.
export const RADIUS = {
  card: 12, // cards, tables, panels
  control: 8, // inputs, small surfaces, status badges
  pill: 100, // buttons, chips
} as const;

// Spacing scale (MUI units; 1 = 8px). Pick from these, don't invent.
export const SPACING = {
  pagePadding: 4, // 32px — the content padding on every page (kills tab-jump)
  sectionGap: 3, // 24px — gap between major sections on a page
  cardPadding: 3, // 24px — padding inside a card
  itemGap: 1.5, // 12px — gap between small items (chips, count pills)
} as const;

// Responsive page padding: tighter on phones (16px), full on desktop (32px).
// PageLayout/TopBar use this so every screen's chrome breathes correctly on
// mobile from one place. Pass directly into an `sx` prop (p / px / py).
export const PAGE_PADDING_RESPONSIVE = { xs: 2, md: SPACING.pagePadding } as const;

// Minimum comfortable touch target on mobile (px). Use for interactive rows,
// icon buttons, and list items on small screens.
export const TAP_TARGET = 44;

// M3 lavender accents (selected/active states).
export const LAVENDER = "#E8DEF8";
export const LAVENDER_HOVER = "#E0D4F2";

// Shared status palette (semantic). Reuse across work orders / employees / etc.
export type StatusTone = {
  fg: string;
  bg: string;
};
export const STATUS_TONES = {
  open: { fg: "#6750A4", bg: "#E8DEF8" },
  info: { fg: "#3B82F6", bg: "#DBEAFE" },
  danger: { fg: "#B3261E", bg: "#F9DEDC" },
  success: { fg: "#1E8E5A", bg: "#D1FAE5" },
  warning: { fg: "#B45309", bg: "#FEF3C7" },
  neutral: { fg: "#49454F", bg: "#F3F0F4" },
} satisfies Record<string, StatusTone>;
