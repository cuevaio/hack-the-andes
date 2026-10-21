import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ParticipationCertificate } from "@chofex/registration-contract";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import { certificateUrl } from "./links";

const width = 1190;
const height = 842;
const qr = { x: 1035, y: 697, size: 92, margin: 4 };

function asset(file: string) {
  const relative = join("content", "certificates", file);
  const runtime = join(process.cwd(), relative);
  if (existsSync(runtime)) return runtime;
  return join(process.cwd(), "apps", "web", relative);
}

function glyphText(
  font: fontkit.Font,
  value: string,
  baseline: number,
  size: number,
  color: string,
) {
  const run = font.layout(value);
  const scale = size / font.unitsPerEm;
  const advance = run.positions.reduce((sum, p) => sum + p.xAdvance, 0);
  let x = (width - advance * scale) / 2;
  const paths: string[] = [];
  for (const [index, glyph] of run.glyphs.entries()) {
    const position = run.positions[index];
    if (!position) throw new Error("Missing certificate font position");
    paths.push(
      `<path d="${glyph.path.toSVG()}" transform="translate(${x + position.xOffset * scale} ${baseline - position.yOffset * scale}) scale(${scale} ${-scale})"/>`,
    );
    x += position.xAdvance * scale;
  }
  return `<g fill="${color}">${paths.join("")}</g>`;
}

export async function renderCertificate(
  certificate: ParticipationCertificate,
  format: "pdf" | "png",
) {
  const fontBytes = await readFile(asset("Sans-Regular.ttf"));
  const font = fontkit.create(fontBytes);
  const advance = font
    .layout(certificate.recipientName)
    .positions.reduce((sum, p) => sum + p.xAdvance, 0);
  const nameSize = Math.min(45, (960 * font.unitsPerEm) / advance);
  const code = QRCode.create(certificateUrl(certificate.id), {
    errorCorrectionLevel: "M",
  });
  const unit = qr.size / (code.modules.size + qr.margin * 2);
  const squares: { x: number; y: number }[] = [];
  for (let row = 0; row < code.modules.size; row++) {
    for (let col = 0; col < code.modules.size; col++) {
      if (code.modules.get(row, col))
        squares.push({
          x: qr.x + (col + qr.margin) * unit,
          y: qr.y + (row + qr.margin) * unit,
        });
    }
  }
  const label = `ID ${certificate.id}`;
  if (format === "png") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3508" height="2481" viewBox="0 0 ${width} ${height}">
      ${glyphText(font, certificate.recipientName, 505, nameSize, "#ffffff")}
      ${glyphText(font, label, 807, 10, "#a6a6a6")}
      <g shape-rendering="crispEdges"><rect x="${qr.x}" y="${qr.y}" width="${qr.size}" height="${qr.size}" fill="white"/>
      ${squares.map((p) => `<rect x="${p.x}" y="${p.y}" width="${unit}" height="${unit}" fill="black"/>`).join("")}</g>
    </svg>`;
    return sharp(await readFile(asset("base.png")))
      .composite([{ input: Buffer.from(svg) }])
      .withMetadata({ density: 300 })
      .png()
      .toBuffer();
  }
  const document = await PDFDocument.load(await readFile(asset("base.pdf")));
  document.registerFontkit(fontkit);
  const embeddedFont = await document.embedFont(fontBytes, { subset: true });
  const page = document.getPages()[0];
  if (!page) throw new Error("Certificate template is missing its page");
  const sx = page.getWidth() / width;
  const sy = page.getHeight() / height;
  for (const [value, baseline, size, color] of [
    [certificate.recipientName, 505, nameSize, 1],
    [label, 807, 10, 0.65],
  ] as const) {
    page.drawText(value, {
      x:
        (page.getWidth() - embeddedFont.widthOfTextAtSize(value, size * sx)) /
        2,
      y: page.getHeight() - baseline * sy,
      size: size * sx,
      font: embeddedFont,
      color: rgb(color, color, color),
    });
  }
  page.drawRectangle({
    x: qr.x * sx,
    y: page.getHeight() - (qr.y + qr.size) * sy,
    width: qr.size * sx,
    height: qr.size * sy,
    color: rgb(1, 1, 1),
  });
  for (const p of squares)
    page.drawRectangle({
      x: p.x * sx,
      y: page.getHeight() - (p.y + unit) * sy,
      width: unit * sx,
      height: unit * sy,
      color: rgb(0, 0, 0),
    });
  document.setTitle(`${certificate.recipientName} · Hack the Andes 2026`);
  document.setSubject(
    `Certificado de participación · ${certificate.id} · ${certificateUrl(certificate.id)}`,
  );
  document.setCreationDate(new Date(certificate.issuedAt));
  document.setModificationDate(new Date(certificate.issuedAt));
  return Buffer.from(await document.save());
}
