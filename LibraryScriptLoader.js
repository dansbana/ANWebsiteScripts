(function () {
    // ----- Logger Setup -----
    const LOG_LEVEL = Object.freeze({
        ERROR: 'ERROR',
        WARN: 'WARN',
        TRACE: 'TRACE',
        VERBOSE: 'VERBOSE'
    });
    
    // Default log level if not set
    const defaultLogLevel = LOG_LEVEL.WARN;
    
    // Log level hierarchy - each level includes all levels above it
    const logLevelHierarchy = {
        [LOG_LEVEL.ERROR]: [LOG_LEVEL.ERROR],
        [LOG_LEVEL.WARN]: [LOG_LEVEL.ERROR, LOG_LEVEL.WARN],
        [LOG_LEVEL.TRACE]: [LOG_LEVEL.ERROR, LOG_LEVEL.WARN, LOG_LEVEL.TRACE],
        [LOG_LEVEL.VERBOSE]: [LOG_LEVEL.ERROR, LOG_LEVEL.WARN, LOG_LEVEL.TRACE, LOG_LEVEL.VERBOSE]
    };
    
    function logger(level, ...args) {
        const currentLevel = window.LogLevel || defaultLogLevel;
        const allowedLevels = logLevelHierarchy[currentLevel] || logLevelHierarchy[LOG_LEVEL.TRACE];
        
        if (!allowedLevels.includes(level)) {
            return; // Don't log if level is not allowed
        }
        
        // Map log levels to console methods
        const consoleMethod = level === LOG_LEVEL.ERROR ? console.error :
                             level === LOG_LEVEL.WARN ? console.warn :
                             console.log;
        
        consoleMethod(...args);
    }
    
    // Expose logger on window so LibraryScripts.js can use it
    window.logger = logger;
    window.LOG_LEVEL = LOG_LEVEL;
    
    logger(LOG_LEVEL.TRACE, "LibraryScriptLoader booted on", location.pathname);
      
    // ----- Helpers to read globals safely -----
    function getArray(name) {
      const v = window[name];
      return Array.isArray(v) ? v : [];
    }
      

    let scriptLoaded = false;
    let lastLoadedCorpId = null;
    let lastLoadedScriptElement = null;
    let libCheckAttempts = 0;
    const MAX_LIB_CHECK_ATTEMPTS = 40; // e.g. 40 × 100ms = 4s max
    
    function loadLibraryScriptForUser(user) {
          // Check if user changed
          const currentCorpId = String(user.corp_id);
          const userChanged = lastLoadedCorpId !== null && lastLoadedCorpId !== currentCorpId;
          if (!user) return;
          
          
          if (userChanged) {
              logger(LOG_LEVEL.TRACE, "LibraryScriptLoader: User changed from", lastLoadedCorpId, "to", currentCorpId, "- removing old script");
              // Remove the old script element
              if (lastLoadedScriptElement && lastLoadedScriptElement.parentNode) {
                  lastLoadedScriptElement.parentNode.removeChild(lastLoadedScriptElement);
              }
              // Reset flags to allow reloading
              scriptLoaded = false;
              lastLoadedCorpId = null;
              lastLoadedScriptElement = null;
          }
          
          if (scriptLoaded && !userChanged) {
            logger(LOG_LEVEL.VERBOSE, "LibraryScriptLoader: Script already loaded for user:", user.corp_id, " company: ", user.company);
            return;
          }
      
          // IMPORTANT: read globals *now*, not at startup
          const libAccts      = getArray("libAccts");
          const testerLibAcct = getArray("testerLibAcct");
          const ShowAcctIds    = getArray("ShowAcctIds");
          const prodLocation = window.prodLocation;
          const testLocation = window.testLocation;

          window.showAccountId = ShowAcctIds.length && !user && ShowAcctIds.map(n => n.toLowerCase());
    
      
          // --- NEW: wait until libAccts is actually populated ---
          if (!libAccts.length && libCheckAttempts < MAX_LIB_CHECK_ATTEMPTS) {
            libCheckAttempts++;
            logger(
              LOG_LEVEL.VERBOSE,
              "LibraryScriptLoader: libAccts not populated yet, retry",
              libCheckAttempts,
              "..."
            );
            setTimeout(() => loadLibraryScriptForUser(user), 100);
            return;
          }
      
          // If we *still* have no libAccts after many attempts, bail out
          if (!libAccts.length && !testerLibAcct.length) {
            logger(
              LOG_LEVEL.WARN,
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
            logger(
              LOG_LEVEL.TRACE,
              "LibraryScriptLoader: Non-library account, not loading script.",
              user.corp_id
            );
            return;
          }
      
          const chosenUrl = isTestAcct ? testLocation : prodLocation;
          
          logger(
            LOG_LEVEL.TRACE,
            "LibraryScriptLoader: Loading",
            isTestAcct ? "TEST" : "PROD",
            "script for corp_id",
            user.corp_id,
            "=>",
            chosenUrl
          );
          
          scriptLoaded = true;
          lastLoadedCorpId = currentCorpId;
          
          const s = document.createElement("script");
          s.src = chosenUrl + "?v=" + Date.now(); // cache-buster while iterating
          s.async = true;
          document.head.appendChild(s);
          lastLoadedScriptElement = s;
    }
  
    // ----- Patch fetch to detect /customer/session/get -----
    (function patchFetch() {
      logger(LOG_LEVEL.TRACE, "LibraryScriptLoader: Patching fetch");
      if (!window.fetch) return;
  
      const originalFetch = window.fetch;
  
      window.fetch = function patchedFetch(input, init) {
        const url = typeof input === "string" ? input : input && input.url;
        const result = originalFetch.apply(this, arguments);
  
        if (url && url.indexOf("/customer/session/get") !== -1) {
          logger(LOG_LEVEL.VERBOSE, "LibraryScriptLoader: Fetching session get");
          result
            .then(function (response) {
              try {
                const clone = response.clone();
                clone
                  .json()
                  .then(function (data) {
                    const user = data && data.user;
                    logger(LOG_LEVEL.TRACE, "LibraryScriptLoader: Fetching session get user: ", user.corp_id, " company: ", user.company);
                    if (!user) return;
  
                    // Make user globally available if scripts want it
                    window.libUser = user;
  
                    // Load PROD or TEST
                    loadLibraryScriptForUser(user);
                  })
                  .catch(function () {});
              } catch (e) {}
            })
            .catch(function () {});
        }
        else {
          logger(LOG_LEVEL.VERBOSE, "LibraryScriptLoader: Ignoring Fetch for URL", url);
        }
  
        return result;
      };
    })();
  
    // ----- Try to trigger the app to re-fetch session after patch -----
    (function pokeAppToRefetch() {
      function poke() {
        logger(LOG_LEVEL.VERBOSE, "LibraryScriptLoader: poking app to refetch session...");
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