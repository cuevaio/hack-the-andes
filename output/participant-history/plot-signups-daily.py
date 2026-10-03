# /// script
# requires-python = ">=3.11"
# dependencies = ["matplotlib==3.11.2"]
# ///
import argparse
import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator

parser = argparse.ArgumentParser(description="Plot daily signups and first completed registrations from a historical export.")
parser.add_argument("--input", type=Path, default=Path(__file__).with_name("history.json"))
parser.add_argument("--output-dir", type=Path, default=Path(__file__).parent)
args = parser.parse_args()
report = json.loads(args.input.read_text())
days = report["days"]
if not days:
    raise ValueError("The historical export contains no daily observations")
dates = [datetime.fromisoformat(day["date"]) for day in days]
if any(left + timedelta(days=1) != right for left, right in zip(dates, dates[1:])):
    raise ValueError("Daily observations must be consecutive and in date order")
series = [("registered", "Inscritos", "#2574e8"), ("submitted", "Registro completado", "#079e9b")]
daily = {}
for key, _, _ in series:
    cumulative = [day[key] for day in days]
    values = [count - (cumulative[i - 1] if i else 0) for i, count in enumerate(cumulative)]
    if any(count < 0 for count in values):
        raise ValueError(f"Cumulative {key} counts must never decrease")
    daily[key] = values

args.output_dir.mkdir(parents=True, exist_ok=True)
with (args.output_dir / "signups-and-completed-daily.csv").open("w", newline="") as output:
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["date_lima", "signups", "completed_registrations"])
    writer.writerows([day["date"], daily["registered"][i], daily["submitted"][i]] for i, day in enumerate(days))

months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
def date_label(date):
    return f"{date.day} {months[date.month - 1]}"

generated = datetime.fromisoformat(report["metadata"]["generated_at"]).astimezone(ZoneInfo("America/Lima"))
date_range = f"{date_label(dates[0])} {dates[0].year} – {date_label(dates[-1])} {dates[-1].year}"
cutoff = f"{date_label(generated)} {generated.year}, {generated:%H:%M} (Lima)"
partial_note = " El último día es parcial." if dates[-1].date() == generated.date() else ""
maximum = max(1, *daily["registered"], *daily["submitted"])
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 12, "svg.hashsalt": "participant-history"})
fig, ax = plt.subplots(figsize=(16, 9), dpi=180)
fig.subplots_adjust(left=.08, right=.95, top=.79, bottom=.25)
fig.text(.08, .925, "Inscripciones y registros completados por día", fontsize=27, weight="bold", color="#17212b")
fig.text(.08, .875, f"Datos históricos reales · {date_range} · Lima", fontsize=15, color="#64717b")
for key, label, color in series:
    values = daily[key]
    ax.fill_between(dates, values, color=color, alpha=.10)
    ax.plot(dates, values, color=color, linewidth=3, marker="o", markersize=4, label=label)
    if len(days) <= 30:
        for i, count in enumerate(values):
            registered = daily["registered"][i]
            submitted = daily["submitted"][i]
            above = (key == "registered" and registered >= submitted) or (key == "submitted" and submitted > registered)
            offset = 9 if above else -17
            ax.annotate(str(count), (dates[i], count), xytext=(0, offset), textcoords="offset points", ha="center", fontsize=10, weight="bold", color=color,
                        bbox={"facecolor": "white", "edgecolor": "none", "alpha": .85, "pad": .6})
ax.set_axisbelow(True)
ax.grid(axis="y", color="#dfe5ea", linestyle=(0, (4, 4)))
ax.spines[["top", "right"]].set_visible(False)
ax.spines[["left", "bottom"]].set_color("#b7c1c9")
ax.tick_params(colors="#55626d", length=0, pad=10)
ax.set_ylim(0, maximum * 1.25)
ax.yaxis.set_major_locator(MaxNLocator(integer=True, nbins=7))
ax.set_xlim(dates[0] - timedelta(hours=8), dates[-1] + timedelta(hours=8))
step = max(1, (len(days) - 1 + 5) // 6)
indices = sorted(set([*range(0, len(days), step), len(days) - 1]))
ax.set_xticks([dates[i] for i in indices], [date_label(dates[i]) for i in indices])
ax.set_ylabel("Participantes por día", labelpad=12, color="#374551")
ax.set_xlabel("Día de Lima", labelpad=14, color="#374551")
fig.legend(*ax.get_legend_handles_labels(), loc="upper left", bbox_to_anchor=(.075, .16), ncols=2, frameon=False, fontsize=13, columnspacing=3)
fig.text(.08, .09, "Cada punto muestra las personas nuevas de ese día. Inscritos: cuenta creada. Registro completado: primera postulación enviada.", fontsize=11, color="#64717b")
fig.text(.08, .055, f"Fuente: base de datos de Chofex · Corte: {cutoff}.{partial_note}", fontsize=11, color="#64717b")
fig.savefig(args.output_dir / "signups-and-completed-daily.png", facecolor="white")
svg_path = args.output_dir / "signups-and-completed-daily.svg"
fig.savefig(svg_path, facecolor="white", metadata={"Date": report["metadata"]["generated_at"]})
svg_path.write_text("\n".join(line.rstrip() for line in svg_path.read_text().splitlines()) + "\n")
print(f"Verified daily totals: {sum(daily['registered'])} signups, {sum(daily['submitted'])} completed registrations, {len(days)} days. PNG, SVG and CSV saved to {args.output_dir}.")
