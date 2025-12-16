(function () {
    // Use logger from LibraryScriptLoader if available, otherwise simple fallback
    const logger = (typeof window !== 'undefined' && window.logger) ||
                   function(level, ...args) {
                       console.log(level + ':', ...args);
                   };
    const LOG_LEVEL = (typeof window !== 'undefined' && window.LOG_LEVEL) ||
                      Object.freeze({
                          ERROR: 'ERROR',
                          WARN: 'WARN',
                          TRACE: 'TRACE',
                          VERBOSE: 'VERBOSE'
                      });
    
    window.version = 'V1.0.92';
    logger(LOG_LEVEL.TRACE, 'Loading Custom Library Functionaltiy', location.pathname);
    // Track whether we've confirmed this is a library account
    // Track our temporary re-apply interval for library tweaks
    let libraryTweaksIntervalId = null;
    let currentWatcherPageType = null; // Track which page type the current watcher is for
    
    // Observer state objects (passed by reference)
    const checkoutButtonsObserverState = { observer: null, container: null };
    const orderSummaryObserverState = { observer: null, container: null };

    // Helper function to observe an element with idempotent behavior
    function observeElement(observerState, selector, callback) {
        const container = document.querySelector(selector);
        if (!container) return;
        
        // If observer exists, check if it's still observing a valid container
        if (observerState.observer) {
            // Check if the container we're observing still exists and is connected to the DOM
            if (observerState.container && document.contains(observerState.container)) {
                // Observer is still valid, exit early
                return;
            } else {
                // Container was removed, disconnect old observer
                observerState.observer.disconnect();
                observerState.observer = null;
                observerState.container = null;
            }
        }
    
        observerState.observer = new MutationObserver(callback);
    
        observerState.observer.observe(container, {
            childList: true,
            subtree: true
        });
        
        // Store reference to the container we're observing
        observerState.container = container;
    }



    function repElContent(selector, matchText, newHTML, listener) {
        const match = matchText ? matchText.toLowerCase() : null;

        document.querySelectorAll(selector).forEach(el => {
            const currentText = el.textContent.replace(/\s+/g, ' ').trim().toLowerCase();

            if (match && !currentText.includes(match)) {
            return;
            }

            el.innerHTML = newHTML;

            if (typeof listener === "function") {
            el.addEventListener("click", listener);
            }
        });
    }

    function hideBtn(selector, labels) {
        const labelList = Array.isArray(labels) ? labels : [labels];

        document.querySelectorAll(selector).forEach(btn => {
            const text = btn.textContent.replace(/\s+/g, ' ').trim().toLowerCase();

            const shouldHide = labelList.some(label =>
            text.includes(label.toLowerCase())
            );

            if (shouldHide) {
                btn.style.display = 'none';
            }
        });
    }

    const SQTE_BTN_SEL =
    'button.ant-btn.ant-btn-default.ant-btn-block';

    const SHIP_SEL =
    'button.ant-btn-default.checkout-btn';

    const PKUP_SEL =
    'button.ant-btn-primary.checkout-btn';

    const DEL_SEL =
    'button.ant-btn-default.ant-btn-block';

    function setTextAreaValue(message) {
        const ta = document.querySelector('.ant-modal-body textarea.ant-input');
        if (!ta) return;
    
        // Use the native value setter so React's internal tracker updates
        const proto = Object.getPrototypeOf(ta);
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (valueSetter) {
            valueSetter.call(ta, message);
        } else {
            ta.value = message; // fallback, but usually the line above works
        }
    
        // Fire the event React listens for on textareas
        const event = new Event('input', { bubbles: true });
        ta.dispatchEvent(event);
    }

    function changeSubmitQuoteModal() {
        logger(LOG_LEVEL.VERBOSE, 'changeSubmitQuoteModal: Changing submit quote modal');
        repElContent(
            'h3',
            'Request',
            'Place Library Order'
        );
        repElContent(
            'button.ant-btn-primary',
            "submit quote",
            "Submit order"
        );
        repElContent(
            '.ant-modal-body p',
            'This option is for',
            ''
        );
        repElContent(
            '.ant-modal-body p',
            'Use the box below',
            'Any special instructions or questions about your order?'
        );

        repElContent(
            '.ant-modal-body em',
            'your cart will be',
            'Your cart will be cleared upon submitting your order.'
        );
        setTextAreaValue('My order is good to go.');
    }


    function changeCartPageFunctionality() {
        logger(LOG_LEVEL.VERBOSE, 'changeCartPageFunctionality: Changing cart page functionality');
        // WP2 – modal entry point
        repElContent(
            SQTE_BTN_SEL,
            'Request a school',
            'Place Library Order',
            () => setTimeout(changeSubmitQuoteModal, 50)
        );

        hideBtn(SHIP_SEL, 'Ship');
        hideBtn(PKUP_SEL, 'Pick up');
        hideBtn(DEL_SEL, 'Deliver');
    }

    function changeOrderConfirmationFunctionality() {
        logger(LOG_LEVEL.VERBOSE, 'changeOrderConfirmationFunctionality: Changing order confirmation functionality');
        // WP3 – order confirmation
        repElContent(
            '.ant-result-title span',
            'your quote request has been submitted',
            '<strong>Your order has been submitted.</strong><br/><br/>'
        );
        repElContent(
            '.ant-result-subtitle div',
            'we will review your quote and comments',
            '<b>IMPORTANT NOTE: Your email confirmation will label this order a &quot;Quote Request,&quot; but we will process it as an order from your library.</b>'
        );
    }

    // WP4 – orders list summary text
    function changeOrderPage() {
        logger(LOG_LEVEL.VERBOSE, 'changeOrderPage: Changing order page functionality');
        repElContent( 
            'span',
            'requested a quote',
            '<strong>Order Type</strong> Library'
        );
        repElContent(
            '.ant-card-body div:not(:has(*))',
            'requested a quote',
            'Standard library delivery'
        );
    }

    
    function observeCheckoutButtons() {
        observeElement(
            checkoutButtonsObserverState,
            'aside.responsiveSummary',
            changeCartPageFunctionality
        );
    }

    function observeOrderSummary() {
        observeElement(
            orderSummaryObserverState,
            'aside.responsiveSummaryLeft',
            changeOrderPage
        );
    }

    function startWatchersAndObservers() {
        // Determine page type
        const isCartPage = location.pathname.startsWith("/checkout/cart");
        const isOrderPage = location.pathname.startsWith("/account/order");
        
        if (!isCartPage && !isOrderPage) {
            // Not a page we handle - stop any existing watcher but still show the account ID
            window.showAccountIdWhenRequested(libUser, window.version);
            if (libraryTweaksIntervalId) {
                clearInterval(libraryTweaksIntervalId);
                libraryTweaksIntervalId = null;
                currentWatcherPageType = null;
            }
            return;
        }
        
        const newPageType = isCartPage ? 'cart' : 'order';
        
        // Stop old watcher if it exists and page type changed
        if (libraryTweaksIntervalId) {
            if (currentWatcherPageType !== newPageType) {
                // Page type changed, stop old watcher
                clearInterval(libraryTweaksIntervalId);
                libraryTweaksIntervalId = null;
                currentWatcherPageType = null;
            } else {
                // Same page type, watcher already running, exit early
                return;
            }
        }
        
        // Start the appropriate observer
        if (isCartPage) {
            observeCheckoutButtons();
        } else if (isOrderPage) {
            observeOrderSummary();
        }
        
        // Start the watcher loop 
        let runs = 0;
        let shouldStop = false;
        const maxRuns = isCartPage ? 20 : 40;  // Cart: 20 runs, Order: 40 runs
        const intervalMs = isCartPage ? 125 : 250;  // Cart: 125ms, Order: 250ms
        
        currentWatcherPageType = newPageType;
        
        libraryTweaksIntervalId = setInterval(() => {
            runs++;
            
            try {
                window.showAccountIdWhenRequested(libUser, window.version);
                if (isCartPage) {
                    // Cart page: call changeCartPageFunctionality
                    logger(LOG_LEVEL.VERBOSE, 'Watcher calling changeCartPageFunctionality');
                    changeCartPageFunctionality();
                } else if (isOrderPage) {
                    // Order page: call changeOrderPage
                    logger(LOG_LEVEL.VERBOSE, 'Watcher calling changeOrderPage');
                    changeOrderPage();
                    
                    // Check if replacement was successful (order page specific)
                    const replaced = Array.from(document.querySelectorAll('span'))
                        .some(el => {
                            const text = el.textContent.toLowerCase();
                            return text.includes('order type') && text.includes('library');
                        });
                    
                    if (replaced) {
                        shouldStop = true;
                    }
                }
            } catch (e) {
                logger(LOG_LEVEL.ERROR, 'CustLibFunc: watcher error in interval', e);
            }
            
            if (shouldStop || runs >= maxRuns) {
                clearInterval(libraryTweaksIntervalId);
                libraryTweaksIntervalId = null;
                currentWatcherPageType = null;
            }
        }, intervalMs);
    }

    /**
     * Run the appropriate tweaks for the *current* page.
     * Safe to call multiple times – selectors just won't match on irrelevant pages.
     */

    function runLibTweaksForCurrentPage() {
        logger(LOG_LEVEL.TRACE, 'CustLibFunc: runLibTweaksForCurrentPage on', location.pathname);
    
        // Cart / modal / order confirmation tweaks (WP2 / WP3 etc)
        if (location.pathname.startsWith("/checkout/cart")) {
            changeCartPageFunctionality();
        }
    
        // Orders list / order detail pages – summary tweaks (WP4-like)
        if (location.pathname.startsWith("/account/orders")) {
            logger(LOG_LEVEL.TRACE, 'CustLibFunc: Order Summary Watcher Running');
            changeOrderConfirmationFunctionality();
        }
    }


    /**
     * Watch SPA-style navigation and re-run tweaks when URL changes.
     */
    (function hookSpaNavigation() {
        const origPushState = history.pushState;
        const origReplaceState = history.replaceState;

        function onLocationChange() {
            runLibTweaksForCurrentPage();
            startWatchersAndObservers();
        }

        history.pushState = function () {
            const ret = origPushState.apply(this, arguments);
            onLocationChange();
            return ret;
        };

        history.replaceState = function () {
            const ret = origReplaceState.apply(this, arguments);
            onLocationChange();
            return ret;
        };

        window.addEventListener('popstate', onLocationChange);

    })();

    // kick things off immediately on load:
    if (typeof runLibTweaksForCurrentPage === "function") {
        runLibTweaksForCurrentPage();
        startWatchersAndObservers();
    }

    (function patchFetch() {
        logger(LOG_LEVEL.TRACE, "LibraryScript: Patching fetch");
        if (!window.fetch) return;
    
        const originalFetch = window.fetch;
    
        window.fetch = function patchedFetch(input, init) {
          const url = typeof input === "string" ? input : input && input.url;
          const result = originalFetch.apply(this, arguments);
    
          if (url && url.indexOf("/customer/session/get") !== -1) {
            logger(LOG_LEVEL.VERBOSE, "LibraryScript: Fetching session get for URL:", url);
            result
              .then(function (response) {
                try {
                  const clone = response.clone();
                  clone
                    .json()
                    .then(function (data) {
                      const user = data && data.user;
                      if (!user) return;    
                      logger(LOG_LEVEL.TRACE, "LibraryScript: fetch causing tweaks to run");
                      runLibTweaksForCurrentPage(user);
                      startWatchersAndObservers();
                    })
                    .catch(function () {});
                } catch (e) {}
              })
              .catch(function () {});
          }
          else {
            logger(LOG_LEVEL.VERBOSE, "LibraryScript: Ignoring Fetch for URL:", url);
          }
    
          return result;
        };
      })();

    
})();
