"""Inspect actual RIFF files independently with Python wave and NumPy FFT/least squares."""

from datetime import datetime, timezone
from hashlib import sha256
import json
import math
from pathlib import Path
import struct
import sys
import wave

import numpy as np

root = Path(__file__).resolve().parents[1]
directory = Path(sys.argv[1])
data = json.loads((root / "public/shuang/sources/measurements.json").read_text())
results = []
reference = 364.07
for bell in data["bells"]:
    if bell["aHz"] is None:
        continue
    for tuning in ["measured", "semitone"]:
        pair = [float(bell[key]) for key in ["aHz", "bHz"]]
        if tuning == "semitone":
            pair = [reference * 2 ** (math.floor(12 * math.log2(f / reference) + 0.5) / 12) for f in pair]
        for angle in [0, 22, 45]:
            filename = f'{bell["id"]}-{tuning}-{angle}.wav'
            path = directory / filename
            raw = path.read_bytes()
            assert raw[:4] == b"RIFF" and raw[8:12] == b"WAVE"
            assert struct.unpack_from("<I", raw, 4)[0] + 8 == len(raw)
            with wave.open(str(path), "rb") as stream:
                assert (stream.getnchannels(), stream.getsampwidth(), stream.getframerate(), stream.getnframes()) == (1, 2, 44100, 88200)
                pcm = np.frombuffer(stream.readframes(stream.getnframes()), dtype="<i2").astype(float) / 32767
            assert max(abs(pcm)) < 0.2
            assert abs(pcm[0]) == 0 and abs(pcm[-1]) < 0.00005
            time = np.arange(len(pcm)) / 44100
            envelope = np.minimum(1, time / 0.008) * np.minimum(1, (2 - time) / 0.025) * np.exp(-time / 0.65)
            basis = np.column_stack([envelope * np.sin(2 * np.pi * frequency * time) for frequency in pair])
            fit = np.linalg.lstsq(basis, pcm, rcond=None)[0]
            expected = 0.14 * np.array([math.cos(math.radians(2 * angle)), math.sin(math.radians(2 * angle))])
            coefficient_error = float(max(abs(fit - expected)))
            residual_rms = float(np.sqrt(np.mean((pcm - basis @ fit) ** 2)))
            assert coefficient_error < 0.000003, (filename, fit, expected)
            assert residual_rms < 1 / 32767, (filename, residual_rms)
            spectrum = abs(np.fft.rfft(pcm * np.hanning(len(pcm)), 2**20))
            peak_errors = []
            for frequency, coefficient in zip(pair, expected):
                if coefficient < 0.001:
                    continue
                centre = int(round(frequency / 44100 * 2**20))
                peak = centre - 12 + int(np.argmax(spectrum[centre - 12:centre + 13]))
                left, middle, right = np.log(spectrum[peak - 1:peak + 2])
                offset = 0.5 * (left - right) / (left - 2 * middle + right)
                estimated = (peak + offset) * 44100 / 2**20
                error = abs(float(estimated) - frequency)
                assert error < 0.05, (filename, frequency, estimated)
                peak_errors.append(error)
            offset, comments = 12, []
            while offset < len(raw):
                key, size = raw[offset:offset + 4], struct.unpack_from("<I", raw, offset + 4)[0]
                body = raw[offset + 8:offset + 8 + size]
                if key == b"LIST":
                    assert body[:4] == b"INFO"
                    comments.append(body.decode("ascii", errors="replace"))
                offset += 8 + size + size % 2
            assert offset == len(raw)
            assert any("not an ancient bell recording" in text and "10.1250/ast.10.299" in text for text in comments)
            results.append({"file": filename, "bytes": len(raw), "sha256": sha256(raw).hexdigest(), "expectedHz": pair, "peakErrorHz": max(peak_errors), "coefficientError": coefficient_error, "residualRms": residual_rms})

assert len(results) == 72
print(json.dumps({"checkedAtUtc": datetime.now(timezone.utc).isoformat(), "method": "Python wave decoding, NumPy Hann-window FFT with log-parabolic peak interpolation and least-squares PCM coefficients against source-table Hz", "numpy": np.__version__, "files": len(results), "sampleRate": 44100, "channels": 1, "bitsPerSample": 16, "durationSeconds": 2, "sourceSha256": sha256((root / "public/shuang/sources/measurements.json").read_bytes()).hexdigest(), "maxPeakErrorHz": max(r["peakErrorHz"] for r in results), "maxCoefficientError": max(r["coefficientError"] for r in results), "maxResidualRms": max(r["residualRms"] for r in results), "allSourceNoticesRetained": True, "cases": results}, indent=2))
