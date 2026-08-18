(() => {
  const DESIGN_WIDTH = 1024;
  const stage = document.getElementById('approvedStage');
  const artwork = document.getElementById('approvedArtwork');

  async function loadArtwork() {
    try {
      const urls = Array.from({ length: 8 }, (_, i) =>
        `/assets/approved-ref/chunk-${String(i).padStart(2, '0')}.txt`
      );
      const chunks = await Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url, { cache: 'force-cache' });
          if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
          return (await response.text()).trim();
        })
      );
      artwork.addEventListener('load', () => stage.setAttribute('aria-busy', 'false'), { once: true });
      artwork.src = `data:image/webp;base64,${chunks.join('')}`;
    } catch (error) {
      stage.setAttribute('aria-busy', 'false');
      console.error(error);
      const message = document.createElement('p');
      message.className = 'load-error';
      message.textContent = 'The approved TAKEFRAME artwork could not be loaded.';
      stage.appendChild(message);
    }
  }

  function scrollToDesignY(y) {
    const rect = stage.getBoundingClientRect();
    const scale = rect.width / DESIGN_WIDTH;
    const target = window.scrollY + rect.top + Number(y) * scale;
    window.scrollTo({ top: target, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-scroll-y]').forEach((control) => {
    control.addEventListener('click', () => scrollToDesignY(control.dataset.scrollY));
  });

  loadArtwork();
})();
