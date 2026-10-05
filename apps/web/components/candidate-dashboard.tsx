"use client";

import { playableChallenges } from "@chofex/challenges-contract";
import { Badge } from "@chofex/ui/components/badge";
import {
  BrandCenteredPage,
  BrandContainer,
  BrandHeader,
  BrandKicker,
  BrandPage,
  BrandTitle,
  BrandWordmarkLink,
} from "@chofex/ui/components/brand";
import {
  Button,
  ButtonLink,
  buttonVariants,
} from "@chofex/ui/components/button";
import { Card, CardContent, CardHeader } from "@chofex/ui/components/card";
import { Checkbox } from "@chofex/ui/components/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@chofex/ui/components/drawer";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@chofex/ui/components/input-group";
import { RowAction } from "@chofex/ui/components/row-action";
import { Textarea } from "@chofex/ui/components/textarea";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleUserRoundIcon,
  CopyIcon,
  ExternalLinkIcon,
  ImageIcon,
  MailIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  SparklesIcon,
  SquareCodeIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { CandidateFunnel } from "@/components/candidate-funnel";
import { CandidateRankingRows } from "@/components/candidate-ranking-rows";
import { CountryFilter } from "@/components/country-filter";
import { brandName } from "@/components/landing/content";
import { ParticipantCountry } from "@/components/participant-country";
import {
  type CandidateFilters,
  candidateFilterQuery,
  parseCandidateFilters,
} from "@/lib/admin/candidate-filters";
import {
  candidateKeys,
  candidateListOptions,
  submitCandidateDecision,
} from "@/lib/admin/candidate-queries";
import {
  candidateLastUpdatedAt,
  candidateTimeline,
} from "@/lib/admin/candidate-timeline";
import {
  applicationDataStatus,
  challengeReviewStatus,
  completedChallengeMetrics,
  formatChallengeCompletionDuration,
} from "@/lib/admin/review-metrics";
import type {
  Candidate,
  CandidateCounts,
  CandidateFilter,
  CandidateFunnelStatus,
  CandidatePage,
  CandidateRankingSort,
  CandidateStatus,
} from "@/lib/admin/types";
import {
  candidateFunnelStatuses,
  candidateRankingSorts,
  parseCandidateFilter,
  parseCandidateRankingSort,
  reviewableCandidateStatuses,
} from "@/lib/admin/types";
import { whatsappMessage, whatsappUrl } from "@/lib/admin/whatsapp";
import { participantDisplayName } from "@/lib/challenges/names";
import { formatChallengeScore } from "@/lib/challenges/score";

interface CandidateDashboardProps {
  readonly data: CandidatePage;
  readonly initialFilters: CandidateFilters;
  readonly initialSelection?: "first" | "last";
}

interface StatusStyle {
  readonly label: string;
  readonly variant:
    | "statusDraft"
    | "statusSubmitted"
    | "statusUnderReview"
    | "statusWaitlisted"
    | "statusAccepted"
    | "statusRejected"
    | "statusWithdrawn";
}

const applicationStatusStyles: Record<CandidateStatus, StatusStyle> = {
  draft: {
    label: "Draft",
    variant: "statusDraft",
  },
  submitted: {
    label: "Submitted",
    variant: "statusSubmitted",
  },
  under_review: {
    label: "In review",
    variant: "statusUnderReview",
  },
  waitlisted: {
    label: "Waitlisted",
    variant: "statusWaitlisted",
  },
  accepted: {
    label: "Accepted",
    variant: "statusAccepted",
  },
  rejected: {
    label: "Declined",
    variant: "statusRejected",
  },
  withdrawn: {
    label: "Withdrawn",
    variant: "statusWithdrawn",
  },
};

const funnelStatusStyles: Record<CandidateFunnelStatus, StatusStyle> = {
  registration_started: {
    label: "Registro iniciado",
    variant: "statusDraft",
  },
  registration_completed: {
    label: "Registro completo",
    variant: "statusSubmitted",
  },
  challenge_started: {
    label: "Reto iniciado",
    variant: "statusUnderReview",
  },
  challenge_completed: {
    label: "Reto completado",
    variant: "statusAccepted",
  },
  approved: {
    label: "Aprobados",
    variant: "statusAccepted",
  },
  declined: {
    label: "Rechazados",
    variant: "statusRejected",
  },
};

const reviewableStatuses = new Set<CandidateStatus>(
  reviewableCandidateStatuses,
);

const filterStatuses: ReadonlyArray<{
  readonly value?: CandidateFilter;
  readonly label: string;
  readonly countKey: keyof CandidateCounts;
}> = [
  { label: "Todos", countKey: "all" },
  ...candidateFunnelStatuses.map((status) => ({
    value: status,
    label: funnelStatusStyles[status].label,
    countKey: status,
  })),
];

const displayName = (candidate: Candidate): string =>
  candidate.name || participantDisplayName(candidate);

const WhatsAppIcon = ({ className }: { readonly className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47a8.9 8.9 0 0 1-1.65-2.06c-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.91-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.1 4.5.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35M12.04 21.5h-.01a9.47 9.47 0 0 1-4.83-1.32l-.35-.2-3.59.94.96-3.5-.23-.36A9.46 9.46 0 0 1 2.54 12c0-5.23 4.26-9.49 9.5-9.49a9.42 9.42 0 0 1 6.71 2.79A9.41 9.41 0 0 1 21.54 12c0 5.24-4.26 9.5-9.5 9.5m8.08-17.58A11.34 11.34 0 0 0 12.05.58C5.76.58.65 5.7.65 12c0 2 .52 3.96 1.51 5.68L.55 23.55l6-1.57a11.4 11.4 0 0 0 5.49 1.4h.01c6.29 0 11.41-5.12 11.41-11.4 0-3.05-1.19-5.92-3.34-8.07" />
  </svg>
);

const WhatsAppLink = ({
  candidate,
  adminFirstName,
}: {
  readonly candidate: Candidate;
  readonly adminFirstName?: string;
}) => {
  const phone = candidate.phone ?? candidate.applicationPhone;
  const [publicFirstName] = candidate.name.trim().split(/\s+/);
  const message = whatsappMessage({
    participantFirstName: publicFirstName || candidate.firstName,
    adminFirstName,
    funnelStatus: candidate.funnelStatus,
    attendanceCompleted: Boolean(candidate.attendanceCompletedAt),
  });
  const href = whatsappUrl(phone, message);
  if (!href) return null;

  const label = `Message ${displayName(candidate)} on WhatsApp`;
  return (
    <a
      className="relative z-20 inline-flex size-7 shrink-0 items-center justify-center text-[#1fa855] transition-colors hover:text-[#168a45] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
    >
      <WhatsAppIcon className="size-4" />
    </a>
  );
};

const initials = (candidate: Candidate): string => {
  const words = candidate.name.trim().split(/\s+/).filter(Boolean);
  const [first, second] = words;
  if (!first) {
    return `${candidate.firstName.charAt(0)}${candidate.lastName.charAt(0)}`.toUpperCase();
  }
  if (second) return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
  return first.slice(0, 2).toUpperCase();
};

const CandidateAvatar = ({
  candidate,
  className,
}: {
  readonly candidate: Candidate;
  readonly className: string;
}) => {
  const avatarUrl = safeUrl(candidate.avatarUrl);
  const [failedUrl, setFailedUrl] = useState<string>();
  if (avatarUrl && avatarUrl !== failedUrl) {
    return (
      <span className={`${className} overflow-hidden`}>
        <Image
          src={avatarUrl}
          alt=""
          width={56}
          height={56}
          unoptimized
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(avatarUrl)}
        />
      </span>
    );
  }

  return (
    <span className={`${className} overflow-hidden`}>
      {initials(candidate)}
    </span>
  );
};

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat("es-PE", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(value));

const formatCalendarDate = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));

const titleCase = (value: string): string =>
  value
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

const safeUrl = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return undefined;
  }
  return undefined;
};

const ApplicationStatusBadge = ({
  status,
}: {
  readonly status: CandidateStatus;
}) => {
  const style = applicationStatusStyles[status];
  return (
    <Badge variant={style.variant}>
      <span className="size-1.5 rounded-full bg-current opacity-60" />
      {style.label}
    </Badge>
  );
};

const FunnelStatusBadge = ({
  status,
}: {
  readonly status: CandidateFunnelStatus;
}) => {
  const style = funnelStatusStyles[status];
  return (
    <Badge variant={style.variant}>
      <span className="size-1.5 rounded-full bg-current opacity-60" />
      {style.label}
    </Badge>
  );
};

type ChallengeProgress = Candidate["challenges"][number];

const challengeStatusVariant = (
  challenge: ChallengeProgress,
): "statusAccepted" | "statusSubmitted" | "statusDraft" => {
  if (challenge.status === "evaluated") return "statusAccepted";
  if (challenge.status === "in_progress") return "statusSubmitted";
  return "statusDraft";
};

const ChallengeStatusBadge = ({
  challenge,
}: {
  readonly challenge: ChallengeProgress;
}) => (
  <Badge variant={challengeStatusVariant(challenge)}>
    <span className="size-1.5 rounded-full bg-current opacity-60" />
    {challengeReviewStatus(challenge)}
  </Badge>
);

const challengeAvailability = (challenge: ChallengeProgress): string => {
  if (!challenge.playable) return "Coming later";
  if (challenge.closed) return "Cerrado";
  if (challenge.open) return "Open";
  return "Not open yet";
};

const completedChallengeSummary = (
  candidate: Candidate,
): string | undefined => {
  const metrics = completedChallengeMetrics(candidate.challenges);
  if (!metrics) return undefined;
  const details: Array<string> = [];
  if (metrics.accuracy !== undefined) {
    details.push(`Puntaje ${formatChallengeScore(metrics.accuracy)}`);
  }
  if (metrics.durationMs !== undefined) {
    details.push(
      `Tiempo ${formatChallengeCompletionDuration(metrics.durationMs)}`,
    );
  }
  if (details.length === 0) return undefined;
  return details.join(" · ");
};

const EmptyValue = () => (
  <span className="text-muted-foreground/60">Not provided</span>
);

const Detail = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children?: React.ReactNode;
}) => (
  <div className="space-y-1">
    <dt className="text-xs font-medium tracking-wide text-muted-foreground">
      {label}
    </dt>
    <dd className="text-sm leading-6 text-foreground">
      {children || <EmptyValue />}
    </dd>
  </div>
);

const CandidateLink = ({
  href,
  label,
  icon,
}: {
  readonly href?: string;
  readonly label: string;
  readonly icon: React.ReactNode;
}) => {
  const safeHref = safeUrl(href);
  if (!safeHref) return null;
  return (
    <ButtonLink
      variant="outline"
      size="sm"
      href={safeHref}
      target="_blank"
      rel="noreferrer"
    >
      {icon}
      {label}
      <ExternalLinkIcon className="text-muted-foreground" />
    </ButtonLink>
  );
};

type CopyEmailStatus = "idle" | "copied" | "failed";

const CopyEmailButton = ({ email }: { readonly email: string }) => {
  const [status, setStatus] = useState<CopyEmailStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(
    () => () => {
      if (resetTimer.current !== undefined) clearTimeout(resetTimer.current);
    },
    [],
  );

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }

    if (resetTimer.current !== undefined) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 3_000);
  };

  let label = "Copy email address";
  let icon = <CopyIcon />;
  if (status === "copied") {
    label = "Email address copied";
    icon = <CheckIcon />;
  } else if (status === "failed") {
    label = "Could not copy email address";
    icon = <TriangleAlertIcon />;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground hover:text-foreground"
      onClick={copyEmail}
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  );
};

const CandidateActivityTimeline = ({
  candidate,
}: {
  readonly candidate: Candidate;
}) => {
  const events = candidateTimeline(candidate);
  return (
    <div>
      <h3 className="text-sm font-semibold">Activity timeline</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Recorded milestones from sign-up through participation.
      </p>
      <ol className="mt-4 ml-1.5 border-l border-border">
        {events.map((event) => (
          <li key={event.id} className="relative pb-5 pl-5 last:pb-0">
            <span
              aria-hidden="true"
              className="absolute top-1 -left-1.5 size-3 border-2 border-background bg-primary"
            />
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div>
                <p className="text-sm font-medium">{event.title}</p>
                {event.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.description}
                  </p>
                )}
              </div>
              <time
                dateTime={event.at}
                className="text-xs text-muted-foreground"
              >
                {formatDateTime(event.at)}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

const CandidateDrawer = ({
  candidate,
  initialDecision,
  adminFirstName,
  open,
  onOpenChange,
  onPrevious,
  onNext,
  onCandidateUpdated,
  hasPrevious,
  hasNext,
}: {
  readonly candidate?: Candidate;
  readonly initialDecision?: "accepted" | "rejected";
  readonly adminFirstName?: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onCandidateUpdated: (
    previousStatus: CandidateFunnelStatus,
    candidate: Candidate,
  ) => void;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}) => {
  const [message, setMessage] = useState("");
  const [stagedDecision, setStagedDecision] = useState(initialDecision);
  const [notify, setNotify] = useState(true);
  const [countryDialogOpen, setCountryDialogOpen] = useState(false);
  const decisionMutation = useMutation({
    mutationFn: submitCandidateDecision,
    onSuccess: (result) => {
      const previousStatus =
        candidate?.funnelStatus ?? result.candidate.funnelStatus;
      onCandidateUpdated(previousStatus, result.candidate);
    },
  });

  useEffect(() => {
    if (!open || countryDialogOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if ((event.key === "ArrowLeft" || event.key === "k") && hasPrevious) {
        event.preventDefault();
        onPrevious();
      }
      if ((event.key === "ArrowRight" || event.key === "j") && hasNext) {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasNext, hasPrevious, onNext, onPrevious, open, countryDialogOpen]);

  if (!candidate) return null;

  const challengeSummary = completedChallengeSummary(candidate);

  const submitDecision = (decision: "accepted" | "rejected") => {
    decisionMutation.mutate({
      candidateId: candidate.id,
      decision,
      message,
      notify: decision === "accepted" || notify,
    });
  };

  let failedDecision: "accepted" | "rejected" | undefined;
  if (
    decisionMutation.data?.emailStatus === "failed" ||
    decisionMutation.data?.badgeStatus === "failed"
  ) {
    failedDecision = decisionMutation.variables?.decision;
  }
  let feedback: string | undefined;
  if (decisionMutation.isError) {
    feedback = decisionMutation.error.message;
  } else if (decisionMutation.data?.emailStatus === "failed") {
    feedback =
      decisionMutation.data.emailError ??
      "Decision saved, but the notification email failed.";
  } else if (decisionMutation.data?.badgeStatus === "failed") {
    feedback =
      decisionMutation.data.badgeError ??
      "La decisión se guardó, pero no se pudo iniciar la generación del carnet.";
  } else if (decisionMutation.data?.emailStatus === "pending") {
    feedback =
      "Decisión guardada. El correo se enviará cuando el carnet esté listo.";
  } else if (decisionMutation.data?.emailStatus === "sent") {
    if (decisionMutation.data.badgeStatus === "pending") {
      feedback =
        "Decisión guardada, correo enviado y generación del carnet iniciada.";
    } else {
      feedback = "Decisión guardada y correo enviado.";
    }
  } else if (decisionMutation.data?.emailStatus === "not_requested") {
    feedback = "Decisión guardada sin enviar un correo.";
  }
  const isReviewable = reviewableStatuses.has(candidate.status);
  const canAccept =
    Boolean(candidate.rankingResult) ||
    candidate.challenges.some(
      (challenge) => challenge.playable && challenge.bestAccuracy !== undefined,
    );
  const showDecisionPanel = isReviewable || Boolean(decisionMutation.data);
  let decisionPanelMessage = "Revisa la postulación y confirma tu decisión.";
  if (!isReviewable) {
    decisionPanelMessage = "Decisión guardada.";
    if (failedDecision) decisionPanelMessage = "La entrega necesita atención.";
  }
  let decisionSummary = `Vas a rechazar a ${displayName(candidate)}.`;
  let confirmationLabel = "Confirmar rechazo";
  let confirmationVariant: "default" | "destructive" = "destructive";
  if (stagedDecision === "accepted") {
    decisionSummary = `Vas a aprobar a ${displayName(candidate)}.`;
    confirmationLabel = "Confirmar aprobación";
    confirmationVariant = "default";
  }
  const participation =
    candidate.participationMode && titleCase(candidate.participationMode);
  const teamPreference =
    candidate.teamPreference && titleCase(candidate.teamPreference);
  let attendanceStatus = "Awaiting details";
  if (candidate.attendanceCompletedAt) attendanceStatus = "Complete";
  const checkedIn =
    candidate.checkedInAt && formatDateTime(candidate.checkedInAt);
  const dateOfBirth =
    candidate.dateOfBirth && formatCalendarDate(candidate.dateOfBirth);
  const idDocument = candidate.nationalIdProvided && "Provided securely";
  const dataStatus = applicationDataStatus(candidate.submittedAt);

  return (
    <Drawer
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
      }}
      swipeDirection="right"
    >
      <DrawerContent size="wide" className="shadow-2xl">
        <DrawerHeader className="border-b bg-background/95 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DrawerClose
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Cerrar detalles del participante"
                  />
                }
              >
                <XIcon className="size-4" />
              </DrawerClose>
              <div>
                <DrawerTitle>Detalles del participante</DrawerTitle>
                <DrawerDescription className="text-xs">
                  Revisa la postulación y decide
                </DrawerDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={onPrevious}
                disabled={!hasPrevious}
                aria-label="Previous candidate (K or left arrow)"
                title="Previous (K or ←)"
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onNext}
                disabled={!hasNext}
                aria-label="Next candidate (J or right arrow)"
                title="Next (J or →)"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
          <section className="border-b bg-background px-5 py-6 sm:px-7">
            <div className="flex items-start gap-4">
              <CandidateAvatar
                candidate={candidate}
                className="grid size-14 shrink-0 place-items-center border border-border bg-muted text-sm font-semibold text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-1 text-xl font-semibold tracking-tight">
                      <span>{displayName(candidate)}</span>
                      <ParticipantCountry
                        key={candidate.id}
                        candidate={candidate}
                        onOpenChange={setCountryDialogOpen}
                      />
                      <WhatsAppLink
                        candidate={candidate}
                        adminFirstName={adminFirstName}
                      />
                    </h2>
                    <div className="mt-1 flex items-center gap-1">
                      <a
                        className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                        href={`mailto:${candidate.email}`}
                      >
                        <MailIcon className="size-3.5" />
                        <span className="truncate">
                          {candidate.email || "No email provided"}
                        </span>
                      </a>
                      {candidate.email && (
                        <CopyEmailButton
                          key={candidate.id}
                          email={candidate.email}
                        />
                      )}
                    </div>
                  </div>
                  <FunnelStatusBadge status={candidate.funnelStatus} />
                </div>
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  Attempt {candidate.attemptNumber}
                  {challengeSummary && ` · ${challengeSummary}`}
                </p>
                {candidate.rankingResult && (
                  <p className="mt-2 text-sm font-medium text-primary">
                    Posición global #{candidate.rankingResult.rank} · Puntaje{" "}
                    {formatChallengeScore(
                      candidate.rankingResult.score.accuracy,
                    )}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <CandidateLink
                    href={candidate.githubUrl}
                    label="GitHub"
                    icon={<SquareCodeIcon className="size-3.5" />}
                  />
                  <CandidateLink
                    href={candidate.linkedInUrl}
                    label="LinkedIn"
                    icon={<CircleUserRoundIcon className="size-3.5" />}
                  />
                  <CandidateLink
                    href={candidate.portfolioUrl}
                    label="Portfolio"
                    icon={<SparklesIcon className="size-3.5" />}
                  />
                  <CandidateLink
                    href={candidate.badgeUrl}
                    label="View badge"
                    icon={<ImageIcon className="size-3.5" />}
                  />
                </div>
              </div>
            </div>
          </section>

          {showDecisionPanel && (
            <section className="border-b bg-background px-5 py-5 sm:px-7">
              <Card size="sm" className="gap-0 py-0">
                <CardHeader className="border-b py-3 text-sm font-medium">
                  {decisionPanelMessage}
                </CardHeader>
                <CardContent className="space-y-3 py-4">
                  {(isReviewable || failedDecision) && (
                    <div className="space-y-3">
                      <label
                        htmlFor="notify-candidate"
                        className="flex cursor-pointer items-center gap-2 text-sm font-medium"
                      >
                        <Checkbox
                          id="notify-candidate"
                          checked={notify}
                          onCheckedChange={setNotify}
                          disabled={Boolean(failedDecision)}
                        />
                        Notificar el rechazo por correo
                      </label>
                      <p className="text-xs text-muted-foreground">
                        La aceptación siempre envía las instrucciones de
                        confirmación. Esta opción controla los avisos de
                        rechazo.
                      </p>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="candidate-message"
                          className="text-xs font-medium"
                        >
                          Mensaje opcional
                        </label>
                        <Textarea
                          id="candidate-message"
                          value={message}
                          onChange={(event) => setMessage(event.target.value)}
                          disabled={!notify && stagedDecision !== "accepted"}
                          maxLength={2000}
                          rows={4}
                          placeholder="Agrega un mensaje al correo de decisión"
                          resize="none"
                        />
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>
                            El correo siempre incluye las instrucciones de la
                            decisión.
                          </span>
                          <span>{message.length}/2,000</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {isReviewable && !stagedDecision && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => setStagedDecision("accepted")}
                        disabled={decisionMutation.isPending || !canAccept}
                      >
                        <CheckIcon />
                        Aprobar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setStagedDecision("rejected")}
                        disabled={decisionMutation.isPending}
                      >
                        <XIcon />
                        Rechazar
                      </Button>
                    </div>
                  )}
                  {isReviewable && !canAccept && (
                    <p className="text-xs text-muted-foreground">
                      Para aprobar necesita un resultado evaluado de la versión
                      actual de un reto.
                    </p>
                  )}
                  {isReviewable && stagedDecision && (
                    <div className="space-y-3">
                      <p className="text-sm">{decisionSummary}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={confirmationVariant}
                          onClick={() => submitDecision(stagedDecision)}
                          disabled={
                            decisionMutation.isPending ||
                            (stagedDecision === "accepted" && !canAccept)
                          }
                        >
                          {confirmationLabel}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={decisionMutation.isPending}
                          onClick={() => setStagedDecision(undefined)}
                        >
                          Cambiar decisión
                        </Button>
                      </div>
                    </div>
                  )}
                  {failedDecision && (
                    <Button
                      className="w-full"
                      onClick={() => submitDecision(failedDecision)}
                      disabled={decisionMutation.isPending}
                    >
                      <MailIcon />
                      Reintentar entrega
                    </Button>
                  )}
                  {feedback && (
                    <p
                      role="status"
                      className="border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
                    >
                      {feedback}
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          <section className="space-y-5 px-5 py-6 sm:px-7">
            <CandidateActivityTimeline candidate={candidate} />

            <div className="border-t pt-5">
              <h3 className="text-sm font-semibold">Application</h3>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
                <Detail label="Application state">
                  <ApplicationStatusBadge status={candidate.status} />
                </Detail>
                <Detail label="Application data">{dataStatus}</Detail>
                <Detail label="Submitted at">
                  {candidate.submittedAt &&
                    formatDateTime(candidate.submittedAt)}
                </Detail>
                <Detail label="Draft created">
                  {formatDateTime(candidate.createdAt)}
                </Detail>
                <Detail label="Attempt">
                  {candidate.attemptNumber.toString()}
                </Detail>
                <Detail label="Location">
                  {[candidate.city, candidate.countryCode]
                    .filter(Boolean)
                    .join(", ")}
                </Detail>
                <Detail label="Role">{candidate.role}</Detail>
                <Detail label="Phone">{candidate.applicationPhone}</Detail>
                <Detail label="Organization">{candidate.organization}</Detail>
                <Detail label="Pronouns">{candidate.pronouns}</Detail>
                <Detail label="Field of study">{candidate.fieldOfStudy}</Detail>
                <Detail label="Graduation year">
                  {candidate.graduationYear?.toString()}
                </Detail>
                <Detail label="Participation">{participation}</Detail>
                <Detail label="Team preference">{teamPreference}</Detail>
                <Detail label="Team name">{candidate.teamName}</Detail>
                <Detail label="Media consent">
                  {candidate.mediaConsent ? "Granted" : "Not granted"}
                </Detail>
                <Detail label="Decision time">
                  {candidate.decidedAt && formatDateTime(candidate.decidedAt)}
                </Detail>
                {candidate.status === "accepted" && (
                  <Detail label="Approved by">{candidate.approvedBy}</Detail>
                )}
              </dl>
            </div>

            <div className="border-t pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Retos técnicos</h3>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                    Compara los resultados actuales en Rankings. La aprobación
                    es manual y requiere un resultado de la versión actual de un
                    reto.
                  </p>
                </div>
                <ButtonLink
                  variant="outline"
                  size="sm"
                  href={pageHref({
                    page: 1,
                    query: "",
                    view: "ranking",
                    ranking:
                      candidate.rankingResult?.slug ?? candidateRankingSorts[0],
                  })}
                >
                  Rankings de selección
                  <ExternalLinkIcon />
                </ButtonLink>
              </div>
              <div className="mt-4 space-y-3">
                {candidate.challenges.map((challenge) => (
                  <div
                    key={challenge.slug}
                    className="border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          {challenge.theme}
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {challenge.title}
                        </p>
                      </div>
                      <ChallengeStatusBadge challenge={challenge} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                      <Detail label="Availability">
                        {challengeAvailability(challenge)}
                      </Detail>
                      {challenge.queriesLimit > 0 && (
                        <Detail label="Queries used">
                          {challenge.queriesUsed} / {challenge.queriesLimit}
                        </Detail>
                      )}
                      <Detail label="Official attempts">
                        {challenge.evaluationsUsed} /{" "}
                        {challenge.evaluationsLimit}
                      </Detail>
                      <Detail label="Puntaje">
                        {challenge.bestAccuracy !== undefined &&
                          formatChallengeScore(challenge.bestAccuracy)}
                      </Detail>
                      <Detail label="Exact matches">
                        {challenge.bestExactCount?.toString()}
                      </Detail>
                      <Detail label="Posición">
                        {candidate.rankingResult?.slug === challenge.slug &&
                          `#${candidate.rankingResult.rank}`}
                        {candidate.rankingResult?.slug !== challenge.slug &&
                          challenge.rank !== undefined &&
                          `#${challenge.rank}`}
                      </Detail>
                    </dl>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-5">
              <h3 className="text-sm font-semibold">Projects & story</h3>
              <dl className="mt-4 space-y-5">
                <Detail label="What have you shipped?">
                  {candidate.shippedProject}
                </Detail>
                <Detail label="What do you want to ship at the hackathon?">
                  {candidate.hackathonProject}
                </Detail>
                <Detail label="Bio">{candidate.bio}</Detail>
              </dl>
            </div>

            {(candidate.status === "accepted" ||
              candidate.attendanceCompletedAt) && (
              <div className="border-t pt-5">
                <h3 className="text-sm font-semibold">Attendance details</h3>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
                  <Detail label="Details status">{attendanceStatus}</Detail>
                  <Detail label="Checked in">{checkedIn}</Detail>
                  <Detail label="Full name on ID">
                    {candidate.documentFullName}
                  </Detail>
                  <Detail label="Phone">{candidate.phone}</Detail>
                  <Detail label="Date of birth">{dateOfBirth}</Detail>
                  <Detail label="Shirt size">
                    {candidate.shirtSize?.toUpperCase()}
                  </Detail>
                  <Detail label="ID document">{idDocument}</Detail>
                  <Detail label="Emergency contact">
                    {candidate.emergencyContactName}
                  </Detail>
                  <Detail label="Emergency phone">
                    {candidate.emergencyContactPhone}
                  </Detail>
                  <Detail label="Dietary restrictions">
                    {candidate.dietaryRestrictions}
                  </Detail>
                  <Detail label="Accessibility needs">
                    {candidate.accessibilityNeeds}
                  </Detail>
                </dl>
              </div>
            )}

            {candidate.decisionHistory.length > 0 && (
              <div className="border-t pt-5">
                <h3 className="text-sm font-semibold">Decision history</h3>
                <ol className="mt-4 space-y-3">
                  {candidate.decisionHistory.map((decision) => (
                    <li
                      key={decision.applicationId}
                      className="border bg-background p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ApplicationStatusBadge status={decision.decision} />
                          <span className="text-xs text-muted-foreground">
                            Attempt {decision.attemptNumber}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(decision.at)}
                        </span>
                      </div>
                      <dl className="mt-3 space-y-3">
                        <Detail label="Decided by">{decision.decidedBy}</Detail>
                        {decision.decision === "rejected" && (
                          <Detail label="Message">
                            {decision.message || "No message provided"}
                          </Detail>
                        )}
                      </dl>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

const pageHref = (
  filters: CandidateFilters,
  selection?: "first" | "last",
): string => {
  const parameters = new URLSearchParams(candidateFilterQuery(filters));
  if (selection) parameters.set("candidate", selection);
  const suffix = parameters.toString();
  if (suffix) return `/admin/participants?${suffix}`;
  return "/admin/participants";
};

const visiblePages = (
  page: number,
  totalPages: number,
): ReadonlyArray<number> => {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export function CandidateDashboard({
  data,
  initialFilters,
  initialSelection,
}: CandidateDashboardProps) {
  const { user } = useUser();
  const adminFirstName = user?.firstName ?? undefined;
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(initialFilters.query);
  const [filters, setFilters] = useState(initialFilters);
  const [initialDataUpdatedAt] = useState(Date.now);
  let initiallySelectedId: string | undefined;
  if (initialSelection === "first") {
    initiallySelectedId = data.candidates[0]?.id;
  }
  if (initialSelection === "last") {
    initiallySelectedId = data.candidates.at(-1)?.id;
  }
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initiallySelectedId,
  );
  const [reviewDecision, setReviewDecision] = useState<
    "accepted" | "rejected"
  >();
  const openReview = (
    candidateId: string,
    decision?: "accepted" | "rejected",
  ) => {
    setReviewDecision(decision);
    setSelectedId(candidateId);
  };
  const [pendingPageSelection, setPendingPageSelection] = useState<
    "first" | "last"
  >();
  const isInitialList =
    candidateFilterQuery(filters) === candidateFilterQuery(initialFilters);
  const candidateQuery = useQuery({
    ...candidateListOptions(filters),
    initialData: isInitialList ? data : undefined,
    initialDataUpdatedAt,
    placeholderData: keepPreviousData,
  });
  const currentData = candidateQuery.data ?? data;
  const isRankingView = filters.view === "ranking";
  let searchLabel = "Buscar participantes";
  if (isRankingView) searchLabel = "Buscar en este ranking";
  const selectedIndex = currentData.candidates.findIndex(
    (candidate) => candidate.id === selectedId,
  );
  const selectedCandidate = currentData.candidates[selectedIndex];
  const resultsUnavailable =
    candidateQuery.isPlaceholderData || candidateQuery.isError;
  let resultSummary = `${currentData.total} participantes`;
  if (currentData.total === 1) resultSummary = "1 participante";
  if (candidateQuery.isError) {
    resultSummary = "No se pudieron actualizar los resultados.";
  } else if (candidateQuery.isPlaceholderData) {
    resultSummary = "Actualizando resultados…";
  }

  useEffect(() => {
    if (!candidateQuery.isSuccess || candidateQuery.isPlaceholderData) return;
    if (selectedId && !selectedCandidate) setSelectedId(undefined);
  }, [
    candidateQuery.isSuccess,
    candidateQuery.isPlaceholderData,
    selectedId,
    selectedCandidate,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const nextFilters = parseCandidateFilters(
        new URL(window.location.href).searchParams,
      );
      setFilters(nextFilters);
      setQuery(nextFilters.query);
      setSelectedId(undefined);
      setReviewDecision(undefined);
      setPendingPageSelection(undefined);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!candidateQuery.isSuccess || candidateQuery.isPlaceholderData) return;
    if (currentData.page === filters.page) return;
    const nextFilters = { ...filters, page: currentData.page };
    queryClient.setQueryData(candidateKeys.list(nextFilters), currentData);
    window.history.replaceState(null, "", pageHref(nextFilters));
    setFilters(nextFilters);
  }, [
    candidateQuery.isSuccess,
    candidateQuery.isPlaceholderData,
    currentData,
    filters,
    queryClient,
  ]);

  useEffect(() => {
    if (!pendingPageSelection || candidateQuery.isPlaceholderData) return;
    let candidate = currentData.candidates[0];
    if (pendingPageSelection === "last") {
      candidate = currentData.candidates.at(-1);
    }
    setSelectedId(candidate?.id);
    setPendingPageSelection(undefined);
  }, [candidateQuery.isPlaceholderData, currentData, pendingPageSelection]);

  const navigateTo = (
    nextFilters: CandidateFilters,
    selection?: "first" | "last",
  ) => {
    if (
      candidateFilterQuery(nextFilters) === candidateFilterQuery(filters) &&
      !selection
    )
      return;
    window.history.pushState(null, "", pageHref(nextFilters));
    setFilters(nextFilters);
    setReviewDecision(undefined);
    setPendingPageSelection(selection);
    if (!selection) setSelectedId(undefined);
  };

  const navigateFromClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    nextFilters: CandidateFilters,
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigateTo(nextFilters);
  };

  const goToCandidate = (index: number) => {
    const candidate = currentData.candidates[index];
    if (candidate) openReview(candidate.id);
  };

  const goToPreviousCandidate = () => {
    if (selectedIndex > 0) {
      goToCandidate(selectedIndex - 1);
      return;
    }
    if (currentData.page > 1) {
      navigateTo({ ...filters, page: currentData.page - 1 }, "last");
    }
  };

  const goToNextCandidate = () => {
    if (selectedIndex < currentData.candidates.length - 1) {
      goToCandidate(selectedIndex + 1);
      return;
    }
    if (currentData.page < currentData.totalPages) {
      navigateTo({ ...filters, page: currentData.page + 1 }, "first");
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigateTo({
      ...filters,
      page: 1,
      query: query.trim().slice(0, 200),
    });
  };

  const handleCandidateUpdated = (
    previousStatus: CandidateFunnelStatus,
    updatedCandidate: Candidate,
  ) => {
    queryClient.setQueryData<CandidatePage>(
      candidateKeys.list(filters),
      (cachedPage) => {
        if (!cachedPage) return cachedPage;
        let counts = cachedPage.counts;
        if (previousStatus !== updatedCandidate.funnelStatus) {
          counts = {
            ...counts,
            [previousStatus]: Math.max(0, counts[previousStatus] - 1),
            [updatedCandidate.funnelStatus]:
              counts[updatedCandidate.funnelStatus] + 1,
          };
        }
        const candidates = cachedPage.candidates.map((candidate) => {
          if (candidate.id === updatedCandidate.id) {
            return {
              ...updatedCandidate,
              rankingResult: candidate.rankingResult,
            };
          }
          return candidate;
        });
        return { ...cachedPage, candidates, counts };
      },
    );
    void queryClient.invalidateQueries({
      queryKey: candidateKeys.all,
      refetchType: "none",
    });
  };

  const pageNumbers = useMemo(
    () => visiblePages(currentData.page, currentData.totalPages),
    [currentData.page, currentData.totalPages],
  );
  let firstResult = 0;
  if (currentData.total > 0) {
    firstResult = (currentData.page - 1) * currentData.pageSize + 1;
  }
  const lastResult = Math.min(
    currentData.page * currentData.pageSize,
    currentData.total,
  );

  return (
    <BrandPage className="overflow-hidden">
      <BrandHeader>
        <div>
          <BrandWordmarkLink href="/">{brandName}</BrandWordmarkLink>
          <BrandKicker className="mt-1 text-muted-foreground">
            Lima / revisión de participantes
          </BrandKicker>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:inline-flex">
            Equipo organizador
          </Badge>
          <UserButton
            appearance={{
              elements: {
                userButtonTrigger: buttonVariants({
                  variant: "ghost",
                  size: "icon",
                }),
              },
            }}
          />
        </div>
      </BrandHeader>

      <main>
        <BrandContainer className="py-10 sm:py-14">
          <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <BrandKicker className="mb-3 text-primary">
                Revisión de postulaciones
              </BrandKicker>
              <BrandTitle as="h1" className="text-3xl sm:text-6xl">
                {isRankingView ? "Rankings" : "Participantes"}
              </BrandTitle>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Revisa postulaciones y compara resultados para seleccionar
                participantes.
              </p>
            </div>
            <ButtonLink
              variant="outline"
              href={`/admin/insights?${candidateFilterQuery({ page: 1, query: "", country: filters.country, challenge: filters.challenge })}`}
            >
              Ver estadísticas
            </ButtonLink>
          </section>

          <nav
            aria-label="Vistas de selección"
            className="mt-6 flex flex-wrap gap-2"
          >
            <ButtonLink
              variant={isRankingView ? "outline" : "default"}
              href={pageHref({
                ...filters,
                page: 1,
                view: undefined,
                ranking: undefined,
              })}
              aria-current={!isRankingView ? "page" : undefined}
              onClick={(event) =>
                navigateFromClick(event, {
                  ...filters,
                  page: 1,
                  view: undefined,
                  ranking: undefined,
                })
              }
            >
              Participantes
            </ButtonLink>
            <ButtonLink
              variant={isRankingView ? "default" : "outline"}
              href={pageHref({
                ...filters,
                page: 1,
                view: "ranking",
                ranking: filters.ranking ?? candidateRankingSorts[0],
              })}
              aria-current={isRankingView ? "page" : undefined}
              onClick={(event) =>
                navigateFromClick(event, {
                  ...filters,
                  page: 1,
                  view: "ranking",
                  ranking: filters.ranking ?? candidateRankingSorts[0],
                })
              }
            >
              Rankings
            </ButtonLink>
          </nav>

          {isRankingView && (
            <section className="mt-5 border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Rankings de selección
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Todos los resultados de la versión actual, disponibles para
                    el equipo organizador en cualquier momento. Los filtros no
                    cambian la posición global.
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={candidateQuery.isFetching}
                  onClick={() => void candidateQuery.refetch()}
                >
                  <RefreshCwIcon />
                  Actualizar
                </Button>
              </div>
              {currentData.ranking && !resultsUnavailable && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {currentData.ranking.competitorCount} participantes en el
                  ranking global · Actualizado{" "}
                  {formatDateTime(currentData.ranking.updatedAt)} · Se actualiza
                  cada minuto
                </p>
              )}
            </section>
          )}

          {!isRankingView && (
            <CandidateFunnel
              data={currentData}
              unavailable={resultsUnavailable}
            />
          )}

          <section className="mt-8">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(16rem,1.5fr)_minmax(12rem,1fr)_minmax(12rem,1fr)]">
              <form
                onSubmit={handleSearch}
                className="col-span-2 min-w-0 xl:col-span-1"
              >
                <label
                  htmlFor="candidate-search"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  {searchLabel}
                </label>
                <InputGroup>
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="candidate-search"
                    className="h-11"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nombre, correo, perfil, ID o código"
                    maxLength={200}
                  />
                </InputGroup>
              </form>
              <label className="min-w-0 text-xs font-medium text-muted-foreground">
                <span className="mb-1.5 block">Estado</span>
                <select
                  className="h-11 w-full border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={filters.status ?? ""}
                  name="status"
                  onChange={(event) =>
                    navigateTo({
                      ...filters,
                      page: 1,
                      status: parseCandidateFilter(event.target.value),
                    })
                  }
                >
                  {filterStatuses.map((filter) => {
                    let count = "";
                    if (!resultsUnavailable)
                      count = ` · ${currentData.counts[filter.countKey]}`;
                    return (
                      <option key={filter.countKey} value={filter.value ?? ""}>
                        {filter.label}
                        {count}
                      </option>
                    );
                  })}
                </select>
              </label>
              <CountryFilter
                value={filters.country}
                onChange={(country) =>
                  navigateTo({ ...filters, page: 1, country })
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p role="status" className="text-sm text-muted-foreground">
                  {resultSummary}
                </p>
                {(filters.query ||
                  filters.status ||
                  filters.country ||
                  filters.challenge) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      navigateTo({
                        page: 1,
                        query: "",
                        ranking: filters.ranking,
                        view: filters.view,
                      });
                    }}
                  >
                    Limpiar filtros
                  </Button>
                )}
                {filters.challenge && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigateTo({ ...filters, page: 1, challenge: undefined })
                    }
                  >
                    Iniciaron{" "}
                    {
                      playableChallenges.find(
                        (challenge) => challenge.slug === filters.challenge,
                      )?.theme
                    }
                    <XIcon className="size-3" />
                  </Button>
                )}
              </div>
              <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                {isRankingView ? "Ranking del reto" : "Ordenar por"}
                <select
                  className="h-11 min-w-0 flex-1 border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  value={filters.ranking ?? ""}
                  name="ranking"
                  onChange={(event) => {
                    const ranking = parseCandidateRankingSort(
                      event.target.value || undefined,
                    );
                    navigateTo({ ...filters, page: 1, ranking });
                  }}
                >
                  {!isRankingView && <option value="">Más recientes</option>}
                  {playableChallenges.map((challenge) => (
                    <option key={challenge.slug} value={challenge.slug}>
                      Reto {challenge.code}: {challenge.theme}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {candidateQuery.isError && (
              <p
                role="alert"
                className="mt-4 border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {candidateQuery.error.message}
              </p>
            )}
            <div
              className="mt-4 overflow-hidden border bg-card"
              aria-busy={candidateQuery.isFetching}
              inert={resultsUnavailable}
            >
              {!isRankingView && (
                <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(8rem,.8fr)_minmax(9rem,1fr)_11rem_9rem] gap-4 border-b bg-muted/35 px-5 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:grid">
                  <span>Participante</span>
                  <span>Perfil</span>
                  <span>Ranking de retos</span>
                  <span>Estado</span>
                  <span className="text-right">Última actualización</span>
                </div>
              )}
              {candidateQuery.isPlaceholderData && (
                <p
                  role="status"
                  className="grid min-h-64 place-items-center text-sm text-muted-foreground"
                >
                  Actualizando resultados…
                </p>
              )}
              {!resultsUnavailable && currentData.candidates.length === 0 && (
                <EmptyCandidates
                  isRankingView={isRankingView}
                  participantsHref={pageHref({ page: 1, query: filters.query })}
                />
              )}
              {!resultsUnavailable &&
                isRankingView &&
                currentData.candidates.length > 0 && (
                  <CandidateRankingRows
                    candidates={currentData.candidates}
                    onReview={openReview}
                  />
                )}
              {!resultsUnavailable &&
                !isRankingView &&
                currentData.candidates.length > 0 && (
                  <CandidateRows
                    candidates={currentData.candidates}
                    adminFirstName={adminFirstName}
                    ranking={filters.ranking}
                    onSelect={openReview}
                  />
                )}
            </div>

            <div className="mt-4 flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
              <span>
                Mostrando {firstResult}–{lastResult} de {currentData.total}
              </span>
              <nav
                aria-label="Páginas de participantes"
                className="flex items-center gap-1"
                inert={resultsUnavailable}
              >
                <PaginationArrow
                  href={pageHref({
                    ...filters,
                    page: Math.max(1, currentData.page - 1),
                  })}
                  onClick={(event) =>
                    navigateFromClick(event, {
                      ...filters,
                      page: Math.max(1, currentData.page - 1),
                    })
                  }
                  disabled={currentData.page === 1}
                  label="Página anterior"
                  icon={<ArrowLeftIcon className="size-3.5" />}
                />
                {pageNumbers.map((page) => {
                  const isCurrentPage = page === currentData.page;
                  const variant = isCurrentPage ? "default" : "outline";
                  const ariaCurrent = isCurrentPage ? "page" : undefined;
                  return (
                    <ButtonLink
                      key={page}
                      variant={variant}
                      size="icon"
                      href={pageHref({ ...filters, page })}
                      onClick={(event) =>
                        navigateFromClick(event, { ...filters, page })
                      }
                      aria-current={ariaCurrent}
                    >
                      {page}
                    </ButtonLink>
                  );
                })}
                <PaginationArrow
                  href={pageHref({
                    ...filters,
                    page: Math.min(
                      currentData.totalPages,
                      currentData.page + 1,
                    ),
                  })}
                  onClick={(event) =>
                    navigateFromClick(event, {
                      ...filters,
                      page: Math.min(
                        currentData.totalPages,
                        currentData.page + 1,
                      ),
                    })
                  }
                  disabled={currentData.page === currentData.totalPages}
                  label="Página siguiente"
                  icon={<ArrowRightIcon className="size-3.5" />}
                />
              </nav>
            </div>
          </section>
        </BrandContainer>
      </main>

      <CandidateDrawer
        key={`${selectedCandidate?.id}:${reviewDecision ?? "details"}`}
        candidate={selectedCandidate}
        initialDecision={reviewDecision}
        adminFirstName={adminFirstName}
        open={Boolean(selectedCandidate)}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setSelectedId(undefined);
          if (initialSelection) {
            window.history.replaceState(null, "", pageHref(filters));
          }
          if (
            selectedCandidate &&
            filters.status &&
            selectedCandidate.funnelStatus !== filters.status
          ) {
            void queryClient.invalidateQueries({
              queryKey: candidateKeys.list(filters),
            });
          }
        }}
        onPrevious={goToPreviousCandidate}
        onNext={goToNextCandidate}
        onCandidateUpdated={handleCandidateUpdated}
        hasPrevious={selectedIndex > 0 || currentData.page > 1}
        hasNext={
          selectedIndex >= 0 &&
          (selectedIndex < currentData.candidates.length - 1 ||
            currentData.page < currentData.totalPages)
        }
      />
    </BrandPage>
  );
}

const EmptyCandidates = ({
  isRankingView,
  participantsHref,
}: {
  readonly isRankingView: boolean;
  readonly participantsHref: string;
}) => (
  <div className="grid min-h-64 place-items-center px-6 text-center">
    <div>
      <div className="mx-auto grid size-11 place-items-center border border-border bg-muted">
        <SearchIcon className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium">
        No hay participantes con estos filtros
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Prueba otra búsqueda, estado o país.
      </p>
      {isRankingView && (
        <div className="mt-4">
          <p className="mb-3 max-w-sm text-xs leading-5 text-muted-foreground">
            Esta búsqueda solo incluye participantes del ranking. Busca en
            participantes para encontrar también a quienes no aparecen aquí.
          </p>
          <ButtonLink variant="outline" href={participantsHref}>
            Buscar en participantes
          </ButtonLink>
        </div>
      )}
    </div>
  </div>
);

const CandidateChallengeRanking = ({
  candidate,
  ranking,
  className,
}: {
  readonly candidate: Candidate;
  readonly ranking?: CandidateRankingSort;
  readonly className?: string;
}) => {
  let challenges = candidate.challenges.filter(
    (challenge) => challenge.playable && challenge.status === "evaluated",
  );
  if (ranking) {
    challenges = candidate.challenges.filter(
      (challenge) => challenge.slug === ranking,
    );
  }

  if (challenges.length === 0) {
    return (
      <span className={`text-xs text-muted-foreground ${className ?? ""}`}>
        Sin puntaje
      </span>
    );
  }

  return (
    <span className={`space-y-1 ${className ?? ""}`}>
      {challenges.map((challenge) => (
        <span className="block" key={challenge.slug}>
          <span className="block truncate text-xs font-medium">
            {challenge.theme}
            {challenge.rank !== undefined && ` · #${challenge.rank}`}
          </span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">
            {challenge.bestAccuracy === undefined
              ? "Sin posición"
              : `Puntaje ${formatChallengeScore(challenge.bestAccuracy)}`}
          </span>
        </span>
      ))}
    </span>
  );
};

const CandidateRows = ({
  candidates,
  adminFirstName,
  ranking,
  onSelect,
}: {
  readonly candidates: ReadonlyArray<Candidate>;
  readonly adminFirstName?: string;
  readonly ranking?: CandidateRankingSort;
  readonly onSelect: (candidateId: string) => void;
}) => (
  <div className="divide-y">
    {candidates.map((candidate) => {
      const lastTimelineAt = candidateLastUpdatedAt(candidate);
      let lastUpdatedAt = "—";
      if (lastTimelineAt) {
        lastUpdatedAt = formatDateTime(lastTimelineAt);
      }
      return (
        <RowAction
          label={`Review ${displayName(candidate)}`}
          key={candidate.id}
          onClick={() => onSelect(candidate.id)}
          contentClassName="grid w-full grid-cols-1 justify-start gap-3 px-4 py-4 text-left sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,.8fr)_minmax(9rem,1fr)_11rem_9rem] sm:items-center sm:gap-4 sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <CandidateAvatar
              candidate={candidate}
              className="grid size-9 shrink-0 place-items-center border border-border bg-muted text-[11px] font-semibold text-muted-foreground"
            />
            <span className="min-w-0">
              <span className="flex min-w-0 items-center">
                <span className="truncate text-sm font-medium">
                  {displayName(candidate)}
                </span>
                <ParticipantCountry candidate={candidate} />
                <WhatsAppLink
                  candidate={candidate}
                  adminFirstName={adminFirstName}
                />
                <span className="truncate text-[11px] font-normal text-muted-foreground">
                  Attempt {candidate.attemptNumber}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {candidate.email || "No email provided"}
              </span>
              <CandidateChallengeRanking
                candidate={candidate}
                ranking={ranking}
                className="mt-2 sm:hidden"
              />
            </span>
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm">
              {candidate.role || candidate.fieldOfStudy || "—"}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {candidate.organization || candidate.city || "No organization"}
            </span>
          </span>
          <CandidateChallengeRanking
            candidate={candidate}
            ranking={ranking}
            className="hidden sm:block"
          />
          <span className="ml-12 sm:ml-0">
            <FunnelStatusBadge status={candidate.funnelStatus} />
          </span>
          <span className="hidden items-center justify-end gap-2 text-xs text-muted-foreground sm:flex">
            {lastUpdatedAt}
            <ChevronRightIcon className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </span>
        </RowAction>
      );
    })}
  </div>
);

const PaginationArrow = ({
  href,
  onClick,
  disabled,
  label,
  icon,
}: {
  readonly href: string;
  readonly onClick: React.MouseEventHandler<HTMLAnchorElement>;
  readonly disabled: boolean;
  readonly label: string;
  readonly icon: React.ReactNode;
}) => {
  if (disabled) {
    return (
      <Button variant="outline" size="icon" disabled aria-label={label}>
        {icon}
      </Button>
    );
  }

  return (
    <ButtonLink
      variant="outline"
      size="icon"
      href={href}
      onClick={onClick}
      aria-label={label}
    >
      {icon}
    </ButtonLink>
  );
};

export const AdminAccessDenied = () => (
  <BrandCenteredPage>
    <Card className="w-full max-w-md p-4 text-center">
      <div className="mx-auto grid size-12 place-items-center border border-border bg-muted">
        <ShieldAlertIcon className="size-5 text-muted-foreground" />
      </div>
      <h1 className="mt-5 text-xl font-semibold">Admin access required</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        This workspace contains private participant information. Ask an
        organizer to add the admin role to your Clerk account.
      </p>
      <ButtonLink
        className="mt-2"
        href="/sign-in?redirect_url=/admin/participants"
      >
        Use another account
      </ButtonLink>
    </Card>
  </BrandCenteredPage>
);
