import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';

const app = document.getElementById('app');
const pieceCountLabel = document.getElementById('pieceCountLabel');
const progressLabel = document.getElementById('progressLabel');
const modeLabel = document.getElementById('modeLabel');
const narrationText = document.getElementById('narrationText');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#090b14');

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 500);
camera.position.set(0, 1.7, 4.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

const ambient = new THREE.AmbientLight('#b0c4ff', 0.45);
const keyLight = new THREE.DirectionalLight('#d9e0ff', 1.1);
keyLight.position.set(2, 3, 2.5);
const fillLight = new THREE.DirectionalLight('#91a2ff', 0.55);
fillLight.position.set(-2, -1, -2);
scene.add(ambient, keyLight, fillLight);

const axes = new THREE.AxesHelper(2.3);
scene.add(axes);

const sphereRadius = 1;
const leftCenter = new THREE.Vector3(-1.8, 0, 0);
const rightCenter = new THREE.Vector3(1.8, 0, 0);

const targetMaterial = new THREE.MeshBasicMaterial({
  color: '#3e486f',
  wireframe: true,
  transparent: true,
  opacity: 0.28,
});

const leftTarget = new THREE.Mesh(new THREE.SphereGeometry(sphereRadius, 30, 18), targetMaterial);
leftTarget.position.copy(leftCenter);
const rightTarget = leftTarget.clone();
rightTarget.position.copy(rightCenter);
scene.add(leftTarget, rightTarget);

const guideSolid = new THREE.Mesh(
  new THREE.SphereGeometry(sphereRadius, 44, 28),
  new THREE.MeshStandardMaterial({ color: '#5f6cb2', roughness: 0.4, metalness: 0.05, transparent: true, opacity: 0.18 })
);
const guideWire = new THREE.Mesh(
  guideSolid.geometry,
  new THREE.MeshBasicMaterial({ color: '#8ea2ff', wireframe: true, transparent: true, opacity: 0.5 })
);
scene.add(guideSolid, guideWire);

const piecesGroup = new THREE.Group();
scene.add(piecesGroup);

const presetNames = ['Classroom Intro', 'High Contrast', 'Dense Experimental'];
const presets = {
  'Classroom Intro': {
    partitions: 6,
    seed: 42,
    pointDensity: 52,
    angleRangeDeg: 150,
    animationSpeed: 0.2,
    renderMode: 'points',
    visibleSubset: -1,
    showAxes: true,
    showTargets: true,
  },
  'High Contrast': {
    partitions: 10,
    seed: 7,
    pointDensity: 60,
    angleRangeDeg: 185,
    animationSpeed: 0.3,
    renderMode: 'wireframe',
    visibleSubset: -1,
    showAxes: true,
    showTargets: true,
  },
  'Dense Experimental': {
    partitions: 14,
    seed: 77,
    pointDensity: 70,
    angleRangeDeg: 220,
    animationSpeed: 0.18,
    renderMode: 'points',
    visibleSubset: -1,
    showAxes: false,
    showTargets: true,
  },
};

const params = {
  partitions: 8,
  seed: 22,
  pointDensity: 56,
  angleRangeDeg: 170,
  animationSpeed: 0.22,
  easing: 'smootherstep',
  progress: 0,
  autoPlay: false,
  renderMode: 'points',
  visibleSubset: -1,
  showAxes: true,
  showTargets: true,
  preset: presetNames[0],
  play: () => {
    presentationState.active = false;
    params.autoPlay = true;
  },
  pause: () => {
    presentationState.active = false;
    params.autoPlay = false;
  },
  reset: () => {
    presentationState.active = false;
    params.autoPlay = false;
    params.progress = 0;
    if (progressController) progressController.updateDisplay();
  },
  savePreset: () => saveCurrentPreset(),
  loadPreset: () => triggerPresetLoad(),
  screenshot: () => saveScreenshot(),
  applyPreset: () => {
    applyPreset(params.preset);
  },
  startPresentation: () => startPresentationMode(),
  stopPresentation: () => stopPresentationMode(),
};

const partitionState = {
  pieces: [],
  maxSubsetIndex: -1,
  pointCount: 0,
};

let progressController;
let subsetController;
let renderModeController;
let narrationStage = -1;
let presentationStage = -1;

const presentationState = {
  active: false,
  elapsed: 0,
  duration: 42,
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashXYZ(x, y, z, seed) {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 5.123) * 43758.5453123;
  return h - Math.floor(h);
}

function easeByName(t, name) {
  const x = clamp(t, 0, 1);
  if (name === 'linear') return x;
  if (name === 'smoothstep') return x * x * (3 - 2 * x);
  return x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
}

function colorForIndex(i, total) {
  return new THREE.Color().setHSL((i / Math.max(total, 1) + 0.08) % 1, 0.82, 0.62);
}

function generateSpherePoints(targetDensity) {
  const density = clamp(Math.floor(targetDensity), 16, 96);
  const points = [];
  for (let i = 0; i <= density; i += 1) {
    const v = i / density;
    const phi = Math.PI * v;
    const rowCount = Math.max(8, Math.floor(Math.sin(phi) * density * 2));
    for (let j = 0; j < rowCount; j += 1) {
      const u = j / rowCount;
      const theta = u * Math.PI * 2;
      const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
      const y = sphereRadius * Math.cos(phi);
      const z = sphereRadius * Math.sin(phi) * Math.sin(theta);
      points.push(new THREE.Vector3(x, y, z));
    }
  }
  return points;
}

function rebuildPieces() {
  while (piecesGroup.children.length) {
    const child = piecesGroup.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }

  const partitions = clamp(Math.floor(params.partitions), 2, 24);
  params.partitions = partitions;
  const points = generateSpherePoints(params.pointDensity);

  const buckets = Array.from({ length: partitions }, () => []);
  for (const p of points) {
    const h = hashXYZ(p.x, p.y, p.z, params.seed);
    const subset = Math.floor(h * partitions) % partitions;
    buckets[subset].push(p);
  }

  const rng = mulberry32(params.seed * 1337 + partitions * 97);
  const pieces = [];

  for (let i = 0; i < buckets.length; i += 1) {
    const bucket = buckets[i];
    if (bucket.length === 0) continue;

    const positions = new Float32Array(bucket.length * 3);
    for (let k = 0; k < bucket.length; k += 1) {
      positions[k * 3] = bucket[k].x;
      positions[k * 3 + 1] = bucket[k].y;
      positions[k * 3 + 2] = bucket[k].z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: colorForIndex(i, partitions),
      size: 0.026,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    const pointsObj = new THREE.Points(geometry, material);
    const axis = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
    const maxAngle = THREE.MathUtils.degToRad(clamp(params.angleRangeDeg, 0, 360));
    const angle = (rng() * 2 - 1) * maxAngle;
    const targetCenter = i % 2 === 0 ? leftCenter : rightCenter;
    const offsetScale = 0.35 + 0.35 * rng();
    const centerOffset = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(offsetScale);

    pieces.push({
      subset: i,
      pointsObj,
      axis,
      angle,
      targetCenter,
      centerOffset,
      sideSign: i % 2 === 0 ? -1 : 1,
    });

    piecesGroup.add(pointsObj);
  }

  partitionState.pieces = pieces;
  partitionState.maxSubsetIndex = partitions - 1;
  partitionState.pointCount = points.length;

  if (params.visibleSubset > partitionState.maxSubsetIndex) {
    params.visibleSubset = -1;
    subsetController?.updateDisplay();
  }

  updateVisibilityMode();
  updateHud();
}

function computePieceTransform(piece, t) {
  const phaseA = clamp(t / 0.33, 0, 1);
  const phaseB = clamp((t - 0.33) / 0.33, 0, 1);
  const phaseC = clamp((t - 0.66) / 0.34, 0, 1);

  const easedA = easeByName(phaseA, params.easing);
  const easedB = easeByName(phaseB, params.easing);
  const easedC = easeByName(phaseC, params.easing);

  const quaternion = new THREE.Quaternion().setFromAxisAngle(piece.axis, piece.angle * easedA);

  const sideDrift = new THREE.Vector3(piece.sideSign * 0.8 * easedB, 0.2 * Math.sin(piece.subset) * easedB, 0);
  const settle = piece.targetCenter.clone().add(piece.centerOffset.clone().multiplyScalar(1 - easedC));
  const translation = sideDrift.lerp(settle, easedC);

  return { quaternion, translation };
}

function updatePiecesForProgress() {
  const t = clamp(params.progress, 0, 1);
  for (const piece of partitionState.pieces) {
    const { quaternion, translation } = computePieceTransform(piece, t);
    piece.pointsObj.quaternion.copy(quaternion);
    piece.pointsObj.position.copy(translation);
  }

  const stage = t < 0.33 ? 0 : t < 0.66 ? 1 : 2;
  if (stage !== narrationStage) {
    narrationStage = stage;
    narrationText.textContent =
      stage === 0
        ? 'Stage 1: deterministic finite pieces are defined and begin independent rigid rotations.'
        : stage === 1
          ? 'Stage 2: subsets drift apart into left/right branches, showing piece-wise rigid motions.'
          : 'Stage 3: subsets settle into two target regions, imitating paradoxical duplication visually.';
  }

  updateHud();
}

function updateHud() {
  pieceCountLabel.textContent = `Pieces: ${partitionState.maxSubsetIndex + 1} subsets / ${partitionState.pointCount} points`;
  progressLabel.textContent = `Progress: ${Math.round(clamp(params.progress, 0, 1) * 100)}%`;
  modeLabel.textContent = `Mode: ${params.renderMode}${presentationState.active ? ' (presentation)' : ''}`;
}

function updateVisibilityMode() {
  axes.visible = params.showAxes;
  leftTarget.visible = params.showTargets;
  rightTarget.visible = params.showTargets;

  const renderMode = params.renderMode;
  guideSolid.visible = renderMode === 'solid';
  guideWire.visible = renderMode === 'wireframe';

  const subsetFilter = Number(params.visibleSubset);
  for (const piece of partitionState.pieces) {
    piece.pointsObj.visible = renderMode === 'points' && (subsetFilter === -1 || subsetFilter === piece.subset);
  }

  updateHud();
}

function applyPreset(name) {
  const chosen = presets[name];
  if (!chosen) return;
  const mutableKeys = ['partitions', 'seed', 'pointDensity', 'angleRangeDeg', 'animationSpeed', 'renderMode', 'visibleSubset', 'showAxes', 'showTargets'];
  for (const key of mutableKeys) {
    if (Object.hasOwn(chosen, key)) params[key] = chosen[key];
  }
  if (subsetController) {
    subsetController.max(partitionState.maxSubsetIndex);
    subsetController.updateDisplay();
  }
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  rebuildPieces();
  updatePiecesForProgress();
}

function saveCurrentPreset() {
  const payload = {
    partitions: params.partitions,
    seed: params.seed,
    pointDensity: params.pointDensity,
    angleRangeDeg: params.angleRangeDeg,
    animationSpeed: params.animationSpeed,
    easing: params.easing,
    renderMode: params.renderMode,
    visibleSubset: params.visibleSubset,
    showAxes: params.showAxes,
    showTargets: params.showTargets,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'banach-tarski-inspired-preset.json';
  a.click();
  URL.revokeObjectURL(url);
}

function triggerPresetLoad() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const preset = JSON.parse(text);
      const allowed = ['partitions', 'seed', 'pointDensity', 'angleRangeDeg', 'animationSpeed', 'easing', 'renderMode', 'visibleSubset', 'showAxes', 'showTargets'];
      for (const key of allowed) {
        if (Object.hasOwn(preset, key)) params[key] = preset[key];
      }
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      rebuildPieces();
      updatePiecesForProgress();
    } catch {
      alert('Invalid preset file. Please provide a valid JSON preset.');
    }
  });
  input.click();
}

function saveScreenshot() {
  const dataUrl = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `banach-tarski-inspired-${Date.now()}.png`;
  a.click();
}

function resetCameraView() {
  camera.position.set(0, 1.7, 4.2);
  controls.target.set(0, 0, 0);
  controls.update();
}

function startPresentationMode() {
  presentationState.active = true;
  presentationState.elapsed = 0;
  presentationStage = -1;
  params.autoPlay = false;
  params.progress = 0;
  applyPreset('Classroom Intro');
  resetCameraView();
  progressController?.updateDisplay();
  updatePiecesForProgress();
  updateVisibilityMode();
}

function stopPresentationMode(keepState = true) {
  presentationState.active = false;
  presentationState.elapsed = 0;
  presentationStage = -1;
  params.autoPlay = false;
  if (!keepState) {
    params.progress = 0;
    progressController?.updateDisplay();
    updatePiecesForProgress();
  }
  updateVisibilityMode();
}

function enterPresentationStage(stage) {
  if (stage === 0) {
    applyPreset('Classroom Intro');
    params.progress = 0;
  } else if (stage === 1) {
    applyPreset('Classroom Intro');
    params.visibleSubset = -1;
    params.renderMode = 'points';
  } else if (stage === 2) {
    applyPreset('High Contrast');
    params.renderMode = 'wireframe';
    params.visibleSubset = 2;
    params.progress = 0.6;
  } else if (stage === 3) {
    applyPreset('Dense Experimental');
    params.renderMode = 'points';
    params.visibleSubset = -1;
    params.progress = 0;
  } else if (stage === 4) {
    params.renderMode = 'wireframe';
    params.progress = 1;
  }

  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  updatePiecesForProgress();
  updateVisibilityMode();
}

function updatePresentationMode(dt) {
  presentationState.elapsed += dt;
  const t = presentationState.elapsed;

  let stage = 0;
  if (t >= 6 && t < 20) stage = 1;
  else if (t >= 20 && t < 27) stage = 2;
  else if (t >= 27 && t < 39) stage = 3;
  else if (t >= 39) stage = 4;

  if (stage !== presentationStage) {
    presentationStage = stage;
    enterPresentationStage(stage);
  }

  if (stage === 1) {
    const stageT = clamp((t - 6) / 14, 0, 1);
    params.progress = stageT;
  } else if (stage === 3) {
    const stageT = clamp((t - 27) / 12, 0, 1);
    params.progress = stageT;
  }

  progressController?.updateDisplay();
  updatePiecesForProgress();

  if (presentationState.elapsed >= presentationState.duration) {
    stopPresentationMode(true);
  }
}

const gui = new GUI({ title: 'Controls' });
const modelFolder = gui.addFolder('Model');
modelFolder.add(params, 'partitions', 2, 24, 1).name('Partitions').onFinishChange(() => rebuildPieces());
modelFolder.add(params, 'seed', 1, 9999, 1).name('Seed').onFinishChange(() => rebuildPieces());
modelFolder.add(params, 'pointDensity', 16, 96, 1).name('Density').onFinishChange(() => rebuildPieces());
modelFolder.add(params, 'angleRangeDeg', 0, 360, 1).name('Max angle (deg)').onFinishChange(() => rebuildPieces());
modelFolder.add(params, 'renderMode', ['points', 'wireframe', 'solid']).name('Render mode').onChange(() => updateVisibilityMode());
renderModeController = modelFolder.controllers[modelFolder.controllers.length - 1];
subsetController = modelFolder
  .add(params, 'visibleSubset', -1, 23, 1)
  .name('Subset (-1 = all)')
  .onChange(() => updateVisibilityMode());
modelFolder.add(params, 'showAxes').name('Show axes').onChange(() => updateVisibilityMode());
modelFolder.add(params, 'showTargets').name('Show targets').onChange(() => updateVisibilityMode());
modelFolder.open();

const animationFolder = gui.addFolder('Animation');
animationFolder.add(params, 'animationSpeed', 0.02, 1, 0.01).name('Speed');
animationFolder.add(params, 'easing', ['linear', 'smoothstep', 'smootherstep']).name('Easing');
progressController = animationFolder
  .add(params, 'progress', 0, 1, 0.001)
  .name('Timeline')
  .onChange(() => updatePiecesForProgress());
animationFolder.add(params, 'play');
animationFolder.add(params, 'pause');
animationFolder.add(params, 'reset');
animationFolder.open();

const toolsFolder = gui.addFolder('Presets & Export');
toolsFolder.add(params, 'preset', presetNames).name('Preset');
toolsFolder.add(params, 'applyPreset').name('Apply preset');
toolsFolder.add(params, 'savePreset').name('Save preset JSON');
toolsFolder.add(params, 'loadPreset').name('Load preset JSON');
toolsFolder.add(params, 'screenshot').name('Export screenshot');
toolsFolder.open();

const presentationFolder = gui.addFolder('Presentation');
presentationFolder.add(params, 'startPresentation').name('Start presentation');
presentationFolder.add(params, 'stopPresentation').name('Stop presentation');
presentationFolder.open();

applyPreset('Classroom Intro');
rebuildPieces();
updatePiecesForProgress();
updateVisibilityMode();

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);
  if (presentationState.active) {
    updatePresentationMode(dt);
  } else if (params.autoPlay) {
    params.progress += dt * params.animationSpeed;
    if (params.progress >= 1) {
      params.progress = 1;
      params.autoPlay = false;
    }
    progressController.updateDisplay();
    updatePiecesForProgress();
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
