export const APP_NAME = "QUANTTE";
export const APP_SUBTITLE = "Officer sign-in";
export const APP_TAGLINE = "Officer Attendance Management";
export const BRAND_SHORT = "ROTC";
export const LOGO_SRC = "/logo.png";

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@cadet.local`;
export const CLASSES = ["1CL", "2CL", "3CL", "Aspirant"] as const;
export const PLATOONS = ["Alpha", "Bravo", "Charlie", "Delta"] as const;