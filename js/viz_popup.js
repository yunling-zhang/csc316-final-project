// js/viz_popup.js
// Mixed popup system:
// - Heatmap, Clock, Road-type → iframe (standalone pages)
// - Speed Limit, Month Circular Bar → clone inline chart-panel from comic.html

document.addEventListener("DOMContentLoaded", () => {
  const overlay  = document.getElementById("viz-popup-overlay");
  const mount    = document.getElementById("viz-mount");
  const closeBtn = document.getElementById("viz-close");

  if (!overlay || !mount || !closeBtn) return;

  // ----------------------------------------------------------
  // Panel → visualization config
  // data-panel-index in comic.html:
  //   1 = Panel 2 (heatmap)
  //   2 = Panel 3 (clock)
  //   5 = Panel 6 (speed limit)
  //   6 = Panel 7 (road type)
  //   9 = Panel 10 (month circular bar)
  // ----------------------------------------------------------
  const PANEL_VIZ = {
    // Panel 2 – heatmap (iframe)
    1: {
      mode: "iframe",
      url: "z_individual_visuals/heatmap/heatmap_index.html"
    },

    // Panel 3 – clock (iframe)
    2: {
      mode: "iframe",
      url: "z_individual_visuals/clockVis/clockVis.html"
    },

    // Panel 6 – speed limit (iframe)
    5: {
      mode: "iframe",
      url: "z_individual_visuals/speed_limit/speedLimitVisSigns_index.html"
    },

    // Panel 7 – road-type circular viz (iframe)
    6: {
      mode: "iframe",
      url: "z_individual_visuals/collision_by_roadtypes/collision_by_roadtype.html"
    },

    // Panel 10 – circular bar by month (iframe)
    9: {
      mode: "iframe",
      url: "z_individual_visuals/circular_bar_month/circularBarChart_index.html"
    }
  };

  // ----------------------------------------------------------
  // Attach click handlers to clickable panels
  // ----------------------------------------------------------
  document.querySelectorAll(".comic-panel").forEach(panel => {
    const indexAttr = panel.getAttribute("data-panel-index");
    const index = indexAttr !== null ? parseInt(indexAttr, 10) : NaN;

    if (!Number.isInteger(index) || !(index in PANEL_VIZ)) {
      panel.style.cursor = "default";
      return;
    }

    // Make whole panel feel clickable
    panel.style.cursor = "pointer";

    panel.addEventListener("click", (evt) => {
      // Ignore clicks on obvious UI controls inside panels
      const tag = evt.target.tagName.toLowerCase();
      if (["select", "option", "button", "input"].includes(tag)) return;

      openViz(index);
    });
  });

  // ----------------------------------------------------------
  // OPEN popup
  // ----------------------------------------------------------
  function openViz(index) {
    const cfg = PANEL_VIZ[index];
    if (!cfg) return;

    overlay.style.display = "flex";
    mount.innerHTML = "";
    document.body.classList.add("no-scroll");

    // --- IFRAME MODE (heatmap, clock, road-type) ---
    if (cfg.mode === "iframe" && cfg.url) {
      const frame = document.createElement("iframe");
      frame.src = cfg.url;
      frame.loading = "lazy";
      frame.className = "viz-popup-frame";
      frame.title = "Crash data visualization";
      mount.appendChild(frame);
      return;
    }

    // --- CLONE MODE (speed limit, month circular bar) ---
    if (cfg.mode === "clone" && cfg.panelSelector) {
      const sourcePanel = document.querySelector(cfg.panelSelector);
      if (!sourcePanel) {
        console.warn("Clone source not found for panel", index, cfg.panelSelector);
        return;
      }

      // Clone the mini chart-panel that is already rendering correctly in the comic
      const clone = sourcePanel.cloneNode(true);

      // Reset its positioning so it behaves like content inside the popup
      clone.classList.add("viz-popup-clone");
      clone.style.position = "static";
      clone.style.left = "";
      clone.style.top = "";
      clone.style.right = "";
      clone.style.bottom = "";
      clone.style.transform = "none";

      // Remove small in-panel close buttons; popup has its own X
      clone.querySelectorAll(".chart-close").forEach(btn => btn.remove());

      mount.appendChild(clone);
      return;
    }
  }

  // ----------------------------------------------------------
  // CLOSE popup
  // ----------------------------------------------------------
  function closePopup() {
    overlay.style.display = "none";
    mount.innerHTML = "";
    document.body.classList.remove("no-scroll");
  }

  // Click outside the centered window to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closePopup();
    }
  });

  // X button closes
  closeBtn.addEventListener("click", closePopup);

  // Escape key closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePopup();
    }
  });
});
