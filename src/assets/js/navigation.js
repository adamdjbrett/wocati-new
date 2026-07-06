(function () {
  if (!window.fetch || !window.DOMParser || !history.pushState) return;

  var selectors = [
    "title",
    "meta[name='description']",
    "meta[property^='og:']",
    "meta[name^='twitter:']",
    "link[rel='canonical']",
    "link[rel='describedby']",
    "link[rel='cite-as']",
    "link[rel='author']",
    "meta[property^='dc:']",
    "meta[name^='citation_']"
  ];

  function prettyUrl(url) {
    url.pathname = url.pathname.replace(/\/index\.html$/i, "/");
    return url;
  }

  function shouldHandleLink(link, event) {
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target || link.download || link.hasAttribute("data-no-transition")) return false;
    var url = prettyUrl(new URL(link.href, location.href));
    if (url.origin !== location.origin) return false;
    if (url.hash && url.pathname === location.pathname && url.search === location.search) return false;
    if (!/\/$|\.html$/i.test(url.pathname)) return false;
    link.href = url.href;
    return true;
  }

  function replaceHead(nextDoc) {
    selectors.forEach(function (selector) {
      document.head.querySelectorAll(selector).forEach(function (node) {
        if (selector === "title") return;
        node.remove();
      });
      nextDoc.head.querySelectorAll(selector).forEach(function (node) {
        if (selector === "title") {
          document.title = node.textContent;
        } else {
          document.head.appendChild(node.cloneNode(true));
        }
      });
    });
  }

  function runPageScripts(container) {
    container.querySelectorAll("script").forEach(function (oldScript) {
      var script = document.createElement("script");
      Array.from(oldScript.attributes).forEach(function (attr) {
        script.setAttribute(attr.name, attr.value);
      });
      script.textContent = oldScript.textContent;
      oldScript.replaceWith(script);
    });
  }

  function swapPage(nextDoc, url, push) {
    var current = document.querySelector(".initial-content");
    var next = nextDoc.querySelector(".initial-content");
    if (!current || !next) {
      location.href = url.href;
      return;
    }
    replaceHead(nextDoc);
    document.body.className = nextDoc.body.className;
    current.replaceWith(next);
    runPageScripts(next);
    if (push) history.pushState({ enhanced: true }, "", url.pathname + url.search + url.hash);
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent("wocati:navigation", { detail: { url: url.href } }));
  }

  function loadPage(url, push) {
    document.documentElement.classList.add("is-navigating");
    return fetch(url.href, { credentials: "same-origin", headers: { "X-Requested-With": "fetch" } })
      .then(function (response) {
        if (!response.ok || !/text\/html/i.test(response.headers.get("content-type") || "")) throw new Error("Not an HTML page");
        return response.text();
      })
      .then(function (html) {
        var nextDoc = new DOMParser().parseFromString(html, "text/html");
        swapPage(nextDoc, url, push);
      })
      .catch(function () {
        location.href = url.href;
      })
      .finally(function () {
        document.documentElement.classList.remove("is-navigating");
      });
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (!shouldHandleLink(link, event)) return;
    event.preventDefault();
    loadPage(prettyUrl(new URL(link.href)), true);
  });

  window.addEventListener("popstate", function () {
    loadPage(prettyUrl(new URL(location.href)), false);
  });
}());
