(function () {
    
    window.version = 'V1.0.7';
    console.log('Loading Custom Library Functionaltiy', location.pathname);
    // Track whether we've confirmed this is a library account
    let isLibraryAccount = false;
    // Track our temporary re-apply interval for library tweaks
    let libraryTweaksIntervalId = null;



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
    }

    // WP4 – orders list summary text
    function libraryTweakOrderSummary() {
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

    function observeModal() {
        const observer = new MutationObserver(() => {
            // Reapply modal tweaks whenever modal content updates
            tweakModal();
        });
    
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    
    function observeCheckoutButtons() {
        const container = document.querySelector('aside.responsiveSummary');
        if (!container) return;
    
        const observer = new MutationObserver(() => {
            libraryTweak(); // will hide buttons + rename main button
        });
    
        observer.observe(container, {
            childList: true,
            subtree: true
        });
    }

    function observeOrderSummary() {
        const container = document.querySelector('aside.responsiveSummaryLeft');
        if (!container) return;
    
        const observer = new MutationObserver(() => {
            libraryTweakOrderSummary();
        });
    
        observer.observe(container, {
            childList: true,
            subtree: true
        });
    }

    function startLibraryTweaksForABit() {
        // Don't start multiple intervals
        if (libraryTweaksIntervalId) return;
    
        let runs = 0;
        const maxRuns = 20;       // 20 × 250ms = 5 seconds
        const intervalMs = 125;
    
        libraryTweaksIntervalId = setInterval(() => {
            runs++;
    
            try {
                // This handles WP2 (modal/buttons) and WP3 (confirmation text)
                libraryTweak();
            } catch (e) {
                console.error('CustLibFunc: libraryTweak error in interval', e);
            }
    
            if (runs >= maxRuns) {
                clearInterval(libraryTweaksIntervalId);
                libraryTweaksIntervalId = null;
            }
        }, intervalMs);
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
     * Run the appropriate tweaks for the *current* page.
     * Safe to call multiple times – selectors just won't match on irrelevant pages.
     */

    function runLibTweaksForCurrentPage() {
        console.log('CustLibFunc: runLibTweaksForCurrentPage on', location.pathname);
    
        // Cart / modal / order confirmation tweaks (WP2 / WP3 etc)
        libraryTweak();
        observeCheckoutButtons();
        observeModal();
    
        // For Firefox / React re-renders: keep re-applying cart/modal tweaks
        // for a short period so late renders don't bring old buttons back.
        //startLibraryTweaksForABit();
    
        // Orders list / order detail pages – summary tweaks (WP4-like)
        if (location.pathname.startsWith("/account/order")) {
            console.log('CustLibFunc: Order Summary Watcher Running');
            startOrderSummaryWatcher();
            observeOrderSummary();
        }

    }


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

    })();

    // kick things off immediately on load:
    if (typeof runLibTweaksForCurrentPage === "function") {
        runLibTweaksForCurrentPage();
    }
    
})();
