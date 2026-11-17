# Film Negative 1.0.0

Turns scanned colour and black and white negatives into positives. The maths is
darktable's negadoctor (`src/iop/negadoctor.c`, GPL-3.0-or-later), ported pixel
for pixel; the one-click Auto is ours, after the idea Negative Lab Pro made
popular. RawTherapee's Film Negative was surveyed and not ported: its power-law
model has fewer, less print-like controls.

## Where it runs

One stage, `film-negative.invert`, in the **decode** phase (priority 900, after
the other decode stages such as a flat field), on `lin`, linear Rec.709, ahead
of white balance and every tone tool. So White Balance, Basic and the rest edit
the positive, as they would a scan of a print.

It sets core's `plainSource` (Safelight 3.2.6): while it is at work, a RAW
camera scan renders without Safelight's baseline tone, camera baseline and
match, and channel reconstruction, so the densities are the sensor's own. At
rest (`stock` 0) the photo renders exactly as without the extension.

## Values (param bag, `film-negative.invert.<key>`)

| key | meaning | unit in the bag | range | colour film | B&W film |
|---|---|---|---|---|---|
| stock | 0 off, 1 colour, 2 B&W, 3 measure (pass-through, captures only) | int | | 1 | 2 |
| base | film base transmission per channel (dt Dmin) | % | 0.001–150 | 113, 49, 27 | 100, 100, 100 |
| dmax | the film's density range (dt D_max) | density | 0.1–6 | 1.6 | 2.2 |
| offset | scan exposure bias | density | −1–1 | −0.05 | −0.05 |
| low | shadows colour cast (dt wb_low) | gain | 0.25–2 | 1, 1, 1 | 1, 1, 1 |
| high | highlights white balance (dt wb_high) | gain | 0.25–2 | 1, 1, 1 | 1, 1, 1 |
| black | paper black (density correction) | % | −50–50 | 7.55 | 7.55 |
| grade | paper grade (gamma) | | 1–8 | 4 | 5 |
| gloss | paper gloss (soft clip of specular highlights) | % | 0.01–100 | 75 | 75 |
| exposure | print exposure | EV | −1–1 | log2 0.9245 | 0 |

Starting values are darktable's "color film" and "black and white film"
presets. Choosing a film type from Off loads that type's values; switching
between Colour and B&W keeps them. Off keeps them too, so turning the
inversion back on restores the photo's settings.

B&W reads each pixel's luminance as its transmission and uses the red film
base for all channels, so the positive is neutral; Highlights white balance
still tones it (darktable's "sepia or warm tone"). darktable keeps the scan's
colour in B&W; this is the one departure from it.

## Per pixel (darktable `_process_pixel`)

```
density   = log10(max(in, 2^-32) / base)            // ≤ 0 on the film
corrected = high / dmax · density + high · offset · low
print     = max(exposure · (1 + black − 10^corrected), 0) ^ grade
out       = print > gloss ? gloss + (1 − e^(−(print − gloss)/(1 − gloss)))(1 − gloss) : print
```

## Pickers (darktable `apply_auto_*`)

Each picker takes a rectangle dragged on the image, or a click (a spot), and
reads the stage's own input there (a float capture at core's new `"decode"`
point with `stock` 3): the mean, and the per-channel min and max.

- **Film base** (mean): base = mean.
- **D max** (min): dmax = max_c log10(base / min).
- **Scan bias** (max): offset = min_c log10(base / max) / dmax.
- **Shadows colour** (mean of a neutral black): low_c = v / r_c, r_c = log10(base / mean) / dmax, v = min r.
- **Highlights white balance** (mean of a neutral white): high_c = r_c / min r, r_c = |−1 / (offset · low_c − log10(base / mean) / dmax)|.
- **Paper black** (max): black = max_c 0.1 − (1 − 10^(−log10(base/max) · high/dmax + low · offset · high)).
- **Print exposure** (min): exposure = min_c 0.96 / (1 − 10^(−log10(base/min) · high/dmax + low · offset) + black).

Results are clamped to the ranges above and committed as one undo step each.

## Auto

One click, on the whole photo as cropped (a float render at `"decode"`):

1. Film base, unless it has been set away from the film type's starting value:
   the per-channel 99.9th percentile of the whole frame, so a rebate in frame
   is the base.
2. Inside a 10 % border on every side, per channel: the 0.5th percentile
   (dense: the print's whites) and the 99.5th (thin: its blacks).
3. Then darktable's own order with those for the picked areas: D max (dense),
   Scan bias (thin), both colour balances, Paper black (thin), Print exposure
   (dense).
4. The two colour balances are fitted together (model.ts `fitBalance`) so the
   densest and thinnest film each print neutral: Highlights white balance
   evens the channels' density ranges (each dye layer's contrast), Shadows
   colour their starts. darktable's two pickers applied in turn leave a grey
   scale about 0.03 off neutral in the shadows; the fit leaves it exact. Where
   a channel has no range or the scan bias is not above zero, Auto falls back
   on darktable's two pickers.

Off turns into Colour. One undo step.

## Panel

Film type (Off / Colour / B&W), Auto, then sections: Film base (R, G, B or one
Density in B&W, picker), Film (D max, Scan bias, pickers), Colour (Shadows
cast R, G, B and Highlights balance R, G, B, pickers; hidden in B&W), Print
(Paper black, Paper grade, Paper gloss, Print exposure, pickers for black and
exposure). A status line reports pickers and Auto. Not maskable (decode phase).
