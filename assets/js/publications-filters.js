document.addEventListener("DOMContentLoaded", function () {
  var venueSelect = document.getElementById("pub-filter-venue");
  var yearSelect = document.getElementById("pub-filter-year");
  var topicSelect = document.getElementById("pub-filter-topic");
  var searchInput = document.getElementById("pub-search");
  var list = document.getElementById("publications-list");

  if (!list) {
    return;
  }

  var items = Array.prototype.slice.call(
    list.querySelectorAll(".publications__item")
  );

  // Pre-select topic filter from URL query params (for deep-linking from research areas page)
  var urlParams = new URLSearchParams(window.location.search);
  var topicParam = urlParams.get("topic");
  if (topicParam && topicSelect) {
    topicSelect.value = topicParam;
  }

  function matchesFilter(item, venue, year, topic, query) {
    var itemVenue = item.getAttribute("data-venue") || "";
    var itemVenueSeries = item.getAttribute("data-venue-series") || "";
    var itemYear = item.getAttribute("data-year") || "";
    var itemTopics = (item.getAttribute("data-topics") || "").split(",");

    if (venue) {
      if (venue.indexOf("series:") === 0) {
        var series = venue.substring(7);
        if (itemVenueSeries !== series) {
          return false;
        }
      } else {
        if (itemVenue !== venue) {
          return false;
        }
      }
    }

    if (year && itemYear !== year) {
      return false;
    }

    if (topic) {
      var hasTopic = itemTopics.some(function (t) {
        return t && t.trim() === topic;
      });
      if (!hasTopic) {
        return false;
      }
    }

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
    var selectedVenue = venueSelect ? venueSelect.value : "";
    var selectedYear = yearSelect ? yearSelect.value : "";
    var selectedTopic = topicSelect ? topicSelect.value : "";
    var searchQuery = searchInput ? searchInput.value.trim() : "";

    items.forEach(function (item) {
      if (matchesFilter(item, selectedVenue, selectedYear, selectedTopic, searchQuery)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  }

  if (venueSelect) venueSelect.addEventListener("change", applyFilters);
  if (yearSelect) yearSelect.addEventListener("change", applyFilters);
  if (topicSelect) topicSelect.addEventListener("change", applyFilters);
  if (searchInput) searchInput.addEventListener("input", applyFilters);

  // Apply filters on load (handles URL query param pre-selection)
  applyFilters();
});
