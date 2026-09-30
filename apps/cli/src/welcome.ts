import { CliOutput } from "effect/unstable/cli";

import { eventName } from "./brand.js";

// Each character is a landscape pixel, expanded to terminal cells at render time.
// Background colors fill the cells even when a terminal uses generous line spacing.
const valley = [
  "          11              55        ",
  "    11   1111            5555 11     ",
  "   1111 111111      11    55 1111    ",
  " 11112222111111   111111    111111   ",
  "111222222211111111111111111122221111",
  "112223333222111111111111112223332222",
  "222333333322211114411111222333333333",
  "333333333332222144442222233333333333",
  "333333333333322244422223333333333333",
];

const palette = {
  sky: "12;24;24",
  distant: "28;62;61",
  ridge: "44;101;85",
  terrace: "84;143;111",
  river: "141;200;190",
  sun: "234;183;108",
  border: "66;101;85",
  text: "243;241;217",
  muted: "183;201;181",
  accent: "214;255;0",
} as const;

const pixels: Record<string, { color: string; character: string }> = {
  " ": { color: palette.sky, character: " " },
  "1": { color: palette.distant, character: "." },
  "2": { color: palette.ridge, character: ":" },
  "3": { color: palette.terrace, character: "#" },
  "4": { color: palette.river, character: "~" },
  "5": { color: palette.sun, character: "o" },
};

type WelcomeOptions = {
  readonly columns?: number;
  readonly colors?: boolean;
};

const wrap = (text: string, width: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = "";
    }
    line = line ? `${line} ${word}` : word;
    while (line.length > width) {
      lines.push(line.slice(0, width));
      line = line.slice(width);
    }
  }
  if (line) lines.push(line);
  return lines;
};

const center = (text: string, width: number): string =>
  (
    " ".repeat(Math.max(0, Math.floor((width - text.length) / 2))) + text
  ).padEnd(width);

export const renderWelcome = ({
  columns = 80,
  colors = false,
}: WelcomeOptions = {}): string => {
  const width = Math.max(1, Math.min(Math.floor(columns), 72));
  if (width < 24) {
    return [
      eventName,
      "by Chofex",
      "S/8,000 in prizes",
      "Only for the best engineers from Peru.",
    ]
      .flatMap((line) => wrap(line, width))
      .join("\n");
  }

  const innerWidth = width - 4;
  const paint = (
    text: string,
    foreground: string = palette.text,
    background: string = palette.sky,
    bold = false,
  ): string => {
    if (!colors) return text;
    const weight = bold ? "1;" : "";
    return `\x1b[${weight}38;2;${foreground};48;2;${background}m${text}\x1b[0m`;
  };
  let horizontal = "-";
  let vertical = "|";
  let corners = ["+", "+", "+", "+"];
  if (colors) {
    horizontal = "─";
    vertical = "│";
    corners = ["╭", "╮", "╰", "╯"];
  }
  const frame = (content: string): string =>
    ` ${paint(vertical, palette.border)}${content}${paint(vertical, palette.border)}`;
  const rule = (left: string, right: string): string =>
    ` ${paint(left + horizontal.repeat(innerWidth) + right, palette.border)}`;
  const label = (text: string, foreground: string, bold = false): string =>
    frame(paint(center(text, innerWidth), foreground, palette.sky, bold));

  const sourceWidth = Math.max(...valley.map((row) => row.length));
  const scene = valley.map((row, y) => {
    const cells = Array.from({ length: innerWidth }, (_, x) => {
      const sourceX = Math.floor((x / innerWidth) * sourceWidth);
      return row[sourceX] ?? " ";
    });
    let heading = "";
    let foreground: string = palette.text;
    if (y === 3) heading = eventName;
    if (y === 4) {
      heading = "by Chofex";
      foreground = palette.sun;
    }
    const headingStart = Math.floor((innerWidth - heading.length) / 2);
    let rendered = "";
    for (let x = 0; x < cells.length; x += 1) {
      if (
        heading &&
        x >= headingStart - 1 &&
        x <= headingStart + heading.length
      ) {
        const character = heading[x - headingStart] ?? " ";
        rendered += paint(character, foreground, palette.sky, y === 3);
        continue;
      }
      const pixel = pixels[cells[x] ?? " "] ?? pixels[" "];
      if (!pixel) continue;
      if (colors) {
        rendered += paint(" ", pixel.color, pixel.color);
      } else {
        rendered += pixel.character;
      }
    }
    return frame(rendered);
  });

  return [
    "",
    rule(corners[0] ?? "+", corners[1] ?? "+"),
    ...scene,
    label("", palette.text),
    label("S/8,000 in prizes", palette.accent, true),
    ...wrap("Only for the best engineers from Peru.", innerWidth - 2).map(
      (line) => label(line, palette.muted),
    ),
    rule(corners[2] ?? "+", corners[3] ?? "+"),
    "",
  ].join("\n");
};

export const welcomeFormatter = (
  options: WelcomeOptions & { readonly home?: boolean },
): CliOutput.Formatter => {
  const formatter = CliOutput.defaultFormatter({ colors: options.colors });
  return {
    ...formatter,
    formatHelpDoc: (doc) => {
      const help = formatter.formatHelpDoc(doc);
      if (!doc.subcommands?.length) return help;
      const welcome = renderWelcome(options);
      if (!options.home) return `${welcome}\n${help}`;
      const width = Math.max(1, Math.min(options.columns ?? 80, 72));
      const shortcuts = [
        "andes login     Sign in",
        "andes register  Apply",
        "andes status    Check your application",
        "andes --help    All commands",
      ];
      return `${welcome}\n${shortcuts.flatMap((line) => wrap(line, width)).join("\n")}\n`;
    },
  };
};
