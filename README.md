# namima-lab

# Status

This repository is no longer the primary active music runtime.

Current music-stack direction:
- Experimental / edge generative rig: QuietBriony/Music
- Public-friendly ambient player: QuietBriony/namima
- Band groove generator: QuietBriony/drum-floor

This repository is kept as a possible staging/lab area for `namima`, or as an archive candidate after useful ideas are harvested.

## Harvest status (2026-05-25)

The dormant-asset audit cycle for `namima-lab` is **harvest-complete**.
Concrete harvest deliverable:

- **organic-pluck audio recipe (a-min v1 / v2)**: concrete PluckSynth / filter /
  reverb / shimmer values translated into namima's public-friendly ambient
  vocabulary (`water_shimmer` / `air_lift` / `melody_fragment_probability` /
  `soft_pulse_visibility` / `fade_back_time`).
  - Deliverable: `QuietBriony/namima` `docs/organic-pluck-lab-recipe.md`
    (shipped via namima PR #32, 2026-05-25)
  - Status: docs-only translation, runtime wiring deferred behind human-gate
    listening review in namima
- **v3 audio (FMSynth / BitCrusher / NoiseSynth / Transport pattern)**:
  rejected for namima per `namima/docs/namima-lab-harvest-closure.md`
  (dark glitch / metallic reactor / heavy low-end pressure are out of scope
  for namima's public-friendly ambient direction).

Tracking: `QuietBriony/Music` `docs/autonomy/BACKLOG.md` BL-019,
`docs/archive-repo-harvest-audit.md` §5, and
`docs/namima-lab-safe-ripple-lineage-decision.md`.

`namima-lab` no further harvest is pending. The repo may remain as a historical
lineage source / lightweight reference. Promoting `namima-lab` itself back to
active runtime, or formally toggling the GitHub archive setting, requires
separate human approval.

## Allowed (residual)

Use this repo only for:
- lightweight reference notes that cite the deliverable above
- docs or concepts that may later move to `QuietBriony/namima`
- namima-safe ambient experiments (only if explicitly re-approved)

## Not allowed

Do not use this repo for:
- main Music runtime development
- dark IDM / glitch experiments
- band groove generation
- audio file or sample storage
- dependency-heavy experiments
- GitHub Actions experiments

Rules:
- Do not add audio files or samples
- Do not add dependencies
- Do not add GitHub Actions
- Do not use this repo as the main runtime unless reactivated intentionally
