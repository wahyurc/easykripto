'use strict';
(() => {
  let ready = null, sdk = null, instance = null;
  window.EasyAppCheck = {
    initialize(app) {
      if (!window.EASYKRIPTO_APPCHECK_SITE_KEY) return Promise.resolve(false);
      return ready ||= (async () => {
        sdk = await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-check.js');
        instance = sdk.initializeAppCheck(app, {provider:new sdk.ReCaptchaV3Provider(window.EASYKRIPTO_APPCHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
        return true;
      })();
    },
    async headers() {
      if (!window.EASYKRIPTO_APPCHECK_SITE_KEY) return {};
      if (!ready || !await ready) throw new Error('Perlindungan aplikasi belum siap. Muat ulang halaman.');
      const result = await sdk.getToken(instance);
      return {'X-Firebase-AppCheck':result.token};
    }
  };
})();
