// js/comic_scroll.js
// Vertical scroll → horizontal comic-strip with cinematic camera + arrows (no GSAP)

document.addEventListener("DOMContentLoaded", () => {
  const hero = document.getElementById("comic-hero");
  const track = document.querySelector(".comic-track");
  const panels = Array.from(document.querySelectorAll(".comic-panel"));
  const scrollLengthEl = document.querySelector(
    ".comic-scroll-length");
  const leftBtn = document.getElementById("comic-arrow-prev");
  const rightBtn = document.getElementById("comic-arrow-next");
  const progressIndicator = document.getElementById("progress-indicator");
  const progressDotsContainer = progressIndicator?.querySelector(".progress-dots");
  const currentPanelSpan = document.getElementById("current-panel");
  const totalPanelsSpan = document.getElementById("total-panels");

  if (!hero || !track || !scrollLengthEl || panels.length === 0) return;

  // ----------------------
  // CONFIG
  // ----------------------

  // S-like vertical offsets for panels (in px)
  const laneOffsets = [
    -60, 40, -350, 60, -200, 500, -50, 250, -250, 70, -100, 150, -40
  ];

  const extraScrollPanels = 1;        // extra "panel lengths" of scroll padding
  const scrollPerPanelFactor = 1.4;   // slightly more scroll per panel → slower horizontal motion

  const cameraSnapDuration = 1000;     // ms (0.25s)
  let startY = 0;                     // where comic motion starts (after hero)
  let scrollRange = 0;                // total scroll distance that drives the comic
  let baseOffsetX = 0;                // initial camera translation to center first panel
  let totalDeltaX = 1;                // horizontal distance from first panel center to last

  // Camera state
  let currentCameraY = 0;
  let targetCameraY = 0;
  let currentX = 0;
  let activeIndex = 0;
  let cameraAnimFrame = null;
  let snapTimeout = null;
  let isSnapping = false;

  // ----------------------
  // CAMERA HELPERS
  // ----------------------

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function setTransform() {
    // combine horizontal scroll-driven X + camera vertical Y
    track.style.transform = `translate(${currentX}px, ${currentCameraY}px)`;
  }

  function animateCameraY(fromY, toY, duration) {
    if (cameraAnimFrame !== null) {
      cancelAnimationFrame(cameraAnimFrame);
      cameraAnimFrame = null;
    }

    const startTime = performance.now();

    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutQuad(t);
      currentCameraY = fromY + (toY - fromY) * eased;
      setTransform();

      if (t < 1) {
        cameraAnimFrame = requestAnimationFrame(step);
      } else {
        cameraAnimFrame = null;
      }
    }

    cameraAnimFrame = requestAnimationFrame(step);
  }

  // ----------------------
  // PROGRESS INDICATOR
  // ----------------------

  function initializeProgressIndicator() {
    if (!progressIndicator || !progressDotsContainer || !totalPanelsSpan) return;

    // Set total panels
    totalPanelsSpan.textContent = panels.length;

    // Create dots for each panel
    progressDotsContainer.innerHTML = '';
    panels.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'progress-dot';
      dot.dataset.index = i;
      progressDotsContainer.appendChild(dot);
    });

    // Show indicator after scrolling past hero
    updateProgressIndicator(0);
  }

  function updateProgressIndicator(index) {
    if (!progressIndicator || !progressDotsContainer || !currentPanelSpan) return;

    // Update text
    currentPanelSpan.textContent = index + 1;

    // Update dots
    const dots = progressDotsContainer.querySelectorAll('.progress-dot');
    dots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // Show/hide indicator based on scroll position
    if (window.scrollY > hero.offsetHeight * 0.3) {
      progressIndicator.classList.add('visible');
    } else {
      progressIndicator.classList.remove('visible');
    }
  }

  // ----------------------
  // LAYOUT + MEASURE
  // ----------------------

  function setupLayout() {
    // Apply lane offsets (vertical wiggle per panel)
    panels.forEach((panel, i) => {
      const lane = laneOffsets[i] ?? laneOffsets[i % laneOffsets.length];
      panel.style.setProperty("--lane-offset", `${lane}px`);
    });

    // Reset transforms before measuring
    track.style.transform = "none";
    currentCameraY = 0;
    targetCameraY = 0;

    // Where comic motion starts: after full hero height
    startY = hero.offsetHeight;

    // Use the DOM layout (with CSS gap) to measure centers
    const firstPanel = panels[0];
    const lastPanel = panels[panels.length - 1];

    const firstCenter = firstPanel.offsetLeft + firstPanel.offsetWidth / 2;
    const lastCenter = lastPanel.offsetLeft + lastPanel.offsetWidth / 2;

    const viewportCenterX = window.innerWidth / 2;

    // Camera X offset that centers first panel at progress = 0
    baseOffsetX = viewportCenterX - firstCenter;
    totalDeltaX = Math.max(1, lastCenter - firstCenter); // avoid divide-by-zero

    // Scroll distance to move through all panels (roughly one viewport per panel)
    const panelCount = panels.length;
    scrollRange =
      window.innerHeight * (panelCount * scrollPerPanelFactor + extraScrollPanels);

    scrollLengthEl.style.height = `${scrollRange}px`;

    // Apply initial transform based on current scroll
    applyTransform(window.scrollY);
  }

  // ----------------------
  // APPLY TRANSFORM (X from scroll, Y from camera)
  // ----------------------

  function applyTransform(scrollY) {
    // Only start horizontal motion after we've cleared the hero section
    let delta = scrollY - startY;
    if (delta < 0) delta = 0;
    if (delta > scrollRange) delta = scrollRange;

    const progress = scrollRange > 0 ? delta / scrollRange : 0;

    // Scroll → horizontal translation
    const x = baseOffsetX - progress * totalDeltaX;
    currentX = x;
    setTransform(); // keep using currentCameraY

    // Determine which panel should be "active"
    const index = Math.round(progress * (panels.length - 1));
    const clampedIndex = Math.min(panels.length - 1, Math.max(0, index));

    if (clampedIndex !== activeIndex) {
      activeIndex = clampedIndex;
      updateProgressIndicator(activeIndex);

      // Target camera Y so that active panel is vertically centered (neutralize its lane)
      const lane = laneOffsets[activeIndex] ?? 0;
      const desiredCameraY = -lane;

      if (desiredCameraY !== targetCameraY) {
        const fromY = currentCameraY;
        targetCameraY = desiredCameraY;
        animateCameraY(fromY, targetCameraY, cameraSnapDuration);
      }
    }
  }

  function onScroll() {
    applyTransform(window.scrollY);

    // Update progress indicator visibility on scroll
    if (progressIndicator) {
      if (window.scrollY > hero.offsetHeight * 0.3) {
        progressIndicator.classList.add('visible');
      } else {
        progressIndicator.classList.remove('visible');
      }
    }

    if (isSnapping) return;

    if (snapTimeout) {
      clearTimeout(snapTimeout);
    }

    // Medium snap: when scrolling pauses briefly, glide to nearest panel
    snapTimeout = setTimeout(() => {
      scrollToPanel(activeIndex);
    }, 400);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  function smoothSnapToPanel(index) {
    if (index < 0 || index >= panels.length) return;
  
    const targetProgress =
      panels.length > 1 ? index / (panels.length - 1) : 0;
  
    const targetDelta = targetProgress * scrollRange;
    const targetScrollY = startY + targetDelta;
  
    const start = window.scrollY;
    const change = targetScrollY - start;
    const duration = 650; // ms
    const startTime = performance.now();
  
    isSnapping = true;
  
    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }
  
    function animate(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(t);
      window.scrollTo(0, start + eased * change);
  
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        isSnapping = false;
      }
    }
  
    requestAnimationFrame(animate);
  }
  
  // ----------------------
  // ARROW / KEYBOARD NAV → SCROLL TO PANEL
  // ----------------------

  function scrollToPanel(index) {
    if (index < 0 || index >= panels.length) return;

    // Map target panel index to progress [0,1]
    const targetProgress =
      panels.length > 1 ? index / (panels.length - 1) : 0;

    const targetDelta = targetProgress * scrollRange;
    const targetScrollY = startY + targetDelta;

    activeIndex = index;
    isSnapping = true;

    window.scrollTo({
      top: targetScrollY,
      behavior: "smooth"
    });

    // After the glide ends, allow natural snapping again
    setTimeout(() => {
      isSnapping = false;
    }, cameraSnapDuration + 150);
  }

  if (leftBtn) {
    leftBtn.addEventListener("click", () => {
      scrollToPanel(activeIndex - 1);
    });
  }

  if (rightBtn) {
    rightBtn.addEventListener("click", () => {
      scrollToPanel(activeIndex + 1);
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      scrollToPanel(activeIndex + 1);
    } else if (e.key === "ArrowLeft") {
      scrollToPanel(activeIndex - 1);
    }
  });

  // ----------------------
  // INITIALIZE + RESIZE
  // ----------------------

  function init() {
    setupLayout();
    initializeProgressIndicator();
  }

  // Run once DOM is ready, then once more after images fully load
  init();
  window.addEventListener("load", () => {
    setupLayout();
    initializeProgressIndicator();
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setupLayout();
    }, 120);
  });
});
