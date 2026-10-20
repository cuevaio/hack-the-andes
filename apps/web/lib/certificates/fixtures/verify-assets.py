"""Decode the QR in both certificate formats and verify their printed identity.

Generate disposable artifacts from the repository root:
CERTIFICATE_TEST_OUTPUT=/tmp/certificate-proof bun test apps/web/lib/certificates/certificates.test.ts
uv run --with pymupdf --with opencv-python-headless verify-assets.py /tmp/certificate-proof
"""

import argparse
import json
from pathlib import Path

import cv2
import pymupdf

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("directory", type=Path)
root = parser.parse_args().directory
record = json.loads((root / "demo.json").read_text())
detector = cv2.QRCodeDetector()
url, _, _ = detector.detectAndDecode(cv2.imread(str(root / "demo-not-issued.png")))
assert url == record["verificationUrl"], "PNG QR does not match the stored certificate"
with pymupdf.open(root / "demo-not-issued.pdf") as document:
    assert len(document) == 1
    text = document[0].get_text()
    assert record["recipientName"] in text and record["id"] in text
    assert "Nombre del participante" not in text
    page = document[0].get_pixmap(matrix=pymupdf.Matrix(300 / 72, 300 / 72))
    page.save(root / "pdf-render.png")
url, _, _ = detector.detectAndDecode(cv2.imread(str(root / "pdf-render.png")))
assert url == record["verificationUrl"], "PDF QR does not match the stored certificate"
print("PDF and PNG identities match; both QR codes resolve to the stored verification URL.")
