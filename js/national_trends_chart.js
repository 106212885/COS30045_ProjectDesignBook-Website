/* ==========================================================================
   Builds the SVG, axes, lines, and handles text layout.
   ========================================================================== */

function renderNationalTrendsChart(data) {
  // 1. Container Setup: Determine width dynamically
  const containerNode = d3.select("#chart-container").node();
  containerNode.style.overflowX = "auto"; 
  
  const containerW = containerNode.getBoundingClientRect().width || 900;
  const svgWidth = Math.max(containerW, 950); 
  
  const margin = { top: 50, right: 240, bottom: 120, left: 140 };
  const width = svgWidth - margin.left - margin.right;
  const height = 550 - margin.top - margin.bottom;

  // Clear previous chart on redraw
  d3.select("#chart-container").html(""); 
  d3.select("#filter-container").html("");

  // 2. SVG Creation: Set up accessible canvas
  const svgParent = d3.select("#chart-container")
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", height + margin.top + margin.bottom)
    .attr("tabindex", "0") // Makes graph focusable for keyboard navigation
    .attr("aria-label", "Interactive line chart of road hospitalisations. Use Left and Right arrow keys to explore.")
    .style("border-radius", "12px");

  svgParent.style("overflow", "visible");

  const svg = svgParent.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Group data by road user for multi-line plotting
  const nested = d3.group(data, d => d.road_user_group);
  const groups = Array.from(nested.keys());

  const groupTotals = groups.map(g => {
    return { group: g, total: d3.sum(nested.get(g), d => d.hospitalisations) };
  });

  // 3. Scales & Axes: Map data to pixel coordinates
  const x = d3.scaleLinear().domain([2011, 2021]).range([0, width]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.hospitalisations)]).nice().range([height, 0]);

  // X-Axis
  svg.append("g")
     .attr("transform", `translate(0,${height})`)
     .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format("d")).tickPadding(12).tickSizeOuter(0))
     .attr("font-size", "1rem").attr("font-family", "Inter, sans-serif");

  svg.append("text")
     .attr("x", width / 2).attr("y", height + margin.bottom - 40).attr("text-anchor", "middle")
     .style("font-size", "1.15rem").style("font-weight", "700").style("fill", "#5E5A66")
     .text("Calendar Year");

  // Y-Axis
  svg.append("g")
     .call(d3.axisLeft(y).tickFormat(d3.format(",")).tickPadding(10).tickSizeOuter(0))
     .attr("font-size", "1rem").attr("font-family", "Inter, sans-serif");

  svg.append("text")
     .attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -margin.left + 35).attr("text-anchor", "middle")
     .style("font-size", "1.15rem").style("font-weight", "700").style("fill", "#5E5A66")
     .text("Total Hospitalisations");

  // 4. Line Generator
  const line = d3.line().x(d => x(d.year)).y(d => y(d.hospitalisations));
  const paths = {};
  
  // 5. Text Wrapping Logic: Splits long labels into multiple lines based on available width
  function wrapText(text, width) {
    text.each(function() {
      const textElement = d3.select(this);
      const words = textElement.text().split(/\s+/).reverse();
      let word, line = [], lineNumber = 0, lineHeight = 1.2; 
      const x = textElement.attr("x"), y = textElement.attr("y"), dy = parseFloat(textElement.attr("dy") || 0);
      let tspan = textElement.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
      
      while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = textElement.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        }
      }
    });
  }

  // 6. Anti-Collision Logic: Prevents line labels from overlapping each other
  let labelData = groups.map(g => {
    return { group: g, y: y(nested.get(g).find(d => d.year === 2021).hospitalisations) };
  });
  
  labelData.sort((a, b) => a.y - b.y); 
  for (let i = 1; i < labelData.length; i++) {
    if (labelData[i].y - labelData[i-1].y < 35) labelData[i].y = labelData[i-1].y + 35; // Push down
  }
  for (let i = labelData.length - 1; i >= 0; i--) {
    if (labelData[i].y > height) labelData[i].y = height - 5; // Keep inside bottom bound
    if (i < labelData.length - 1 && labelData[i+1].y - labelData[i].y < 35) labelData[i].y = labelData[i+1].y - 35; // Push up
  }

  // Draw lines and append labels
  groups.forEach(group => {
    paths[group] = svg.append("path")
      .datum(nested.get(group))
      .attr("fill", "none")
      .attr("stroke-width", 4)
      .attr("d", line);
      
    const finalY = labelData.find(d => d.group === group).y;
    svg.append("text")
       .attr("class", `label-${group.replace(/\s+/g, '')}`)
       .attr("x", width + 10).attr("y", finalY).attr("dy", "0.35em")
       .style("font-weight", "700").style("font-size", "1rem")
       .text(group)
       .call(wrapText, margin.right - 20); 
  });

  // Pass chart elements to the interactivity script
  const chartContext = { svgParent, svg, width, height, x, y, nested, groups, groupTotals, paths };
  if (typeof setupInteractivity === "function") setupInteractivity(chartContext);
}