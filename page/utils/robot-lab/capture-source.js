// Media stays in memory. Only landmark coordinates leave the worker.
const RUNTIME = new URL('../../assets/mediapipe/tasks-vision/0.10.14/', import.meta.url).href;
const MODELS = new URL('../../assets/mediapipe/models/', import.meta.url).href;
const MODES = new Set(['body-hands', 'body', 'hands']);
const failure = (code, cause) => Object.assign(new Error(code), {code, cause});
const plain = result => result ? {landmarks: result.landmarks || [], worldLandmarks: result.worldLandmarks || [], ...(result.handednesses || result.handedness ? {handednesses: result.handednesses || result.handedness} : {})} : null;

function workerEngine() {
  const worker = new Worker(new URL('./capture-worker.js', import.meta.url));
  const pending = new Map();let next = 1, closed = false;
  const rejectAll = error => {for (const entry of pending.values()) {clearTimeout(entry.timer);entry.reject(error);}pending.clear();};
  worker.onmessage = ({data}) => {const entry = pending.get(data.id);if (!entry) return;pending.delete(data.id);clearTimeout(entry.timer);data.type === 'error' ? entry.reject(failure(data.code, data.message)) : entry.resolve(data.results);};
  worker.onerror = event => {event.preventDefault();closed = true;worker.terminate();rejectAll(failure('MODEL_LOAD', event.message));};
  function request(message, transfer = [], timeout = 45000) {
    if (closed) return Promise.reject(failure('MODEL_LOAD'));
    const id = next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {pending.delete(id);reject(failure(message.type === 'load' ? 'MODEL_LOAD' : 'INFERENCE', 'timeout'));}, timeout);
      pending.set(id, {resolve, reject, timer});
      try {worker.postMessage({...message, id}, transfer);} catch (error) {clearTimeout(timer);pending.delete(id);reject(failure('INFERENCE', error));}
    });
  }
  return {name: 'worker', load: mode => request({type: 'load', mode}), frame: (image, timestamp, mode) => request({type: 'frame', image, timestamp, mode}, [image], 20000),
    close() {if (closed) return;closed = true;worker.terminate();rejectAll(failure('CANCELED'));}};
}

async function mainEngine() {
  const library = await import(RUNTIME + 'vision_bundle.mjs');
  const resolver = await library.FilesetResolver.forVisionTasks(RUNTIME + 'wasm');
  let body, hands, closed = false;
  return {name: 'main',
    async load(mode) {
      if (closed) throw failure('CANCELED');
      if (mode !== 'hands' && !body) body = await library.PoseLandmarker.createFromOptions(resolver, {
        baseOptions: {modelAssetPath: MODELS + 'pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task', delegate: 'CPU'},
        runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5, outputSegmentationMasks: false,
      });
      if (closed) {body?.close();body = null;throw failure('CANCELED');}
      if (mode !== 'body' && !hands) hands = await library.HandLandmarker.createFromOptions(resolver, {
        baseOptions: {modelAssetPath: MODELS + 'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'CPU'},
        runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .5, minHandPresenceConfidence: .5, minTrackingConfidence: .5,
      });
      if (closed) {hands?.close();hands = null;throw failure('CANCELED');}
    },
    async frame(image, timestamp, mode) {
      if (closed) throw failure('CANCELED');
      const pose = mode === 'hands' ? null : body.detectForVideo(image, timestamp);
      const hand = mode === 'body' ? null : hands.detectForVideo(image, timestamp);
      const result = {pose: plain(pose), hand: plain(hand)};pose?.close?.();return result;
    },
    close() {closed = true;body?.close();hands?.close();body = hands = null;},
  };
}

export function createCaptureSource({video, onResults = () => {}, onState = () => {}, onError = () => {}, onEnded = () => {}}) {
  if (!(video instanceof HTMLVideoElement)) throw new TypeError('A video element is required');
  let source = 'none', status = 'idle', mode = 'body-hands', generation = 0, frameGeneration = 0, modeRevision = 0, disposed = false;
  let stream = null, url = null, engine = null, loadingEngine = null, enginePromise = null, engineMode = null, engineQueue = Promise.resolve();
  let processing = false, loading = false, ready = false, frameHandle = 0, callbackKind = '', frameRequested = false;
  let lastCapture = -Infinity, lastMediaTime = -1, lastTimestamp = 0, filename = '', latestReason = 'init';
  let currentFrame = null, pendingMediaCancel = null, surfaceVisible = true;
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d', {alpha: false});
  video.playsInline = true;video.muted = true;video.preload = 'auto';
  const state = () => ({source, status, mode, duration: source === 'video' && Number.isFinite(video.duration) ? video.duration : 0, currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    processing, busy: loading, engine: engine?.name || null, fileName: filename, reason: latestReason, ready});
  function notify(reason = latestReason) {latestReason = reason;if (!disposed) onState(state());}
  function fail(error, code = 'INFERENCE') {const e = typeof error?.code === 'string' ? error : failure(code, error);if (!disposed) onError(e);return e;}
  function cancelScheduled() {
    if (frameHandle) {callbackKind === 'video' ? video.cancelVideoFrameCallback(frameHandle) : cancelAnimationFrame(frameHandle);frameHandle = 0;}
  }
  function invalidate() {frameGeneration++;frameRequested = false;cancelScheduled();}
  function releaseMedia() {
    pendingMediaCancel?.();pendingMediaCancel = null;
    if (stream) {for (const track of stream.getTracks()) {track.onended = null;track.stop();}stream = null;}
    video.pause();video.srcObject = null;video.removeAttribute('src');video.load();
    if (url) {URL.revokeObjectURL(url);url = null;}
  }
  function stop(reason = 'stop') {
    generation++;invalidate();ready = false;loading = false;source = 'none';status = 'idle';filename = '';lastMediaTime = -1;
    releaseMedia();notify(reason);
  }
  async function getEngine(wantedMode) {
    if (!enginePromise) enginePromise = (async () => {
      let candidate;
      if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function') {
        try {candidate = loadingEngine = workerEngine();await candidate.load(wantedMode);if (disposed) {candidate.close();throw failure('CANCELED');}engine = candidate;loadingEngine = null;engineMode = wantedMode;return engine;}
        catch (error) {candidate?.close();if (disposed) throw failure('CANCELED');}
      }
      candidate = loadingEngine = await mainEngine();
      try {await candidate.load(wantedMode);} catch (error) {candidate.close();throw failure('MODEL_LOAD', error);}
      if (disposed) {candidate.close();throw failure('CANCELED');}engine = candidate;loadingEngine = null;engineMode = wantedMode;return engine;
    })().catch(error => {enginePromise = null;loadingEngine = null;throw typeof error?.code === 'string' ? error : failure('MODEL_LOAD', error);});
    const instance = await enginePromise;
    // A mode change may arrive while model creation is still pending.
    engineQueue = engineQueue.catch(() => {}).then(async () => {if (engineMode !== wantedMode) {await instance.load(wantedMode);engineMode = wantedMode;}return instance;});
    return engineQueue;
  }
  function waitForMedia(token) {
    return new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => {clearTimeout(timer);video.removeEventListener('loadeddata', done);video.removeEventListener('canplay', done);video.removeEventListener('error', error);if (pendingMediaCancel === cancel) pendingMediaCancel = null;};
      const done = () => {if (token !== generation) return cancel();if (video.error) return error();if (video.readyState < 2 || !video.videoWidth) return;cleanup();resolve();};
      const error = () => {cleanup();reject(failure(source === 'camera' ? 'CAMERA_UNAVAILABLE' : 'VIDEO_FORMAT'));};
      const cancel = () => {cleanup();reject(failure('CANCELED'));};
      pendingMediaCancel = cancel;video.addEventListener('loadeddata', done);video.addEventListener('canplay', done);video.addEventListener('error', error);timer = setTimeout(error, 20000);done();
    });
  }
  async function prepare(token) {
    const revision = modeRevision, instance = await getEngine(mode);if (token !== generation || disposed) return false;
    if (revision !== modeRevision) return prepare(token);
    await waitForMedia(token);if (token !== generation || disposed) return false;
    loading = false;ready = true;status = video.paused ? 'ready' : 'playing';notify('ready');requestFrame(true);return !!instance;
  }
  async function startCamera(deviceId) {
    if (disposed) return false;
    stop('source-change');const token = generation;source = 'camera';status = 'loading';loading = true;notify('source-change');
    try {
      if (!window.isSecureContext) throw failure('SECURE_CONTEXT');
      if (!navigator.mediaDevices?.getUserMedia) throw failure('CAMERA_UNAVAILABLE');
      const constraints = {audio: false, video: {width: {ideal: 640}, height: {ideal: 480}, ...(deviceId ? {deviceId: {exact: deviceId}} : {facingMode: 'user'})}};
      let requested;
      try {requested = await navigator.mediaDevices.getUserMedia(constraints);} catch (error) {
        if (error.name === 'OverconstrainedError' && !deviceId) requested = await navigator.mediaDevices.getUserMedia({audio: false, video: true});else throw error;
      }
      if (token !== generation || disposed || document.hidden || !surfaceVisible) {requested.getTracks().forEach(track => track.stop());if (token === generation && !disposed) stop('hidden');return false;}
      stream = requested;for (const track of stream.getVideoTracks()) track.onended = () => {const details = {source: 'camera', reason: 'camera-ended', mediaTime: video.currentTime};stop('camera-ended');onEnded(details);};
      video.srcObject = stream;await video.play();return await prepare(token);
    } catch (error) {
      if (token !== generation || disposed || error.code === 'CANCELED') return false;
      const code = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error.name) ? 'CAMERA_PERMISSION' : (typeof error.code === 'string' ? error.code : null) || (['NotFoundError', 'NotReadableError', 'AbortError', 'OverconstrainedError'].includes(error.name) ? 'CAMERA_UNAVAILABLE' : 'MODEL_LOAD');
      stop('error');status = 'error';notify('error');fail(error, code);return false;
    }
  }
  async function loadVideo(file) {
    if (disposed) return false;
    if (!(file instanceof Blob) || !file.size || (file.type && !file.type.startsWith('video/')) || (!file.type && !/\.(mp4|m4v|mov|webm|ogv)$/i.test(file.name || ''))) {fail(failure('VIDEO_FORMAT'));return false;}
    stop('source-change');const token = generation;source = 'video';status = 'loading';loading = true;filename = file.name || '';notify('source-change');
    try {url = URL.createObjectURL(file);video.src = url;video.load();return await prepare(token);}
    catch (error) {if (token !== generation || disposed || error.code === 'CANCELED') return false;stop('error');status = 'error';notify('error');fail(error, 'VIDEO_FORMAT');return false;}
  }
  function requestFrame(force = false) {
    if (disposed || !ready || source === 'none' || document.hidden || !surfaceVisible || video.seeking) return;
    if (force) frameRequested = true;
    if (frameHandle || (video.paused && !frameRequested)) return;
    if (video.paused) {callbackKind = 'raf';frameHandle = requestAnimationFrame(now => {frameHandle = 0;processFrame(now, video.currentTime);});}
    else if (video.requestVideoFrameCallback) {callbackKind = 'video';frameHandle = video.requestVideoFrameCallback((now, metadata) => {frameHandle = 0;processFrame(now, metadata.mediaTime);});}
    else {callbackKind = 'raf';frameHandle = requestAnimationFrame(now => {frameHandle = 0;processFrame(now, video.currentTime);});}
  }
  async function processFrame(now, mediaTime) {
    if (disposed || !ready || document.hidden || !surfaceVisible || source === 'none' || video.seeking) return;
    if (processing) {requestFrame();return;}
    if (!frameRequested && (now - lastCapture < 1000 / 15 || mediaTime === lastMediaTime)) {requestFrame();return;}
    if (video.readyState < 2 || !video.videoWidth) {requestFrame();return;}
    frameRequested = false;processing = true;lastCapture = now;lastMediaTime = mediaTime;
    const token = generation, frameToken = frameGeneration, frameMode = mode, frameSource = source;
    const timestamp = lastTimestamp = Math.max(performance.now(), lastTimestamp + 1);
    const size = Math.min(1, 640 / video.videoWidth, 640 / video.videoHeight);
    const width = Math.max(1, Math.round(video.videoWidth * size)), height = Math.max(1, Math.round(video.videoHeight * size));
    if (canvas.width !== width || canvas.height !== height) {canvas.width = width;canvas.height = height;}
    notify('frame');
    let image;
    try {
      context.drawImage(video, 0, 0, width, height);
      image = engine.name === 'worker' ? await createImageBitmap(canvas) : canvas;
      if (token !== generation || frameToken !== frameGeneration || disposed) {image?.close?.();return;}
      currentFrame = engine.frame(image, timestamp, frameMode);const results = await currentFrame;
      if (token !== generation || frameToken !== frameGeneration || disposed) return;
      onResults(results, {mediaTime, sourceTime: mediaTime, timestamp, source: frameSource, mode: frameMode});
    } catch (error) {
      if (token === generation && frameToken === frameGeneration && !disposed) {
        frameSource === 'camera' ? stop('error') : pause();ready = false;engine?.close();engine = null;enginePromise = null;engineMode = null;status = 'error';notify('error');fail(error);onEnded({source: frameSource, reason: 'error', mediaTime});
      }
    } finally {currentFrame = null;processing = false;if (!disposed) {notify('frame');requestFrame();}}
  }
  async function play() {
    if (!ready || disposed || document.hidden || !surfaceVisible) return false;
    try {if (source === 'video' && video.ended) video.currentTime = 0;await video.play();return true;}
    catch (error) {fail(failure('VIDEO_PLAY', error));return false;}
  }
  function pause(reason = 'pause') {invalidate();video.pause();if (source !== 'none') status = 'paused';notify(reason);}
  function seek(seconds) {
    if (source !== 'video' || !ready || !Number.isFinite(seconds)) return false;
    invalidate();notify('seek');video.currentTime = Math.max(0, Math.min(Number.isFinite(video.duration) ? video.duration : seconds, seconds));return true;
  }
  async function setMode(next) {
    if (!MODES.has(next) || next === mode || disposed) return;
    mode = next;const revision = ++modeRevision;invalidate();notify('mode');if (source === 'none') return;
    const token = generation;ready = false;loading = true;status = 'loading';notify('loading');
    try {await getEngine(mode);if (token !== generation || revision !== modeRevision || disposed) return;ready = true;loading = false;status = video.paused ? 'paused' : 'playing';notify('ready');requestFrame(true);}
    catch (error) {if (token !== generation || revision !== modeRevision || disposed) return;const was = source;source === 'camera' ? stop('error') : pause();loading = false;ready = false;status = 'error';notify('error');fail(error, 'MODEL_LOAD');onEnded({source: was, reason: 'error', mediaTime: video.currentTime});}
  }
  const onPlay = () => {if (source === 'none' || !ready) return;status = 'playing';notify('play');requestFrame(true);};
  const onPause = () => {invalidate();if (source !== 'none' && ready) {status = 'paused';notify('pause');}};
  const onSeeking = () => {invalidate();if (source !== 'none') notify('seek');};
  const onSeeked = () => {lastMediaTime = -1;if (source !== 'none') {notify('seeked');requestFrame(true);}};
  const onTime = () => {if (source !== 'none') notify('time');};
  const ended = () => {invalidate();if (source === 'video') {status = 'paused';notify('ended');onEnded({source, reason: 'ended', mediaTime: video.currentTime});}};
  const mediaError = () => {if (!ready || source === 'none') return;const was = source;stop('error');status = 'error';notify('error');fail(failure('VIDEO_FORMAT'));onEnded({source: was, reason: 'error', mediaTime: 0});};
  const suspendHidden = () => {if (source === 'camera') {stop('hidden');onEnded({source: 'camera', reason: 'hidden', mediaTime: 0});}else if (source === 'video') pause('hidden');};
  const hidden = () => {if (document.hidden) suspendHidden();};
  // A desktop window can hide an iframe without changing document.hidden.
  const visibility = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {surfaceVisible = entries.every(entry => entry.isIntersecting);if (!surfaceVisible) suspendHidden();}) : null;
  visibility?.observe(document.documentElement);
  const unload = event => {if (event.persisted) stop('hidden');else dispose();};
  const events = {play: onPlay, pause: onPause, seeking: onSeeking, seeked: onSeeked, timeupdate: onTime, ended, error: mediaError};
  for (const [event, fn] of Object.entries(events)) video.addEventListener(event, fn);
  document.addEventListener('visibilitychange', hidden);window.addEventListener('pagehide', unload);
  function dispose() {if (disposed) return;stop('dispose');disposed = true;visibility?.disconnect();loadingEngine?.close();engine?.close();engine = loadingEngine = null;for (const [event, fn] of Object.entries(events)) video.removeEventListener(event, fn);document.removeEventListener('visibilitychange', hidden);window.removeEventListener('pagehide', unload);canvas.width = canvas.height = 1;}
  return {startCamera, loadVideo, play, pause, seek, stop, dispose, setMode, get state() {return state();}, get video() {return video;}};
}
