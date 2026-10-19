/**
 * SPTC Official Portal - Lucide Icons Integration System (High-Performance & Lazy Loading)
 * Provides instant viewport initialization, IntersectionObserver lazy loading for off-screen icons,
 * and debounced non-blocking mutation handling for smooth 60fps mobile scrolling.
 */
(function () {
  function getLucide() {
    return window.lucide;
  }

  // Convert kebab-case (e.g., 'map-pin') or snake_case to PascalCase ('MapPin')
  function toPascalCase(str) {
    if (!str) return '';
    return str
      .replace(/[-_ ]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, c => c.toUpperCase());
  }

  // Lazy icon observer for elements outside initial viewport
  let lazyIconObserver = null;
  function getLazyObserver() {
    if (!lazyIconObserver && typeof IntersectionObserver !== 'undefined') {
      lazyIconObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            obs.unobserve(entry.target);
            hydrateElementIcons(entry.target);
          }
        });
      }, { rootMargin: '300px 0px 300px 0px' }); // Pre-hydrate 300px before scroll
    }
    return lazyIconObserver;
  }

  function hydrateElementIcons(root) {
    const lucide = getLucide();
    if (!lucide || !lucide.createIcons || !lucide.icons) return;
    try {
      lucide.createIcons({
        icons: lucide.icons,
        root: root || document,
        attrs: {
          'stroke-width': '2'
        }
      });
    } catch (e) {
      console.warn('[SPTC Icons] hydrate notice:', e);
    }
  }

  /**
   * Initializes or refreshes all Lucide icons with viewport-first prioritization and lazy loading
   */
  window.initLucideIcons = function (root) {
    const lucide = getLucide();
    if (!lucide || !lucide.createIcons || !lucide.icons) return;

    const target = root || document;
    const observer = getLazyObserver();

    // If target is document and IntersectionObserver is supported, prioritize viewport
    if (target === document && observer) {
      // 1. Immediately hydrate critical above-the-fold elements
      const criticalSelectors = '.main-header, .top-bar, .mobile-nav-drawer, .hero-section, .dashboard-header-dedicated';
      document.querySelectorAll(criticalSelectors).forEach(el => hydrateElementIcons(el));

      // 2. Observe all major sections for lazy icon hydration as they scroll into view
      const sections = document.querySelectorAll('section, footer, .modal, .card, .department-card, .gallery-card');
      if (sections.length > 0) {
        sections.forEach(sec => observer.observe(sec));
      } else {
        hydrateElementIcons(document);
      }

      // 3. Fallback idle hydration to guarantee 100% coverage
      const idleCallback = window.requestIdleCallback || ((fn) => setTimeout(fn, 120));
      idleCallback(() => hydrateElementIcons(document));
    } else {
      hydrateElementIcons(target);
    }
  };

  /**
   * Renders a Lucide icon directly as an SVG HTML string
   * Perfect for template literals and innerHTML injection
   */
  window.renderLucideIcon = function (name, attrs = {}) {
    const lucide = getLucide();
    if (!lucide || !lucide.icons || !lucide.createElement) {
      return `<i data-lucide="${name}"></i>`;
    }
    const pascalName = toPascalCase(name);
    const iconNode = lucide.icons[pascalName];
    if (!iconNode) {
      console.warn(`[SPTC Icons] Icon "${name}" (PascalCase: "${pascalName}") not found.`);
      return `<i data-lucide="${name}"></i>`;
    }
    const mergedAttrs = {
      'stroke-width': '2',
      ...attrs,
      class: `lucide lucide-${name} ${attrs.class || ''}`.trim()
    };
    const svgEl = lucide.createElement(iconNode, mergedAttrs);
    return svgEl ? svgEl.outerHTML : `<i data-lucide="${name}"></i>`;
  };

  /**
   * Returns a lightweight placeholder tag for Lucide createIcons replacement
   */
  window.iconTag = function (name, extraClass = '', extraAttrs = '') {
    return `<i data-lucide="${name}" class="${extraClass}" ${extraAttrs}></i>`;
  };

  // Run on initial page readiness
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.initLucideIcons());
  } else {
    window.initLucideIcons();
  }
  window.addEventListener('load', () => window.initLucideIcons());

  // MutationObserver for automated icon replacement in dynamically injected templates (modals, ledgers, tables)
  const pendingNodes = new Set();
  let scheduled = false;

  const mutationObserver = new MutationObserver((mutations) => {
    let hasIcons = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.hasAttribute && node.hasAttribute('data-lucide')) {
              pendingNodes.add(node);
              hasIcons = true;
            } else if (node.querySelector && node.querySelector('[data-lucide]')) {
              pendingNodes.add(node);
              hasIcons = true;
            }
          }
        }
      }
    }
    if (hasIcons && !scheduled) {
      scheduled = true;
      const scheduleFn = window.requestIdleCallback || requestAnimationFrame;
      scheduleFn(() => {
        pendingNodes.forEach(node => hydrateElementIcons(node));
        pendingNodes.clear();
        scheduled = false;
      });
    }
  });

  function startObserver() {
    if (document.body) {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          mutationObserver.observe(document.body, { childList: true, subtree: true });
        }
      });
    }
  }

  startObserver();

  // Universal Mobile Navigation Drawer Controller
  window.toggleMobileMenu = function (forceState) {
    const drawer = document.getElementById('mobileNavDrawer');
    const backdrop = document.getElementById('mobileNavBackdrop');
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const openIcon = document.getElementById('menuToggleIconOpen');
    const closeIcon = document.getElementById('menuToggleIconClose');
    if (!drawer) return;

    const willBeActive = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('active');

    if (willBeActive) {
      drawer.classList.add('active');
      backdrop?.classList.add('active');
      document.body.classList.add('mobile-nav-open');
      toggleBtn?.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      if (openIcon) openIcon.style.display = 'none';
      if (closeIcon) closeIcon.style.display = 'inline-block';
    } else {
      if (document.activeElement && drawer.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      drawer.classList.remove('active');
      backdrop?.classList.remove('active');
      document.body.classList.remove('mobile-nav-open');
      toggleBtn?.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      if (openIcon) openIcon.style.display = 'inline-block';
      if (closeIcon) closeIcon.style.display = 'none';
    }
  };

  window.closeMobileNav = function () {
    window.toggleMobileMenu(false);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.toggleMobileMenu(false);
    }
  });
})();
