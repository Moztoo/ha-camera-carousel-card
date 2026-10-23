/**
 * Camera Carousel Card - Theme-Aware Spotlight & Filmstrip Camera Widget
 * Features a main focus view (Live Stream or Snapshot), interactive thumbnail reel,
 * auto-cycle option, and quick controls (Motion Alarm, Privacy, Siren, Fullscreen).
 */
class CameraCarouselCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._selectedIndex = 0;
    this._liveMode = false; // false = fast low-CPU snapshot (refreshed), true = live stream
    this._autoCycle = false;
    this._compact = false;
    this._tick = Date.now();
    this._refreshTimer = null;
    this._cycleTimer = null;
    this._renderedStreamEntity = null;
  }

  static getStubConfig() {
    return {
      title: "Security Cameras",
      compact: false,
      live_stream: false,
      refresh_interval: 5,
      cameras: [
        {
          entity: "camera.cam_entrada",
          name: "Entrada",
          motion_switch: "switch.cam_entrada_motion_alarm",
          privacy_switch: "switch.cam_entrada_privacy_mode",
          recording_switch: "switch.cam_entrada_video_recording",
        },
        {
          entity: "camera.cam_calle",
          name: "Calle",
          motion_switch: "switch.cam_calle_motion_alarm",
          privacy_switch: "switch.cam_calle_privacy_mode",
          recording_switch: "switch.cam_calle_video_recording",
          siren_entity: "siren.cam_calle",
        },
        {
          entity: "camera.cam_patio",
          name: "Patio",
          motion_switch: "switch.cam_patio_motion_alarm",
          privacy_switch: "switch.cam_patio_privacy_mode",
          recording_switch: "switch.cam_patio_video_recording",
          siren_entity: "siren.cam_patio",
        },
      ],
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.cameras) || config.cameras.length === 0) {
      throw new Error("You need to define at least one camera in 'cameras'");
    }
    this._config = {
      title: "Security Cameras",
      compact: false,
      live_stream: false,
      refresh_interval: 5,
      cycle_interval: 10,
      ...config,
    };
    this._compact = Boolean(this._config.compact);
    this._liveMode = Boolean(this._config.live_stream);
    this._cameras = this._config.cameras.map((c) =>
      typeof c === "string" ? { entity: c } : c
    );
    if (this._selectedIndex >= this._cameras.length) {
      this._selectedIndex = 0;
    }
    this._buildSkeleton();
    this._setupTimers();
    if (this._hass) {
      this._render();
    }
  }

  connectedCallback() {
    this._setupTimers();
  }

  disconnectedCallback() {
    this._clearTimers();
  }

  _clearTimers() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
    if (this._cycleTimer) {
      clearInterval(this._cycleTimer);
      this._cycleTimer = null;
    }
  }

  _setupTimers() {
    this._clearTimers();
    if (!this._config) return;
    const refreshSec = Math.max(2, Number(this._config.refresh_interval) || 5);
    this._refreshTimer = setInterval(() => {
      this._tick = Date.now();
      this._updateImagesOnly();
    }, refreshSec * 1000);

    if (this._autoCycle && this._cameras.length > 1) {
      const cycleSec = Math.max(4, Number(this._config.cycle_interval) || 10);
      this._cycleTimer = setInterval(() => {
        this._selectCamera((this._selectedIndex + 1) % this._cameras.length);
      }, cycleSec * 1000);
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (first) {
      this._render();
    } else {
      this._updateStatesAndStream();
    }
  }

  getCardSize() {
    return this._compact ? 5 : 7;
  }

  getGridOptions() {
    return {
      columns: 12,
      min_columns: 6,
      rows: "auto",
    };
  }

  _selectCamera(idx) {
    if (idx < 0 || idx >= this._cameras.length) return;
    this._selectedIndex = idx;
    this._renderedStreamEntity = null;
    this._render();
  }

  _openMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }

  _toggleEntity(entityId) {
    if (!this._hass || !entityId) return;
    const domain = entityId.split(".")[0];
    this._hass.callService(domain, "toggle", { entity_id: entityId });
  }

  _cameraProxyUrl(entityId, bustCache = true) {
    if (!this._hass || !entityId) return "";
    const st = this._hass.states[entityId];
    const base = st?.attributes?.entity_picture || `/api/camera_proxy/${entityId}`;
    if (!bustCache) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}_ts=${this._tick}`;
  }

  _buildSkeleton() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--ha-card-header-font-family, var(--primary-font-family, var(--paper-font-body1_-_font-family, inherit)));
          --ccc-bg: var(--ha-card-background, var(--card-background-color, #23242b));
          --ccc-surface: var(--secondary-background-color, rgba(128, 128, 128, 0.08));
          --ccc-input: var(--input-fill-color, var(--secondary-background-color, rgba(128, 128, 128, 0.14)));
          --ccc-divider: var(--divider-color, rgba(128, 128, 128, 0.18));
          --ccc-text-primary: var(--primary-text-color, #e4e4e7);
          --ccc-text-secondary: var(--secondary-text-color, #8a8c99);
          --ccc-accent: var(--primary-color, #e08a00);
          --ccc-rec: var(--error-color, #ff6174);
          --ccc-ok: var(--success-color, #207e47);
        }
        ha-card {
          background: var(--ccc-bg);
          border-radius: var(--ha-card-border-radius, 12px);
          border-width: var(--ha-card-border-width, 1px);
          border-style: var(--ha-card-border-style, solid);
          border-color: var(--ha-card-border-color, var(--ccc-divider));
          box-shadow: var(--ha-card-box-shadow, none);
          padding: 14px;
          color: var(--ccc-text-primary);
          overflow: hidden;
          position: relative;
        }
        ha-card.compact {
          padding: 10px 12px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        ha-card.compact .header {
          margin-bottom: 7px;
        }
        .title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rec-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ccc-rec);
        }
        .title {
          font-size: 0.98rem;
          font-weight: 600;
          color: var(--ha-card-header-color, var(--ccc-text-primary));
        }
        ha-card.compact .title {
          font-size: 0.9rem;
        }
        .controls {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }
        .pill-group {
          display: flex;
          background: var(--ccc-surface);
          border: 1px solid var(--ccc-divider);
          border-radius: 999px;
          padding: 2px;
          gap: 2px;
        }
        button.btn {
          appearance: none;
          border: 1px solid transparent;
          background: transparent;
          color: var(--ccc-text-secondary);
          font-family: inherit;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        button.btn:hover {
          color: var(--ccc-text-primary);
          background: var(--ccc-input);
        }
        button.btn.active {
          background: var(--ha-color-fill-primary-normal-resting, color-mix(in srgb, var(--ccc-accent) 18%, transparent));
          color: var(--ccc-accent);
          border-color: color-mix(in srgb, var(--ccc-accent) 42%, transparent);
        }

        /* Main Focus Viewport */
        .stage {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 10px;
          overflow: hidden;
          background: #0d0e11;
          border: 1px solid var(--ccc-divider);
          margin-bottom: 10px;
        }
        ha-card.compact .stage {
          margin-bottom: 7px;
        }
        .stage-media {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .stage-media img,
        .stage-media ha-camera-stream {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        /* Stage Overlays - Positioned at bottom so top-left camera OSD timestamp is completely unobstructed */
        .stage-bottom {
          position: absolute;
          bottom: 8px;
          left: 8px;
          right: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: none;
          z-index: 3;
        }
        .cam-badge {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(16, 18, 22, 0.78);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 0.75rem;
          font-weight: 600;
          color: #f4f4f6;
        }
        .state-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--ccc-rec);
        }
        .state-dot.idle {
          background: var(--ccc-text-secondary);
        }
        .cam-state-text {
          font-size: 0.66rem;
          font-weight: 500;
          color: rgba(230, 232, 240, 0.75);
          text-transform: uppercase;
        }

        /* Quick Action Overlay Bar */
        .stage-actions {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .icon-btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(16, 18, 22, 0.76);
          backdrop-filter: blur(6px);
          color: rgba(240, 242, 250, 0.82);
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .icon-btn:hover {
          background: rgba(32, 35, 42, 0.92);
          color: #ffffff;
        }
        .icon-btn.on {
          border-color: color-mix(in srgb, var(--ccc-accent) 65%, transparent);
          color: var(--ccc-accent);
          background: rgba(20, 22, 27, 0.88);
        }
        .icon-btn.danger.on {
          border-color: var(--ccc-rec);
          color: var(--ccc-rec);
        }
        .icon-btn ha-icon {
          --mdc-icon-size: 16px;
        }

        /* Prev / Next Floating Arrows on Stage */
        .nav-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 3;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(16, 18, 22, 0.65);
          color: #f0f2f8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.18s ease, background 0.15s ease;
        }
        .stage:hover .nav-arrow {
          opacity: 1;
        }
        .nav-arrow:hover {
          background: rgba(24, 27, 34, 0.92);
        }
        .nav-arrow.prev {
          left: 8px;
        }
        .nav-arrow.next {
          right: 8px;
        }

        /* Thumbnail Carousel / Filmstrip */
        .reel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(95px, 1fr));
          gap: 8px;
        }
        ha-card.compact .reel {
          gap: 6px;
        }
        .thumb {
          position: relative;
          aspect-ratio: 16 / 9;
          border-radius: 8px;
          overflow: hidden;
          background: #101216;
          border: 1.5px solid var(--ccc-divider);
          cursor: pointer;
          transition: transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
          opacity: 0.72;
        }
        .thumb:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }
        .thumb.selected {
          opacity: 1;
          border-color: var(--ccc-accent);
          border-width: 2px;
        }
        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .thumb-bar {
          position: absolute;
          inset: auto 0 0 0;
          padding: 3px 7px;
          background: linear-gradient(0deg, rgba(10, 12, 16, 0.88) 0%, rgba(10, 12, 16, 0.45) 75%, transparent 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
        }
        .thumb-name {
          font-size: 0.68rem;
          font-weight: 600;
          color: #f2f4f8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .thumb-icons {
          display: flex;
          align-items: center;
          gap: 3px;
          color: rgba(235, 240, 250, 0.8);
        }
        .thumb-icons ha-icon {
          --mdc-icon-size: 12px;
        }
        .thumb-icons ha-icon.active {
          color: var(--ccc-accent);
        }
      </style>

      <ha-card id="card-root">
        <div class="header">
          <div class="title-wrap">
            <div class="rec-dot"></div>
            <div class="title" id="card-title">Security</div>
          </div>
          <div class="controls">
            <div class="pill-group">
              <button class="btn" id="btn-live" title="Toggle between Live Stream and fast Snapshot">Stream</button>
              <button class="btn" id="btn-cycle" title="Auto-cycle cameras">Auto</button>
              <button class="btn" id="btn-compact" title="Toggle compact layout">Compact</button>
            </div>
          </div>
        </div>

        <!-- Focus Stage -->
        <div class="stage">
          <button class="nav-arrow prev" id="btn-prev" title="Previous camera">◀</button>
          <button class="nav-arrow next" id="btn-next" title="Next camera">▶</button>

          <div class="stage-media" id="stage-media" title="Click to open full camera dialog"></div>

          <div class="stage-bottom">
            <div class="cam-badge" id="focus-badge">
              <span class="state-dot" id="focus-dot"></span>
              <span id="focus-name">--</span>
              <span class="cam-state-text" id="focus-state">--</span>
            </div>
            <div class="stage-actions" id="focus-actions"></div>
          </div>
        </div>

        <!-- Thumbnail Reel -->
        <div class="reel" id="reel-container"></div>
      </ha-card>
    `;

    this.shadowRoot.getElementById("btn-live").addEventListener("click", () => {
      this._liveMode = !this._liveMode;
      this._renderedStreamEntity = null;
      this._render();
    });

    this.shadowRoot.getElementById("btn-cycle").addEventListener("click", () => {
      this._autoCycle = !this._autoCycle;
      this._setupTimers();
      this._render();
    });

    this.shadowRoot.getElementById("btn-compact").addEventListener("click", () => {
      this._compact = !this._compact;
      this._render();
    });

    this.shadowRoot.getElementById("btn-prev").addEventListener("click", (e) => {
      e.stopPropagation();
      const nextIdx = (this._selectedIndex - 1 + this._cameras.length) % this._cameras.length;
      this._selectCamera(nextIdx);
    });

    this.shadowRoot.getElementById("btn-next").addEventListener("click", (e) => {
      e.stopPropagation();
      const nextIdx = (this._selectedIndex + 1) % this._cameras.length;
      this._selectCamera(nextIdx);
    });

    this.shadowRoot.getElementById("stage-media").addEventListener("click", () => {
      const cam = this._cameras[this._selectedIndex];
      if (cam?.entity) {
        this._openMoreInfo(cam.entity);
      }
    });
  }

  _updateImagesOnly() {
    if (!this.shadowRoot || !this._hass || !this._cameras?.length) return;
    // Update snapshot on main stage if not in live stream mode
    if (!this._liveMode) {
      const mainImg = this.shadowRoot.querySelector("#stage-media img");
      const focusCam = this._cameras[this._selectedIndex];
      if (mainImg && focusCam) {
        mainImg.src = this._cameraProxyUrl(focusCam.entity, true);
      }
    }
    // Update thumbnails
    this.shadowRoot.querySelectorAll(".thumb img").forEach((img) => {
      const entityId = img.dataset.entity;
      if (entityId) {
        img.src = this._cameraProxyUrl(entityId, true);
      }
    });
  }

  _updateStatesAndStream() {
    if (!this.shadowRoot || !this._hass || !this._cameras?.length) return;
    const focusCam = this._cameras[this._selectedIndex];
    if (!focusCam) return;

    // Keep live stream hass reference updated
    const streamEl = this.shadowRoot.querySelector("#stage-media ha-camera-stream");
    if (streamEl) {
      streamEl.hass = this._hass;
      streamEl.stateObj = this._hass.states[focusCam.entity];
    }

    this._renderHeaderAndActions(focusCam);
    this._renderThumbBadges();
  }

  _renderHeaderAndActions(focusCam) {
    const stObj = this._hass?.states?.[focusCam.entity];
    const camName =
      focusCam.name ||
      stObj?.attributes?.friendly_name?.replace("[CAM] ", "") ||
      focusCam.entity;
    const camState = stObj?.state || "unknown";

    const nameEl = this.shadowRoot.getElementById("focus-name");
    const stateEl = this.shadowRoot.getElementById("focus-state");
    const dotEl = this.shadowRoot.getElementById("focus-dot");

    if (nameEl) nameEl.textContent = camName;
    if (stateEl) stateEl.textContent = `· ${camState}`;
    if (dotEl) dotEl.classList.toggle("idle", camState !== "recording" && camState !== "streaming");

    const actionsEl = this.shadowRoot.getElementById("focus-actions");
    if (!actionsEl) return;
    actionsEl.innerHTML = "";

    const addToggleBtn = (entityId, iconOn, iconOff, label, danger = false) => {
      if (!entityId || !this._hass?.states?.[entityId]) return;
      const isOn = this._hass.states[entityId].state === "on";
      const btn = document.createElement("button");
      btn.className = `icon-btn ${isOn ? "on" : ""} ${danger ? "danger" : ""}`;
      btn.title = `${label}: ${isOn ? "ON" : "OFF"} (Click to toggle)`;
      btn.innerHTML = `<ha-icon icon="${isOn ? iconOn : iconOff}"></ha-icon>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleEntity(entityId);
      });
      actionsEl.appendChild(btn);
    };

    addToggleBtn(
      focusCam.motion_switch,
      "mdi:motion-sensor",
      "mdi:motion-sensor-off",
      "Motion Alarm"
    );
    addToggleBtn(
      focusCam.recording_switch,
      "mdi:record-rec",
      "mdi:stop-circle-outline",
      "Video Recording"
    );
    addToggleBtn(
      focusCam.privacy_switch,
      "mdi:eye-off",
      "mdi:eye-outline",
      "Privacy Mode"
    );
    addToggleBtn(
      focusCam.siren_entity,
      "mdi:bullhorn",
      "mdi:bullhorn-outline",
      "Siren",
      true
    );

    // More info / Fullscreen button
    const expandBtn = document.createElement("button");
    expandBtn.className = "icon-btn";
    expandBtn.title = "Open Fullscreen / More Info";
    expandBtn.innerHTML = `<ha-icon icon="mdi:arrow-expand"></ha-icon>`;
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._openMoreInfo(focusCam.entity);
    });
    actionsEl.appendChild(expandBtn);
  }

  _renderThumbBadges() {
    this.shadowRoot.querySelectorAll(".thumb").forEach((thumbEl) => {
      const idx = Number(thumbEl.dataset.index);
      const cam = this._cameras[idx];
      if (!cam) return;
      const iconsContainer = thumbEl.querySelector(".thumb-icons");
      if (!iconsContainer) return;

      const motionOn =
        cam.motion_switch &&
        this._hass?.states?.[cam.motion_switch]?.state === "on";
      const recOn =
        cam.recording_switch &&
        this._hass?.states?.[cam.recording_switch]?.state === "on";

      iconsContainer.innerHTML = `
        ${
          motionOn
            ? `<ha-icon class="active" icon="mdi:motion-sensor" title="Motion alarm active"></ha-icon>`
            : ""
        }
        ${
          recOn
            ? `<ha-icon icon="mdi:record-rec" style="color: var(--ccc-rec);" title="Recording active"></ha-icon>`
            : ""
        }
      `;
    });
  }

  _render() {
    if (!this.shadowRoot || !this._config || !this._hass) return;

    const cardRoot = this.shadowRoot.getElementById("card-root");
    if (cardRoot) cardRoot.classList.toggle("compact", this._compact);

    const titleEl = this.shadowRoot.getElementById("card-title");
    if (titleEl) titleEl.textContent = this._config.title || "Security Cameras";

    this.shadowRoot
      .getElementById("btn-live")
      ?.classList.toggle("active", this._liveMode);
    this.shadowRoot
      .getElementById("btn-cycle")
      ?.classList.toggle("active", this._autoCycle);
    this.shadowRoot
      .getElementById("btn-compact")
      ?.classList.toggle("active", this._compact);

    const focusCam = this._cameras[this._selectedIndex];
    if (!focusCam) return;

    this._renderHeaderAndActions(focusCam);

    // Render Stage Media (Live Stream or Snapshot)
    const stageMedia = this.shadowRoot.getElementById("stage-media");
    const stateObj = this._hass.states[focusCam.entity];
    if (stageMedia && stateObj) {
      if (this._liveMode) {
        if (this._renderedStreamEntity !== focusCam.entity) {
          stageMedia.innerHTML = "";
          const streamEl = document.createElement("ha-camera-stream");
          streamEl.hass = this._hass;
          streamEl.stateObj = stateObj;
          streamEl.controls = false;
          streamEl.muted = true;
          streamEl.allowExoPlayer = true;
          stageMedia.appendChild(streamEl);
          this._renderedStreamEntity = focusCam.entity;
        }
      } else {
        this._renderedStreamEntity = null;
        stageMedia.innerHTML = `<img src="${this._cameraProxyUrl(
          focusCam.entity,
          true
        )}" alt="${focusCam.name || focusCam.entity}" />`;
      }
    }

    // Render Thumbnail Reel
    const reel = this.shadowRoot.getElementById("reel-container");
    if (reel) {
      reel.innerHTML = "";
      this._cameras.forEach((cam, idx) => {
        const st = this._hass.states[cam.entity];
        const name =
          cam.name ||
          st?.attributes?.friendly_name?.replace("[CAM] ", "") ||
          cam.entity;

        const thumb = document.createElement("div");
        thumb.className = `thumb ${idx === this._selectedIndex ? "selected" : ""}`;
        thumb.dataset.index = String(idx);
        thumb.innerHTML = `
          <img data-entity="${cam.entity}" src="${this._cameraProxyUrl(
          cam.entity,
          false
        )}" alt="${name}" />
          <div class="thumb-bar">
            <span class="thumb-name">${name}</span>
            <span class="thumb-icons"></span>
          </div>
        `;
        thumb.addEventListener("click", () => {
          this._selectCamera(idx);
        });
        reel.appendChild(thumb);
      });
      this._renderThumbBadges();
    }
  }
}

if (!customElements.get("camera-carousel-card")) {
  customElements.define("camera-carousel-card", CameraCarouselCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "camera-carousel-card",
  name: "Camera Carousel Card",
  description:
    "Compact spotlight and filmstrip carousel for Home Assistant cameras",
});
