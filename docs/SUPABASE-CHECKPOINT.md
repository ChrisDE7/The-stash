# Setup checkpoint — 2026-09-24

Project: The Stash (`qzhvvfcipirrhbbejrtc`).

Completed:
- All three SQL migrations were applied previously. Do not rerun them.
- Owner account is authorized and browser login verified.
- Both Edge Functions are deployed with custom access checks; legacy gateway JWT verification is off as approved.
- Fixed media Storage requests by including the API-key header. Published image bytes and byte-range requests now pass.
- Live upload, private download, draft isolation, publish/unpublish and in-use deletion protection pass. Test content was cleaned up.
- Site introduction/about updated; Unturned Maps and Unturned Plugins categories configured. Historical Websites draft retained privately.
- GitHub CLI access restored. Pages uses Actions and both VITE repository variables are configured.
- TypeScript, all five automated tests, build and anonymous backend checks pass.

Deployment: see docs/TEST-REPORT.md for the final release record.
Owner instructions: OWNER-WORKSPACE-README.md.
