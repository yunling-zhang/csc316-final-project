// js/main.js

/**
 * loading the car crash vs speed limit data and initialize the visualization
 */
function main() {
    const dataPath = 'data/cleaned_crash_by_month.csv';

    // load data from CSV file
    d3.csv(dataPath).then(rawData => {
        // rawData
        console.log('Data loaded successfully:', rawData.length, 'rows');

        // use the function from speedLimitVisSigns.js to init
        initializeVisualization(rawData);
    }).catch(error => {
        console.error('Error loading the CSV file:', error);
    });
}

// run after loading. make sure DOM is ready
document.addEventListener('DOMContentLoaded', main);