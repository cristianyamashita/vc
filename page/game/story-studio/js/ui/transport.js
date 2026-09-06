import { t } from '../i18n.js';

// Play, pause and a scrubbable progress bar. The bar is the reason the whole
// engine compiles to keyframes instead of simulating, so it gets to be a
// first-class control rather than a decoration: dragging it is a plain
// `seek()`, and it works identically whether the film is playing or paused.

function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Transport {
  constructor(root, playback) {
    this.root = root;
    this.playback = playback;
    this.button = root.querySelector('.ss-play');
    this.range = root.querySelector('.ss-scrub');
    this.now = root.querySelector('.ss-now');
    this.total = root.querySelector('.ss-total');
    this.scrubbing = false;

    this.button.addEventListener('click', () => this.toggle());

    // While the pointer is down the film must not fight the slider for the
    // time value, so playback pauses for the drag and resumes after it.
    this.range.addEventListener('pointerdown', () => {
      this.scrubbing = true;
      this.wasPlaying = playback.playing;
      playback.pause();
    });
    const release = () => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      if (this.wasPlaying && playback.time < playback.duration - 1e-3) playback.play();
      this.sync();
    };
    this.range.addEventListener('pointerup', release);
    this.range.addEventListener('pointercancel', release);
    this.range.addEventListener('input', () => {
      const d = playback.duration || 1;
      playback.seek((Number(this.range.value) / 1000) * d);
      this.sync();
    });

    playback.onTick = () => this.sync();
  }

  toggle() {
    if (this.playback.playing) this.playback.pause();
    else this.playback.play();
    this.sync();
  }

  sync() {
    const d = this.playback.duration || 0;
    const time = this.playback.time;
    if (!this.scrubbing) {
      this.range.value = String(d > 0 ? Math.round((time / d) * 1000) : 0);
    }
    this.now.textContent = clock(time);
    this.total.textContent = clock(d);
    const ended = d > 0 && time >= d - 1e-3;
    const label = this.playback.playing ? t('pause') : ended ? t('replay') : t('play');
    this.button.textContent = this.playback.playing ? '❚❚' : '▶';
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
  }
}
