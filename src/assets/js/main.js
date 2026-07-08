(function () {
  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function outerWidth(element) {
    if (!element) return 0;
    var style = window.getComputedStyle(element);
    return element.getBoundingClientRect().width +
      parseFloat(style.marginLeft || 0) +
      parseFloat(style.marginRight || 0);
  }

  function initGreedyNav() {
    var nav = document.querySelector("nav.greedy-nav");
    if (!nav) return;

    var button = nav.querySelector(".greedy-nav__toggle");
    var visibleLinks = nav.querySelector(".visible-links");
    var hiddenLinks = nav.querySelector(".hidden-links");
    var logo = nav.querySelector(".site-logo");
    var logoImg = nav.querySelector(".site-logo img");
    var title = nav.querySelector(".site-title");
    var search = nav.querySelector("button.search__toggle");
    if (!button || !visibleLinks || !hiddenLinks) return;

    var totalItems = 0;
    var breakWidths = [];
    var closingTimer;

    function measureLinks() {
      totalItems = 0;
      breakWidths = [];
      var totalSpace = 0;
      var items = Array.prototype.slice.call(visibleLinks.children)
        .concat(Array.prototype.slice.call(hiddenLinks.children));

      items.forEach(function (item) {
        var clone = item.cloneNode(true);
        clone.style.visibility = "hidden";
        visibleLinks.appendChild(clone);
        totalSpace += outerWidth(clone);
        totalItems += 1;
        breakWidths.push(totalSpace);
        clone.remove();
      });
    }

    function closeHiddenLinks() {
      hiddenLinks.classList.add("hidden");
      button.classList.remove("close");
    }

    function check() {
      if (!breakWidths.length) measureLinks();

      var visibleCount = visibleLinks.children.length;
      var available = nav.clientWidth -
        outerWidth(logo) -
        outerWidth(title) -
        outerWidth(search) -
        (visibleCount !== breakWidths.length ? outerWidth(button) : 0);
      var required = breakWidths[visibleCount - 1] || 0;

      if (required > available && visibleLinks.lastElementChild) {
        hiddenLinks.prepend(visibleLinks.lastElementChild);
        check();
        return;
      }

      var nextRequired = breakWidths[visibleCount] || 0;
      var toggleWidth = visibleCount === breakWidths.length - 1 ? outerWidth(button) : 0;
      if (hiddenLinks.firstElementChild && available + toggleWidth > nextRequired) {
        visibleLinks.appendChild(hiddenLinks.firstElementChild);
        check();
        return;
      }

      button.setAttribute("count", String(totalItems - visibleLinks.children.length));
      button.classList.toggle("hidden", visibleLinks.children.length === totalItems);
      if (button.classList.contains("hidden")) closeHiddenLinks();
    }

    button.addEventListener("click", function () {
      hiddenLinks.classList.toggle("hidden");
      button.classList.toggle("close");
      clearTimeout(closingTimer);
    });

    hiddenLinks.addEventListener("click", closeHiddenLinks);
    hiddenLinks.addEventListener("mouseleave", function () {
      closingTimer = setTimeout(closeHiddenLinks, 1000);
    });
    hiddenLinks.addEventListener("mouseenter", function () {
      clearTimeout(closingTimer);
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        measureLinks();
        check();
      }, 100);
    });

    if (logoImg && !(logoImg.complete || logoImg.naturalWidth !== 0)) {
      logoImg.addEventListener("load", check, { once: true });
      logoImg.addEventListener("error", check, { once: true });
    } else {
      check();
    }
  }

  function initAuthorMenu() {
    document.querySelectorAll(".author__urls-wrapper button").forEach(function (button) {
      button.addEventListener("click", function () {
        document.querySelectorAll(".author__urls").forEach(function (urls) {
          urls.classList.toggle("is--visible");
        });
        button.classList.toggle("open");
      });
    });
  }

  function initSmoothScroll() {
    var reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a[href*='#']");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (link.hostname !== window.location.hostname || link.pathname !== window.location.pathname) return;

      var hash = link.hash;
      if (!hash) return;
      var target = hash === "#" || hash === "#top" ?
        document.documentElement :
        document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (history.pushState) history.pushState(null, "", hash === "#" ? "#top" : hash);
    });
  }

  function initTocSpy() {
    var toc = document.querySelector("nav.toc");
    if (!toc || !("IntersectionObserver" in window)) return;

    var links = Array.prototype.slice.call(toc.querySelectorAll("a[href^='#']"));
    var entriesById = {};
    links.forEach(function (link) {
      var id = decodeURIComponent(link.hash.slice(1));
      var target = document.getElementById(id);
      if (target) entriesById[id] = { link: link, target: target };
    });

    var ids = Object.keys(entriesById);
    if (!ids.length) return;

    function setActive(id) {
      links.forEach(function (link) {
        var active = decodeURIComponent(link.hash.slice(1)) === id;
        link.classList.toggle("active", active);
        if (link.parentElement) link.parentElement.classList.toggle("active", active);
      });

      var activeLink = entriesById[id].link;
      var sidebar = document.querySelector("aside.sidebar__right.sticky");
      if (sidebar && window.getComputedStyle(sidebar).position === "sticky") {
        var scrollTarget = activeLink.parentElement &&
          activeLink.parentElement.classList.contains("toc__menu") &&
          activeLink === activeLink.parentElement.firstElementChild ?
          toc.querySelector("header") :
          activeLink;
        if (scrollTarget) scrollTarget.scrollIntoView({ behavior: "auto", block: "nearest", inline: "start" });
      }
    }

    var observer = new IntersectionObserver(function (entries) {
      var visible = entries
        .filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; })[0];
      if (visible && visible.target.id) setActive(visible.target.id);
    }, { rootMargin: "-20px 0px -70% 0px", threshold: 0 });

    ids.forEach(function (id) {
      observer.observe(entriesById[id].target);
    });
  }

  function initImageLinks() {
    document
      .querySelectorAll("a[href$='.jpg'],a[href$='.jpeg'],a[href$='.JPG'],a[href$='.png'],a[href$='.gif'],a[href$='.webp']")
      .forEach(function (link) {
        if (link.querySelector("img")) link.classList.add("image-link");
      });
  }

  function initHeadingAnchors() {
    var pageContent = document.querySelector(".page__content");
    if (!pageContent) return;

    pageContent.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(function (heading) {
      var id = heading.getAttribute("id");
      if (!id || heading.querySelector(".header-link")) return;

      var anchor = document.createElement("a");
      anchor.className = "header-link";
      anchor.href = "#" + id;
      anchor.innerHTML = '<span class="sr-only">Permalink</span><i class="fas fa-link"></i>';
      anchor.title = "Permalink";
      heading.appendChild(anchor);
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        console.error("Failed to copy text to clipboard: " + text);
      });
      return true;
    }

    var textarea = document.createElement("textarea");
    textarea.className = "clipboard-helper";
    textarea.style.left = "-9999px";
    textarea.style.top = (window.pageYOffset || document.documentElement.scrollTop) + "px";
    textarea.setAttribute("readonly", "");
    textarea.value = text;
    document.body.appendChild(textarea);

    var success = true;
    try {
      textarea.select();
      success = document.execCommand("copy");
    } catch (error) {
      success = false;
    }
    textarea.remove();
    return success;
  }

  function initCopyButtons() {
    if (!window.enable_copy_code_button) return;

    document.querySelectorAll(".page__content pre.highlight > code").forEach(function (code) {
      var container = code.parentElement;
      if (!container || container.firstElementChild.tagName.toLowerCase() !== "code") return;

      var button = document.createElement("button");
      button.title = "Copy to clipboard";
      button.className = "clipboard-copy-button";
      button.innerHTML = '<span class="sr-only">Copy code</span><i class="far fa-fw fa-copy"></i><i class="fas fa-fw fa-check copied"></i>';
      button.addEventListener("click", function () {
        var codeBlock = button.nextElementSibling;
        while (codeBlock && codeBlock.tagName.toLowerCase() !== "code") {
          codeBlock = codeBlock.nextElementSibling;
        }
        if (!codeBlock) return;

        var realCodeBlock = codeBlock.querySelector("td.code, td.rouge-code");
        if (realCodeBlock) codeBlock = realCodeBlock;

        if (copyText(codeBlock.innerText)) {
          button.focus();
          clearTimeout(button.copyTimer);
          button.classList.add("copied");
          button.copyTimer = setTimeout(function () {
            button.classList.remove("copied");
            button.copyTimer = null;
          }, 1500);
        }
      });
      container.prepend(button);
    });
  }

  ready(function () {
    initGreedyNav();
    initAuthorMenu();
    initSmoothScroll();
    initTocSpy();
    initImageLinks();
    initHeadingAnchors();
    initCopyButtons();
  });
}());
