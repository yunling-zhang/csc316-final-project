// js/panels.js

(function () {
    const panels = Array.from(document.querySelectorAll(".comic-panel"));
    if (!panels.length) return;
  
    const body = document.body;
    const hero = document.querySelector(".comic-hero");
    const introOverlay = document.getElementById("intro-overlay");
    const introBtn = document.getElementById("intro-main-btn");
  
    const prevArrow = document.getElementById("arrow-prev");
    const nextArrow = document.getElementById("arrow-next");
  
    let currentIndex = 0;
    let lastScrollY = window.scrollY;
  
    // Helper: scroll smoothly to a panel by index
    function scrollToPanel(index) {
      if (index < 0 || index >= panels.length) return;
      const target = panels[index];
  
      target.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  
    // Helper: apply animation classes when active panel changes
    function animateTransition(oldIndex, newIndex) {
      if (oldIndex === newIndex) return;
  
      const oldPanel = panels[oldIndex];
      const newPanel = panels[newIndex];
  
      const direction = newIndex > oldIndex ? "down" : "up";
  
      // Clean up previous animation classes
      panels.forEach((p) => {
        p.classList.remove(
          "animate-from-right",
          "animate-from-left",
          "animate-to-left",
          "animate-to-right"
        );
      });
  
      // Mark both as visible (so opacity isn't 0)
      oldPanel.classList.add("is-visible");
      newPanel.classList.add("is-visible");
  
      if (direction === "down") {
        oldPanel.classList.add("animate-to-left");
        newPanel.classList.add("animate-from-right");
      } else {
        oldPanel.classList.add("animate-to-right");
        newPanel.classList.add("animate-from-left");
      }
    }
  
    // Determine which panel is closest to viewport center
    function computeClosestPanelIndex() {
      const viewportCenter = window.innerHeight / 2;
  
      let bestIndex = currentIndex;
      let bestDist = Infinity;
  
      panels.forEach((panel, i) => {
        const rect = panel.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const dist = Math.abs(centerY - viewportCenter);
  
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      });
  
      return bestIndex;
    }
  
    // Scroll listener to detect active panel change
    function onScroll() {
      const newScrollY = window.scrollY;
      const newIndex = computeClosestPanelIndex();
  
      if (newIndex !== currentIndex) {
        animateTransition(currentIndex, newIndex);
        currentIndex = newIndex;
      }
  
      lastScrollY = newScrollY;
  
      // Show arrows once user has moved past hero
      if (hero) {
        const heroRect = hero.getBoundingClientRect();
        if (heroRect.bottom < 0) {
          body.classList.add("comic-arrows-visible");
        } else {
          body.classList.remove("comic-arrows-visible");
        }
      }
    }
  
    // Initialize: mark first panel as visible
    panels[0].classList.add("is-visible");
  
    window.addEventListener("scroll", onScroll, { passive: true });
  
    // Arrow navigation
    if (prevArrow) {
      prevArrow.addEventListener("click", () => {
        scrollToPanel(currentIndex - 1);
      });
    }
  
    if (nextArrow) {
      nextArrow.addEventListener("click", () => {
        scrollToPanel(currentIndex + 1);
      });
    }
  
    // Keyboard arrows for accessibility
    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        scrollToPanel(currentIndex + 1);
      } else if (e.key === "ArrowLeft") {
        scrollToPanel(currentIndex - 1);
      }
    });
  
    // Intro overlay behavior
    function dismissIntro() {
      if (!introOverlay) return;
      introOverlay.classList.add("hidden");
    }
  
    if (introBtn && introOverlay) {
      introBtn.addEventListener("click", (e) => {
        e.preventDefault();
        dismissIntro();
      });
  
      // Auto-dismiss after a short delay (optional)
      setTimeout(dismissIntro, 4000);
    }
  
    // ====== Keep your existing modal ESC behavior at the bottom ======
    // If your previous panels.js had logic like:
    // document.querySelectorAll('.chart-modal.open')... ESC closes, etc.
    // you can paste that unchanged below this line.
  })();
  
const PANEL_VIZ_MAP = {
  2: "heatmap",
  3: "clock",
  6: "speed_limit",
  7: "road_types",
  10: "circular_bar"
};

// ADD THIS function to use standardized file locations
export function getVizURLForPanel(panelNum) {
  switch (PANEL_VIZ_MAP[panelNum]) {
    case "heatmap":
      return "z_individual_visuals/heatmap/heatmap_index.html";
    case "clock":
      return "z_individual_visuals/clockVis/clockVis.html";  // If index missing, create later
    case "speed_limit":
      return "z_individual_visuals/speed_limit/speedLimitVisSigns_index.html";
    case "road_types":
      return "z_individual_visuals/collision_by_roadtypes/collision_by_roadtype.html";
    case "circular_bar":
      return "z_individual_visuals/circular_bar_month/circularBarChart_index.html"; // create later if missing
    default:
      return null;
  }
}
