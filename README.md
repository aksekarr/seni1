# Seni
### A sci-fi AI presence, made of light.

**[Meet Seni →](https://aksekarr.github.io/seni1/)**

Seni is an interactive AI character combining live voice conversation with a custom animated particle body. Powered by ElevenLabs’ V4 Turbo voice model through ElevenLabs Agents, with OpenAI’s GPT-4.1 mini for conversation, she explores how an AI’s personality might become visible through movement, expression and presence.

Created by **Avi Ravisekara**.

## Why I made Seni

Seni began with a simple question: if an AI could have a digital body, what would I want mine to look like?

I grew up with science fiction’s depictions of AI as distinctive presences. Their voices, appearances and behaviour made them recognisable characters. That thinking shaped Seni.

Today’s models can already convey personality through conversation. I wanted to explore how that personality could take shape on screen, and how a voice, visual identity and animated performance could feel like one coherent being.

I’m interested in a future where AI becomes woven into our devices, environments and physical world. Greater personalisation could extend beyond what an assistant knows about us to how it looks, sounds and behaves.

There is a product question here too. Businesses choosing an AI voice are also designing an experience for their users. How might a distinctive character influence familiarity, brand identity, customer preference and retention? What would make someone want to return to the same AI?

Seni is my practical exploration of those questions.

## Bringing her to life

Seni’s face is formed from thousands of individually animated particles. Her performance combines three interacting layers.

### Living material

Particles drift, breathe, gather and occasionally detach before returning. Around her silhouette, flowing filaments and loose particles create movement beyond the face itself.

The material responds differently to expressive cues: curiosity draws particles into upward streams, warmth produces a soft outward ripple, and concern gathers the form inward.

### Facial performance

Speech-synchronised mouth shapes work alongside gaze, blinks, head movement and subtle changes around the eyes and brows.

Authored expressions respond to cues in the generated speech, including curiosity, excitement, thoughtfulness, warmth, concern, laughter and sighs. Listening has its own quieter behaviour, helping distinguish attention from speaking.

The mouth system combines ElevenLabs’ character timing with custom English articulation rules and interpolated mouth shapes. Particular attention went into readable lip closures, rounded vowels and transitions between shapes.

### Whole-form acting

Expressions extend into Seni’s overall silhouette and position. Anticipation, squash and stretch, overshoot and delayed follow-through give a gesture a beginning, a peak and a natural settling movement.

Her head and central features lead; surrounding particles and filaments follow. Small movements through width, height and depth give her room to perform.

The motion is coordinated with audio playback so buffering, interrupted speech and new expressive cues can recover smoothly.

## Research and visual references

Development brought together character-animation references, speech studies and repeated visual experiments:

- **Disney and Pixar character animation** informed the creative direction around readable poses, anticipation, exaggeration, timing and follow-through.
- **Cartoon expression sheets** helped explore how brows, eyelids, asymmetry and whole-face deformation communicate character.
- **[Meta/Oculus’ Viseme Reference](https://developers.meta.com/vr/documentation/unity/audio-ovrlipsync-viseme-reference/)** provided a reference vocabulary for the visible mouth shapes associated with speech sounds.
- **[Adobe’s Creating Mouth Shapes](https://www.adobe.com/learn/adobe-character-animator/web/lip-sync-mouth-shapes)** was researched for its approach to designing readable mouth sets for animated characters.
- **Rachel’s English pronunciation demonstrations**, including [OO](https://rachelsenglish.com/english-pronounce-oo-vowel/), [CH/J](https://rachelsenglish.com/english-pronounce-ch-jj-sounds/) and [OH](https://rachelsenglish.com/english-pronounce-oh-diphthong/), supplied close visual references for lip shape and articulation.

These references informed a custom particle-animation system. Meta and Adobe are research references; Seni’s animation runs in her own browser implementation.

## Beyond the face

Explore mode lets Seni transform into a drifting jellyfish, an orbiting atom and a lotus that gathers into a closed bud before blooming.

The wider experience includes a living nebula, independent microphone and sound controls, reduced-motion alternatives, and clear recovery messages when voice access is unavailable.

## Built with

- **Three.js and WebGL** for particle rendering and the visual environment.
- **Custom JavaScript animation systems** for facial deformation, expressions, spatial motion and transitions.
- **ElevenLabs Agents with the V4 Turbo model** for live voice interaction.
- **OpenAI GPT-4.1 mini** for conversation.
- **Web Audio API** for playback, audio analysis and custom voice processing.
- **GitHub Pages** for the published experience.

I led the concept, product direction, visual judgement and iterative refinement, working with ChatGPT, Claude and Codex to research, prototype, implement and review the build.

Development combined automated checks with visual comparisons and repeated listening and motion reviews. Technical correctness and the quality of the performed result were assessed separately.

## Try it

**[Open Seni](https://aksekarr.github.io/seni1/)**

Best experienced on a laptop or desktop with sound enabled. Starting a voice conversation requires microphone permission.

This repository contains the published browser experience. The development repository and internal working materials are maintained privately.

## Find me

[LinkedIn](https://www.linkedin.com/in/avi-ravisekara-99123784) · [GitHub](https://github.com/aksekarr) · `avi.sekarr@outlook.com`
