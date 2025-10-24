// js/main.js

/**
 * loading the car crash vs speed limit data and initialize the visualization
 */
function main() {
    const dataPathV1 = 'data/cleaned_crash_by_month.csv';
    const dataPathV2 = 'data/col_hour.csv'

    // load data from CSV file
    d3.csv(dataPathV1).then(rawData => {
        // rawData
        console.log('Data loaded successfully:', rawData.length, 'rows');


        initializeVisualization(rawData);
    }).catch(error => {
        console.error('Error loading the CSV file:', error);
    });

    d3.csv(dataPathV2, d3.autoType).then(rawData => {
        // rawData
        console.log('Data loaded successfully:', rawData.length, 'rows');


        initializeClockVisualization(rawData);
    }).catch(error => {
        console.error('Error loading the CSV file:', error);
    });
}

// run after loading. make sure DOM is ready
document.addEventListener('DOMContentLoaded', main);