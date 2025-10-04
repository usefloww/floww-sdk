import fs from 'fs';
import path from 'path';
import os from 'os';
import { StoredAuth } from './authTypes';

const CONFIG_DIR = path.join(os.homedir(), '.mycli');
const TOKEN_FILE = path.join(CONFIG_DIR, 'auth.json');

export function saveTokens(auth: StoredAuth): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(auth, null, 2));
  fs.chmodSync(TOKEN_FILE, 0o600); // Secure permissions (owner read/write only)
}

export function loadTokens(): StoredAuth | null {
  if (!fs.existsSync(TOKEN_FILE)) {
    return null;
  }
  try {
    const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load stored credentials');
    return null;
  }
}

export function clearTokens(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}
