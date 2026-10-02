import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { CandidateDashboard } from "@/components/candidate-dashboard";
import { parseCandidateFilters } from "@/lib/admin/candidate-filters";
import { candidateListOptions } from "@/lib/admin/candidate-queries";

const filters = parseCandidateFilters(new URL(location.href).searchParams);
const queryClient = new QueryClient();
const data = await queryClient.fetchQuery(candidateListOptions(filters));
const root = document.getElementById("root");
if (!root) throw new Error("Preview root is missing");
createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <CandidateDashboard data={data} initialFilters={filters} />
  </QueryClientProvider>,
);
