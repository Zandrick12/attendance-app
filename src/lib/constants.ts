export const APP_NAME = "Attendance Management System";
export const APP_SUBTITLE = "Officer sign-in";

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@cadet.local`;
export const CLASSES = ["1CL", "2CL", "3CL", "Aspirant"] as const;
export const PLATOONS = ["Alpha", "Bravo", "Charlie", "Delta"] as const;