(function () {
    const libAccts = [1627756];
    console.log('Loading Custom Library Functionaltiy', location.pathname);
    // Track whether we've confirmed this is a library account
    let isLibraryAccount = false;

    /**
     * Run the appropriate tweaks for the *current* page.
     * Safe to call multiple times – selectors just won't match on irrelevant pages.
     */
    function runLibTweaksForCurrentPage() {
    console.log('CustLibFunc: runLibTweaksForCurrentPage on', location.pathname);

    // Cart / modal / order confirmation tweaks (WP2 / WP3 etc)
    libraryTweak();

    // Orders list page (WP4-like) – only here do we need the watcher
    if (location.pathname.startsWith("/account/orders")) {
        console.log('CustLibFunc: Order Summary Watcher Running');
        startOrderSummaryWatcher();
    }
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

    function setTAValue(message) {
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

    function tweakModal() {
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
    setTAValue('My order is good to go.');
    }

    function libraryTweak() {
        // WP2 – modal entry point
        repElContent(
            SQTE_BTN_SEL,
            'Request a school',
            'Place Library Order',
            () => setTimeout(tweakModal, 50)
        );

        hideBtn(SHIP_SEL, 'Ship');
        hideBtn(PKUP_SEL, 'Pick up');
        hideBtn(DEL_SEL, 'Deliver');

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
        repElContent(
            '.ant-card-body div:not(:has(*))',
            'requested a quote',
            'Standard library delivery'
        );
    }

    // WP4 – orders list summary text
    function libraryTweakOrderSummary() {

        // the order of these replacements is important
        // first the span should be replace and if not found, then the div should be replaced
        repElContent(
            'span',
            'requested a quote',
            '<strong>Order Type</strong> Library'
        );
    }

    function startOrderSummaryWatcher() {
        let runs = 0;
        let shouldStop = false;
        const maxRuns = 40;
        const intervalMs = 250;

        const id = setInterval(() => {
            runs++;
            libraryTweakOrderSummary();

            const replaced = Array.from(document.querySelectorAll('span'))
            .some(el => {
                const text = el.textContent.toLowerCase();
                return text.includes('order type') && text.includes('library');
            });

            if (shouldStop || runs >= maxRuns) {
            clearInterval(id);
            }
            if (replaced) {
            shouldStop = true;
            }
        }, intervalMs);
    }

    /**
     * Patch fetch once and detect library accounts.
     */
    (function patchFetch() {
    if (!window.fetch) return;

    const originalFetch = window.fetch;

    window.fetch = function patchedFetch(input, init) {
        const url = typeof input === 'string' ? input : input && input.url;

        const result = originalFetch.apply(this, arguments);

        if (url && url.indexOf('/customer/session/get') !== -1) {
        result.then(function (response) {
            try {
            const clone = response.clone();
            clone.json().then(function (data) {
                const user = data && data.user;
                if (!user) return;

                const isLibraryTestAccount = libAccts.includes(user.corp_id);

                if (isLibraryTestAccount) {
                console.log('CustLibFunc: Library account detected');
                isLibraryAccount = true;

                // Run tweaks for whatever page we’re currently on
                runLibTweaksForCurrentPage();
                } else {
                console.log('CustLibFunc: Non-library account.');
                }
            }).catch(function () { });
            } catch (e) { }
        }).catch(function () { });
        }

        return result;
    };
    })();

    

    /**
     * Watch SPA-style navigation and re-run tweaks when URL changes.
     */
    (function hookSpaNavigation() {
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;

    function onLocationChange() {
        if (!isLibraryAccount) return;
        runLibTweaksForCurrentPage();
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

        // ---- POKE THE APP TO RE-FETCH SESSION AFTER OUR PATCH ----

        function pokeAppToRefetch() {
            console.log('Poking app to refetch session via focus/visibility...');

            // Try focus
            try {
            window.dispatchEvent(new Event('focus'));
            } catch (e) {}

            // Try visibilitychange (some apps use this)
            try {
            document.dispatchEvent(new Event('visibilitychange'));
            } catch (e) {}
        }

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            // Page is already loaded; wait a bit and poke
            setTimeout(pokeAppToRefetch, 50);
        } else {
            // Wait for DOM ready, then poke
            window.addEventListener('DOMContentLoaded', function () {
            setTimeout(pokeAppToRefetch, 50);
            });
        }
    })();
})();
