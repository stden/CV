// Progressive enhancement only. Every page works without this file: the theme
// toggle and the copy button are hidden until the script marks <html class="js">.
(function () {
  var root = document.documentElement;
  root.classList.add('js');

  var THEME_KEY = 'cv-theme';
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function currentTheme() {
    if (root.dataset.theme === 'dark' || root.dataset.theme === 'light') return root.dataset.theme;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // Private windows can block storage; the choice then lasts for this page only.
    }
  }

  var themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    var describeToggle = function () {
      var other = currentTheme() === 'dark' ? 'light' : 'dark';
      themeToggle.setAttribute('aria-label', 'Switch to ' + other + ' theme');
    };
    describeToggle();
    themeToggle.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      describeToggle();
    });
  }

  var copyButton = document.querySelector('[data-copy-email]');
  var copyStatus = document.querySelector('[data-copy-status]');
  if (copyButton && navigator.clipboard) {
    copyButton.addEventListener('click', function () {
      navigator.clipboard.writeText(copyButton.dataset.copyEmail).then(
        function () {
          if (copyStatus) copyStatus.textContent = 'Email address copied.';
        },
        function () {
          if (copyStatus) copyStatus.textContent = 'Copying failed. Use the email link instead.';
        }
      );
    });
  } else if (copyButton) {
    copyButton.hidden = true;
  }
})();
