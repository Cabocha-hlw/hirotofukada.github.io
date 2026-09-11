// Progressive enhancement only. All content is pre-rendered into the HTML by
// site/build.mjs, so nothing here is required for reading or indexing the page.
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Scroll progress bar ────────────────────────────────────
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    const updateProgress = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.width = total > 0 ? `${(window.scrollY / total) * 100}%` : '0%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  // ── Fade-in on scroll (content is visible without JS; see .js .fade-up in CSS) ──
  const fadeEls = document.querySelectorAll('.fade-up');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    fadeEls.forEach((el) => el.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    fadeEls.forEach((el) => observer.observe(el));
  }

  // ── Scrollspy ──────────────────────────────────────────────
  const navLinks = document.querySelectorAll('nav a[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));
  }

  // ── "New" badge for items added within the last 30 days ────
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  document.querySelectorAll('[data-added]').forEach((el) => {
    const added = new Date(el.getAttribute('data-added'));
    if (Number.isNaN(added.getTime()) || added.getTime() < cutoff) return;
    const title = el.querySelector('.work-title');
    if (!title) return;
    const badge = document.createElement('span');
    badge.className = 'badge-new';
    badge.textContent = 'New';
    title.prepend(badge);
  });
})();
