(() => {
  const storageKey = 'portfolio-theme';
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');

  function updateTheme() {
    const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && systemTheme.matches);
    toggle?.setAttribute('aria-pressed', String(dark));
  }

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch {
    // The current page can still switch themes when storage is unavailable.
  }
  updateTheme();
  systemTheme.addEventListener('change', updateTheme);

  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const next = toggle.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
      root.dataset.theme = next;
      updateTheme();
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // The selection remains active on this page.
      }
    });
  }

  const mobileMenu = document.querySelector('#mobile-menu');
  mobileMenu?.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link) mobileMenu.open = false;
  });
  mobileMenu?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileMenu.open) {
      mobileMenu.open = false;
      mobileMenu.querySelector('summary').focus();
    }
  });

  const copyButton = document.querySelector('[data-copy-email]');
  const copyStatus = document.querySelector('[data-copy-status]');
  if (copyButton && copyStatus) {
    copyButton.hidden = false;
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(copyButton.dataset.copyEmail);
        copyStatus.textContent = 'Email address copied.';
      } catch {
        copyStatus.textContent = 'Select and copy the email address above.';
        document.querySelector('.contact-email a')?.focus();
      }
    });
  }
})();
