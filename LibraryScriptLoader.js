(function () {
    console.log("LibraryScriptLoader booted on", location.pathname);
  
    // ----- Helpers to read globals safely -----
    function getArray(name) {
      const v = window[name];
      return Array.isArray(v) ? v : [];
    }
  
    const libAccts       = getArray("libAccts");
    const testerLibAcct  = getArray("testerLibAcct");
    const ShowAcctIds    = getArray("ShowAcctIds");
  
    const prodLocation = window.prodLocation ||
      "https://dansbana.github.io/ANWebsiteScripts/prod/LibraryScripts.js";
    const testLocation = window.testLocation ||
      "https://dansbana.github.io/ANWebsiteScripts/test/LibraryScripts.js";
  
    let scriptLoaded = false;
  
    function showAccountIdWhenRequested(user) {
      if (!ShowAcctIds.length || !user) return;
  
      const namesToShow = ShowAcctIds.map(n => n.toLowerCase());
  
      const selectors = [
        "button.ant-btn-primary.styled_btn span", // desktop account button
        ".ant-avatar-string div",                // avatar initials element
        ".ant-drawer-title",                     // mobile drawer title
      ];
  
      const els = document.querySelectorAll(selectors.join(","));
      if (!els.length) return;
  
      els.forEach(el => {
        const text = el.textContent.trim().toLowerCase();
        const matches = namesToShow.some(name => text.includes(name));
        if (!matches) return;
  
        if (el.textContent.includes("ID:")) return; // avoid double-label
  
        el.textContent = `${user.company || user.first_name} (ID: ${user.corp_id})`;
      });
    }
  
    function loadLibraryScriptForUser(user) {
      if (scriptLoaded || !user) return;
  
      const corpId = user.corp_id;
      const isLibAcct   = libAccts.includes(corpId);
      const isTestAcct  = testerLibAcct.includes(corpId);
  
      // Decide whether to load anything at all:
      //   - Always load for tester accounts.
      //   - Otherwise only load for libAccts.
      const shouldLoad = isTestAcct || isLibAcct;
      if (!shouldLoad) {
        console.log("LibraryScriptLoader: Non-library account, not loading script.", corpId);
        return;
      }
  
      const chosenUrl = isTestAcct ? testLocation : prodLocation;
  
      console.log(
        "LibraryScriptLoader: Loading",
        isTestAcct ? "TEST" : "PROD",
        "script for corp_id",
        corpId,
        "=>",
        chosenUrl
      );
  
      scriptLoaded = true;
  
      const s = document.createElement("script");
      s.src = chosenUrl;
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