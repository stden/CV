(function () {
    'use strict';

    const THEME_KEY = 'cv-theme';
    const root = document.documentElement;

    function getTheme() {
        return root.dataset.theme === 'dark' ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        root.dataset.theme = theme;
        const btn = document.getElementById('theme-toggle');
        if (btn) {
            const isDark = theme === 'dark';
            btn.setAttribute('aria-pressed', String(isDark));
            btn.setAttribute('aria-label', isDark ? btn.dataset.toLight : btn.dataset.toDark);
            const label = btn.querySelector('.theme-label');
            if (label) {
                label.textContent = isDark ? btn.dataset.lightLabel : btn.dataset.darkLabel;
            }
        }
    }

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        applyTheme(getTheme());
        themeToggle.addEventListener('click', function () {
            const next = getTheme() === 'dark' ? 'light' : 'dark';
            try {
                localStorage.setItem(THEME_KEY, next);
            } catch (_) {
                // Ignore storage errors in restricted browser contexts.
            }
            applyTheme(next);
        });
    }

    const languageLinks = Array.from(document.querySelectorAll('a[data-locale]'));
    const languageKey = 'cv-language';
    languageLinks.forEach(function (link) {
        link.addEventListener('click', function () {
            try {
                localStorage.setItem(languageKey, link.dataset.locale);
            } catch (_) {
                // Links still work when storage is unavailable.
            }
        });
    });

    const defaultLanding = languageLinks.find(function (link) {
        return link.dataset.locale === 'en' && link.getAttribute('href') === './';
    });
    if (defaultLanding && location.href === defaultLanding.href) {
        try {
            const preference = localStorage.getItem(languageKey);
            const destination = languageLinks.find(function (link) {
                return link.dataset.locale === preference && preference !== 'en';
            });
            if (destination) location.replace(destination.href);
        } catch (_) {
            // The English homepage is available in restricted storage contexts.
        }
    }

    // Mobile drawer toggle
    const navToggle = document.getElementById('nav-toggle');
    const mobileDrawer = document.getElementById('mobile-drawer');
    if (navToggle && mobileDrawer) {
        function setDrawer(open) {
            navToggle.setAttribute('aria-expanded', String(open));
            mobileDrawer.hidden = !open;
        }
        navToggle.addEventListener('click', function () {
            setDrawer(mobileDrawer.hidden);
        });
        mobileDrawer.addEventListener('click', function (event) {
            if (event.target.closest('a')) {
                setDrawer(false);
            }
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !mobileDrawer.hidden) {
                setDrawer(false);
                navToggle.focus();
            }
        });
    }

    // Copy email action
    document.querySelectorAll('[data-copy-email]').forEach(function (button) {
        button.addEventListener('click', async function () {
            const email = button.getAttribute('data-copy-email');
            const statusId = button.getAttribute('data-status-target');
            const status = statusId ? document.getElementById(statusId) : null;
            let copied = false;

            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(email);
                    copied = true;
                } catch (_) {
                    copied = false;
                }
            }

            if (!copied) {
                const input = document.createElement('textarea');
                input.value = email;
                input.setAttribute('readonly', '');
                input.style.position = 'fixed';
                input.style.opacity = '0';
                document.body.appendChild(input);
                input.select();
                try {
                    copied = document.execCommand('copy');
                } catch (_) {
                    copied = false;
                }
                document.body.removeChild(input);
            }

            if (status) {
                const message = copied ? button.dataset.copySuccess : button.dataset.copyFallback;
                status.textContent = message.replace('{email}', email);
            }
        });
    });

    // Interactive Architecture tabs and component inspector
    const tabs = Array.from(document.querySelectorAll('.arch-tab'));
    const panels = Array.from(document.querySelectorAll('.arch-panel'));

    function activateTab(targetSlug) {
        tabs.forEach(function (tab) {
            const selected = tab.getAttribute('data-arch-tab') === targetSlug;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        });
        panels.forEach(function (panel) {
            panel.hidden = panel.getAttribute('data-arch-panel') !== targetSlug;
        });
    }

    tabs.forEach(function (tab, index) {
        tab.addEventListener('click', function () {
            activateTab(tab.getAttribute('data-arch-tab'));
        });
        tab.addEventListener('keydown', function (event) {
            let nextIndex;
            switch (event.key) {
            case 'ArrowLeft': nextIndex = (index - 1 + tabs.length) % tabs.length; break;
            case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break;
            case 'Home': nextIndex = 0; break;
            case 'End': nextIndex = tabs.length - 1; break;
            default: return;
            }
            event.preventDefault();
            const nextTab = tabs[nextIndex];
            activateTab(nextTab.getAttribute('data-arch-tab'));
            nextTab.focus();
        });
    });

    function activateLinkedTab() {
        const linked = tabs.find(function (tab) {
            return location.hash === '#' + tab.id || location.hash === '#' + tab.getAttribute('aria-controls');
        });
        if (linked) activateTab(linked.getAttribute('data-arch-tab'));
    }

    if (tabs.length) {
        activateLinkedTab();
        window.addEventListener('hashchange', activateLinkedTab);
    }

    panels.forEach(function (panel) {
        const inspector = panel.querySelector('[data-inspector-detail]');
        const selectors = Array.from(panel.querySelectorAll('[data-node-id]'));

        function selectNode(nodeId) {
            let payload = null;
            selectors.forEach(function (el) {
                const active = el.getAttribute('data-node-id') === nodeId;
                el.setAttribute('aria-pressed', String(active));
                if (active && el.hasAttribute('data-node-json')) {
                    try {
                        payload = JSON.parse(el.getAttribute('data-node-json'));
                    } catch (_) {
                        payload = null;
                    }
                }
            });
            if (payload && inspector) {
                const titleEl = inspector.querySelector('[data-field="title"]');
                const respEl = inspector.querySelector('[data-field="responsibility"]');
                const conceptsEl = inspector.querySelector('[data-field="concepts"]');
                const tradeoffsEl = inspector.querySelector('[data-field="tradeoffs"]');
                if (titleEl) titleEl.textContent = payload.title;
                if (respEl) respEl.textContent = payload.responsibility;
                if (conceptsEl) conceptsEl.textContent = (payload.concepts || []).join(' · ');
                if (tradeoffsEl) tradeoffsEl.textContent = payload.tradeoffs;
            }
        }

        selectors.forEach(function (el) {
            el.addEventListener('click', function () {
                selectNode(el.getAttribute('data-node-id'));
            });
            el.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectNode(el.getAttribute('data-node-id'));
                }
            });
        });
    });

    // Skill tier filter
    const filterButtons = Array.from(document.querySelectorAll('[data-skill-filter]'));
    const skillItems = Array.from(document.querySelectorAll('.skill-items li[data-tier]'));
    const skillCards = Array.from(document.querySelectorAll('.skill-card'));

    filterButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            const tier = btn.getAttribute('data-skill-filter');
            filterButtons.forEach(function (other) {
                other.setAttribute('aria-pressed', String(other === btn));
            });
            skillItems.forEach(function (item) {
                item.hidden = tier !== 'all' && item.getAttribute('data-tier') !== tier;
            });
            skillCards.forEach(function (card) {
                const visible = card.querySelectorAll('.skill-items li:not([hidden])').length > 0;
                card.hidden = !visible;
            });
        });
    });
})();
