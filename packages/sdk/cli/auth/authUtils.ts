import fs from "fs";
import path from "path";
import { StoredAuth } from "./authTypes";
import { BackendConfig } from "../config/backendConfig";
import { getFlowwConfigDir } from "../config/xdg";

const CONFIG_DIR = getFlowwConfigDir();
const TOKEN_FILE = path.join(CONFIG_DIR, "auth.json");
const PROFILES_DIR = path.join(CONFIG_DIR, "profiles");
const CURRENT_PROFILE_FILE = path.join(CONFIG_DIR, "current-profile");

export interface ProfileNamespace {
  id: string;
  displayName: string;
}

export interface Profile {
  name: string;
  backendUrl: string;
  config: BackendConfig;
  auth: StoredAuth;
  namespace?: ProfileNamespace | null;
}

function generateProfileName(backendUrl: string): string {
  try {
    const url = new URL(backendUrl);
    return url.hostname.replace(/\./g, "-");
  } catch {
    return "default";
  }
}

export function saveProfile(
  backendUrl: string,
  config: BackendConfig,
  auth: StoredAuth
): void {
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }

  const profileName = generateProfileName(backendUrl);
  const profile: Profile = {
    name: profileName,
    backendUrl,
    config,
    auth,
  };

  const profileFile = path.join(PROFILES_DIR, `${profileName}.json`);
  fs.writeFileSync(profileFile, JSON.stringify(profile, null, 2));
  fs.chmodSync(profileFile, 0o600);
}

export function loadActiveProfile(): Profile | null {
  if (!fs.existsSync(CURRENT_PROFILE_FILE)) {
    return null;
  }

  try {
    const profileName = fs.readFileSync(CURRENT_PROFILE_FILE, "utf-8").trim();
    const profileFile = path.join(PROFILES_DIR, `${profileName}.json`);

    if (!fs.existsSync(profileFile)) {
      return null;
    }

    const data = fs.readFileSync(profileFile, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to load active profile");
    return null;
  }
}

export function setActiveProfile(backendUrl: string): void {
  const profileName = generateProfileName(backendUrl);

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(CURRENT_PROFILE_FILE, profileName);
}

export function updateProfileNamespace(
  namespace: ProfileNamespace | null
): void {
  const profile = loadActiveProfile();
  if (!profile) return;

  profile.namespace = namespace;
  const profileFile = path.join(PROFILES_DIR, `${profile.name}.json`);
  fs.writeFileSync(profileFile, JSON.stringify(profile, null, 2));
  fs.chmodSync(profileFile, 0o600);
}

export function listProfiles(): string[] {
  if (!fs.existsSync(PROFILES_DIR)) {
    return [];
  }

  return fs
    .readdirSync(PROFILES_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(".json", ""));
}

export function deleteProfile(profileName: string): void {
  const profileFile = path.join(PROFILES_DIR, `${profileName}.json`);
  if (fs.existsSync(profileFile)) {
    fs.unlinkSync(profileFile);
  }

  const currentProfile = fs.existsSync(CURRENT_PROFILE_FILE)
    ? fs.readFileSync(CURRENT_PROFILE_FILE, "utf-8").trim()
    : null;

  if (currentProfile === profileName && fs.existsSync(CURRENT_PROFILE_FILE)) {
    fs.unlinkSync(CURRENT_PROFILE_FILE);
  }
}

export function saveTokens(auth: StoredAuth): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(auth, null, 2));
  fs.chmodSync(TOKEN_FILE, 0o600);
}

export function loadTokens(): StoredAuth | null {
  if (!fs.existsSync(TOKEN_FILE)) {
    return null;
  }
  try {
    const data = fs.readFileSync(TOKEN_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to load stored credentials");
    return null;
  }
}

export function clearTokens(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}
