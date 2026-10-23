# ha-camera-carousel-card

A compact, theme-aware custom Lovelace Web Component for **Home Assistant** (`custom:camera-carousel-card`) featuring a main **Focus Stage** and an interactive **Thumbnail Filmstrip / Carousel**.

## Features

- **Spotlight + Filmstrip Carousel:**
  - Displays one primary camera in a `16:9` focus viewport while keeping all cameras visible in a horizontal thumbnail strip below.
  - Click any thumbnail in the strip (or use the `◀` / `▶` stage arrows) to immediately bring that camera into focus.
- **Fast Snapshot & Live Stream Toggle (`Stream`):**
  - Starts in fast, low-CPU **Snapshot mode** (auto-refreshing thumbnails and main view every `refresh_interval` seconds) so dashboards load instantly.
  - Toggle **Stream** in the header anytime to switch the focused camera to a native Home Assistant live stream (`ha-camera-stream`).
- **Auto-Cycle Mode (`Auto`):**
  - Automatically rotates focus across all cameras every `cycle_interval` seconds.
- **Quick Overlay Controls:**
  - Floating glassmorphic action buttons on the focused camera for **Motion Alarm**, **Video Recording**, **Privacy Mode**, **Siren**, and **Fullscreen / More Info**.
- **100% Theme-Aware + Compact Mode:**
  - Inherits all colors, borders, backgrounds, and typography from the active Home Assistant theme (e.g., *Graphite*).

## Configuration

```yaml
type: custom:camera-carousel-card
title: Security Cameras
compact: false
live_stream: false
refresh_interval: 5
cameras:
  - entity: camera.cam_entrada
    name: Entrada
    motion_switch: switch.cam_entrada_motion_alarm
    privacy_switch: switch.cam_entrada_privacy_mode
    recording_switch: switch.cam_entrada_video_recording
  - entity: camera.cam_calle
    name: Calle
    motion_switch: switch.cam_calle_motion_alarm
    privacy_switch: switch.cam_calle_privacy_mode
    recording_switch: switch.cam_calle_video_recording
    siren_entity: siren.cam_calle
  - entity: camera.cam_patio
    name: Patio
    motion_switch: switch.cam_patio_motion_alarm
    privacy_switch: switch.cam_patio_privacy_mode
    recording_switch: switch.cam_patio_video_recording
    siren_entity: siren.cam_patio
grid_options:
  columns: 12
  rows: auto
```
