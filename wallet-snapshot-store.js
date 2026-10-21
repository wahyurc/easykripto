'use strict';

(() => {
  let opening=null;
  function database(){
    if(opening)return opening;
    opening=new Promise((resolve,reject)=>{
      const request=indexedDB.open('easykripto-wallet-snapshots',1);
      let expired=false;
      const timeout=setTimeout(()=>{expired=true;reject(new Error('Penyimpanan perangkat tidak merespons.'));},6000);
      request.onupgradeneeded=()=>{const store=request.result.createObjectStore('snapshots',{keyPath:['account','key']});store.createIndex('account','account');};
      request.onerror=()=>{clearTimeout(timeout);reject(request.error);};
      request.onsuccess=()=>{clearTimeout(timeout);const db=request.result;if(expired){db.close();return;}db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
    }).catch(error=>{opening=null;throw error;});
    return opening;
  }
  async function run(mode,operation){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('snapshots',mode),request=operation(tx.objectStore('snapshots'));
      tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error||new Error('Penyimpanan dibatalkan.'));tx.onerror=()=>reject(tx.error||request.error);
    });
  }
  window.EasyWalletSnapshots={
    read:account=>run('readonly',store=>store.index('account').getAll(account)),
    write:(account,key,data)=>run('readwrite',store=>store.put({account,key,data})),
    remove:(account,key)=>run('readwrite',store=>store.delete([account,key]))
  };
})();
