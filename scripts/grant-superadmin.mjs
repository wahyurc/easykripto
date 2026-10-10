import {readFile, access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GoogleAuth} from 'google-auth-library';

const projectId = 'easykripto-40e96';
const email = 'ddr8gb@gmail.com';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const localKey = path.join(root, '.secrets', 'firebase-admin.json');
class GrantSetupError extends Error {}

async function grantSuperadmin() {
  let keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    try { await access(localKey); keyFile = localKey; } catch {}
  }
  if (keyFile) {
    const credentials = JSON.parse(await readFile(keyFile, 'utf8'));
    if (credentials.type !== 'service_account' || credentials.project_id !== projectId) {
      throw new GrantSetupError('Kredensial harus berupa service account dari proyek easykripto-40e96.');
    }
  }
  const auth = new GoogleAuth({
    ...(keyFile ? {keyFilename:keyFile} : {}),
    projectId,
    scopes:['https://www.googleapis.com/auth/identitytoolkit']
  });
  const client = await auth.getClient();
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;
  const lookup = await client.request({url:`${base}:lookup`, method:'POST', data:{email:[email]}, timeout:15000});
  const users = lookup.data.users || [];
  const user = users.find(item => item.email?.toLowerCase() === email);
  if (!user?.localId || users.length !== 1) throw new GrantSetupError('Akun belum ditemukan. Masuk dengan Google menggunakan ddr8gb@gmail.com terlebih dahulu.');
  if (!user.emailVerified || user.disabled) throw new GrantSetupError('Akun harus aktif dan email sudah terverifikasi.');
  const existingClaims = JSON.parse(user.customAttributes || '{}');
  const claims = {...existingClaims, role:'superadmin', superadmin:true};
  const customAttributes = JSON.stringify(claims);
  if (Buffer.byteLength(customAttributes, 'utf8') > 1000) throw new GrantSetupError('Custom claims melebihi batas Firebase.');
  await client.request({url:`${base}:update`, method:'POST', data:{localId:user.localId, customAttributes}, timeout:15000});
  const verification = await client.request({url:`${base}:lookup`, method:'POST', data:{localId:[user.localId]}, timeout:15000});
  const savedUser = verification.data.users?.find(item => item.localId === user.localId);
  const savedClaims = JSON.parse(savedUser?.customAttributes || '{}');
  if (savedClaims.role !== 'superadmin' || savedClaims.superadmin !== true) throw new GrantSetupError('Penetapan belum dapat dikonfirmasi. Jalankan kembali skrip untuk memeriksa hasilnya.');
  console.log(JSON.stringify({projectId, email, role:savedClaims.role, superadmin:savedClaims.superadmin, confirmed:true}));
}

try {
  await grantSuperadmin();
} catch (error) {
  const status = error.response?.status;
  const messages = {
    401:'Kredensial admin tidak dapat digunakan. Periksa autentikasi Google Cloud.',
    403:'Akun admin membutuhkan izin firebaseauth.users.get dan firebaseauth.users.update pada proyek easykripto-40e96.'
  };
  console.error(messages[status] || (error instanceof GrantSetupError ? error.message : error.response ? 'Permintaan Firebase gagal. Periksa proyek, izin, dan koneksi lalu coba lagi.' : 'Kredensial admin belum dapat digunakan. Siapkan .secrets/firebase-admin.json yang valid atau autentikasi Application Default Credentials.'));
  process.exitCode = 1;
}
