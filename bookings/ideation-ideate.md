---
leg: ideate
command: /ideation:brainstorm
model: opus
effort: high
handover: transfer
stampCmd: false
---
Talk the idea through before committing to it. Name the problem, argue for the smallest version
that could work, and surface the assumptions you have not tested yet. Nothing is written to disk
at this beat by design — the output is a decision to build, or a decision not to.

This beat's `doneWhenCmd` never succeeds on purpose: rough ideation leaves no artifact, so Pitwall
judges it from repository state (a later beat is already done, or a feature branch is checked out)
rather than from this manifest.
