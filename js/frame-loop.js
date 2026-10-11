// One frame owner, with a single failure notification and no runaway retries.
export function createFrameLoop(render, { onFailure = () => {},
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id) } = {}) {
  let started = false, stopped = false, pending = null;
  function stop() {
    if (stopped) return;
    stopped = true;
    if (pending !== null) cancelFrame(pending);
    pending = null;
  }
  function fail() {
    if (stopped) return;
    stop();
    onFailure();
  }
  function frame(time) {
    pending = null;
    if (stopped) return;
    try {
      render(time);
      if (!stopped) pending = requestFrame(frame);
    } catch { fail(); }
  }
  return { start() {
    if (started || stopped) return;
    started = true;
    pending = requestFrame(frame);
  }, stop, fail };
}
