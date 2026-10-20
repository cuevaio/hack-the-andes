/**
 * The participant's credential.
 *
 * The badge is for people who were accepted, and this is where that is
 * known rather than inferred: the session says who they are, and
 * everything the card prints comes from their own application.
 *
 * Anyone signed in who is not accepted is sent to the welcome page rather
 * than shown an empty credential. A card that says nothing is a worse
 * answer than being told where to go.
 */

import { BrandCenteredPage, BrandTitle } from "@chofex/ui/components/brand";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import "@/components/credential/credential.css";
import { BadgeDownload } from "@/components/credential/badge-download";
import { CredentialCard } from "@/components/credential/credential-card";
import { CredentialGround } from "@/components/credential/credential-ground";
import { brandName } from "@/components/landing/content";
import { CredentialStage } from "@/components/portrait/credential-stage";
import { PageSweep } from "@/components/portrait/page-sweep";
import {
  acceptedByClerkUser,
  badgeImageForClerkUser,
  credentialFor,
  portraitFor,
} from "@/lib/credential/accepted";

/** The session decides what this page is, so it cannot be prerendered. */
export const dynamic = "force-dynamic";

const title = `Mi carnet | ${brandName}`;
const description = `Tu credencial para ${brandName}.`;

export const metadata: Metadata = {
  title,
  description,
  /*
    Restated for the unfurl rather than left to inherit.

    Next does not merge a page's title and description into the root
    layout's `openGraph` object — it takes that object wholesale. Without
    these, a participant pasting their badge somewhere gets the
    site-wide event promo instead, which is the feature failing in the
    one place it is meant to work.
  */
  openGraph: { title, description, type: "profile" },
  twitter: { card: "summary_large_image", title, description },
  // Signed-in and personal: the card carries a name and a role. It
  // unfurls for whoever the participant shares it with; it does not
  // belong in an index.
  robots: { index: false, follow: false },
};

export default async function BadgePage() {
  const authentication = await auth();
  /*
    Rendered, not redirected.

    A redirect answers with a 307, a 307 carries no HTML, and no HTML
    carries no meta — so every link a participant pasted unfurled as the
    sign-in page rather than as their badge. Measured, not assumed: the
    image was being served at 200 and no crawler could ever reach the
    tag that points at it.

    Nothing personal renders here. Somebody arriving without a session
    is told what this is and offered the way in, which is also a better
    answer than being bounced to a form with no explanation.
  */
  if (!authentication.userId) {
    return (
      <BrandCenteredPage contentClassName="max-w-xl text-center">
        <Link className="credential-back-link" href="/">
          {brandName}
        </Link>
        <BrandTitle as="h1">Tu carnet</BrandTitle>
        <p className="badge-gate">
          Los participantes aceptados tienen aquí su credencial de {brandName}.
        </p>
        <Link
          className="badge-download-link"
          href="/sign-in?redirect_url=/badge"
        >
          Iniciar sesión
        </Link>
      </BrandCenteredPage>
    );
  }

  const accepted = await acceptedByClerkUser(authentication.userId);
  if (!accepted) {
    redirect("/welcome");
  }

  const credential = credentialFor(accepted);
  const portrait = portraitFor(accepted);
  const badge = await badgeImageForClerkUser(authentication.userId);

  return (
    <BrandCenteredPage contentClassName="max-w-3xl text-center">
      {/*
        The landing's ground, held still and dimmed. The card is the
        subject; this is the horizon it hangs in.
      */}
      <CredentialGround />
      {/*
        The curtain the page arrives out of. Mounted here rather than in
        the layout because this is the page it belongs to: an accepted
        participant opening their credential, not somebody clicking
        through the site.
      */}
      <PageSweep />
      <Link className="credential-back-link" href="/">
        {brandName}
      </Link>
      <BrandTitle as="h1">Tu carnet</BrandTitle>
      {/*
        Two layers: the static card is what a visitor without JavaScript
        reads and what the browser paints before hydration, with the
        simulated lanyard mounted over it.
      */}
      <CredentialStage
        confirmed={portrait.confirmed}
        githubAvatarUrl={portrait.confirmed ? null : portrait.url}
        portraitUrl={portrait.url}
        textureUrl="/badge/card-texture"
      >
        <CredentialCard credential={credential} />
      </CredentialStage>
      <BadgeDownload badge={badge} participantName={credential.name} />
      <Link className="credential-back-link" href="/certificate">
        Mi certificado de participación
      </Link>
    </BrandCenteredPage>
  );
}
