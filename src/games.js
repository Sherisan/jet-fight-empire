import { createJetScene } from './scenes/jet';

export const GAME = {
  id: 'jet',
  title: 'Jet Fight Empire',
  blurb: 'Launch from your carrier into a naval war. Shoot down jets, sink battleships, and cash out before the flak gets you.',
  waitLabel: 'Launch in',
  crashVerb: 'Shot down',
  runningLabel: 'Strike multiplier',
  scene: createJetScene,
};
