# Restored original artwork

These WebP assets reuse the existing Opinion Rocks PNG artwork without repainting, generation, hue changes, or compositing. Originals remain unchanged. Source artwork was fetched from `https://opinionrocks.com/art/<source>` on 2026-10-15.

Method: Pillow RGBA decode; decorative cutouts crop to visible-alpha bounding box (alpha > 8 of 255) plus four source pixels of padding, removing near-transparent export speckle outside the artwork; Lanczos proportional downscale; WebP encoder method 6, exact transparent RGB, quality shown below. The sunset retains its entire canvas. Crop bounds use Pillow left/top/right/bottom exclusive coordinates.

| Source | Output | Crop | Final pixels | WebP quality | Bytes |
| --- | --- | --- | --- | --- | --- |
| `banner.png` | `valley-sunset.webp` | (0, 0, 1536, 1024) | 1100 × 733 | 80 | 122,222 |
| `button_valley.png` | `cairn.webp` | (408, 278, 1096, 768) | 200 × 142 | 88 | 10,540 |
| `gold_pebble.png` | `echo-gold.webp` | (75, 96, 970, 901) | 96 × 86 | 88 | 3,624 |
| `pebble.png` | `echo-clay.webp` | (58, 95, 967, 929) | 96 × 88 | 88 | 3,426 |
| `rock_02.png` | `scenery-round.webp` | (123, 84, 898, 936) | 182 × 200 | 85 | 10,062 |
| `rock_04.png` | `scenery-peak.webp` | (138, 85, 887, 942) | 175 × 200 | 85 | 8,282 |

The original `button_window.png` is intentionally not reused: its illustration contains a baked submission count, which could be mistaken for real activity.

## Source SHA-256

- `banner.png`: `43e648c9867e43b1925140fe10458ba5a47737c58807932344e6f785d97450c3`
- `button_valley.png`: `aed838abb43257694cb8d719db2efa54514d9c6a75ea24074b3b94aac8725d63`
- `gold_pebble.png`: `f8764b8cd7fe5ca277d458ca0503323e5846cf86d594603074e77c947056a877`
- `pebble.png`: `efc0a434a0041201ba94b4d0bad24884c11a1d9a8a93eb360da20e28ef9b4531`
- `rock_02.png`: `44a4ec991f3a7bebcab5e56c6dfe024b4fe0b7fb3db02bd1ac82d3630b709fee`
- `rock_04.png`: `0af507224ec0d3cba771f4a40cbebc7f00a8a7d761ac70cbe10a08cad2b049cd`
