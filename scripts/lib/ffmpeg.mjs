// Trova ffmpeg: nel PATH oppure dove lo installa winget (il PATH di una shell
// già aperta non vede le installazioni nuove).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function ffmpegPath() {
  const candidates = [
    process.env.FFMPEG_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft/WinGet/Links/ffmpeg.exe'),
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    throw new Error('ffmpeg non trovato');
  }
}
