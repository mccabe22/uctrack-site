(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.mobile-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open');
    });
  }

  const header = document.getElementById('site-header');
  const updateHeader = () => header && header.classList.toggle('is-scrolled', window.scrollY > 30);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.uc-video-lite__button');
    if (!button) return;

    const wrapper = button.closest('.uc-video-lite');
    if (!wrapper) return;

    const videoId = wrapper.getAttribute('data-video-id');
    if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return;

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    iframe.title = button.getAttribute('aria-label') || 'Union Catholic video';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';

    wrapper.replaceChildren(iframe);
  });
})();
