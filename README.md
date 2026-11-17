# Film Negative for Safelight

Turns scanned colour and black and white negatives into positives, in
Develop. Works on camera scans (RAW or not) and on scanner files (TIFF, JPEG).

## Use

1. Open the scan in Develop and pick **Colour** or **B&W** in the Film
   Negative panel (or click **Auto**, which turns it on as Colour).
2. **Film base**: click **Pick** and drag over bare film, such as the rebate
   between frames. Do this first: everything else is measured from it.
3. Click **Auto** to fit the rest to the photo, or set it by hand:
   - **Film**: D max (the film's density range) and Scan bias, each with a
     picker (the densest and the thinnest part of the film).
   - **Shadows colour** and **Highlights white balance** (colour film): pick
     something that should print neutral black, or neutral white.
   - **Print**: Paper black, Paper grade (contrast), Paper gloss (how the
     brightest highlights roll off) and Print exposure.
4. Finish with White Balance, Basic and the rest: they edit the positive.

Every picker takes a dragged rectangle or a click; Esc cancels. Each change is
one undo step, and the values copy, paste and go into presets like any other,
so one set of values can serve a whole roll.

With the inversion on, a RAW camera scan is read as the sensor recorded it,
without Safelight's camera-style tone, which would bend the film's densities.
Off, the photo renders exactly as without the extension.

## How it works

The scan's transmission becomes the film's density above its base; each
channel's density is corrected, then printed on virtual paper with a black, a
grade, a gloss and an exposure. Auto measures the whole photo and fits the
film and both colour balances so a grey scale prints neutral. B&W film reads
the scan's luminance, so the positive is neutral. See
[docs/SPEC.md](docs/SPEC.md) and [NOTICE](NOTICE).

Needs Safelight 3.2.6 or later.

## Develop

```bash
npm install
npm run check
```

`npm run test:gpu` runs the stage on Safelight's own renderer (headless
Chromium on SwiftShader); it needs a SafeLight checkout beside this folder, or
`SAFELIGHT_CORE` pointing at one.

## Licence

GPL-3.0-or-later. See [LICENSE](LICENSE).
