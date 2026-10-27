/**
 * Main rendering function for National Trends Multi-line Chart (G1).
 * @param {Array<Object>} data - Cleaned road safety data containing year, group, hospitalisations.
 */
function renderNationalTrendsChart(data) {

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 1: RESPONSIVE CONTAINER & VIEWPORT DIMENSIONS
  // Calculates dynamic dimensions based on client bounding box while setting minimum bounds.
  // ------------------------------------------------------------------------------------------------
  const containerNode = d3.select("#chart-container").node();
  containerNode.style.overflowX = "auto"; 
  
  const containerW = containerNode.getBoundingClientRect().width || 900;
  const svgWidth = Math.max(containerW, 980); 
  
  // margin.top is elevated to 115px so the right-hand COLOR LEGEND box sits safely
  // in the upper canvas padding area without overlapping the 2021 Car Occupants line.
  const margin = { top: 115, right: 240, bottom: 105, left: 130 };
  const width = svgWidth - margin.left - margin.right;
  const height = 600 - margin.top - margin.bottom;

  // Clear previous SVG and filter pills on redraw (prevents element duplication during resize)
  d3.select("#chart-container").html(""); 
  d3.select("#filter-container").html("");

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 2: ACCESSIBLE SVG CANVAS INITIALISATION
  // SPECIAL INDEX EXPLANATION:
  // - tabindex="0": Normal HTML <div> and SVG elements cannot receive keyboard focus by default.
  //   Setting tabindex="0" inserts the graphic into the browser's sequential tab navigation order,
  //   allowing keyboard-only users to navigate into the visualization and use Arrow keys.
  // - aria-label: Provides auditory context for screen readers when the graphic gains focus.
  // ------------------------------------------------------------------------------------------------
  const svgParent = d3.select("#chart-container")
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", height + margin.top + margin.bottom)
    .attr("tabindex", "0") 
    .attr("aria-label", "Interactive line chart of road hospitalisations. Use Left and Right arrow keys to explore.")
    .style("border-radius", "12px");

  svgParent.style("overflow", "visible");

  // SVG group container offset by top/left margins (D3 Margins Convention)
  const svg = svgParent.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 3: DATA STRUCTURING & GROUPING
  // Uses d3.group (internally implemented via ES6 Map) to partition records by road user group.
  // ------------------------------------------------------------------------------------------------
  const nested = d3.group(data, d => d.road_user_group);
  const groups = Array.from(nested.keys());

  // Aggregate 10-year totals for dynamic KPI computation
  const groupTotals = groups.map(g => {
    return { group: g, total: d3.sum(nested.get(g), d => d.hospitalisations) };
  });

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 4: SCALES & AXES
  // SPECIAL INDEX EXPLANATION:
  // - d3.scaleLinear().domain([min, max]).range([0, width]): Maps data domain to pixel coordinates.
  // - .nice(): Extends scale domain to the nearest round, human-friendly numbers (e.g., 20,000).
  // - d3.format("d"): Formats integers without floating point decimals (for Calendar Year).
  // - d3.format(","): Formats large numbers with thousands separators (e.g., 18,539).
  // ------------------------------------------------------------------------------------------------
  const x = d3.scaleLinear().domain([2011, 2021]).range([0, width]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.hospitalisations)]).nice().range([height, 0]);

  // Bottom Horizontal Axis (Calendar Year)
  svg.append("g")
     .attr("transform", `translate(0,${height})`)
     .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format("d")).tickPadding(12).tickSizeOuter(0))
     .attr("font-size", "1rem")
     .style("font-family", "var(--font-sans, sans-serif)");

  svg.append("text")
     .attr("x", width / 2).attr("y", height + margin.bottom - 35).attr("text-anchor", "middle")
     .style("font-size", "1.15rem").style("font-weight", "700").style("fill", "#5E5A66")
     .text("Calendar Year");

  // Left Vertical Axis (Total Hospitalisations)
  svg.append("g")
     .call(d3.axisLeft(y).tickFormat(d3.format(",")).tickPadding(10).tickSizeOuter(0))
     .attr("font-size", "1rem")
     .style("font-family", "var(--font-sans, sans-serif)");

  svg.append("text")
     .attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -margin.left + 35).attr("text-anchor", "middle")
     .style("font-size", "1.15rem").style("font-weight", "700").style("fill", "#5E5A66")
     .text("Total Hospitalisations");

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 5: COLOR LEGEND BOX (TOP-RIGHT MARGIN)
  // Explains the dynamic 3-color semantic encoding (Highest, Lowest, and Active baseline).
  // ------------------------------------------------------------------------------------------------
  const legendData = [
    { label: "Highest Volume", color: "#D55E00" },
    { label: "Other Active Groups", color: "#222222" },
    { label: "Lowest Volume", color: "#009E73" }
  ];

  const legendGroup = svg.append("g")
    .attr("class", "chart-color-legend")
    .attr("transform", `translate(${width + 10}, ${-margin.top + 5})`);

  legendGroup.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", margin.right - 20)
    .attr("height", 86)
    .attr("rx", 10)
    .style("fill", "rgba(255, 255, 255, 0.94)")
    .style("stroke", "#C3B1E0")
    .style("stroke-width", 1.5);

  legendGroup.append("text")
    .attr("x", 12)
    .attr("y", 18)
    .style("font-size", "0.75rem")
    .style("font-weight", "800")
    .style("letter-spacing", "0.08em")
    .style("fill", "#5B4182")
    .text("COLOR LEGEND");

  legendData.forEach((item, idx) => {
    const rowY = 37 + idx * 20;
    legendGroup.append("circle")
      .attr("cx", 18)
      .attr("cy", rowY - 4)
      .attr("r", 5.5)
      .style("fill", item.color);

    legendGroup.append("text")
      .attr("x", 30)
      .attr("y", rowY)
      .style("font-size", "0.85rem")
      .style("font-weight", "600")
      .style("fill", "#2A2730")
      .text(item.label);
  });

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 6: PATH GENERATOR & SVG TEXT WRAPPING
  // SPECIAL INDEX EXPLANATION:
  // - d3.line(): Generator function mapping discrete (x, y) coordinates into an SVG 'd' path string.
  // - getComputedTextLength(): Native browser SVG DOM method that calculates rendered pixel width 
  //   of SVG text strings. Used here to break multi-word labels into multi-line <tspan> elements.
  // ------------------------------------------------------------------------------------------------
  const line = d3.line().x(d => x(d.year)).y(d => y(d.hospitalisations));
  const paths = {};
  
  function wrapText(text, maxWidth) {
    text.each(function() {
      const textElement = d3.select(this);
      const words = textElement.text().split(/\s+/).reverse();
      let word, lineArr = [], lineNumber = 0, lineHeight = 1.2; 
      const xPos = textElement.attr("x"), yPos = textElement.attr("y"), dy = parseFloat(textElement.attr("dy") || 0);
      let tspan = textElement.text(null).append("tspan").attr("x", xPos).attr("y", yPos).attr("dy", dy + "em");
      
      while (word = words.pop()) {
        lineArr.push(word);
        tspan.text(lineArr.join(" "));
        if (tspan.node().getComputedTextLength() > maxWidth) {
          lineArr.pop();
          tspan.text(lineArr.join(" "));
          lineArr = [word];
          tspan = textElement.append("tspan").attr("x", xPos).attr("y", yPos).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        }
      }
    });
  }

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 7: LABEL ANTI-COLLISION ENGINE
  // Prevents overlapping text when lines converge at the final 2021 data point (e.g. Other & Bus).
  // ------------------------------------------------------------------------------------------------
  let labelData = groups.map(g => {
    return { group: g, y: y(nested.get(g).find(d => d.year === 2021).hospitalisations) };
  });
  
  labelData.sort((a, b) => a.y - b.y); 
  for (let i = 1; i < labelData.length; i++) {
    if (labelData[i].y - labelData[i - 1].y < 32) labelData[i].y = labelData[i - 1].y + 32; // Push downwards
  }
  for (let i = labelData.length - 1; i >= 0; i--) {
    if (labelData[i].y > height) labelData[i].y = height - 4; // Constrain to bottom border
    if (i < labelData.length - 1 && labelData[i + 1].y - labelData[i].y < 32) labelData[i].y = labelData[i + 1].y - 32; // Push upwards
  }

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 8: RENDERING PATHS AND LABELS
  // ------------------------------------------------------------------------------------------------
  groups.forEach(group => {
    const safeClass = group.replace(/\s+/g, '');

    // Draw continuous SVG stroke line
    paths[group] = svg.append("path")
      .datum(nested.get(group))
      .attr("fill", "none")
      .attr("stroke-width", 4)
      .attr("d", line);
      
    const finalY = labelData.find(d => d.group === group).y;

    // Direct label placed at the terminal end of each series line (avoiding external legend lookup)
    svg.append("text")
       .attr("class", `label-${safeClass}`)
       .attr("x", width + 10)
       .attr("y", finalY)
       .attr("dy", "0.35em")
       .style("font-weight", "700")
       .style("font-size", "1rem")
       .text(group)
       .call(wrapText, margin.right - 20); 
  });

  // Pass canvas context object to interaction logic module
  const chartContext = { svgParent, svg, width, height, x, y, nested, groups, groupTotals, paths };
  if (typeof setupInteractivity === "function") setupInteractivity(chartContext);
}
