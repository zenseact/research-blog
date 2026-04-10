document.addEventListener("DOMContentLoaded", function () {
  var searchInput = document.getElementById("pub-search");
  var list = document.getElementById("publications-list");
  var countEl = document.getElementById("publications-count");

  if (!list) return;

  var items = Array.prototype.slice.call(
    list.querySelectorAll(".publications__item")
  );

  var topicCheckboxes = Array.prototype.slice.call(
    document.querySelectorAll(".pub-filter-topic")
  );
  var yearCheckboxes = Array.prototype.slice.call(
    document.querySelectorAll(".pub-filter-year")
  );
  var venueCheckboxes = Array.prototype.slice.call(
    document.querySelectorAll(".pub-filter-venue")
  );

  // Pre-select topic filter from URL query params (for deep-linking from research areas page)
  var urlParams = new URLSearchParams(window.location.search);
  var topicParam = urlParams.get("topic");
  if (topicParam) {
    topicCheckboxes.forEach(function (cb) {
      if (cb.value === topicParam) cb.checked = true;
    });
  }

  function getCheckedValues(checkboxes) {
    return checkboxes
      .filter(function (cb) { return cb.checked; })
      .map(function (cb) { return cb.value; });
  }

  function matchesFilter(item, venues, years, topics, query) {
    // Venue filter: match if any checked venue matches (OR logic)
    if (venues.length > 0) {
      var itemVenue = item.getAttribute("data-venue") || "";
      var itemVenueSeries = item.getAttribute("data-venue-series") || "";
      var venueMatch = venues.some(function (v) {
        if (v.indexOf("series:") === 0) {
          return itemVenueSeries === v.substring(7);
        }
        return itemVenue === v;
      });
      if (!venueMatch) return false;
    }

    // Year filter: match if any checked year matches (OR logic)
    if (years.length > 0) {
      var itemYear = item.getAttribute("data-year") || "";
      if (years.indexOf(itemYear) === -1) return false;
    }

    // Topic filter: match if any checked topic matches (OR logic)
    if (topics.length > 0) {
      var itemTopics = (item.getAttribute("data-topics") || "").split(",").map(function (t) {
        return t.trim();
      });
      var topicMatch = topics.some(function (t) {
        return itemTopics.indexOf(t) !== -1;
      });
      if (!topicMatch) return false;
    }

    // Search query
    if (query) {
      var itemTitle = item.getAttribute("data-title") || "";
      var itemAuthors = item.getAttribute("data-authors") || "";
      var q = query.toLowerCase();
      if (itemTitle.indexOf(q) === -1 && itemAuthors.indexOf(q) === -1) {
        return false;
      }
    }

    return true;
  }

  function applyFilters() {
    var selectedVenues = getCheckedValues(venueCheckboxes);
    var selectedYears = getCheckedValues(yearCheckboxes);
    var selectedTopics = getCheckedValues(topicCheckboxes);
    var searchQuery = searchInput ? searchInput.value.trim() : "";

    var visibleCount = 0;
    items.forEach(function (item) {
      if (matchesFilter(item, selectedVenues, selectedYears, selectedTopics, searchQuery)) {
        item.style.display = "";
        visibleCount++;
      } else {
        item.style.display = "none";
      }
    });

    if (countEl) {
      countEl.textContent = visibleCount + " of " + items.length + " publications";
    }
  }

  topicCheckboxes.forEach(function (cb) { cb.addEventListener("change", applyFilters); });
  yearCheckboxes.forEach(function (cb) { cb.addEventListener("change", applyFilters); });
  venueCheckboxes.forEach(function (cb) { cb.addEventListener("change", applyFilters); });
  if (searchInput) searchInput.addEventListener("input", applyFilters);

  // Apply filters on load (handles URL query param pre-selection)
  applyFilters();
});
