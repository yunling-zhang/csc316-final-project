// js/comic_v2.js

document.addEventListener("DOMContentLoaded", () => {
    const panels = Array.from(document.querySelectorAll(".comic-panel"));
    const track = document.querySelector(".comic-track");
    const body = document.body;
    const leftArrow = document.querySelector(".comic-arrow--left");
    const rightArrow = document.querySelector(".comic-arrow--right");
    const hero = document.querySelector(".comic-hero");
  
    if (!panels.length || !track || !leftArrow || !rightArrow || !hero) return;
  
    let currentIndex = 0;
  
    /* ===========================
       Helper: scroll to a panel
       =========================== */
    function scrollToPanel(index) {
      if (index < 0 || index >= panels.length) return;
      currentIndex = index;
      const target = panels[currentIndex];
  
      target.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  
    /* ===========================
       IntersectionObserver for panels
       =========================== */
    const panelObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const panel = entry.target;
          if (entry.isIntersecting) {
            panel.classList.add("in-view");
          }
        });
  
        // Update currentIndex based on the panel that is most centered
        const visible = panels
          .map((p, i) => {
            const rect = p.getBoundingClientRect();
            const centerDist = Math.abs(
              rect.top + rect.height / 2 - window.innerHeight / 2
            );
            return { panel: p, index: i, centerDist };
          })
          .filter(({ panel }) => panel.classList.contains("in-view"))
          .sort((a, b) => a.centerDist - b.centerDist);
  
        if (visible.length > 0) {
          currentIndex = visible[0].index;
        }
      },
      {
        root: null,
        threshold: 0.4
      }
    );
  
    panels.forEach((panel) => panelObserver.observe(panel));
  
    /* ===========================
       Show/hide arrows after hero
       =========================== */
    const heroObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            body.classList.add("comic-arrows-visible");
          } else {
            body.classList.remove("comic-arrows-visible");
          }
        });
      },
      {
        root: null,
        threshold: 0.1
      }
    );
  
    heroObserver.observe(hero);
  
    /* ===========================
       Arrow interactions
       =========================== */
    leftArrow.addEventListener("click", () => {
      scrollToPanel(currentIndex - 1);
    });
  
    rightArrow.addEventListener("click", () => {
      scrollToPanel(currentIndex + 1);
    });
  
    // Optional: keyboard support
    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        scrollToPanel(currentIndex + 1);
      } else if (e.key === "ArrowLeft") {
        scrollToPanel(currentIndex - 1);
      }
    });
  });
  