import { guardElevenSetup } from './eleven-setup.js';
import { createAgentReplies } from './agent-replies.js';
import { withLoadDeadline } from './load-deadline.js';

const BUSY_MESSAGE = 'Seni is chatting with someone. Please try again shortly.';
// A policy close or HTTP 429 alone can also mean authentication, daily quota,
// or rate limiting. Only an explicit concurrency rejection is a busy signal.
const CONCURRENCY_REASON = /\b(?:concurrent|concurrency)(?:[ _-]+(?:calls?|conversations?|connections?|requests?))?[ _-]+limit(?:[ _-]+(?:of[ _-]+)?\d+)?[ _-]+(?:exceeded|reached)\b|\b(?:maximum|max)[ _-]+(?:number[ _-]+of[ _-]+)?concurrent[ _-]+(?:calls?|conversations?|connections?|requests?)[ _-]+(?:exceeded|reached)\b/i;

function isBusyError(error, context) {
  if (error?.code === 'BUSY') return true; // Local queue rejection.
  // Pinned SDK: setup rejection -> closeReason; disconnect -> closeReason and
  // context.reason; onError(message, context) -> structured second argument.
  return [error?.code, error?.errorType, context?.code, context?.errorType,
    error?.closeReason, error?.context?.reason,
    typeof error === 'string' ? error : error?.message]
    .some(value => typeof value === 'string' && value.length <= 2048 && CONCURRENCY_REASON.test(value));
}

function errorDetails(error, context) {
  let message;
  if (error?.name === 'NotAllowedError') message = 'Microphone access is blocked. Allow microphone access in your browser and system settings, then try again.';
  else if (error?.name === 'NotFoundError' || error?.name === 'NotReadableError') message = 'Your microphone is unavailable. Check it, then try again.';
  else if (isBusyError(error, context)) return { message: BUSY_MESSAGE, kind: 'busy' };
  else if (error?.code === 'TIMEOUT') message = 'The connection took too long. Please try again.';
  else message = 'Seni could not connect. Please try again.';
  return { message, kind: null };
}

// The provider owns conversation; the existing local player owns all audible
// output, mouth timing and effects. Never display or log provider payloads.
export function createAgentSession({ voice, onReplyText = () => {}, onChange = () => {},
  clientLoader = null, host = window, media = navigator.mediaDevices, connectionTimeoutMs = 30000 }) {
  let current = null, pendingSetup = null, clientPromise = null;
  let state = { status: 'idle', speaking: false, micMuted: false, error: null, errorKind: null };
  const replies = createAgentReplies({ stream: voice.stream, onReplyText });
  function publish(next) {
    const changed = Object.keys(next).some(key => state[key] !== next[key]);
    state = { ...state, ...next };
    if (changed) onChange({ ...state });
  }
  function loadClient() {
    if (!clientPromise) {
      clientPromise = withLoadDeadline(signal => clientLoader ? clientLoader() : new Promise((resolve, reject) => {
        if (host.ElevenLabsClient) { resolve(host.ElevenLabsClient); return; }
        const script = host.document.createElement('script');
        script.src = new URL('./vendor/elevenlabs-client-1.27.0.iife.js', import.meta.url).href;
        const cleanup = () => { signal.removeEventListener('abort', cancel); script.onload = script.onerror = null; };
        const cancel = () => { cleanup(); script.remove(); reject(signal.reason); };
        script.onload = () => { cleanup(); resolve(host.ElevenLabsClient); };
        script.onerror = () => { cleanup(); script.remove(); reject(new Error('Client unavailable')); };
        signal.addEventListener('abort', cancel, { once: true });
        host.document.head.appendChild(script);
      }), { timeoutMs: connectionTimeoutMs }).catch(error => { clientPromise = null; throw error; });
    }
    return clientPromise;
  }
  function closeResources(session) {
    session.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    session.socket?.close();
    const closeLeftovers = () => {
      session.contexts.forEach(context => {
        if (context.state !== 'closed') context.close().catch(() => {});
      });
      session.audioElements.forEach(element => {
        element.pause();
        element.srcObject = null;
        element.remove();
      });
      session.audioElements.clear();
    };
    if (session.conversation) {
      if (!session.ending) {
        session.ending = true;
        // The SDK closes input before output. Closing its contexts first makes
        // input.close() reject and skips the output element/timer cleanup.
        session.conversation.endSession().catch(() => {}).finally(closeLeftovers);
      }
    } else closeLeftovers();
  }
  function stopSession(session, error = null, errorKind = null) {
    session.stopped = true;
    clearTimeout(session.timer);
    // An in-flight guarded call rejects late permission/socket results. Between
    // guarded calls, keep hooks installed until the SDK continuation unwinds.
    if (!session.setupPending || !session.restoreSetup || session.guardedCalls > 0) {
      session.restoreSetup?.();
      if (pendingSetup === session) pendingSetup = null;
    }
    closeResources(session);
    session.cancel({ status: error ? 'unavailable' : 'stopped' });
    if (current !== session) return;
    current = null;
    replies.reset();
    publish({ status: error ? 'error' : 'idle', speaking: false, micMuted: false, error, errorKind: error ? errorKind : null });
  }
  function start(config) {
    if (current) return current.done;
    if (pendingSetup) {
      publish({ status: 'error', error: 'The previous connection is still closing. Please try again shortly.', errorKind: null });
      return Promise.resolve({ status: 'unavailable' });
    }
    const agentId = config?.agentId;
    if (typeof agentId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(agentId)) {
      publish({ status: 'error', error: 'Voice conversation is not available yet.', errorKind: null });
      return Promise.resolve({ status: 'unavailable' });
    }
    replies.reset();
    const session = { stopped: false, setupPending: true, guardedCalls: 0, connected: false,
      streams: new Set(), contexts: new Set(), audioElements: new Set(), conversation: null, cutoff: 0, micMuted: false };
    const cancelled = new Promise(resolve => { session.cancel = resolve; });
    current = pendingSetup = session;
    publish({ status: 'connecting', speaking: false, micMuted: false, error: null, errorKind: null });
    const active = () => current === session && !session.stopped;
    const fail = (error, context) => {
      if (!active()) return;
      const { message, kind } = errorDetails(error, context);
      stopSession(session, message, kind);
    };
    session.timer = setTimeout(() => fail({ code: 'TIMEOUT' }), connectionTimeoutMs);
    const setup = (async () => {
      try {
        const client = await loadClient();
        if (!active()) return { status: 'stopped' };
        if (!media?.getUserMedia) throw Object.assign(new Error('No microphone'), { name: 'NotFoundError' });
        session.restoreSetup = guardElevenSetup(session, client, { host, media });
        session.conversation = await client.Conversation.startSession({
          agentId, connectionType: 'websocket', useWakeLock: false,
          // Keep the SDK's self-contained sample-rate fallback on this origin.
          libsampleratePath: new URL('./vendor/libsamplerate-2.1.2.worklet.js', import.meta.url).href,
          onConversationCreated(conversation) {
            session.conversation = conversation;
            conversation.onError = fail;
            conversation.input.onError = fail;
            conversation.setVolume({ volume: 0 });
            conversation.output.audioElement.muted = true;
            if (active()) {
              conversation.setMicMuted(state.micMuted);
              session.releaseOutput();
            } else closeResources(session);
          },
          onConnect() {
            if (!active()) return;
            session.connected = true;
            clearTimeout(session.timer);
            publish({ status: 'connected' });
          },
          onIncomingEvent(event) {
            if (!active()) return;
            if (event.type === 'queue_status' && event.queue_status_event?.status !== 'admitted') {
              const status = event.queue_status_event?.status;
              fail(status === 'waiting' || status === 'timed_out' ? { code: 'BUSY' } : null); return;
            }
            if (event.type === 'interruption' && Number.isFinite(event.interruption_event?.event_id)) {
              session.cutoff = Math.max(session.cutoff, event.interruption_event.event_id);
            }
            replies.accept(event);
          },
          // Queue/listening notifications are not reply boundaries. Raw
          // agent_response_complete is consumed by the reply router instead.
          onDisconnect(details) {
            if (details?.reason === 'error') fail(details);
            else if (active()) stopSession(session);
          },
          onError: fail
        });
        if (!active()) { closeResources(session); return { status: 'stopped' }; }
        return { status: 'connected' };
      } catch (error) {
        if (!active()) return { status: 'stopped' };
        fail(error);
        return { status: 'unavailable' };
      } finally {
        session.restoreSetup?.();
        session.setupPending = false;
        if (pendingSetup === session) pendingSetup = null;
      }
    })();
    session.done = Promise.race([setup, cancelled]);
    return session.done;
  }
  return {
    get state() { return { ...state }; },
    prepare() { return loadClient().then(() => ({ status: 'prepared' }), () => ({ status: 'unavailable' })); },
    start,
    stop() { if (current) stopSession(current); },
    audioFailed() {
      if (current) stopSession(current, 'Audio was interrupted. Please try again.');
    },
    setMicMuted(muted) {
      if (!current) return;
      const value = Boolean(muted);
      current.micMuted = value;
      // Disable tracks synchronously as well as the SDK worklet's input gate.
      current.streams.forEach(stream => stream.getTracks().forEach(track => { track.enabled = !value; }));
      current.conversation?.setMicMuted(value);
      publish({ micMuted: value });
    },
    // Read the SDK's existing analyser only during a genuine listening gap.
    // No microphone samples, text or levels are retained or published to UI.
    currentInputVolume() {
      if (!current?.connected || current.micMuted || replies.replyOpen
          || voice.stream.isActive?.() || voice.stream.isAudible()) return 0;
      const value = current.conversation?.getInputVolume?.();
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    },
    onFrame() {
      if (current?.connected) publish({ speaking: voice.stream.isAudible() });
    }
  };
}
