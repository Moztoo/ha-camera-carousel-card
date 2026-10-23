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
  - entity: camera.front_door
    name: Front Door
    motion_switch: switch.front_door_motion_alarm
    privacy_switch: switch.front_door_privacy_mode
    recording_switch: switch.front_door_video_recording
  - entity: camera.driveway
    name: Driveway
    motion_switch: switch.driveway_motion_alarm
    privacy_switch: switch.driveway_privacy_mode
    recording_switch: switch.driveway_video_recording
    siren_entity: siren.driveway
  - entity: camera.backyard
    name: Backyard
    motion_switch: switch.backyard_motion_alarm
    privacy_switch: switch.backyard_privacy_mode
    recording_switch: switch.backyard_video_recording
    siren_entity: siren.backyard
grid_options:
  columns: 12
  rows: auto
```
