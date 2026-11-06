/* Classic worker on purpose: MediaPipe 0.10.14's WASM loader uses importScripts.
   The task library itself is an ES module, imported dynamically below. */
const runtime = new URL('../../assets/mediapipe/tasks-vision/0.10.14/', self.location.href).href;
const models = new URL('../../assets/mediapipe/models/', self.location.href).href;
let library, resolver, body, hands;
let work = Promise.resolve();
async function ensure(mode) {
  if (!library) library = await import(runtime + 'vision_bundle.mjs');
  if (!resolver) resolver = await library.FilesetResolver.forVisionTasks(runtime + 'wasm');
  if (mode !== 'hands' && !body) body = await library.PoseLandmarker.createFromOptions(resolver, {
    baseOptions: {modelAssetPath: models + 'pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task', delegate: 'CPU'},
    canvas: new OffscreenCanvas(1, 1), runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5,
    outputSegmentationMasks: false,
  });
  if (mode !== 'body' && !hands) hands = await library.HandLandmarker.createFromOptions(resolver, {
    baseOptions: {modelAssetPath: models + 'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'CPU'},
    canvas: new OffscreenCanvas(1, 1), runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: .5, minHandPresenceConfidence: .5, minTrackingConfidence: .5,
  });
}
const plain = result => result ? {
  landmarks: result.landmarks || [], worldLandmarks: result.worldLandmarks || [],
  ...(result.handednesses || result.handedness ? {handednesses: result.handednesses || result.handedness} : {}),
} : null;
async function handle(message) {
  const {id, type, mode, image, timestamp} = message;
  try {
    if (type === 'load') {await ensure(mode);self.postMessage({id, type: 'ready'});}
    else if (type === 'frame') {
      const pose = mode === 'hands' ? null : body.detectForVideo(image, timestamp);
      const hand = mode === 'body' ? null : hands.detectForVideo(image, timestamp);
      self.postMessage({id, type: 'result', results: {pose: plain(pose), hand: plain(hand)}});
      pose?.close?.();
    }
  } catch (error) {
    self.postMessage({id, type: 'error', code: type === 'load' ? 'MODEL_LOAD' : 'INFERENCE', message: error?.message || String(error)});
  } finally {image?.close?.();}
}
self.onmessage = event => {work = work.then(() => handle(event.data));};
