(function () {
  if (!history.replaceState || !location.pathname.endsWith("/index.html")) return;

  history.replaceState(
    history.state,
    "",
    location.pathname.slice(0, -10) + location.search + location.hash
  );
}());
