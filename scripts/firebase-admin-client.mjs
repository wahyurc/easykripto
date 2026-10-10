import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {GoogleAuth} from 'google-auth-library';

export const projectId = 'easykripto-40e96';
export const database = `projects/${projectId}/databases/(default)`;
export class AdminSetupError extends Error {}

export async function adminClient() {
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || fileURLToPath(new URL('../.secrets/firebase-admin.json', import.meta.url));
  const credentials = JSON.parse(await readFile(keyFilename, 'utf8'));
  if (credentials.type !== 'service_account' || credentials.project_id !== projectId) {
    throw new AdminSetupError('Gunakan service account dari proyek easykripto-40e96.');
  }
  return new GoogleAuth({keyFilename,projectId,scopes:['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']}).getClient();
}

export function reportError(error) {
  if (error instanceof AdminSetupError) console.error(error.message);
  else if (error.response?.status === 403) console.error('Firebase menolak akses. Periksa aktivasi API Firestore dan izin service account untuk operasi ini.');
  else if (error.response?.status === 404) console.error('Database atau layanan belum tersedia. Buat Firestore Standard, database (default), Production mode di Firebase Console.');
  else console.error('Operasi admin belum selesai. Periksa kredensial, koneksi, dan pengaturan proyek lalu coba lagi.');
  process.exitCode = 1;
}
