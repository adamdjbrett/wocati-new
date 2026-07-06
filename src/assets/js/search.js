(function () {
  function openSearch() {
    var modal = document.querySelector("pagefind-modal");
    if (modal && typeof modal.open === "function") {
      modal.open();
      return;
    }

    var trigger = document.querySelector("pagefind-modal-trigger");
    if (trigger && typeof trigger.openModal === "function") {
      trigger.openModal();
    }
  }

  function closeSearch() {
    var modal = document.querySelector("pagefind-modal");
    if (modal && typeof modal.close === "function" && modal.isOpen) modal.close();
  }

  document.addEventListener("click", function (event) {
    var toggle = event.target.closest && event.target.closest(".search__toggle");
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openSearch();
      return;
    }
  }, true);

  document.addEventListener("keydown", function (event) {
    var key = String(event.key || "").toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === "k") {
      event.preventDefault();
      openSearch();
      return;
    }
    if (key === "escape") closeSearch();
  });

  document.addEventListener("wocati:navigation", function () {
    closeSearch();
  });
}());
