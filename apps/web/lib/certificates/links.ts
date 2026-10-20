export const certificateIssuer = "Hack the Andes";
export const certificateTitle = "Hack the Andes 2026 · Participación";
export const certificateUrl = (id: string) =>
  `https://hacktheandes.com/certificate/${encodeURIComponent(id)}`;
export const linkedinCertificateUrl =
  "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME";
export const linkedinShareUrl = (id: string) =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certificateUrl(id))}`;
