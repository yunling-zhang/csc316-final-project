document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("viz-popup-overlay");
    const mount = document.getElementById("viz-mount");
    const closeBtn = document.getElementById("viz-close");

    // Allow clicking ANY visualization trigger
    document.querySelectorAll(".comic-panel img").forEach((img, panelIndex) => {
        img.addEventListener("click", () => {
            openViz(panelIndex);
        });
    });

    function openViz(index) {
        overlay.style.display = "flex";

        mount.innerHTML = ""; // wipe previous

        // Clone correct visualization DOM
        const sourcePanel = document.querySelector(
            `.comic-panel[data-panel-index="${index}"] .chart-panel`
        );

        if (sourcePanel) {
            const clone = sourcePanel.cloneNode(true);
            clone.style.display = "block";
            mount.appendChild(clone);
        }
    }

    function closePopup() {
        overlay.style.display = "none";
        mount.innerHTML = "";
    }

    // Close logic
    overlay.addEventListener("click", e => {
        if (e.target === overlay) closePopup();
    });

    closeBtn.addEventListener("click", closePopup);

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closePopup();
    });
});