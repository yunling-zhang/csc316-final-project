
// ===============================
// Constants
// ===============================
const margin = { top: 50, right: 100, bottom: 60, left: 80 };
const width = 1200 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;
const carHeight = 32;
const carWidth = 64;
const signSize = 80;
const signWidth = 120;
const poleWidth = 10;
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

// Color palette for different speed zones
const speedZoneColors = {
    low: { bg: '#10b981', text: '#064e3b', label: 'Safe Zone' },      // Green
    medium: { bg: '#f59e0b', text: '#78350f', label: 'Caution Zone' }, // Amber
    high: { bg: '#ef4444', text: '#7f1d1d', label: 'Danger Zone' }     // Red
};

function getSpeedZone(speed) {
    const limit = parseInt(speed, 10) || 0;
    if (limit <= 50) return speedZoneColors.low;
    if (limit <= 80) return speedZoneColors.medium;
    return speedZoneColors.high;
}

// Format speed label for better readability
function formatSpeedLabel(speed) {
    if (speed.toLowerCase().includes('less than')) {
        return '<40';
    }
    return speed.replace(' km', '').replace('km', '');
}

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
    // More detailed car shape
    const bodyBottom = y;
    const bodyTop = y - h * 0.5;
    const roofTop = y - h;
    const frontBumper = x;
    const frontWheel = x + w * 0.15;
    const windshieldStart = x + w * 0.25;
    const windshieldEnd = x + w * 0.45;
    const rearWindow = x + w * 0.75;
    const rearBumper = x + w;

    return `
    M${frontBumper},${bodyTop}
    L${frontBumper},${bodyBottom}
    L${rearBumper},${bodyBottom}
    L${rearBumper},${bodyTop}
    L${rearWindow},${bodyTop}
    L${windshieldEnd},${roofTop}
    L${windshieldStart},${roofTop}
    L${frontWheel},${bodyTop}
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
        .attr("transform", `translate(${margin.left},${margin.top + 40})`);

    // Defs for gradients and filters
    const defs = svg.append("defs");

    // Sky gradient
    const skyGradient = defs
        .append("linearGradient")
        .attr("id", "sky-gradient")
        .attr("x1", "0%")
        .attr("x2", "0%")
        .attr("y1", "0%")
        .attr("y2", "100%");
    skyGradient.append("stop").attr("offset", "0%").attr("stop-color", "#87CEEB");
    skyGradient.append("stop").attr("offset", "100%").attr("stop-color", "#E0F4FF");

    // Road gradient
    const roadGradient = defs
        .append("linearGradient")
        .attr("id", "road-gradient")
        .attr("x1", "0%")
        .attr("x2", "0%")
        .attr("y1", "0%")
        .attr("y2", "100%");
    roadGradient.append("stop").attr("offset", "0%").attr("stop-color", "#4a4a4a");
    roadGradient.append("stop").attr("offset", "50%").attr("stop-color", "#3a3a3a");
    roadGradient.append("stop").attr("offset", "100%").attr("stop-color", "#2a2a2a");

    // Grass gradient
    const grassGradient = defs
        .append("linearGradient")
        .attr("id", "grass-gradient")
        .attr("x1", "0%")
        .attr("x2", "0%")
        .attr("y1", "0%")
        .attr("y2", "100%");
    grassGradient.append("stop").attr("offset", "0%").attr("stop-color", "#4ade80");
    grassGradient.append("stop").attr("offset", "100%").attr("stop-color", "#22c55e");

    // Drop shadow filter
    const filter = defs.append("filter")
        .attr("id", "drop-shadow")
        .attr("height", "130%");
    filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 3)
        .attr("result", "blur");
    filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 2)
        .attr("dy", 2)
        .attr("result", "offsetBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "offsetBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Sky background - extend to cover full SVG including left margin area
    svg.append("rect")
        .attr("class", "sky")
        .attr("x", -margin.left)
        .attr("y", -margin.top - 40)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom + 40)
        .attr("fill", "url(#sky-gradient)");

    // Road surface - extend to full width
    svg.append("rect")
        .attr("class", "road")
        .attr("x", -margin.left)
        .attr("y", roadY - 5)
        .attr("width", width + margin.left + margin.right)
        .attr("height", 50)
        .attr("fill", "url(#road-gradient)");

    // Road lane markings (dashed center line)
    const laneMarkingGroup = svg.append("g").attr("class", "lane-markings");
    for (let i = 0; i < width; i += 60) {
        laneMarkingGroup.append("rect")
            .attr("x", i)
            .attr("y", roadY + 20)
            .attr("width", 30)
            .attr("height", 4)
            .attr("fill", "#fbbf24")
            .attr("rx", 1);
    }

    // Road edge lines - extend to full width
    svg.append("line")
        .attr("x1", -margin.left).attr("y1", roadY)
        .attr("x2", width + margin.right).attr("y2", roadY)
        .attr("stroke", "#fff")
        .attr("stroke-width", 3);

    svg.append("line")
        .attr("x1", -margin.left).attr("y1", roadY + 45)
        .attr("x2", width + margin.right).attr("y2", roadY + 45)
        .attr("stroke", "#fff")
        .attr("stroke-width", 3);

    xBand = d3.scaleBand().range([0, width]).padding(0.5);
    yScale = d3.scaleLinear().range([roadY - signSize / 2 - 20, 60]);

    // y-axis group with label
    svg.append("g").attr("class", "y-axis").attr("transform", `translate(-30,0)`);

    svg.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -roadY / 2)
        .attr("y", -60)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "600")
        .attr("fill", "#374151")
        .text("Number of Collisions");

    // Car with wheels
    const carX = 80;
    const carGroup = svg.append("g")
        .attr("class", "car-group")
        .attr("transform", `translate(${carX}, ${roadY + 5})`);

    // Car shadow
    carGroup.append("ellipse")
        .attr("cx", carWidth / 2)
        .attr("cy", carHeight - 5)
        .attr("rx", carWidth / 2 + 5)
        .attr("ry", 6)
        .attr("fill", "rgba(0,0,0,0.2)");

    // Car body
    carGroup.append("path")
        .attr("class", "car")
        .attr("d", getCarPath(0, carHeight, carWidth, carHeight))
        .attr("id", "animated-car")
        .attr("fill", "#dc2626")
        .attr("filter", "url(#drop-shadow)");

    // Car windows
    carGroup.append("path")
        .attr("d", `M${carWidth * 0.28},${carHeight * 0.35} L${carWidth * 0.42},${carHeight * 0.08} L${carWidth * 0.72},${carHeight * 0.35} Z`)
        .attr("fill", "#93c5fd");

    // Wheels
    carGroup.append("circle")
        .attr("cx", carWidth * 0.2)
        .attr("cy", carHeight - 2)
        .attr("r", 8)
        .attr("fill", "#1f2937");
    carGroup.append("circle")
        .attr("cx", carWidth * 0.8)
        .attr("cy", carHeight - 2)
        .attr("r", 8)
        .attr("fill", "#1f2937");
    // Wheel hubcaps
    carGroup.append("circle")
        .attr("cx", carWidth * 0.2)
        .attr("cy", carHeight - 2)
        .attr("r", 4)
        .attr("fill", "#9ca3af");
    carGroup.append("circle")
        .attr("cx", carWidth * 0.8)
        .attr("cy", carHeight - 2)
        .attr("r", 4)
        .attr("fill", "#9ca3af");

    // Dashboard speedometer display
    const speedDisplayGroup = svg.append("g")
        .attr("id", "speed-display-group")
        .attr("transform", `translate(${width - 130}, 30)`);

    // Speedometer background (circular gauge style)
    speedDisplayGroup.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 55)
        .attr("fill", "#1e293b")
        .attr("stroke", "#475569")
        .attr("stroke-width", 4);

    speedDisplayGroup.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 48)
        .attr("fill", "none")
        .attr("stroke", "#334155")
        .attr("stroke-width", 2);

    // Speed arc background
    speedDisplayGroup.append("path")
        .attr("id", "speed-arc-bg")
        .attr("d", d3.arc()({
            innerRadius: 38,
            outerRadius: 45,
            startAngle: -Math.PI * 0.75,
            endAngle: Math.PI * 0.75
        }))
        .attr("fill", "#374151");

    // Speed arc (filled based on speed)
    speedDisplayGroup.append("path")
        .attr("id", "speed-arc")
        .attr("d", d3.arc()({
            innerRadius: 38,
            outerRadius: 45,
            startAngle: -Math.PI * 0.75,
            endAngle: -Math.PI * 0.75
        }))
        .attr("fill", "#22c55e");

    speedDisplayGroup.append("text")
        .attr("id", "speed-value")
        .attr("x", 0)
        .attr("y", 8)
        .attr("text-anchor", "middle")
        .attr("font-size", "28px")
        .attr("font-weight", "900")
        .attr("fill", "#22c55e")
        .text("0");

    speedDisplayGroup.append("text")
        .attr("id", "speed-unit")
        .attr("x", 0)
        .attr("y", 26)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("fill", "#94a3b8")
        .text("km/h");

    // Crash counter display
    const crashDisplay = svg.append("g")
        .attr("id", "crash-display-group")
        .attr("transform", `translate(${width - 130}, 120)`);

    crashDisplay.append("rect")
        .attr("x", -60)
        .attr("y", -20)
        .attr("width", 120)
        .attr("height", 50)
        .attr("rx", 8)
        .attr("fill", "#fef2f2")
        .attr("stroke", "#fecaca")
        .attr("stroke-width", 2);

    crashDisplay.append("text")
        .attr("x", 0)
        .attr("y", -2)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "600")
        .attr("fill", "#991b1b")
        .text("CRASHES AT THIS SPEED");

    crashDisplay.append("text")
        .attr("id", "crash-count")
        .attr("x", 0)
        .attr("y", 22)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "900")
        .attr("fill", "#dc2626")
        .text("0");

    // Speed control slider with better styling
    const container = d3.select("#car-speed-limit-crashes-vis-nathan");
    const sliderContainer = container.append("div")
        .attr("id", "speed-control-container")
        .style("margin-top", "24px")
        .style("padding", "20px 24px")
        .style("background", "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)")
        .style("border-radius", "16px")
        .style("border", "1px solid #cbd5e1")
        .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)");

    const sliderHeader = sliderContainer.append("div")
        .style("display", "flex")
        .style("justify-content", "space-between")
        .style("align-items", "center")
        .style("margin-bottom", "16px");

    sliderHeader.append("label")
        .attr("for", "speed-control-slider")
        .style("font-weight", "700")
        .style("font-size", "16px")
        .style("color", "#1e293b")
        .text("Drive Speed");

    const speedBadge = sliderHeader.append("div")
        .attr("id", "speed-badge")
        .style("padding", "6px 16px")
        .style("background", "#22c55e")
        .style("border-radius", "20px")
        .style("font-weight", "700")
        .style("font-size", "14px")
        .style("color", "#fff")
        .text("0 km/h");

    const slider = sliderContainer.append("input")
        .attr("type", "range")
        .attr("id", "speed-control-slider")
        .attr("min", 0)
        .attr("max", 120)
        .attr("value", 0)
        .attr("step", 5)
        .style("width", "100%")
        .style("height", "8px")
        .style("border-radius", "4px")
        .style("cursor", "pointer")
        .style("-webkit-appearance", "none")
        .style("background", "linear-gradient(to right, #22c55e 0%, #f59e0b 50%, #ef4444 100%)");

    // Speed zone legend
    const legendContainer = sliderContainer.append("div")
        .style("display", "flex")
        .style("justify-content", "space-between")
        .style("margin-top", "12px")
        .style("font-size", "12px");

    legendContainer.append("span").style("color", "#22c55e").style("font-weight", "600").text("Safe (0-50)");
    legendContainer.append("span").style("color", "#f59e0b").style("font-weight", "600").text("Caution (51-80)");
    legendContainer.append("span").style("color", "#ef4444").style("font-weight", "600").text("Danger (81+)");

    // Instruction text
    sliderContainer.append("p")
        .style("margin-top", "12px")
        .style("margin-bottom", "0")
        .style("font-size", "13px")
        .style("color", "#64748b")
        .style("text-align", "center")
        .html("Drag the slider to simulate driving. Speed limit signs show <strong>collision counts</strong> at that posted limit.");

    speedControlSlider = slider.node();

    slider.on("input", function() {
        currentSpeed = +this.value;
        updateSpeedDisplay(currentSpeed);
    });

    currentYear = defaultYear;
    updateVisualization(defaultYear);

    yearSel.on("change", function () {
        currentYear = +this.value;
        updateVisualization(currentYear);
    });
}

function updateSpeedDisplay(speed) {
    const zone = speed <= 50 ? speedZoneColors.low :
                 speed <= 80 ? speedZoneColors.medium :
                 speedZoneColors.high;

    // Update speedometer
    d3.select("#speed-value")
        .text(speed)
        .attr("fill", zone.bg);

    // Update speed arc
    const arcScale = d3.scaleLinear()
        .domain([0, 120])
        .range([-Math.PI * 0.75, Math.PI * 0.75]);

    d3.select("#speed-arc")
        .attr("d", d3.arc()({
            innerRadius: 38,
            outerRadius: 45,
            startAngle: -Math.PI * 0.75,
            endAngle: arcScale(speed)
        }))
        .attr("fill", zone.bg);

    // Update speed badge
    d3.select("#speed-badge")
        .text(`${speed} km/h`)
        .style("background", zone.bg);

    // Update crash count based on current speed limit data
    if (currentYear && cachedByYear[currentYear]) {
        const data = cachedByYear[currentYear];
        const speedLimitData = getSpeedLimitForSpeed(speed, data);
        if (speedLimitData) {
            d3.select("#crash-count")
                .text(d3.format(",")(speedLimitData.value));
        }
    }
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
    const spawnX = width + 100;
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
            // Slower spawn rate for better readability
            const speedFactor = currentSpeedForSpawning / 60;
            const baseSpawnInterval = 2500; // Much longer base interval
            const spawnInterval = Math.max(800, baseSpawnInterval / (1 + speedFactor * 1.5));

            if ((currentTime - lastSpawnTime) >= spawnInterval) {
                const speedLimitData = getSpeedLimitForSpeed(currentSpeedForSpawning, data);
                if (speedLimitData) {
                    spawnSign(svg, speedLimitData, spawnX);
                    lastSpawnTime = currentTime;
                }
            }
        }

        // Slower movement speed for better readability
        const moveSpeed = currentSpeed * 0.25; // Reduced from 0.5 to 0.25
        for (let i = activeSigns.length - 1; i >= 0; i--) {
            const sign = activeSigns[i];
            sign.x -= moveSpeed * (deltaTime / 16.67);

            if (sign.x < -150) {
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
    const safeY = Math.max(yScale(speedLimitData.value), 80);
    const signX = startX;
    const zone = getSpeedZone(speedLimitData.speed);

    const signGroup = svg.append("g")
        .attr("class", "speed-sign")
        .attr("transform", `translate(${signX}, 0)`);

    // Sign pole with gradient effect
    signGroup.append("rect")
        .attr("class", "sign-pole")
        .attr("x", -poleWidth / 2)
        .attr("width", poleWidth)
        .attr("fill", "#6b7280")
        .attr("y", safeY)
        .attr("height", roadY - safeY + 5)
        .attr("rx", 2);

    // Pole highlight
    signGroup.append("rect")
        .attr("x", -poleWidth / 2 + 1)
        .attr("width", 3)
        .attr("fill", "#9ca3af")
        .attr("y", safeY)
        .attr("height", roadY - safeY + 5)
        .attr("rx", 1);

    // Sign background with shadow
    signGroup.append("rect")
        .attr("class", "sign-shadow")
        .attr("width", signWidth + 4)
        .attr("height", signSize + 4)
        .attr("x", -signWidth / 2 - 2 + 3)
        .attr("y", safeY - signSize - 2 + 3)
        .attr("rx", 10)
        .attr("fill", "rgba(0,0,0,0.2)");

    // Sign white background
    signGroup.append("rect")
        .attr("class", "sign-bg")
        .attr("width", signWidth)
        .attr("height", signSize)
        .attr("x", -signWidth / 2)
        .attr("y", safeY - signSize)
        .attr("rx", 8)
        .attr("fill", "#fff")
        .attr("stroke", "#d1d5db")
        .attr("stroke-width", 2);

    // Red border circle/rounded rect (speed limit style)
    signGroup.append("rect")
        .attr("class", "sign-border")
        .attr("width", signWidth - 10)
        .attr("height", signSize - 10)
        .attr("x", -signWidth / 2 + 5)
        .attr("y", safeY - signSize + 5)
        .attr("rx", 6)
        .attr("fill", "none")
        .attr("stroke", "#dc2626")
        .attr("stroke-width", 4);

    // Format the speed text
    const speedText = formatSpeedLabel(speedLimitData.speed);
    const isLessThan40 = speedLimitData.speed.toLowerCase().includes('less than');

    if (isLessThan40) {
        // Two-line layout for "<40"
        signGroup.append("text")
            .attr("class", "sign-text")
            .attr("text-anchor", "middle")
            .attr("font-size", "28px")
            .attr("font-weight", "900")
            .attr("fill", "#111")
            .attr("x", 0)
            .attr("y", safeY - signSize / 2 + 8)
            .text(speedText);

        signGroup.append("text")
            .attr("class", "sign-unit")
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("font-weight", "600")
            .attr("fill", "#666")
            .attr("x", 0)
            .attr("y", safeY - signSize / 2 + 22)
            .text("km/h");
    } else {
        // Standard speed number
        signGroup.append("text")
            .attr("class", "sign-text")
            .attr("text-anchor", "middle")
            .attr("font-size", "32px")
            .attr("font-weight", "900")
            .attr("fill", "#111")
            .attr("x", 0)
            .attr("y", safeY - signSize / 2 + 8)
            .text(speedText);

        signGroup.append("text")
            .attr("class", "sign-unit")
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("font-weight", "600")
            .attr("fill", "#666")
            .attr("x", 0)
            .attr("y", safeY - signSize / 2 + 22)
            .text("km/h");
    }

    // Collision count badge below the sign
    const badgeY = safeY + 8;
    const badgeWidth = 90;
    const badgeHeight = 28;

    signGroup.append("rect")
        .attr("class", "crash-badge")
        .attr("x", -badgeWidth / 2)
        .attr("y", badgeY)
        .attr("width", badgeWidth)
        .attr("height", badgeHeight)
        .attr("rx", 14)
        .attr("fill", zone.bg)
        .attr("opacity", 0.95);

    signGroup.append("text")
        .attr("class", "crash-count-text")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "700")
        .attr("fill", "#fff")
        .attr("x", 0)
        .attr("y", badgeY + badgeHeight / 2 + 4)
        .text(d3.format(",")(speedLimitData.value));

    activeSigns.push({
        group: signGroup,
        x: signX,
        speedLimit: speedLimitData
    });
}

