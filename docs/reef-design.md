# Moonlight Reef

## Theme and goal

An enchanted, moonlit ocean. Each player is a small luminous jellyfish. Gather
24 floating light pearls together to bring six sleeping coral gardens to life.
The completed reef summons a giant, friendly sky-whale; it swims through a
shower of stars before the next ocean begins. No timers, damage, rankings, words,
or numbers appear in the game.

## Play loop

1. The ocean is alive immediately. A looping silhouette demonstrates reaching
   toward a pearl; a camera pictogram invites camera play. No reading required.
2. Visible wrists become glowing feelers. Touch or sweep through a pearl to
   collect it. A generous swept hit area tolerates imprecise movement.
3. Spread both hands beyond the shoulders to create a visible current around
   each hand. Nearby pearls drift inward. No precision pose or feet required.
4. Collected light flies down to the reef. Every four pearls wakes a coral;
   six illustrated buds at the top communicate the shared goal.
5. Everyone celebrates together. New colors and another cycle follow seamlessly.

## Tracking and fallback controls

Tracking association lives outside game rules. Match shoulder centers across
frames, smooth noisy joints, retain identities through short disappearances,
and stop interactions immediately when joints are stale. Avatars fade instead
of pausing the game. Never require an expected player count or calibration.
Respect existing selected player colors; initial left-to-right colors start
blue and green. The existing on-device detector allows up to 12 poses, subject
to camera and hardware limitations. Nothing records or uploads camera frames.

Mouse movement or a finger drag controls one jellyfish; holding activates its
current. Arrow keys/WASD swim, Space opens the current. These controls work
offline. The camera remains opt-in, with an icon showing starting/on/off states;
permission and diagnostic errors remain readable adult-facing dialogs.

## Presentation and delivery

Canvas art: layered silhouetted reefs, volumetric moonbeams, drifting plankton,
sea grass, glowing pearls, soft jellyfish, particles, and a hand-drawn whale.
Limit DPR and effects, reuse the canvas backing store, and bound particles.
Respect reduced-motion preferences with subdued scenery and celebrations.
Icon-only controls open a three-game illustrated picker. Moonlight Reef is the
startup default; Space Rollercoaster and Trail Dash remain available.

Validation: upper-body-only tracking, identity reorder/dropout, stale wrist
suppression, swept collection, shared progress, celebration/reset, browser
input, mobile sizing, camera denial, all repository checks, then push main and
verify the GitHub Pages action.
