# The Stash

Chris’s Unturned creator portfolio and owner content workspace. React + Vite on GitHub Pages, with Supabase Auth, PostgreSQL RLS, private Storage and two small Edge Functions.

**Owner access and live backend verified September 24, 2026.** See the [verification record](docs/TEST-REPORT.md) for release status.

- [Public portfolio](https://chrisde7.github.io/The-stash/)
- [Owner login](https://chrisde7.github.io/The-stash/#/admin)
- Start with [the step-by-step login and image guide](OWNER-WORKSPACE-README.md). Content changes publish from the dashboard without a GitHub deployment.

- [Owner workspace setup](OWNER-WORKSPACE-README.md): step-by-step account, backend, sign-in, and deployment instructions.
- [Owner guide](docs/OWNER-GUIDE.md): everyday editing, limits, backup and rollback.
- [Setup and security](docs/SETUP-AND-SECURITY.md): one-time provisioning and release gates.
- [Inspection](docs/INSPECTION.md): verified original content and design critique.
- [Test report](docs/TEST-REPORT.md): what passed and what still needs live verification.

## Development

Use Node 22 or later. Run `npm ci`, then `npm run dev`. The base path is `/The-stash/`; routes use hashes to support GitHub Pages refreshes. With no backend variables, the application shows an honest preview/setup state and does not simulate a working owner dashboard.

Public configuration keys are listed in `.env.example`. Never put privileged credentials in a `VITE_` variable. See the setup guide before connecting a project.

Run `npm run check`, `npm test` and `npm run build` before release. The included manual GitHub Pages workflow refuses missing backend configuration and performs basic anonymous-access checks.

The original starter entries migrate as private drafts, not fictional completed projects. No plugin descriptions, screenshots or videos were present in the source repository. The original source files and rollback tag are preserved.
