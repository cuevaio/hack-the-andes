"use client";

import { buttonVariants } from "@chofex/ui/components/button";
import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { useState } from "react";

interface ApprovalOptionsResponse {
  readonly ok: true;
  readonly data: {
    readonly kind: "registration" | "authentication";
    readonly options:
      | PublicKeyCredentialCreationOptionsJSON
      | PublicKeyCredentialRequestOptionsJSON;
  };
}

interface ApprovalErrorResponse {
  readonly ok: false;
  readonly error?: { readonly code?: string };
}

const approvalErrorMessages: Readonly<Record<string, string>> = {
  AUTHENTICATION_REQUIRED: "Inicia sesión otra vez para continuar.",
  BROWSER_SESSION_REQUIRED:
    "Esta aprobación requiere la sesión del participante en el navegador.",
  EVALUATION_APPROVAL_EXPIRED:
    "La aprobación venció. Repite el comando en el terminal para crear otra.",
  APPROVAL_ALREADY_CONFIRMED:
    "Esta evaluación ya fue aprobada. Vuelve al terminal y repite el comando.",
  APPROVAL_ALREADY_USED:
    "Esta aprobación ya fue usada. Repite el comando para comenzar otra evaluación.",
  HUMAN_VERIFICATION_FAILED:
    "No se pudo verificar tu presencia. Inténtalo de nuevo.",
  INVALID_APPROVAL_AUTHENTICATOR: "Elige este equipo o una llave de seguridad.",
};

type ApprovalAuthenticator = "local-device" | "security-key";

const responseErrorMessage = (
  document: ApprovalErrorResponse | { readonly ok: true },
  fallback: string,
): string => {
  if (!document.ok && document.error?.code) {
    return approvalErrorMessages[document.error.code] ?? fallback;
  }
  return fallback;
};

class ApprovalUiError extends Error {}

const browserFailureMessage = (cause: unknown): string => {
  const code =
    cause && typeof cause === "object" && "code" in cause ? cause.code : "";
  if (code === "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT") {
    return "Este equipo no tiene Windows Hello, Touch ID ni PIN. Configura uno, o usa una llave de seguridad.";
  }
  if (
    code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY" ||
    code === "ERROR_CEREMONY_ABORTED"
  ) {
    return "No se completó en este equipo. Confirma con Windows Hello, Touch ID o el PIN. Si Google Workspace bloqueó el teléfono, no escanees el código QR.";
  }
  return "No se completó la verificación. Inténtalo de nuevo en esta computadora.";
};

export function EvaluationApprovalButton({
  approvalId,
}: {
  readonly approvalId: string;
}) {
  const [state, setState] = useState<"idle" | "approved">("idle");
  const [pending, setPending] = useState<ApprovalAuthenticator>();
  const [error, setError] = useState<string>();

  const approve = async (authenticator: ApprovalAuthenticator) => {
    setPending(authenticator);
    setError(undefined);
    try {
      const basePath = `/api/v1/challenges/broken-agent/approvals/${approvalId}`;
      const optionsResponse = await fetch(`${basePath}/options`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authenticator }),
      });
      const optionsDocument = (await optionsResponse.json()) as
        | ApprovalOptionsResponse
        | ApprovalErrorResponse;
      if (!optionsResponse.ok || !optionsDocument.ok) {
        throw new ApprovalUiError(
          responseErrorMessage(
            optionsDocument,
            "No se pudo iniciar la verificación",
          ),
        );
      }

      let credential: unknown;
      if (optionsDocument.data.kind === "registration") {
        credential = await startRegistration({
          optionsJSON: optionsDocument.data
            .options as PublicKeyCredentialCreationOptionsJSON,
        });
      } else {
        credential = await startAuthentication({
          optionsJSON: optionsDocument.data
            .options as PublicKeyCredentialRequestOptionsJSON,
        });
      }

      const verificationResponse = await fetch(`${basePath}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credential),
      });
      const verificationDocument = (await verificationResponse.json()) as
        | { readonly ok: true }
        | ApprovalErrorResponse;
      if (!verificationResponse.ok || !verificationDocument.ok) {
        throw new ApprovalUiError(
          responseErrorMessage(
            verificationDocument,
            "No se pudo verificar la aprobación",
          ),
        );
      }
      setPending(undefined);
      setState("approved");
    } catch (cause) {
      setError(
        cause instanceof ApprovalUiError
          ? cause.message
          : browserFailureMessage(cause),
      );
      setPending(undefined);
    }
  };

  if (state === "approved") {
    return (
      <div className="space-y-2" role="status">
        <p className="font-mono text-sm font-semibold text-[var(--hud-accent)]">
          Evaluación aprobada.
        </p>
        <p className="text-sm text-[var(--hud-muted)]">
          Vuelve al terminal y repite el comando de evaluación antes de que
          venza la aprobación.
        </p>
      </div>
    );
  }

  const localLabel =
    pending === "local-device" ? "Verificando…" : "Aprobar en este equipo";
  const securityLabel =
    pending === "security-key" ? "Verificando…" : "Usar llave de seguridad";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          className={buttonVariants()}
          disabled={pending !== undefined}
          onClick={() => approve("local-device")}
          type="button"
        >
          {localLabel}
        </button>
        <button
          className={buttonVariants({ variant: "outline" })}
          disabled={pending !== undefined}
          onClick={() => approve("security-key")}
          type="button"
        >
          {securityLabel}
        </button>
      </div>
      <p className="text-sm text-[var(--hud-muted)]">
        En esta computadora Windows debe pedir el PIN, la huella o el rostro. Si
        aparece un código QR, cancélalo: esa ventana es el teléfono y Google
        Workspace puede bloquearla.
      </p>
      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
