(() => {
  const stage = document.getElementById('stage');
  const page = document.getElementById('main');
  const BASE_W = 1024;
  const BASE_H = 1536;

  function fit() {
    const scale = window.innerWidth / BASE_W;
    page.style.transform = `scale(${scale})`;
    stage.style.height = `${BASE_H * scale}px`;
  }

  function scrollToDesignY(y) {
    const scale = window.innerWidth / BASE_W;
    window.scrollTo({ top: Number(y) * scale, behavior: 'smooth' });
  }

  document.addEventListener('click', (event) => {
    const scrollLink = event.target.closest('[data-y]');
    if (scrollLink) {
      event.preventDefault();
      scrollToDesignY(scrollLink.dataset.y);
      return;
    }

    const overview = event.target.closest('[data-open-overview]');
    if (overview) {
      document.getElementById('overviewDialog').showModal();
      return;
    }

    const gallery = event.target.closest('[data-open-gallery]');
    if (gallery) {
      document.getElementById('galleryDialog').showModal();
      return;
    }

    const close = event.target.closest('[data-close-dialog]');
    if (close) close.closest('dialog').close();
  });

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) dialog.close();
    });
  });

  fit();
  window.addEventListener('resize', fit, { passive: true });
})();
