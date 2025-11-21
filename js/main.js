// js/main.js

/**
 * loading the car crash vs speed limit data and initialize the visualization
 */
function main() {
    const dataPathV1 = 'data/cleaned_crash_by_month.csv';
    const dataPathV2 = 'z_individual_visuals/clockVis/data/col_hour_full.csv';
    const dataPathV3 = 'data/collisions_by_month.csv';

    // load data for speed-limit vis
    d3.csv(dataPathV1).then(rawData => {
        console.log('Data loaded successfully (speed limit):', rawData.length, 'rows');
        initializeVisualization(rawData);
    }).catch(error => {
        console.error('Error loading the CSV file for speed-limit vis:', error);
    });

    // load data for clock vis - don't use autoType to preserve string column names
    d3.csv(dataPathV2).then(rawData => {
        console.log('Data loaded successfully (clock):', rawData.length, 'rows');
        console.log('First row:', rawData[0]);
        console.log('Columns:', rawData.columns);
        initializeClockVisualization(rawData);
    }).catch(error => {
        console.error('Error loading the CSV file for clock vis:', error);
    });

    // Load monthly collisions data for circular bar chart
    d3.text(dataPathV3).then(text => {
        console.log('Monthly collisions text loaded');

        const monthlyData = parseMonthlyCSVText(text);
        console.log('Parsed monthly data:', monthlyData);

        if (monthlyData && monthlyData.length > 0) {
            
            window.monthlyChartData = monthlyData;
            
            
            setTimeout(() => {
                initializeCircularChart(monthlyData);
            }, 100);
        } else {
            console.error('Failed to parse monthly data');
        }
    }).catch(error => {
        console.error('Error loading monthly collisions CSV:', error);
    });

    
    setupZoomPanels();
}


function setupZoomPanels() {
    const panels = document.querySelectorAll('.chart-panel[data-zoomable]');
    panels.forEach(panel => {
        const closeBtn = panel.querySelector('.chart-close');

        // open zoom on click
        panel.addEventListener('click', (evt) => {
            if (evt.target === closeBtn) return;

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


document.addEventListener('DOMContentLoaded', main);