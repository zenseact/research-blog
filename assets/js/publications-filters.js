document.addEventListener("DOMContentLoaded", function () {
  var venueSelect = document.getElementById("pub-filter-venue");
  var yearSelect = document.getElementById("pub-filter-year");
  var topicSelect = document.getElementById("pub-filter-topic");
  var list = document.getElementById("publications-list");

  if (!list || !venueSelect || !yearSelect || !topicSelect) {
    return;
  }

  var items = Array.prototype.slice.call(
    list.querySelectorAll(".publications__item")
  );

  function matchesFilter(item, venue, year, topic) {
    var itemVenue = item.getAttribute("data-venue") || "";
    var itemYear = item.getAttribute("data-year") || "";
    var itemTopics = (item.getAttribute("data-topics") || "").split(",");

    if (venue && itemVenue !== venue) {
      return false;
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

    return true;
  }

  function applyFilters() {
    var selectedVenue = venueSelect.value;
    var selectedYear = yearSelect.value;
    var selectedTopic = topicSelect.value;

    items.forEach(function (item) {
      if (matchesFilter(item, selectedVenue, selectedYear, selectedTopic)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  }

  venueSelect.addEventListener("change", applyFilters);
  yearSelect.addEventListener("change", applyFilters);
  topicSelect.addEventListener("change", applyFilters);
});


