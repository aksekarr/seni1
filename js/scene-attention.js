// A display-only glance toward a scene element. Speech, cue clocks, random
// scheduling and intrinsic expression buffers keep their original inputs.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export function createSceneAttention(reduce = false) {
  const state = { weight: 0, x: 0, y: 0 };
  const velocity = { weight: 0, x: 0, y: 0 };
  const target = { weight: 0, x: 0, y: 0 };
  return { state, setTarget(point) {
    target.weight = !reduce && point && Number.isFinite(point.x) && Number.isFinite(point.y) ? 1 : 0;
    if (target.weight) { target.x = clamp(point.x, -1, 1); target.y = clamp(point.y, -1, 1); }
  }, update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return state;
    const frequency = 7, decay = Math.exp(-frequency * dt);
    for (const key of Object.keys(state)) {
      const offset = state[key] - target[key], tangent = velocity[key] + frequency * offset;
      state[key] = target[key] + (offset + tangent * dt) * decay;
      velocity[key] = (velocity[key] - frequency * tangent * dt) * decay;
      if (Math.abs(state[key] - target[key]) < 1e-7 && Math.abs(velocity[key]) < 1e-6) {
        state[key] = target[key]; velocity[key] = 0;
      }
    }
    return state;
  } };
}
