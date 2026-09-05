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
at this leg by design — the output is a decision to build, or a decision not to.

This leg's `stampCmd` never succeeds on purpose: rough ideation leaves no papers, so Waybill takes
its stamp from repository state (a later leg is already done, or a feature branch is checked out)
rather than from this booking.
