/* Agent marquee on the landing page: drag to scroll with mouse or touch.
   Without this script the track runs on the CSS animation alone; with it,
   the script drives the same motion so a drag can continue from where the
   hand let go. Reduced motion: the CSS shows the list static, the script
   stays out. */
(function () {
  "use strict";
  var SPEED = 24; // px per second, roughly the CSS pace at the hero width
  var viewport = document.querySelector(".ktw-agents__viewport");
  var track = viewport && viewport.querySelector(".ktw-agents__track");
  if (!track) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var offset = 0, half = 0, hover = false, dragging = false, moved = false;
  var startX = 0, startOffset = 0, last = 0, pointerId = null;

  function measure() { half = track.scrollWidth / 2; }
  function wrap(x) { return half ? ((x % half) + half) % half - half : x; }
  function render() { track.style.transform = "translateX(" + offset + "px)"; }

  // Freeze the CSS animation at its current position, then take over.
  var computed = getComputedStyle(track).transform;
  if (computed && computed !== "none") {
    var m = computed.match(/matrix\(([^)]+)\)/);
    if (m) offset = parseFloat(m[1].split(",")[4]) || 0;
  }
  track.classList.add("ktw-agents__track--scripted");
  measure(); offset = wrap(offset); render();

  function frame(now) {
    var dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (!hover && !dragging && !document.hidden) {
      offset = wrap(offset - SPEED * dt);
      render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  viewport.addEventListener("mouseenter", function () { hover = true; });
  viewport.addEventListener("mouseleave", function () { hover = false; });

  // Capturing the pointer on pointerdown would steer the click away from
  // the logo under it, so the drag only starts once the pointer has moved.
  viewport.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging = true; moved = false; pointerId = e.pointerId;
    startX = e.clientX; startOffset = offset;
  });
  viewport.addEventListener("pointermove", function (e) {
    if (!dragging || e.pointerId !== pointerId) return;
    var dx = e.clientX - startX;
    if (!moved) {
      if (Math.abs(dx) <= 4) return;
      moved = true;
      viewport.setPointerCapture(pointerId);
      viewport.classList.add("ktw-agents__viewport--dragging");
    }
    offset = wrap(startOffset + dx);
    render();
  });
  function release(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false; pointerId = null;
    viewport.classList.remove("ktw-agents__viewport--dragging");
  }
  viewport.addEventListener("pointerup", release);
  viewport.addEventListener("pointercancel", release);
  // A drag is not a click on the logo under the pointer.
  viewport.addEventListener("click", function (e) {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
  }, true);
  viewport.addEventListener("dragstart", function (e) { e.preventDefault(); });
  window.addEventListener("resize", function () { measure(); offset = wrap(offset); render(); });
})();
