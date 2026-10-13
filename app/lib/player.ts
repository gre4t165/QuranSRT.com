// Pemutar dengan satu linimasa: bisa satu file (unggahan / audio qari gabungan)
// atau playlist per ayat (bila audio qari tidak boleh diunduh lintas domain).

export interface Segment {
	url: string;
	offset: number;
	dur: number;
}

type Listener = () => void;

export class TimelinePlayer {
	el: HTMLMediaElement;
	private segs: Segment[] | null = null;
	private segIndex = 0;
	private listeners = new Set<Listener>();
	private rate = 1;
	private mediaDuration = 0;
	private pendingSeek: number | null = null;
	/** Jam virtual: dipakai saat belum ada audio, agar pratinjau tetap bisa diputar. */
	private clock = { playing: false, offset: 0, startedAt: 0 };
	virtualDuration = 0;

	constructor() {
		this.el = typeof Audio !== 'undefined' ? new Audio() : ({} as HTMLMediaElement);
		this.bind(this.el);
	}

	private bind(el: HTMLMediaElement) {
		if (!el.addEventListener) return;
		const emit = () => this.emit();
		el.addEventListener('play', emit);
		el.addEventListener('pause', emit);
		el.addEventListener('loadedmetadata', () => {
			if (!this.segs && Number.isFinite(el.duration)) this.mediaDuration = el.duration;
			if (this.pendingSeek !== null) {
				el.currentTime = this.pendingSeek;
				this.pendingSeek = null;
			}
			el.playbackRate = this.rate;
			this.emit();
		});
		el.addEventListener('ended', () => {
			if (this.segs && this.segIndex < this.segs.length - 1) {
				this.loadSeg(this.segIndex + 1, 0, true);
			} else this.emit();
		});
	}

	on(fn: Listener) {
		this.listeners.add(fn);
		return () => void this.listeners.delete(fn);
	}
	private emit() {
		this.listeners.forEach((f) => f());
	}

	/** Pakai elemen media tertentu (mis. <video> unggahan) atau elemen audio bawaan. */
	loadSingle(url: string, el?: HTMLMediaElement, duration = 0) {
		this.pause();
		if (el && el !== this.el) {
			this.el = el;
			this.bind(el);
		} else if (!el && !(this.el instanceof HTMLAudioElement)) {
			this.el = new Audio();
			this.bind(this.el);
		}
		this.segs = null;
		this.mediaDuration = duration;
		this.clock.playing = false;
		this.el.src = url;
		this.el.load();
		this.emit();
	}

	loadPlaylist(segs: Segment[]) {
		this.pause();
		if (!(this.el instanceof HTMLAudioElement)) {
			this.el = new Audio();
			this.bind(this.el);
		}
		this.segs = segs;
		this.clock.playing = false;
		this.mediaDuration = segs.reduce((a, s) => Math.max(a, s.offset + s.dur), 0);
		this.loadSeg(0, 0, false);
		this.emit();
	}

	clear() {
		this.pause();
		this.segs = null;
		this.mediaDuration = 0;
		if (this.el.removeAttribute) {
			this.el.removeAttribute('src');
			this.el.load();
		}
		this.emit();
	}

	private loadSeg(i: number, at: number, play: boolean) {
		if (!this.segs) return;
		this.segIndex = i;
		const s = this.segs[i];
		if (this.el.src !== s.url) {
			this.pendingSeek = at > 0 ? at : null;
			this.el.src = s.url;
		} else this.el.currentTime = at;
		this.el.playbackRate = this.rate;
		if (play) void this.el.play().catch(() => this.emit());
	}

	get hasMedia() {
		return !!this.segs || !!this.el.src;
	}
	get duration() {
		return this.hasMedia ? this.mediaDuration : this.virtualDuration;
	}
	setVirtualDuration(d: number) {
		this.virtualDuration = d;
	}
	get isPlaylist() {
		return !!this.segs;
	}
	get playing() {
		if (!this.hasMedia) return this.clock.playing;
		return !this.el.paused && !this.el.ended;
	}

	time(): number {
		if (!this.hasMedia) {
			const c = this.clock;
			if (!c.playing) return c.offset;
			const t = c.offset + ((performance.now() - c.startedAt) / 1000) * this.rate;
			if (t >= this.virtualDuration) {
				c.playing = false;
				c.offset = this.virtualDuration;
				queueMicrotask(() => this.emit());
				return c.offset;
			}
			return t;
		}
		const t = this.el.currentTime || 0;
		return this.segs ? (this.segs[this.segIndex]?.offset ?? 0) + t : t;
	}

	play() {
		if (!this.hasMedia) {
			if (this.virtualDuration <= 0) return Promise.resolve();
			if (this.clock.offset >= this.virtualDuration - 0.01) this.clock.offset = 0;
			this.clock.startedAt = performance.now();
			this.clock.playing = true;
			this.emit();
			return Promise.resolve();
		}
		return this.el.play().catch((e) => {
			this.emit();
			throw e;
		});
	}
	pause() {
		if (this.clock.playing) {
			this.clock.offset = this.time();
			this.clock.playing = false;
			this.emit();
		}
		if (this.el.pause) this.el.pause();
	}
	toggle() {
		return this.playing ? (this.pause(), Promise.resolve()) : this.play();
	}

	seek(t: number) {
		const target = Math.max(0, Math.min(this.duration || Infinity, t));
		if (!this.hasMedia) {
			this.clock.offset = target;
			this.clock.startedAt = performance.now();
		} else if (this.segs) {
			let i = this.segs.findIndex((s) => target < s.offset + s.dur);
			if (i < 0) i = this.segs.length - 1;
			this.loadSeg(i, target - this.segs[i].offset, this.playing);
		} else if (this.el.readyState > 0) this.el.currentTime = target;
		else this.pendingSeek = target;
		this.emit();
	}

	setRate(r: number) {
		if (this.clock.playing) {
			this.clock.offset = this.time();
			this.clock.startedAt = performance.now();
		}
		this.rate = r;
		this.el.playbackRate = r;
		this.emit();
	}
	getRate() {
		return this.rate;
	}
}
