// js/main.js

/**
 * loading the car crash vs speed limit data and initialize the visualization
 */
function main() {
    const dataPathV1 = 'data/cleaned_crash_by_month.csv';
    const dataPathV2 = 'data/col_hour.csv';

    // load data for speed-limit vis
    d3.csv(dataPathV1).then(rawData => {
        console.log('Data loaded successfully (speed limit):', rawData.length, 'rows');
        initializeVisualization(rawData);
    }).catch(error => {
        console.error('Error loading the CSV file for speed-limit vis:', error);
    });

    // load data for clock vis
    d3.csv(dataPathV2, d3.autoType).then(rawData => {
        console.log('Data loaded successfully (clock):', rawData.length, 'rows');
        initializeClockVisualization(rawData);
    }).catch(error => {
        console.error('Error loading the CSV file for clock vis:', error);
    });

    // heatmap is self-invoking in calendar-heatmap.js, so we just set up zoom UX
    setupZoomPanels();
}

// simple generic zoom handler for any .chart-panel[data-zoomable]
function setupZoomPanels() {
    const panels = document.querySelectorAll('.chart-panel[data-zoomable]');
    panels.forEach(panel => {
        const closeBtn = panel.querySelector('.chart-close');

        // open zoom on click (but ignore clicks on select boxes etc.)
        panel.addEventListener('click', (evt) => {
            // if we clicked the close button, that is handled separately
            if (evt.target === closeBtn) return;

            // do not trigger zoom when user interacts with form controls
            const tag = evt.target.tagName.toLowerCase();
            if (['select', 'option', 'button', 'input'].includes(tag)) return;

            if (!panel.classList.contains('is-zoomed')) {
                panel.classList.add('is-zoomed');
                document.body.classList.add('no-scroll');
            }
        });

        // close button
        if (closeBtn) {
            closeBtn.addEventListener('click', (evt) => {
                evt.stopPropagation();
                panel.classList.remove('is-zoomed');
                document.body.classList.remove('no-scroll');
            });
        }
    });
}

// run after loading. make sure DOM is ready
document.addEventListener('DOMContentLoaded', main);
