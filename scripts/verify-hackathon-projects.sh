#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bun test apps/web/lib/projects apps/web/lib/event apps/web/lib/teams apps/web/lib/request-security.test.ts apps/web/components/project-details.test.tsx apps/cli/test/project.test.ts apps/cli/test/team.test.ts packages/registration-contract/src
bun run check-types
