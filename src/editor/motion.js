// Motion for a whole deck: an entrance preset for pages without their own animations, and the
// transition between pages while presenting. Both are stored on the deck (`deck.motion`,
// `deck.transition`) and only play in presentation mode (and the editor's «Körish» preview);
// exports draw the still page. prefers-reduced-motion turns all of it off (canva.css / editor.css).

/** Entrance presets: element animation (canva.css an-*), its length, the step between elements. */
export const MOTIONS = {
  none: null,
  minimal: { type: 'fade', dur: 0.5, step: 0.06, transition: 'fade' },
  professional: { type: 'rise', dur: 0.6, step: 0.09, transition: 'fade' },
  cinematic: { type: 'blur', dur: 1.0, step: 0.16, transition: 'zoom' },
  dynamic: { type: 'pop', dur: 0.5, step: 0.07, transition: 'push' },
}
export const MOTION_IDS = Object.keys(MOTIONS)

/** Page transitions drawn by Present.jsx (editor.css .pt-*). */
export const TRANSITIONS = ['none', 'fade', 'slide', 'push', 'zoom', 'reveal']

/** How long each transition runs, in seconds. */
export const TRANSITION_DUR = { none: 0, fade: 0.5, slide: 0.55, push: 0.6, zoom: 0.7, reveal: 0.65 }

/** The deck's entrance preset (null: pages play only the animations set on their elements). */
export const motionOf = (deck) => MOTIONS[deck?.motion] ?? null

/** The deck's transition; a deck that never chose one fades, the quietest of them. */
export const transitionOf = (deck) => (TRANSITIONS.includes(deck?.transition) ? deck.transition : 'fade')

/** True when the viewer asked the system for less motion. */
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
