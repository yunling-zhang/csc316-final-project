
(function () {
    // ===== PANEL-TO-PANEL NAVIGATION =====
    const panels = Array.from(document.querySelectorAll('.comic-panel'));
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    let currentIndex = 0;

    function updatePanels() {
        panels.forEach((p, i) => {
            p.classList.toggle('active', i === currentIndex);
        });

        if (prevBtn) prevBtn.disabled = currentIndex === 0;
        if (nextBtn) nextBtn.disabled = currentIndex === panels.length - 1;
    }

    prevBtn?.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            updatePanels();
        }
    });

    nextBtn?.addEventListener('click', () => {
        if (currentIndex < panels.length - 1) {
            currentIndex++;
            updatePanels();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevBtn?.click();
        if (e.key === 'ArrowRight') nextBtn?.click();
    });

    updatePanels();

    // ===== OPENING OVERLAY =====
    const introOverlay = document.getElementById('intro-overlay');
    const introMainBtn = document.getElementById('intro-main-btn');

    function dismissIntro() {
        if (!introOverlay) return;
        introOverlay.classList.add('hidden');
        setTimeout(() => {
            introOverlay.style.display = 'none';
        }, 400);
    }

    introOverlay?.addEventListener('click', dismissIntro);

    introMainBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissIntro();
    });

    setTimeout(dismissIntro, 4000);

    // ===== CHART MODALS (heatmap, etc.) =====
    const modalTriggers = document.querySelectorAll('[data-modal-target]');

    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('open');

        // Tell other scripts (like heatmap.js) that a modal just opened
        const evt = new CustomEvent('chart-modal-opened', {
            detail: { id: modal.id }
        });
        document.dispatchEvent(evt);
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('open');
    }

    modalTriggers.forEach(trigger => {
        const targetSelector = trigger.getAttribute('data-modal-target');
        const modal = document.querySelector(targetSelector);
        if (!modal) return;

        // Thumbnail click -> open
        trigger.addEventListener('click', () => openModal(modal));

        // Click on dark backdrop -> close
        const backdrop = modal.querySelector('.chart-modal-backdrop');
        backdrop?.addEventListener('click', () => closeModal(modal));
    });

    // ESC closes any open modal
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        document.querySelectorAll('.chart-modal.open').forEach(m => closeModal(m));
    });
})();
