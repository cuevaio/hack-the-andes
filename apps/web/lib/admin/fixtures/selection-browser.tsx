import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { CandidateDashboard } from "../../../components/candidate-dashboard";
import { parseCandidateFilters } from "../candidate-filters";
import type { CandidatePage } from "../types";

declare global {
  interface Window {
    selectionFixture: CandidatePage;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(
  <QueryClientProvider client={new QueryClient()}>
    <CandidateDashboard
      data={window.selectionFixture}
      initialFilters={parseCandidateFilters(
        new URL(location.href).searchParams,
      )}
    />
  </QueryClientProvider>,
);
