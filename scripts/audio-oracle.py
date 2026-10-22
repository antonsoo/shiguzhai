"""Measure native browser PCM using the publisher table and independent zero crossings."""
import array
import hashlib
from importlib.machinery import SourceFileLoader
import json
import math
from pathlib import Path
import sys
import wave

oracle = SourceFileLoader('source_oracle', str(Path(__file__).with_name('source-oracle.py'))).load_module()
bells = {b['id']: b for b in oracle.published_bells()}
report_path = Path(sys.argv[1])
report = json.loads(report_path.read_text())
results = []
for item in report['audio']:
    file = report_path.parent / item['file']
    assert hashlib.sha256(file.read_bytes()).hexdigest() == item['sha256']
    b = bells[item['bell']]
    assert item['a'] in b['A'] and item['b'] in b['B']
    mode = item['mode']
    if mode == 'observations':
        frequencies, step, duration = b['B'], 0.85, 0.65
    else:
        step, duration = 1.25, 1
        frequencies = ([item['a']] if mode == 'A' else [item['b']] if mode == 'B'
                       else [item['b'], item.get('reference',440) * 2 ** ((oracle.modern_pitch(item['b'],item.get('reference',440))[0] - 69) / 12)]
                       if mode == 'reference' else [item['a'], item['b']])
    with wave.open(str(file), 'rb') as wav:
        assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (1, 2, 48000)
        data = array.array('h', wav.readframes(wav.getnframes()))
        if sys.byteorder != 'little':
            data.byteswap()
    rate = 48000
    assert abs(len(data) / rate - len(frequencies) * step) <= 1 / rate
    peak = max(abs(s) for s in data) / 32767
    assert 0.159 < peak <= 0.1601
    measurements = []
    for index, expected in enumerate(frequencies):
        start = index * step
        lo, hi = round((start + .08) * rate), round((start + duration - .08) * rate)
        crossings = [i - data[i] / (data[i+1] - data[i]) for i in range(lo, hi-1) if data[i] <= 0 < data[i+1]]
        assert len(crossings) > 100
        measured = (len(crossings)-1) * rate / (crossings[-1] - crossings[0])
        cents = abs(1200 * math.log2(measured / expected))
        assert cents < .02, (item['file'], expected, measured, cents)
        assert max(abs(n) for n in data[round(start*rate):round((start+.005)*rate)]) < .05 * 32767
        assert max(abs(n) for n in data[round((start+duration-.005)*rate):round((start+duration)*rate)]) < .015 * 32767
        # Leave two samples at the event boundary for clock rounding; the entire gap must be silent.
        assert all(n == 0 for n in data[math.ceil((start+duration)*rate)+2:math.floor((start+step)*rate)-2])
        measurements.append({'expectedHz': expected, 'measuredHz': measured, 'errorCents': cents})
    results.append({**{k:v for k,v in item.items() if k!='path'}, 'peak': peak, 'measurements': measurements})
summary = {'method': 'Python wave + interpolated positive zero crossings; frequencies from publisher table, modern comparison from independent Decimal calculation',
           'files':len(results), 'measuredTones':sum(len(r['measurements']) for r in results),
           'maximumErrorCents': max(m['errorCents'] for r in results for m in r['measurements']),
           'toleranceCents':.02, 'silentGapsAndEnvelopeChecked':True,
           'playback':report.get('playback',[]), 'results':results}
print(json.dumps(summary,indent=2))
