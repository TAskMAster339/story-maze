(() => {
  const loadingScreen = document.getElementById("loadingScreen");
  const progressBar = document.getElementById("loadingProgressBar");
  const brightnessSlider = document.getElementById("brightnessSlider");
  const LOADING_DURATION_MS = 5000;
  const BRIGHTNESS_KEY = "maze-brightness";

  if (!loadingScreen || !progressBar) return;

  const savedBrightness = Number.parseFloat(localStorage.getItem(BRIGHTNESS_KEY));
  if (Number.isFinite(savedBrightness) && brightnessSlider) {
    brightnessSlider.value = String(Math.max(0.5, Math.min(1.5, savedBrightness)));
  }

  const applyBrightness = () => {
    const value = Number.parseFloat(brightnessSlider?.value || "1");
    const brightness = Number.isFinite(value) ? value : 1;
    document.documentElement.style.setProperty("--game-brightness", String(brightness));
    try {
      localStorage.setItem(BRIGHTNESS_KEY, String(brightness));
    } catch {
      // Settings remain available for the current session if storage is blocked.
    }
  };
  brightnessSlider?.addEventListener("input", applyBrightness);
  applyBrightness();

  const startedAt = performance.now();
  const updateLoading = (now) => {
    const progress = Math.max(0, Math.min(1, (now - startedAt) / LOADING_DURATION_MS));
    progressBar.style.width = `${progress * 100}%`;
    if (progress < 1) {
      requestAnimationFrame(updateLoading);
      return;
    }
    loadingScreen.setAttribute("aria-hidden", "true");
    loadingScreen.style.display = "none";
    window.refreshStartOverlay?.();
  };
  requestAnimationFrame(updateLoading);
})();
