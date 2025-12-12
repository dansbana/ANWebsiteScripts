(function () {
    console.log("LibraryScriptLoader booted on", location.pathname);
  
    // ----- Helpers to read globals safely -----
    function getArray(name) {
      const v = window[name];
      return Array.isArray(v) ? v : [];
    }
      

    let scriptLoaded = false;
    let libCheckAttempts = 0;
    const MAX_LIB_CHECK_ATTEMPTS = 40; // e.g. 40 × 100ms = 4s max
    
    function loadLibraryScriptForUser(user) {
          if (scriptLoaded || !user) return;
      
          // IMPORTANT: read globals *now*, not at startup
          const libAccts      = getArray("libAccts");
          const testerLibAcct = getArray("testerLibAcct");
          const ShowAcctIds    = getArray("ShowAcctIds");
          const prodLocation = window.prodLocation ||
          "https://dansbana.github.io/ANWebsiteScripts/prod/LibraryScripts-V1.0.10.js";
          const testLocation = window.testLocation ||
          "https://dansbana.github.io/ANWebsiteScripts/prod/LibraryScripts-V1.0.10.js";

          window.showAccountId = ShowAcctIds.length && !user && ShowAcctIds.map(n => n.toLowerCase());
    
      
          // --- NEW: wait until libAccts is actually populated ---
          if (!libAccts.length && libCheckAttempts < MAX_LIB_CHECK_ATTEMPTS) {
            libCheckAttempts++;
            console.log(
              "LibraryScriptLoader: libAccts not populated yet, retry",
              libCheckAttempts,
              "..."
            );
            setTimeout(() => loadLibraryScriptForUser(user), 100);
            return;
          }
      
          // If we *still* have no libAccts after many attempts, bail out
          if (!libAccts.length && !testerLibAcct.length) {
            console.warn(
              "LibraryScriptLoader: libAccts still empty after retries; not loading script."
            );
            return;
          }
      
          // Normalize everything to strings for safe comparison
          const corpIdStr       = String(user.corp_id);
          const libAcctStrs     = libAccts.map(id => String(id));
          const testerAcctStrs  = testerLibAcct.map(id => String(id));
      
          const isLibAcct  = libAcctStrs.includes(corpIdStr);
          const isTestAcct = testerAcctStrs.includes(corpIdStr);
      
          const shouldLoad = isTestAcct || isLibAcct;
          if (!shouldLoad) {
            console.log(
              "LibraryScriptLoader: Non-library account, not loading script.",
              user.corp_id
            );
            return;
          }
      
          const chosenUrl = isTestAcct ? testLocation : prodLocation;
      
          console.log(
            "LibraryScriptLoader: Loading",
            isTestAcct ? "TEST" : "PROD",
            "script for corp_id",
            user.corp_id,
            "=>",
            chosenUrl
          );
      
          scriptLoaded = true;
      
          const s = document.createElement("script");
          s.src = chosenUrl + "?v=" + Date.now(); // cache-buster while iterating
          s.async = true;
          document.head.appendChild(s);
    }
  
    // ----- Patch fetch to detect /customer/session/get -----
    (function patchFetch() {
      if (!window.fetch) return;
  
      const originalFetch = window.fetch;
  
      window.fetch = function patchedFetch(input, init) {
        const url = typeof input === "string" ? input : input && input.url;
  
        const result = originalFetch.apply(this, arguments);
  
        if (url && url.indexOf("/customer/session/get") !== -1) {
          result
            .then(function (response) {
              try {
                const clone = response.clone();
                clone
                  .json()
                  .then(function (data) {
                    const user = data && data.user;
                    if (!user) return;
  
                    // Make user globally available if scripts want it
                    window.libUser = user;
  
                    // Always show IDs for the configured accounts
                    showAccountIdWhenRequested(user);
  
                    // Load PROD or TEST
                    loadLibraryScriptForUser(user);
                  })
                  .catch(function () {});
              } catch (e) {}
            })
            .catch(function () {});
        }
  
        return result;
      };
    })();
  
    // ----- Try to trigger the app to re-fetch session after patch -----
    (function pokeAppToRefetch() {
      function poke() {
        console.log("LibraryScriptLoader: poking app to refetch session...");
        try {
          window.dispatchEvent(new Event("focus"));
        } catch (e) {}
        try {
          document.dispatchEvent(new Event("visibilitychange"));
        } catch (e) {}
      }
  
      if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(poke, 50);
      } else {
        window.addEventListener("DOMContentLoaded", function () {
          setTimeout(poke, 50);
        });
      }
    })();
  })();