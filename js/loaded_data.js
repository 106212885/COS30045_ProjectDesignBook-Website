/* ==========================================================================
  Loads the CSV, formats the data, and handles responsive redrawing.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  d3.csv("data/(G1) national_by_year_roaduser_group.csv").then(data => {
    
    // 1. Data Cleaning: Convert strings to integers for accurate math
    data.forEach(d => {
      d.year = parseInt(d["Calendar year"], 10);
      d.hospitalisations = parseInt(d.hospitalisations, 10);
    });

    // 2. State Storage: Save globally so the resize event can reuse it
    window.roadSafetyData = data;
    
    // Initial chart render
    if (typeof renderNationalTrendsChart === "function") {
      renderNationalTrendsChart(window.roadSafetyData);
    }

    // 3. Responsive Resize: Debounced listener to redraw chart on window resize
    // (setTimeout prevents the chart from lagging by only redrawing when resizing stops)
    let resizeTimer;
    window.addEventListener('resize', () => {
       clearTimeout(resizeTimer);
       resizeTimer = setTimeout(() => {
           renderNationalTrendsChart(window.roadSafetyData);
       }, 200);
    });

  }).catch(error => console.error("Error loading the dataset:", error));
});