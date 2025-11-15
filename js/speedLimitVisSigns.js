
// ===============================
// Constants
// ===============================
const margin = { top: 50, right: 40, bottom: 40, left: 80 };
const width = 1200 - margin.left - margin.right;
const height = 460 - margin.top - margin.bottom;
const carHeight = 22;
const carWidth = 44;
const signSize = 60;
const signWidth = 96;
const poleWidth = 8;
const roadY = height - margin.bottom;

let xBand, yScale;
let speedKeys = [];
let allYears = [];
let cachedByYear = {};
let currentSpeed = 0;
let currentYear = null;
let activeSigns = [];
let animationFrameId = null;
let speedControlSlider = null;

// data cleaning helper
function getYear(d) {
    if (d.Year && String(d.Year).trim() !== "") return +d.Year;
    if (d.Month) {
        const y = parseInt(String(d.Month).slice(0, 4));
        return Number.isFinite(y) ? y : null;
    }
    return null;
}

function getCarPath(x, y, w, h) {
    const head = x + w * 0.2;
    const tail = x + w * 0.8;
    const topY = y - h;

    return `
    M${x},${y}
    L${x},${topY + h * 0.2}
    L${head},${topY + h * 0.2}
    L${head},${topY}
    L${tail},${topY}
    L${tail},${topY + h * 0.2}
    L${x + w},${topY + h * 0.2}
    L${x + w},${y}
    Z
  `;
}

//preprocess data
function preprocessData(rawData) {
    const filtered = rawData.filter(d => d.Measures === "Number of collisions");
    speedKeys = Object.keys(filtered[0]).filter(k => k.endsWith("per hour"));

    const yearSet = new Set();
    filtered.forEach(d => {
        const y = getYear(d);
        if (y) yearSet.add(y);
    });
    allYears = Array.from(yearSet).sort((a, b) => a - b);

    cachedByYear = {};
    allYears.forEach(y => {
        const rows = filtered.filter(d => getYear(d) === y);
        const arr = speedKeys.map(sk => {
            const sum = d3.sum(rows, r => +r[sk]);
            return {
                speed: sk.replace(" per hour", "").trim(),
                value: sum
            };
        });
        cachedByYear[y] = arr.sort((a, b) => parseInt(a.speed, 10) - parseInt(b.speed, 10));
    });
}

// initialize visualization
function initializeVisualization(rawData) {
    preprocessData(rawData);

    if (allYears.length === 0) {
        d3.select("#car-speed-limit-crashes-vis-nathan").append("p").text("No data available");
        return;
    }

    const defaultYear = allYears[allYears.length - 1];
    const yearSel = d3.select("#car-speed-limit-crashes-vis-nathan-year-select");
    yearSel
        .selectAll("option")
        .data(allYears)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);
    yearSel.property("value", defaultYear);

    const svg = d3
        .select("#car-speed-limit-crashes-vis-nathan")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Road gradient background
    const defs = svg.append("defs");
    const gradient = defs
        .append("linearGradient")
        .attr("id", "road-gradient")
        .attr("x1", "0%")
        .attr("x2", "0%")
        .attr("y1", "0%")
        .attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#dee2e6");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#adb5bd");

    svg
        .append("rect")
        .attr("class", "road")
        .attr("x", 0)
        .attr("y", roadY - 10)
        .attr("width", width)
        .attr("height", height - roadY + 10)
        .attr("fill", "url(#road-gradient)");

    xBand = d3.scaleBand().range([0, width]).padding(0.5);
    yScale = d3.scaleLinear().range([roadY - signSize / 2, 40]); // top safe padding

    // y-axis group
    svg.append("g").attr("class", "y-axis").attr("transform", `translate(-30,0)`);

    // car - fixed position
    const carX = 100;
    svg
        .append("path")
        .attr("class", "car")
        .attr("transform", `translate(${carX}, ${roadY - carHeight})`)
        .attr("d", getCarPath(0, carHeight, carWidth, carHeight))
        .attr("id", "animated-car")
        .attr("fill", "#e63946");

    // Speed display in top right corner of SVG
    const speedDisplayGroup = svg.append("g")
        .attr("id", "speed-display-group")
        .attr("transform", `translate(${width - 200}, -10)`);

    const speedDisplayBg = speedDisplayGroup.append("rect")
        .attr("id", "speed-display-bg")
        .attr("x", -80)
        .attr("y", -25)
        .attr("width", 160)
        .attr("height", 70)
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", "#2c3e50")
        .attr("opacity", 0.9)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

    const speedLabel = speedDisplayGroup.append("text")
        .attr("id", "speed-label")
        .attr("x", 0)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .attr("fill", "#fff")
        .text("SPEED");

    const speedValue = speedDisplayGroup.append("text")
        .attr("id", "speed-value")
        .attr("x", 0)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .attr("font-size", "32px")
        .attr("font-weight", "900")
        .attr("fill", "#e63946")
        .text("0");



    // Speed control slider
    const container = d3.select("#car-speed-limit-crashes-vis-nathan");
    const sliderContainer = container.append("div")
        .attr("id", "speed-control-container")
        .style("margin-top", "20px")
        .style("padding", "10px")
        .style("background", "#f8f9fa")
        .style("border-radius", "8px");

    sliderContainer.append("label")
        .attr("for", "speed-control-slider")
        .style("display", "block")
        .style("margin-bottom", "8px")
        .style("font-weight", "600")
        .text("Car Speed (mph): ");

    const slider = sliderContainer.append("input")
        .attr("type", "range")
        .attr("id", "speed-control-slider")
        .attr("min", 0)
        .attr("max", 100)
        .attr("value", 0)
        .attr("step", 1)
        .style("width", "100%")
        .style("max-width", "600px");

    const speedDisplay = sliderContainer.append("div")
        .attr("id", "speed-display")
        .style("margin-top", "8px")
        .style("font-size", "14px")
        .style("color", "#666")
        .text("Speed: 0 mph");

    speedControlSlider = slider.node();

    slider.on("input", function() {
        currentSpeed = +this.value;
        speedDisplay.text(`Speed: ${currentSpeed} mph`);
        speedValue.text(currentSpeed);
    });

    currentYear = defaultYear;
    updateVisualization(defaultYear);

    yearSel.on("change", function () {
        currentYear = +this.value;
        updateVisualization(currentYear);
    });
}

// Find which speed limit applies to current speed
// Returns the speed limit that the current speed falls within
function getSpeedLimitForSpeed(speed, speedLimits) {
    if (speed === 0) return null;
    
    // Sort speed limits in ascending order
    const sorted = [...speedLimits].sort((a, b) => parseInt(a.speed, 10) - parseInt(b.speed, 10));
    
    // Find the speed limit that matches or is closest below the current speed
    for (let i = sorted.length - 1; i >= 0; i--) {
        const limit = parseInt(sorted[i].speed, 10);
        if (speed >= limit) {
            return sorted[i];
        }
    }
    
    // If speed is below all limits, return the lowest one
    return sorted[0];
}

// update visualization for a given year
function updateVisualization(year) {
    if (!year) return;
    
    const svg = d3.select("#car-speed-limit-crashes-vis-nathan svg g");
    const data = cachedByYear[year];
    if (!data || data.length === 0) return;

    // y domain and limit
    const maxVal = d3.max(data, d => d.value);
    yScale.domain([0, maxVal * 1.05]);

    // y-axis with subtle grid lines
    const axis = d3
        .axisLeft(yScale)
        .ticks(6)
        .tickSize(-width)
        .tickFormat(d3.format(".2s"));

    svg
        .select(".y-axis")
        .transition()
        .duration(600)
        .call(axis)
        .call(g =>
            g.selectAll(".tick line")
                .attr("stroke", "#bbb")
                .attr("stroke-opacity", 0.3)
        )
        .call(g => g.selectAll(".domain").attr("stroke", "#888"));

    // Stop existing animation if running
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Don't clear existing signs - just start/restart animation loop
    animateSigns(svg, data, year);
}

function animateSigns(svg, data, year) {
    const spawnX = width + 50;
    let lastSpawnTime = 0;
    let lastSpeedCheckTime = 0;
    const speedCheckInterval = 200;
    let currentSpeedForSpawning = 0;
    let lastFrameTime = performance.now();
    
    function animate(currentTime) {
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;
        
        // Check slider speed every 0.2 seconds (200ms)
        if ((currentTime - lastSpeedCheckTime) >= speedCheckInterval) {
            currentSpeedForSpawning = currentSpeed;
            lastSpeedCheckTime = currentTime;
        }
        
        if (currentSpeedForSpawning > 0) {
            const speedFactor = currentSpeedForSpawning / 50;
            const baseSpawnInterval = 1000;
            const spawnInterval = Math.max(150, baseSpawnInterval / (1 + speedFactor * 3));
            
            if ((currentTime - lastSpawnTime) >= spawnInterval) {
                const speedLimitData = getSpeedLimitForSpeed(currentSpeedForSpawning, data);
                if (speedLimitData) {
                    spawnSign(svg, speedLimitData, spawnX);
                    lastSpawnTime = currentTime;
                }
            }
        }

        // Use the current slider speed for movement (real-time)
        const moveSpeed = currentSpeed * 0.5;
        for (let i = activeSigns.length - 1; i >= 0; i--) {
            const sign = activeSigns[i];
            sign.x -= moveSpeed * (deltaTime / 16.67);
            
            if (sign.x < -100) {
                sign.group.remove();
                activeSigns.splice(i, 1);
            } else {
                sign.group.attr("transform", `translate(${sign.x}, 0)`);
            }
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    lastFrameTime = performance.now();
    lastSpeedCheckTime = performance.now();
    animate(performance.now());
}

function spawnSign(svg, speedLimitData, startX) {
    const safeY = Math.max(yScale(speedLimitData.value), 60);
    const signX = startX;
    
    const signGroup = svg.append("g")
        .attr("class", "speed-sign")
        .attr("transform", `translate(${signX}, 0)`);

    const pole = signGroup
        .append("rect")
        .attr("class", "sign-pole")
        .attr("x", -poleWidth / 2)
        .attr("width", poleWidth)
        .attr("fill", "#444")
        .attr("y", safeY)
        .attr("height", roadY - safeY);

    const signSquare = signGroup
        .append("rect")
        .attr("class", "sign-square")
        .attr("width", signWidth)
        .attr("height", signSize)
        .attr("x", -signWidth / 2)
        .attr("y", safeY - signSize)
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("stroke", "#d62828")
        .attr("stroke-width", 3)
        .attr("fill", "#fff");

    const signText = signGroup
        .append("text")
        .attr("class", "sign-text")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", 700)
        .attr("x", 0)
        .attr("y", safeY - signSize / 2 + 5)
        .text(`${speedLimitData.speed}`);

    activeSigns.push({
        group: signGroup,
        x: signX,
        speedLimit: speedLimitData
    });
}

