import { resolveLandingRoute } from './landing-route.js';
import { withLoadDeadline } from './load-deadline.js';

const FORM_LABELS = {
  orbit: { name: 'Atom', description: 'an atom' },
  jelly: { name: 'Jellyfish', description: 'a jellyfish' },
  lotus: { name: 'Celestial Lotus', description: 'a celestial lotus' }
};

// Legacy studies own their own stage. Route before loading the landing engine.
const redirect = resolveLandingRoute(window.location.href);
if (redirect) window.location.replace(redirect);
else startLanding();

async function startLanding() {
  const el = Object.fromEntries(['stage', 'meet', 'meet-label', 'arrival', 'entry-hint', 'entry-error',
    'presence', 'presence-title', 'presence-note', 'form-error', 'form-recovery', 'busy-explore', 'return', 'replay', 'talk', 'end-conversation', 'mic', 'mic-label', 'back-face', 'surprise', 'sound', 'sound-label', 'status', 'creator-toggle', 'explore-menu', 'explore-toggle', 'voice-privacy', 'voice-disclosure', 'voice-privacy-details', 'experience-footer']
    .map(id => [id, document.getElementById(id)]));
  let flow = null, ui = null, footerObserver = null, footerLayoutActive = true, soundOn = true, pageGone = false, loadingStep = 'engine';
  const boot = new AbortController();
  const announce = text => { if (el.status.textContent !== text) el.status.textContent = text; };
  const focus = element => { if (!element.hidden && !element.disabled) element.focus({ preventScroll: true }); };
  window.addEventListener('pagehide', event => {
    if (event.persisted) { ui?.close({ restore: false, focus: false }); flow?.returnToNebula(); }
    else { pageGone = true; boot.abort(); releaseFooterLayout(); ui?.dispose(); flow?.dispose(); }
  });

  function releaseFooterLayout() {
    footerLayoutActive = false;
    footerObserver?.disconnect();
    footerObserver = null;
    document.body.style.removeProperty('--creator-footer-clearance');
  }

  function showBootFailure(message = 'Seni could not load. Please try again.') {
    releaseFooterLayout();
    try { ui?.dispose(); } catch { /* Still release audio if interface cleanup fails. */ }
    try { flow?.dispose(); } catch { /* Keep the retry usable even if cleanup fails. */ }
    document.body.dataset.phase = 'error';
    el.arrival.hidden = false;
    el.presence.hidden = true;
    for (const name of ['return', 'replay', 'talk', 'end-conversation', 'mic', 'back-face', 'surprise', 'busy-explore']) el[name].hidden = true;
    el['meet-label'].textContent = 'Try again';
    el.meet.disabled = false;
    el.sound.disabled = true;
    el['creator-toggle'].disabled = true;
    el['explore-menu'].hidden = true;
    el['voice-privacy'].hidden = true;
    el['voice-privacy-details'].open = false;
    el.meet.removeAttribute('aria-describedby');
    el.talk.removeAttribute('aria-describedby');
    el['entry-hint'].hidden = true;
    el['entry-error'].hidden = false;
    el['entry-error'].textContent = message;
    el.meet.onclick = () => window.location.reload();
    announce(message);
  }

  try {
    const [{ createShapes }, { createFace }, { createVoice }, { startStage }, { loadFaceMap }, { createLandingFlow }, { createLandingForms }, { createAgentSession }, { loadAgentConfig }, { createLandingInterface }] = await withLoadDeadline(() => Promise.all([
      import('./shapes.js'), import('./face.js'), import('./voice.js'), import('./stage.js'),
      import('./facemap.js'), import('./landing-flow.js'), import('./landing-forms.js'),
      import('./agent-session.js'), import('./agent-config.js'), import('./landing-interface.js')
    ]), { signal: boot.signal });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const params = new URLSearchParams(window.location.search);
    loadingStep = 'face and configuration';
    const [maps, agentConfig] = await withLoadDeadline(signal => Promise.all([
      loadFaceMap({ signal }), loadAgentConfig({ signal })
    ]), { signal: boot.signal });
    if (pageGone) return;
    const requested = params.get('n');
    const parsed = requested === null || requested.trim() === '' ? NaN : Number(requested);
    const defaultN = Math.min(window.innerWidth, window.innerHeight) < 600 ? 9000 : maps ? 32000 : 16000;
    const N = Number.isFinite(parsed) ? Math.max(4000, Math.min(64000, Math.round(parsed))) : defaultN;
    loadingStep = 'scene setup';
    const designs = createShapes(N, maps);
    const shapes = { ...designs, ...designs.FACE_V3 };
    const face = maps ? createFace(shapes, reduce) : { update() {}, applyTuning() {} };
    const forms = maps ? createLandingForms({ shapes, reduce, idleCount: Number.isFinite(parsed) ? N : 48000 }) : null;
    // Build correspondence during setup, before animation and audio start.
    // Optional form setup must not prevent meeting Seni if it fails.
    try { forms?.prepare(window.innerWidth / window.innerHeight); } catch { /* Selecting a form will offer a retry. */ }
    const state = { mode: 'nebula', modeT: 0, clock: 0, speaking: false };
    // Retain word timing without putting speech text into the page.
    let agent = null;
    const voice = createVoice({ caption: document.createElement('p'), readout: document.createElement('span'),
      onStreamFailure: () => agent?.audioFailed() });
    loadingStep = 'conversation setup';
    agent = agentConfig ? createAgentSession({ voice,
      onReplyText: text => face.setReplyText?.(text), onChange: () => flow?.agentChanged() }) : null;
    function setMode(mode) {
      if (state.mode === mode) return;
      forms?.select(mode, state.clock);
      state.mode = mode;
      state.modeT = state.clock;
    }
    let previousPhase = 'booting', viewState = null;
    function updateCreatorClearance() {
      if (pageGone || !footerLayoutActive) return;
      if (viewState?.live) {
        const height = el['experience-footer'].getBoundingClientRect().height;
        document.body.style.setProperty('--creator-footer-clearance', `${Math.ceil(height) + 12}px`);
      } else document.body.style.removeProperty('--creator-footer-clearance');
    }
    function render(view) {
      viewState = view;
      ui?.render(view);
      const focused = document.activeElement;
      const { phase, form, busy, error, errorKind, live = false, micMuted = false } = view;
      const entry = phase === 'arrival' || phase === 'error';
      const present = phase === 'present';
      const changing = phase === 'changing-form';
      const inSession = phase === 'connecting' || phase === 'listening' || phase === 'speaking';
      const preparingSession = live && (phase === 'forming' || phase === 'loading');
      const showSessionControls = preparingSession || inSession;
      const exploring = present || changing || inSession;
      const formLabel = FORM_LABELS[form];
      const alternate = Boolean(formLabel);
      const voiceRelevant = live && !alternate;
      const entryDisclosure = voiceRelevant && entry && !error && !ui?.open;
      el['voice-privacy'].hidden = !voiceRelevant;
      el['voice-disclosure'].hidden = entryDisclosure || phase === 'listening' || phase === 'speaking';
      if (!voiceRelevant) el['voice-privacy-details'].open = false;
      if (voiceRelevant) {
        el.meet.setAttribute('aria-describedby', entryDisclosure ? 'entry-hint' : 'voice-disclosure');
        el.talk.setAttribute('aria-describedby', 'voice-disclosure');
      } else {
        el.meet.removeAttribute('aria-describedby');
        el.talk.removeAttribute('aria-describedby');
      }
      el['explore-menu'].hidden = phase === 'arrival' || phase === 'error';
      const formName = formLabel?.name;
      document.body.dataset.phase = phase;
      document.body.dataset.form = form;
      el.stage.setAttribute('aria-label', entry ? 'A living nebula of light' : alternate
        ? `Seni's particles ${changing ? 'becoming' : 'forming'} ${formLabel.description}` : "Seni's face, made of light particles");
      el.arrival.hidden = !entry;
      el.meet.disabled = busy;
      el['meet-label'].textContent = error ? 'Try again' : 'Meet Seni';
      el['entry-hint'].hidden = Boolean(error);
      el['entry-hint'].textContent = live ? el['voice-disclosure'].textContent
        : soundOn ? 'Sound on for the introduction' : 'Sound is off. You can still meet Seni.';
      el['entry-error'].hidden = !entry || !error;
      el['entry-error'].textContent = error || '';
      el['form-recovery'].hidden = entry || !error;
      el['form-error'].hidden = entry || !error;
      el['form-error'].textContent = error || '';
      el['busy-explore'].hidden = !present || !error || errorKind !== 'busy';
      el.presence.hidden = entry;
      el['return'].hidden = phase === 'arrival';
      el.replay.hidden = live || !exploring || alternate;
      el.replay.disabled = busy;
      el.talk.hidden = !live || !present || alternate;
      // Reveal one complete group while flow retains microphone startup ownership.
      el['end-conversation'].hidden = !showSessionControls;
      el.mic.hidden = !showSessionControls;
      el.mic.disabled = preparingSession;
      el.mic.setAttribute('aria-pressed', String(micMuted));
      el.mic.setAttribute('aria-label', micMuted ? 'Unmute microphone' : 'Mute microphone');
      el['mic-label'].textContent = micMuted ? 'Mic off' : 'Mic on';
      el['back-face'].hidden = !exploring || !alternate;
      el.surprise.hidden = !exploring;
      el.surprise.disabled = busy && !inSession;
      const surpriseLabel = inSession ? 'End conversation and explore another form' : 'Explore another form';
      el.surprise.title = surpriseLabel;
      el.surprise.setAttribute('aria-label', inSession ? 'Surprise me — end conversation and explore another form' : 'Surprise me');
      el.surprise.setAttribute('aria-busy', String(changing));
      const title = phase === 'forming' ? 'Taking form' : phase === 'loading' ? (live ? 'Preparing your conversation' : 'Preparing your introduction')
        : phase === 'connecting' ? 'Connecting to Seni' : phase === 'speaking' ? 'Seni is speaking'
          : phase === 'listening' ? (micMuted ? 'Microphone muted' : 'Seni is listening')
            : phase === 'greeting' ? 'An introduction' : changing ? (alternate ? 'Changing form' : 'Returning to Seni')
              : error && live ? 'Conversation unavailable' : alternate ? formName : 'Seni is here';
      el['presence-title'].textContent = title;
      el['presence-note'].textContent = inSession ? (phase === 'connecting' ? 'Allow microphone access when asked'
        : micMuted ? 'Unmute your microphone when you are ready' : !soundOn ? 'Sound is off' : 'A conversation, just for you')
        : present ? (alternate ? 'Explore another form or return to Seni' : live ? 'Talk with Seni when you are ready' : 'Live conversation is coming soon')
          : changing && alternate ? formName
            : phase === 'greeting' ? (soundOn ? 'A voice from the light' : 'Sound is off') : 'A moment, just for you';
      announce(error || (entry ? 'Ready to meet Seni.' : title + '.'));
      if (!ui?.open && previousPhase !== 'booting' && (phase !== previousPhase || focused?.hidden)) {
        if (phase === 'arrival' || phase === 'error') focus(el.meet);
        else if (previousPhase === 'arrival' || previousPhase === 'error' || focused === el.replay || focused?.hidden || focused === el.surprise && busy) {
          focus(inSession ? el['end-conversation'] : live && present && !alternate ? el.talk
            : alternate && exploring ? el['back-face'] : el['explore-toggle']);
        }
      }
      previousPhase = phase;
      updateCreatorClearance();
    }
    flow = createLandingFlow({ voice, agent, agentConfig, setMode, setReplyText: text => face.setReplyText?.(text),
      getClock: () => state.clock, isTransitioning: () => forms?.transitioning ?? false, onChange: render });
    ui = createLandingInterface({ flow, face, reduce });
    viewState = flow.state;
    if (typeof window.ResizeObserver === 'function') {
      footerObserver = new window.ResizeObserver(updateCreatorClearance);
      footerObserver.observe(el['experience-footer']);
    }
    loadingStep = 'renderer';
    startStage({ shapes, reduce, state, landingForms: forms, nebulaEnhancement: params.get('nebula') !== 'original',
      sceneFraming: () => ui.framing,
      onFailure: () => { if (!pageGone) showBootFailure('Seni paused unexpectedly. Please try again.'); },
      applyFaceTuning: face.applyTuning,
      onFrame(dt) {
        ui.update(dt);
        voice.update(dt);
        agent?.onFrame();
        flow.onFrame();
        state.speaking = viewState.speaking;
      },
      updateFace(dt, clock) {
        if (state.mode === 'face' || state.mode === 'nebula') face.update(dt, clock, voice.currentCues(), voice.currentEnvelope(), voice.currentShape(),
          state.speaking, voice.lastReplyEnd(), viewState.phase === 'present' || viewState.phase === 'listening',
          null, viewState.phase === 'listening' ? agent?.currentInputVolume() ?? 0 : 0);
      }
    });
    el.meet.addEventListener('click', () => { ui.close({ restore: false, focus: false }); flow.meet(); });
    el['return'].addEventListener('click', () => { ui.close({ restore: false, focus: false }); el['explore-menu'].open = false; flow.returnToNebula(); face.setPose?.('neutral'); });
    el.replay.addEventListener('click', () => { ui.close({ restore: false, focus: false }); flow.repeatGreeting(); });
    el.talk.addEventListener('click', () => { ui.close({ restore: false, focus: false }); flow.meet(); });
    el['busy-explore'].addEventListener('click', () => {
      if (el['busy-explore'].hidden || el['explore-menu'].hidden) return;
      ui.close({ restore: false, focus: false });
      el['explore-menu'].open = true;
      focus(el['explore-toggle']);
    });
    el['end-conversation'].addEventListener('click', () => flow.endConversation());
    el.mic.addEventListener('click', () => flow.setMicMuted(!flow.state.micMuted));
    el.surprise.addEventListener('click', () => { ui.close({ restore: false, focus: false }); el['explore-menu'].open = false; flow.surprise(); });
    el['back-face'].addEventListener('click', () => { ui.close({ restore: false, focus: false }); flow.showFace(); });
    el.sound.addEventListener('click', () => {
      soundOn = !soundOn;
      voice.setSoundOn(soundOn);
      el.sound.setAttribute('aria-pressed', String(!soundOn));
      el.sound.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');
      el['sound-label'].textContent = soundOn ? 'Sound on' : 'Sound off';
      render(flow.state);
    });
    if (maps) { el.sound.disabled = false; render(flow.state); flow.prepare(); }
    else { flow.dispose(); showBootFailure(); }
  } catch {
    if (!pageGone) {
      console.warn(`Seni setup failed during ${loadingStep}.`);
      showBootFailure();
    }
  }
}
