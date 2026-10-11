// Bound local loading even when a fetch/image implementation ignores cancellation.
export function withLoadDeadline(load, { signal, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    let settled = false, timer = null;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      callback(value);
    };
    const cancel = () => {
      const error = signal.reason || new DOMException('Loading cancelled', 'AbortError');
      controller.abort(error);
      finish(reject, error);
    };
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    timer = setTimeout(() => {
      const error = Object.assign(new Error('Loading took too long. Please try again.'), { code: 'LOAD_TIMEOUT' });
      controller.abort(error);
      finish(reject, error);
    }, timeoutMs);
    const failed = error => { controller.abort(error); finish(reject, error); };
    try { Promise.resolve(load(controller.signal)).then(value => finish(resolve, value), failed); }
    catch (error) { failed(error); }
  });
}
