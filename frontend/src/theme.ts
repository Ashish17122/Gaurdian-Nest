// GuardianNest theme tokens — Teal brand palette + Metropolis/Open Sans
// Brand palette (per owner):
//   #09637E  deep teal   → primary brand
//   #088395  teal        → primary CTA
//   #7AB2B2  muted teal  → soft accent / secondary
//   #EBF4F6  porcelain   → app background
export const colors = {
  // Backgrounds
  bg: "#EBF4F6",
  bgSoft: "#F5FAFB",
  bgElev: "#FFFFFF",

  // Borders
  border: "#D6E6EA",
  borderStrong: "#B6CED3",

  // Text
  text: "#0A2A33",
  textSoft: "#3F6470",
  textMuted: "#7AA0AB",

  // Brand
  brandDeep: "#09637E",
  primary: "#088395",
  primaryDark: "#09637E",
  primarySoft: "#7AB2B2",
  primaryBg: "#DCEEF1",

  // Semantic
  success: "#0E8C6B",
  successBg: "#E0F4EE",
  successBorder: "#A6DEC9",
  warning: "#E08A1A",
  danger: "#D94C3D",
  dangerBg: "#FBEAE8",

  // Admin
  admin: "#09637E",
  adminBg: "#DCEEF1",

  // App category accents (distinct from brand, for charts)
  youtube: "#E74C3C",
  instagram: "#C2185B",
  chrome: "#F6B93B",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 6, md: 10, lg: 14, xl: 20 };

export const fonts = {
  h: "Metropolis-Bold",
  hExtra: "Metropolis-ExtraBold",
  hSemi: "Metropolis-SemiBold",
  hMed: "Metropolis-Medium",
  body: "OpenSans_400Regular",
  bodyMed: "OpenSans_600SemiBold",
  bodyBold: "OpenSans_700Bold",
};
