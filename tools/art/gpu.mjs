// GPU sharing with the owner's other sessions (agreed 2026-10-25 with the wh40k "kill teams" session):
// a lock file C:\Claude Code Projects\.gpu-lock ("lorecannae <ISO time>") is held for at most ~10 min
// per slice and its mtime refreshed while held; a Hunyuan3D `stage_*` python process means "yield".
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const LOCK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.gpu-lock');
const ps = cmd => { try { return execFileSync('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'utf8', windowsHide: true, timeout: 20000 }); } catch { return ''; } };
// Other sessions' Hunyuan3D jobs (command line contains stage_ or Hunyuan3D, excluding ComfyUI itself).
export function otherGpuJobs() {
  return ps("Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | ? { $_.CommandLine -match 'stage_|Hunyuan3D' -and $_.CommandLine -notmatch 'ComfyUI' } | % { $_.ProcessId }").split(/\r?\n/).filter(Boolean).length;
}
export function gpuUtil() {
  try { return +execFileSync('nvidia-smi', ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'], { encoding: 'utf8', timeout: 10000 }).trim().split(/\r?\n/)[0]; } catch { return 100; }
}
export function takeLock() { fs.writeFileSync(LOCK, 'shadowforge ' + new Date().toISOString() + '\n'); }
export function touchLock() { if (fs.existsSync(LOCK)) { const t = new Date(); fs.utimesSync(LOCK, t, t); } }
export function releaseLock() { try { if (fs.existsSync(LOCK) && fs.readFileSync(LOCK, 'utf8').startsWith('shadowforge')) fs.unlinkSync(LOCK); } catch {} }
export function lockHeldByOther() { try { if (!fs.existsSync(LOCK)) return false; const s = fs.readFileSync(LOCK, 'utf8'); return !s.startsWith('shadowforge') && Date.now() - fs.statSync(LOCK).mtimeMs < 15 * 60 * 1000; } catch { return false; } }
// Kill only the given process tree root's ComfyUI child (by PID; never by image name).
export function killChildComfy(parentPid) {
  return ps(`Get-CimInstance Win32_Process -Filter "ParentProcessId=${parentPid}" | ? { $_.CommandLine -match 'ComfyUI|main.py' } | % { Stop-Process -Id $_.ProcessId -Force; $_.ProcessId }`).trim();
}
