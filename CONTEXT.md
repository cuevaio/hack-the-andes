# Domain Glossary

## Participant

A person identified by a Clerk user account who may apply to join the hackathon.

## Participant name

The participant's public name used in the admin dashboard, challenge rankings, and badge. First login creates the participant and initializes this name from Clerk. Later logins preserve the saved name. Attendance confirmation shows the current name and lets the participant keep or change it. Badge edits change the same name. The database owns this value; public-name edits also synchronize to Clerk, with failed synchronization retried without losing the saved edit.

## Participant Tangled profile

The participant's optional public Tangled profile link persists across application attempts. Registration can set it, and confirmed participants can update or clear it when editing their badge. It appears on reviewer cards and public challenge rankings without changing historical applications. It is also a fallback QR destination after portfolio and GitHub; an explicitly chosen badge QR destination takes precedence.

## Participant legal name

The participant's full name exactly as it appears on their identity document. It is requested during attendance confirmation and stored separately from the public name. It is not synchronized to Clerk or used as a public-name fallback. The full name entered on an application remains part of that application's history.

## Participant country

The participant's country of residence persists across application attempts. Participants select it once; only admins and application reviewers may correct it after reviewing LinkedIn or other social profiles. An unknown country is not assumed to be Peru. The event is in Lima. Participants residing outside Peru pay for their travel; travel support is reserved for exceptional talent residing in other Peruvian cities.

## Application

One attempt by a participant to enter the hackathon. A rejected or withdrawn application remains part of the participant's history; either outcome permits the participant to create a new application.

Submitting an application creates a candidacy but does not reserve a seat. A participant must also produce a ranked result in an admission challenge before the application can be accepted.

## Active application

An application that is being drafted, awaiting a decision, or has been accepted. A participant may have only one active application at a time. Rejected and withdrawn applications are not active.

## Acceptance details

Personal and logistical information requested only after an application is accepted. Confirmation also collects the participant's legal name for venue access. The details are complete only when completion has been recorded and every detail required for the participation mode is present. They may still be updated after completion.

## Confirmed profile picture

The picture an accepted participant explicitly chooses during attendance confirmation. It may come from Clerk, the application's GitHub profile, or a verified custom upload. It replaces the reviewer-visible picture used for the acceptance badge.

## Acceptance badge

The default public badge generated when an application is accepted. It begins with the name, one-line description, and picture already visible to reviewers, plus the participant's best challenge placement. Attendance confirmation lets the participant replace those public defaults and generates a new badge.

## Badge profile

The public presentation of an accepted participant's badge: display name, one-line description, picture, and QR destination. It begins with acceptance-badge defaults and may be changed without rewriting the historical application.

## Challenge placement

A participant's best exact rank across the latest playable challenge versions. Challenge rankings are the engineering selection mechanism for seats: only participants with a ranked result from a latest challenge version are eligible for acceptance, and organizers select the strongest results. Attempts from superseded versions remain historical and do not confer eligibility. The best placement is also printed on the participant's badge.

## Hackathon teams and tracks

Teams are event entities, separate from the historical team preference/name on an application. Accepted participants with completed attendance confirmation may create and join teams before event check-in. A participant belongs to at most one team; teams have 1–4 members and there are at most 36 teams. There is no captain role. Invitations target an account resolved from its verified primary email; pending invitations reserve neither membership nor capacity. Accepting an invitation atomically leaves the previous team and joins the destination. Empty teams are immediately deleted, cancelling their pending invitations and releasing any track slot.

Participants may leave voluntarily. A checked-in member may remove an unchecked teammate, including the creator, but cannot remove a checked-in teammate. Removal does not change application or attendance eligibility. Commands that change an existing membership confirm the expected current team, so stale CLI prompts cannot operate on a different team.

Track selection defaults closed and is manually opened/closed by organizers. The four tracks are Clima y Territorio (`environmental`), Movilidad y Transporte (`transport`), Educación Escolar (`education`) and Seguridad (`security`), each capped at 25% of the current total number of teams, rounded up. Capacity grows and shrinks with team creation and deletion. Existing selections are retained when capacity drops; new selections into a track at or above capacity are rejected. The global maximum remains 36 teams. Mobility covers public transport in Lima, and passenger transport, regional connections, freight and distribution elsewhere. Existing track IDs and team assignments remain unchanged. Any member may select or change the team's track while selection is open, but all current members must be accepted, confirmed and checked in. Failed switches preserve the old slot. Joining an already tracked team requires check-in even while selection is closed; closing selection does not freeze membership.

## Team project updates and submissions

The team name is the project name. Any accepted, confirmed current member can rename the team, publish attributed Markdown updates, and submit or edit its single project submission. A complete submission has a deployment URL, presentation URL, GitHub repository URL and Markdown description. The GitHub URL is required for new submissions and edits. Legacy submissions and frozen snapshots retain a null URL until their team supplies it; never invent a repository. Updates can precede submission. Project submissions default open and organizers may close or reopen them from the event controls. Closing blocks both initial submissions and edits under the event transaction lock; project updates remain available. Submission edits compare the observed update timestamp under the event transaction lock; stale edits fail without overwriting the teammate's changes. Writes also confirm the expected team.

Updates snapshot the author's public name and survive the author's departure or account deletion while the team exists. Before the existing empty-team deletion runs, a trigger archives the team name, track, submission and complete update history. Dissolved teams release capacity and remain available in the private organizer archive. Archived projects are excluded from the public gallery and cannot be edited or transferred. The gallery defaults hidden and opens or closes manually through organizer controls; the public service exposes only submitted teams while open, including their full update history. Organizers can review every team's updates before publication. Project publication does not send email notifications or grant judging access. Live judging has a separate role and session described below.

Participants present through the deployment and presentation URLs from the organizer's computer. They cannot connect their own laptops. The participant guide and delivery conditions explain these requirements.

## Event check-in

`andes checkin` issues a five-minute opaque QR; only its hash is stored. An authenticated organizer scans it with their phone camera (or enters its alternate code), verifies the participant's public name and confirmed photo, then explicitly confirms physical arrival. Previewing/scanning alone does not check anyone in. Confirmation writes `acceptance_details.checked_in_at` for the current accepted application and retains the first confirmation and verifying organizer. Existing funnel triggers record the attendance milestone. QR tokens rotate on reissue and are never exposed in query parameters; the staff page uses a URL fragment and a POST body.

The same `/admin/checkin` page includes all accepted participants, including those still missing attendance confirmation. Staff can search by public/legal name, email or document, filter by arrival status, and sort by name or arrival time. Document matching runs on the server against decrypted values; the browser receives only the final four characters. Search terms use POST bodies. Direct arrival confirmation targets an exact application ID and requires current acceptance plus complete attendance confirmation. QR and direct confirmation share a database function that retains the first timestamp and `acceptance_details.checked_in_by`, including under repeated confirmation. The roster refreshes every ten seconds.

Organization may explicitly record an arrival exception for an accepted participant whose attendance details are still pending using `hackathon_confirm_arrival_exception(application_id, organizer_clerk_id, reason)`. It preserves the first arrival timestamp and verifier, stores the reason in `acceptance_details.checkin_exception_reason`, and enables sponsor credits for that active accepted application. It never fills personal details or records confirmation completion, and does not grant confirmed-team eligibility. The caller must verify organizer access before using this database operation.

## Funnel milestone dates

`participant_funnel_milestones` records the first known date each participant reached a funnel stage. Database triggers capture signup, application creation and submission, challenge start and evaluation, review, waitlist, acceptance, rejection, withdrawal, confirmation, and check-in in the same transaction as the change. Repeated updates and new application or challenge attempts preserve the earliest date. Challenge milestones include all versions; they do not establish eligibility under current challenge rules.

The migration backfills explicitly recorded dates. Historical review, waitlist, withdrawal, and confirmations without a reliable first date remain unknown. An edit to an already completed legacy confirmation does not invent its first date. A withdrawn application does not retain its prior decision outcome, so its decision date alone cannot establish an acceptance or rejection. New rows inserted directly into review, waitlist, withdrawal, or an undated terminal status use the database observation time rather than a backdated creation date. Milestones describe stages reached across a participant's history, so the same person may count in several cumulative stage totals. Current state and active-application rules still come from the application records.

## Live project judging

Judges have the Clerk `judge` role and an active entry in `judging_judges`. Actual admins, including configured admin IDs, manage `/admin/judging`; application-reviewer access alone does not grant presentation controls. Admins add verified existing Clerk accounts by email without removing their other roles. Deactivation blocks judging access and excludes that judge's scores from results while retaining their evaluations.

Opening judging freezes all submitted teams' project descriptions, links, updates and member names into a single presentation queue. These snapshots survive later submission edits and team deletion. Every active judge evaluates every presenting team. Admins reorder, skip or restore pending teams and manually advance the current presenter. A shared server timer runs three minutes of pitch followed by two minutes of questions; expiration never advances teams. Pausing preserves the remaining time. Session revision checks reject stale organizer actions.

Evaluations belong to an exact presentation and Clerk judge, independently of the current presenter. Judges may finish previous presentations after organizers advance. Drafts save with revision checks; final submission requires three integer scores from 1–5 and hides the team from that judge's server response. Only an admin may reopen a submitted evaluation. The score out of 100 is traction × 6 + technical effort × 8 + pitch × 6. Admin results average submitted evaluations from active judges; missing evaluations never count as zero. Judges cannot read other judges' evaluations or rankings. React Query refreshes both pages every two seconds and on focus/reconnect; stale or failed synchronization disables controls until a fresh read succeeds.
