import os from "os";
import path from "path";

// XDG Base Directory Specification utilities
// See: https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html

// Returns $XDG_CONFIG_HOME or ~/.config as fallback
function getXdgConfigHome(): string {
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
}

function getXdgDataHome(): string {
  return (
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
  );
}

function getXdgCacheHome(): string {
  return process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
}

export function getFlowwConfigDir(): string {
  return path.join(getXdgConfigHome(), "floww");
}

export function getFlowwDataDir(): string {
  return path.join(getXdgDataHome(), "floww");
}

export function getFlowwCacheDir(): string {
  return path.join(getXdgCacheHome(), "floww");
}
