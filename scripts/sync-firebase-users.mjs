import {adminClient,projectId,database,AdminSetupError,reportError} from './firebase-admin-client.mjs';

const stringValue = value => ({stringValue:String(value || '')});
function timestamp(milliseconds) {
  const date = new Date(Number(milliseconds));
  return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date.toISOString() : null;
}

async function sync() {
  const client = await adminClient();
  await client.request({url:`https://firestore.googleapis.com/v1/${database}`,timeout:15000});
  let pageToken, synced = 0;
  do {
    const response = await client.request({url:`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`,params:{maxResults:1000,...(pageToken?{nextPageToken:pageToken}:{})},timeout:15000});
    for (const user of response.data.users || []) {
      if (!user.localId) continue;
      const url = `https://firestore.googleapis.com/v1/${database}/documents/accounts/${encodeURIComponent(user.localId)}`;
      let saved = false;
      for (let attempt=0;attempt<3 && !saved;attempt++) {
        let existing;
        try { existing = (await client.request({url,timeout:15000})).data; }
        catch (error) { if (error.response?.status !== 404) throw error; }
        const claims = JSON.parse(user.customAttributes || '{}');
        const createdAt = existing?.fields?.createdAt?.timestampValue || timestamp(user.createdAt);
        if (!createdAt) throw new AdminSetupError('Tanggal pendaftaran akun tidak tersedia. Sinkronisasi dihentikan tanpa membuat tanggal perkiraan.');
        const previous = existing?.fields?.lastSeenAt?.timestampValue;
        const login = timestamp(user.lastLoginAt);
        const lastSeenAt = previous && (!login || Date.parse(previous)>=Date.parse(login)) ? previous : login || createdAt;
        const fields = {
          uid:stringValue(user.localId),name:stringValue((user.displayName || user.email || 'Pengguna').slice(0,150)),email:stringValue(user.email),
          role:stringValue(claims.role==='superadmin' && claims.superadmin===true?'superadmin':'user'),
          createdAt:{timestampValue:createdAt},lastSeenAt:{timestampValue:lastSeenAt}
        };
        const query = new URLSearchParams();
        for (const field of Object.keys(fields)) query.append('updateMask.fieldPaths',field);
        query.append(existing?'currentDocument.updateTime':'currentDocument.exists',existing?existing.updateTime:'false');
        try { await client.request({url:`${url}?${query}`,method:'PATCH',data:{fields},timeout:15000});saved=true;synced++; }
        catch (error) { if (![409,412].includes(error.response?.status) || attempt===2) throw error; }
      }
    }
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  console.log(JSON.stringify({projectId,syncedAccounts:synced}));
}
sync().catch(reportError);
