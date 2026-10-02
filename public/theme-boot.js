(function () {
  try {
    var t = localStorage.getItem("j2v-theme");
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
