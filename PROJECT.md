# Hack the Andes

This file is public. Do not include personal context, private goals, names of
people from the vault, health information, private decisions, or local vault
paths.

**Last updated:** 2026-10-17  
**Status:** active  
**Type:** landing

## Goal

Ship the Hack the Andes site and participant pipeline: a selective in-person
hackathon in Lima (17–18 October 2026), with a public landing, CLI/API
registration, and a preselection path that is not invite-only.

## Done when

- The public landing presents the event, prizes, and how to apply.
- A participant can apply, check status, and confirm attendance after
  acceptance through the CLI or the web app.
- Preselection includes rotating technical challenges and a public ranking,
  not just a form.

## Current state

The registration API and Effect CLI are implemented. The landing now presents
a shorter WebGL Sacred Valley opening, a hundred-seat senior event, three
sealed event challenges, five judge seats, five mentor seats, direct prize
amounts, participant logistics, and Chofex as principal sponsor. The closing
ceremony deck is at `/deck/closing`.

## Next action

Complete production QA, confirm the application deadline and venue release
policy, then publish the landing.

## Links

- GitHub: https://github.com/crafter-station/hack-the-andes
- README: `README.md`
- Landing copy: `apps/web/components/landing/content.ts`
- Participant skill: `skills/chofex-hackathon/SKILL.md`
