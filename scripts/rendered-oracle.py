"""Compare browser SVG coordinates with independently calculated logarithmic positions."""
from decimal import Decimal, localcontext
import json
from pathlib import Path
import sys

report = json.loads(Path(sys.argv[1]).read_text())
errors = []
for config in report['configurations']:
    for chart in config['charts']:
        x0 = Decimal(str(chart['ticks'][0]['x']))
        step = Decimal(str(chart['ticks'][1]['x'])) - x0
        with localcontext() as ctx:
            ctx.prec = 50
            for mark in chart['marks']:
                distance = 9 + 12 * (Decimal(mark['hz']) / Decimal(chart['reference'])).ln() / Decimal(2).ln()
                expected = x0 + step * distance
                error = abs(float(expected) - mark['x'])
                assert error < 1e-9, (config['browser'], config['width'], mark, error)
                errors.append(error)
summary = {'method':'Python Decimal ln with 50 digits, anchored to the rendered C4 and C-sharp4 grid positions; source list membership verified directly in browser-review.mjs',
           'configurations':len(report['configurations']), 'charts':sum(len(c['charts']) for c in report['configurations']),
           'marks':len(errors), 'maximumSvgUnitsError':max(errors), 'toleranceSvgUnits':1e-9}
print(json.dumps(summary,indent=2))
