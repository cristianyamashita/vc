import { messages } from "./i18n.js";
import { createWorld } from "./world.js";
import {
  WEAPONS,
  stageConfig,
  award,
  paperScore,
  acceleration,
  sanitizeSave,
} from "./core.js";
const $ = (id) => document.getElementById(id),
  $$ = (s) => [...document.querySelectorAll(s)];
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
let save = sanitizeSave(read("rangeClub.save.v1", {})),
  prefs = read("rangeClub.prefs.v1", {});
let lang = ["pt", "en", "ja"].includes(prefs.lang) ? prefs.lang : "pt";
const config = {
  mode: prefs.mode === "tournament" ? "tournament" : "free",
  env: ["forest", "field", "indoor"].includes(prefs.env) ? prefs.env : "forest",
  weapon: WEAPONS.some((w) => w.id === prefs.weapon)
    ? prefs.weapon
    : "revolver",
  target: ["paper", "can", "bottle"].includes(prefs.target)
    ? prefs.target
    : "paper",
  distance: Math.max(8, Math.min(90, Number(prefs.distance) || 18)),
  wind: Math.max(0, Math.min(10, Number(prefs.wind) || 0)),
  moving: !!prefs.moving,
  sway: prefs.sway !== false,
  usePhotos: prefs.usePhotos !== false,
};
if (prefs.wind === undefined) config.wind = 2;
let freeConfig = {
  distance: config.distance,
  wind: config.wind,
  target: config.target,
  moving: config.moving,
  sway: config.sway,
};
let W = null,
  photos = [],
  photoImages = [],
  db = null,
  active = false,
  paused = false,
  round = null,
  aim = { x: 0, y: 0 },
  actualAim = { x: 0, y: 0 },
  zoom = false,
  steady = false,
  breath = 1,
  exhausted = false,
  recoil = 0,
  reloadLeft = 0,
  cooldown = 0,
  time = 0,
  projectiles = [],
  shotId = 0,
  soundEnabled = prefs.sound !== false,
  audio = null,
  last = performance.now(),
  toastTimeout,
  feedbackTimeout,
  modalKind = "",
  lastResult = null;
const t = (key, values = {}) =>
  Object.entries(values).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, v),
    messages[lang][key] || messages.en[key] || key,
  );
const weapon = () => WEAPONS.find((w) => w.id === config.weapon);
function toast(msg) {
  $("toast").textContent = msg;
  $("toast").classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $("toast").classList.remove("visible"), 3300);
}
function persist() {
  try {
    localStorage.setItem("rangeClub.save.v1", JSON.stringify(save));
    localStorage.setItem(
      "rangeClub.prefs.v1",
      JSON.stringify({
        ...config,
        ...(config.mode === "tournament" ? freeConfig : {}),
        lang,
        theme: document.documentElement.dataset.theme,
        sound: soundEnabled,
      }),
    );
  } catch {
    toast(t("storageError"));
  }
}
function applyLanguage() {
  document.documentElement.lang = lang;
  $("language").value = lang;
  $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $$("[data-label]").forEach((el) => {
    el.title = t(el.dataset.label);
    el.setAttribute("aria-label", t(el.dataset.label));
  });
  $("language").setAttribute("aria-label", t("language"));
  refreshUI();
  if (modalKind === "armory") showArmory();
  if (modalKind === "guide") showGuide();
  if (modalKind === "photos") showPhotos();
  if (modalKind === "result") renderResult();
}
function applyStage() {
  if (config.mode === "tournament") {
    Object.assign(config, stageConfig(save.stage));
    if (!save.owned.includes(config.weapon)) config.weapon = "revolver";
  }
}
function effectiveWind() {
  return config.env === "indoor"
    ? 0
    : config.wind * (0.8 + 0.2 * Math.sin(time * 0.43));
}
function refreshUI() {
  $("credits").textContent = Math.floor(save.credits).toLocaleString(lang);
  $("scene-title").textContent = t(config.env + "Title");
  $("scene-description").textContent = t(config.env + "Desc");
  $("distance-hud").textContent = config.distance + " m";
  $("target-hud").textContent = t(config.target);
  $("distance-value").textContent = config.distance + " m";
  $("wind-value").textContent =
    (config.env === "indoor" ? 0 : config.wind) + " m/s";
  $("distance").value = config.distance;
  $("wind").value = config.wind;
  $("moving").checked = config.moving;
  $("sway").checked = config.sway;
  for (const kind of ["mode", "env", "target"])
    $$(`[data-${kind}]`).forEach((b) => {
      const selected = b.dataset[kind] === config[kind];
      b.classList.toggle("active", selected);
      b.setAttribute("aria-pressed", String(selected));
      if (kind === "target") b.disabled = config.mode === "tournament";
    });
  for (const id of ["distance", "wind", "moving", "sway"])
    $(id).disabled =
      config.mode === "tournament" ||
      (id === "wind" && config.env === "indoor");
  $("tournament-note").hidden = config.mode !== "tournament";
  $("tournament-note").textContent = save.completed
    ? t("completeNote")
    : t("stageNote", {
        stage: save.stage,
        distance: config.distance,
        goal: stageConfig(save.stage).goal,
      });
  const w = weapon();
  document.querySelector("#weapon-card svg").innerHTML = weaponArt(w.id);
  $("selected-kind").textContent = t(w.id).toUpperCase();
  $("selected-name").textContent = t(w.name);
  $("selected-info").textContent =
    `${w.mag} ${t(w.id === "bow" ? "arrows" : "rounds")} · ${w.reload.toFixed(1)} s`;
  $("weapon-kind").textContent = t(w.id).toUpperCase();
  $("weapon-name").textContent = t(w.name);
  $("sound").setAttribute("aria-pressed", String(soundEnabled));
  $("sound").style.opacity = soundEnabled ? "1" : ".45";
  updateTargetUploadPanel();
  if (round) updateHUD();
}
function updateTargetUploadPanel() {
  const image = $("target-upload-image");
  const placeholder = $("target-upload-placeholder");
  const status = $("target-upload-status");
  const input = $("target-upload");
  const usePhotos = $("target-use-photos");
  const removePhoto = $("target-remove-photo");
  if (!image || !placeholder || !status || !input || !usePhotos || !removePhoto)
    return;
  const latest = photos.at(-1);
  image.hidden = !latest;
  placeholder.hidden = !!latest;
  if (latest) image.src = latest.data;
  else image.removeAttribute("src");
  status.textContent = photos.length
    ? t("storedPhotos", { count: photos.length })
    : t("noCustomTarget");
  input.disabled = photos.length >= 4;
  removePhoto.hidden = !latest;
  usePhotos.checked = config.usePhotos;
}
function updateHUD() {
  if (!round) return;
  $("score").textContent = String(round.score).padStart(3, "0");
  $("accuracy").textContent = round.shots
    ? Math.round((round.hits / round.shots) * 100) + "%"
    : "—";
  $("goal").textContent = round.mode === "free" ? "∞" : round.goal;
  $("goal-bar").style.width =
    (round.mode === "free"
      ? 0
      : Math.min(100, (round.score / round.goal) * 100)) + "%";
  $("round-name").textContent =
    round.mode === "free" ? t("session") : `${t("stage")} ${round.stage} / 12`;
  $("ammo").textContent =
    reloadLeft > 0
      ? t("reloading")
      : `${round.ammo} / ${weapon().mag}` +
        (round.mode === "tournament"
          ? ` · ${12 - round.shots} ${t("remaining")}`
          : "");
  $("play-hint").textContent =
    round.ammo === 0 && reloadLeft <= 0
      ? t("empty")
      : config.weapon === "bow"
        ? t("bowHint")
        : t("playHint");
}
function rebuildTargets() {
  if (W) {
    W.clearEffects();
    projectiles = [];
    W.buildTargets(config, config.usePhotos ? photoImages : []);
  }
}
function rebuild() {
  if (!W) return;
  W.buildEnvironment(config.env);
  rebuildTargets();
  W.makeGun(config.weapon);
  refreshUI();
}
function sync() {
  applyStage();
  refreshUI();
  persist();
  rebuild();
}
function modal(kind) {
  if (active && !paused) pause();
  modalKind = kind;
  if (!$("modal").open) $("modal").showModal();
}
function closeModal() {
  if (modalKind === "result") {
    lastResult = null;
    modalKind = "";
    $("modal").close();
    returnClub();
    return;
  }
  modalKind = "";
  $("modal").close();
}
const weaponArt = (id) =>
  id === "bow"
    ? '<path d="M65 5Q125 40 65 75L85 40Z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M30 40h90l-10-5m10 5-10 5" fill="none" stroke="currentColor" stroke-width="2"/>'
    : `<path d="M18 27h${id === "rifle" || id === "shotgun" ? 120 : 99}v9H80l-12 7H56l-8 24-20-5 11-27H18Z" fill="currentColor"/>${id === "revolver" ? '<rect x="65" y="22" width="22" height="22" rx="7" fill="#71816b"/>' : ""}${id === "rifle" ? '<rect x="65" y="14" width="38" height="9" rx="4" fill="currentColor"/>' : ""}`;
function showArmory() {
  modal("armory");
  $("modal-body").innerHTML =
    `<h2>${t("armory")}</h2><p>${t("arsenalDesc")}</p><span class="wallet">◈ ${save.credits.toLocaleString(lang)} CR</span><div class="weapon-grid">${WEAPONS.map(
      (w) => {
        const owned = save.owned.includes(w.id),
          free = config.mode === "free",
          selected = w.id === config.weapon;
        return `<article class="weapon-option ${selected ? "selected" : ""}"><small>${t(w.id).toUpperCase()}</small><svg viewBox="0 0 160 80" aria-hidden="true">${weaponArt(w.id)}</svg><h3>${t(w.name)}</h3><small>${w.mag} ${t(w.id === "bow" ? "arrows" : "rounds")} · ${w.reload.toFixed(1)} s</small>${["precision", "stability", "power"].map((s) => `<div class="stat"><span>${t(s)}</span><meter min="0" max="100" value="${w[s]}">${w[s]}</meter></div>`).join("")}<button data-equip="${w.id}" ${selected ? "disabled" : ""}>${selected ? t("equipped") : free || owned ? t("equip") : t("buy") + " · " + w.price + " CR"}</button><small>${free ? t("available") : owned ? t("owned") : w.price + " CR"}</small></article>`;
      },
    ).join("")}</div>`;
  $$("[data-equip]").forEach(
    (b) =>
      (b.onclick = () => {
        const w = WEAPONS.find((w) => w.id === b.dataset.equip);
        if (config.mode === "tournament" && !save.owned.includes(w.id)) {
          if (save.credits < w.price) {
            toast(t("insufficient"));
            return;
          }
          save.credits -= w.price;
          save.owned.push(w.id);
          toast(t("purchased"));
        }
        config.weapon = w.id;
        W?.makeGun(w.id);
        if (round) {
          round.ammo = w.mag;
          reloadLeft = 0;
        }
        persist();
        refreshUI();
        showArmory();
      }),
  );
}
function showGuide() {
  modal("guide");
  $("modal-body").innerHTML =
    `<h2>${t("guideTitle")}</h2><div class="guide-grid">${["Aim", "Physics", "Arms", "Tournament", "Free", "Photos"].map((k) => `<section><h3>${t("guide" + k)}</h3><p>${t("guide" + k + "Text")}</p></section>`).join("")}</div>`;
}
async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("RangeClubDB", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("photos"))
        req.result.createObjectStore("photos", { keyPath: "id" });
    };
    req.onsuccess = () => {
      const d = req.result;
      d.onversionchange = () => {
        d.close();
        db = null;
      };
      resolve(d);
    };
    req.onerror = () => reject(req.error);
  });
}
async function loadPhotos() {
  if (!db) db = await openDB();
  photos = await new Promise((resolve, reject) => {
    const tr = db.transaction("photos"),
      r = tr.objectStore("photos").getAll();
    r.onsuccess = () =>
      resolve(
        r.result
          .filter(
            (p) =>
              p &&
              typeof p.id === "string" &&
              typeof p.data === "string" &&
              /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
                p.data,
              ),
          )
          .slice(0, 4),
      );
    r.onerror = () => reject(r.error);
  });
  photoImages = (
    await Promise.all(
      photos.map(
        (p) =>
          new Promise((resolve) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = () => resolve(null);
            im.src = p.data;
          }),
      ),
    )
  ).filter(Boolean);
}
async function mutatePhoto(action, value) {
  if (!db) db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos")[action](value);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  await loadPhotos();
  rebuildTargets();
  updateTargetUploadPanel();
}
async function importPhotoFiles(fileList, input) {
  input.disabled = true;
  let added = 0;
  for (const file of fileList) {
    if (photos.length >= 4) {
      toast(t("photoLimit"));
      break;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      toast(t("photoError"));
      continue;
    }
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      canvas
        .getContext("2d")
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      await mutatePhoto("put", {
        id: crypto.randomUUID(),
        // PNG keeps the uploaded colors intact after the browser-side resize.
        data: canvas.toDataURL("image/png"),
      });
      added++;
    } catch {
      bitmap?.close();
      toast(t("photoError"));
    }
  }
  if (added) {
    config.usePhotos = true;
    persist();
    rebuildTargets();
    updateTargetUploadPanel();
    toast(t("photoSaved"));
  }
  if (input.isConnected) {
    input.value = "";
    input.disabled = photos.length >= 4;
  }
  return added;
}
function showPhotos() {
  modal("photos");
  $("modal-body").innerHTML =
    `<h2>${t("photoTitle")}</h2><p>${t("photoDesc")}</p><label class="photo-drop">${t("upload")}<input type="file" id="photo-upload" accept="image/jpeg,image/png,image/webp" multiple ${photos.length >= 4 ? "disabled" : ""}></label><label class="photo-toggle"><input type="checkbox" id="use-photos" ${config.usePhotos ? "checked" : ""}>${t("usePhotos")}</label><div class="photo-list">${photos.map((p, i) => `<div class="photo-item"><img alt="${t("target")} ${i + 1}" src="${p.data}"><button data-remove="${i}">${t("remove")}</button></div>`).join("")}</div>`;
  $("use-photos").onchange = (e) => {
    config.usePhotos = e.target.checked;
    persist();
    rebuildTargets();
  };
  $$("[data-remove]").forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        try {
          await mutatePhoto("delete", photos[Number(b.dataset.remove)].id);
          showPhotos();
        } catch {
          toast(t("storageError"));
          b.disabled = false;
        }
      }),
  );
  $("photo-upload").onchange = async (e) => {
    const added = await importPhotoFiles(e.target.files, e.target);
    if (modalKind === "photos") showPhotos();
  };
}
function sound(kind) {
  if (!soundEnabled) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime;
    if (kind === "shot" || kind === "bow") {
      const length = kind === "bow" ? 0.16 : 0.22,
        buf = audio.createBuffer(
          1,
          audio.sampleRate * length,
          audio.sampleRate,
        ),
        data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.13));
      const source = audio.createBufferSource();
      source.buffer = buf;
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value =
        kind === "bow" ? 600 : config.weapon === "shotgun" ? 1200 : 2200;
      const gain = audio.createGain();
      gain.gain.value = kind === "bow" ? 0.2 : 0.4;
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start();
    } else {
      const osc = audio.createOscillator(),
        gain = audio.createGain();
      osc.type = kind === "hit" ? "sine" : "triangle";
      osc.frequency.setValueAtTime(
        kind === "hit" ? 870 : kind === "win" ? 520 : 230,
        now,
      );
      osc.frequency.exponentialRampToValueAtTime(
        kind === "win" ? 1040 : 140,
        now + 0.17,
      );
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(now + 0.27);
    }
  } catch {}
}
function startRound() {
  if (!W) return;
  modalKind = "";
  $("modal").close();
  applyStage();
  active = true;
  paused = false;
  lastResult = null;
  round = {
    mode: config.mode,
    stage: save.stage,
    goal: stageConfig(save.stage).goal,
    score: 0,
    hits: 0,
    shots: 0,
    ammo: weapon().mag,
    finished: false,
  };
  time = 0;
  aim = { x: 0, y: 0 };
  actualAim = { x: 0, y: 0 };
  breath = 1;
  exhausted = false;
  zoom = false;
  steady = false;
  recoil = 0;
  reloadLeft = 0;
  cooldown = 0;
  shotId = 0;
  projectiles = [];
  document.body.classList.add("playing");
  $("paused").hidden = true;
  $("play-hud").hidden = false;
  $("weapon-hud").hidden = false;
  $("reticle").hidden = false;
  $("preview-caption").hidden = true;
  rebuild();
  W.resize();
  updateHUD();
  sound("reload");
  W.renderer.domElement.focus();
}
function pause() {
  if (!active || paused) return;
  paused = true;
  zoom = false;
  steady = false;
  $("paused").hidden = false;
  $("reticle").hidden = true;
}
function resume() {
  if (!active || modalKind) return;
  paused = false;
  $("paused").hidden = true;
  $("reticle").hidden = false;
  last = performance.now();
}
function returnClub() {
  active = false;
  paused = false;
  zoom = false;
  steady = false;
  round = null;
  projectiles = [];
  reloadLeft = 0;
  document.body.classList.remove("playing");
  for (const id of ["paused", "play-hud", "weapon-hud", "reticle"])
    $(id).hidden = true;
  $("preview-caption").hidden = false;
  applyStage();
  rebuild();
  W?.resize();
}
function feedback(text) {
  $("hit-feedback").textContent = text;
  $("hit-feedback").classList.add("visible");
  clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(
    () => $("hit-feedback").classList.remove("visible"),
    650,
  );
}
function reload() {
  if (
    !active ||
    paused ||
    reloadLeft > 0 ||
    round.ammo === weapon().mag ||
    (round.mode === "tournament" && round.shots >= 12)
  )
    return;
  reloadLeft = weapon().reload;
  sound("reload");
  updateHUD();
}
function updateAim() {
  const factor = active
    ? config.sway
      ? weapon().sway * (steady && breath > 0 && !exhausted ? 0.13 : 1)
      : 0
    : 0.35;
  actualAim = {
    x: aim.x + Math.sin(time * 1.7) * 0.006 * factor,
    y: aim.y + Math.sin(time * 2.15 + 0.7) * 0.008 * factor,
  };
}
function shoot() {
  if (
    !active ||
    paused ||
    modalKind ||
    round.finished ||
    cooldown > 0 ||
    reloadLeft > 0
  )
    return;
  if (round.mode === "tournament" && round.shots >= 12) return;
  if (round.ammo <= 0) {
    reload();
    return;
  }
  updateAim();
  const T = W.T,
    w = weapon();
  round.shots++;
  round.ammo--;
  cooldown = w.cooldown;
  recoil = w.recoil;
  const direction = new T.Vector3(actualAim.x, actualAim.y, 0.5)
    .unproject(W.camera)
    .sub(W.camera.position)
    .normalize();
  const origin = W.launchOrigin();
  // Converge from the visible muzzle/arrow tip onto the reticle's target plane.
  const aimPoint = W.camera.position
    .clone()
    .addScaledVector(direction, config.distance / Math.max(0.1, -direction.z));
  direction.copy(aimPoint).sub(origin).normalize();
  const shot = {
    id: ++shotId,
    hit: false,
    scoredTargets: new Set(),
    pending: w.pellets,
  };
  for (let i = 0; i < w.pellets; i++) {
    const d = direction.clone();
    d.x += (Math.random() - 0.5) * w.spread * 2;
    d.y += (Math.random() - 0.5) * w.spread * 2;
    d.normalize();
    const velocity = d.multiplyScalar(w.speed);
    projectiles.push({
      pos: origin.clone(),
      v: velocity,
      life: 0,
      weapon: w,
      shot,
      visual: W.createProjectile(w.id, origin, velocity),
    });
  }
  sound(w.id === "bow" ? "bow" : "shot");
  updateHUD();
}
function settle(p) {
  p.shot.pending--;
  if (p.shot.pending === 0 && !p.shot.hit) feedback(t("miss"));
}
function stepProjectiles(dt) {
  if (!W || !round || dt <= 0) return;
  const T = W.T,
    ray = new T.Raycaster();
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i],
      before = p.pos.clone(),
      a = acceleration(effectiveWind(), p.weapon);
    p.pos
      .addScaledVector(p.v, dt)
      .add(new T.Vector3(a.x, a.y, 0).multiplyScalar(0.5 * dt * dt));
    p.v.x += a.x * dt;
    p.v.y += a.y * dt;
    p.life += dt;
    const delta = p.pos.clone().sub(before),
      length = delta.length();
    ray.set(before, delta.normalize());
    ray.near = 0;
    ray.far = length;
    const objects = W.targets()
      .filter((target) => target.down <= 0)
      .flatMap((target) => target.hitMeshes);
    const collisions = ray.intersectObjects(objects, false);
    if (collisions.length) {
      const hit = collisions[0],
        target = hit.object.userData.target;
      if (!p.shot.scoredTargets.has(target.index)) {
        p.shot.scoredTargets.add(target.index);
        const local = target.group.worldToLocal(hit.point.clone());
        const points =
          target.type === "paper"
            ? paperScore(local.x, local.y - 2)
            : target.type === "can"
              ? 35
              : 40;
        round.score += points;
        if (!p.shot.hit) {
          p.shot.hit = true;
          round.hits++;
        }
        W.hitEffect(target, hit.point);
        sound("hit");
        feedback((points === 50 ? t("bullseye") : t("hit")) + " +" + points);
        updateHUD();
      }
      W.updateProjectile(p.visual, hit.point, p.v);
      W.finishProjectile(p.visual, target);
      settle(p);
      projectiles.splice(i, 1);
    } else {
      W.updateProjectile(p.visual, p.pos, p.v);
      if (p.pos.y < -0.1 || p.life > 4 || p.pos.z < 5 - config.distance - 8) {
        W.finishProjectile(p.visual);
        settle(p);
        projectiles.splice(i, 1);
      }
    }
  }
  if (
    round.mode === "tournament" &&
    round.shots >= 12 &&
    projectiles.length === 0 &&
    !round.finished
  )
    finishRound();
}
function finishRound() {
  round.finished = true;
  lastResult = { ...round, passed: round.score >= round.goal, earned: 0 };
  if (lastResult.passed) {
    lastResult.earned = award(round.score, round.stage);
    save.credits += lastResult.earned;
    if (round.stage === 12) save.completed = true;
    else save.stage = Math.min(12, round.stage + 1);
    save.best = Math.max(save.best, round.score);
    persist();
    sound("win");
  }
  paused = true;
  zoom = false;
  steady = false;
  modal("result");
  renderResult();
  refreshUI();
}
function renderResult() {
  if (!lastResult) return;
  const r = lastResult;
  $("modal-body").innerHTML =
    `<span class="eyebrow">${t("tournament")} / ${t("stage")} ${r.stage}</span><h2>${t(r.passed ? (r.stage === 12 ? "champion" : "passed") : "failed")}</h2><p>${t(r.passed ? (r.stage === 12 ? "championDesc" : "passedDesc") : "failedDesc")}</p><div class="result-stats"><div><strong>${r.score} / ${r.goal}</strong><small>${t("score")}</small></div><div><strong>${Math.round((r.hits / Math.max(1, r.shots)) * 100)}%</strong><small>${t("accuracy")}</small></div><div><strong>+${r.earned}</strong><small>${t("earned")}</small></div></div><div class="result-actions"><button class="primary" id="next-round">${t(r.passed && r.stage < 12 ? "next" : "again")}</button><button class="secondary" id="result-armory">${t("armory")}</button><button class="secondary" id="result-club">${t("club")}</button></div>`;
  $("next-round").onclick = startRound;
  $("result-club").onclick = closeModal;
  $("result-armory").onclick = () => {
    returnClub();
    showArmory();
  };
}
// UI changes are made between sessions, preserving the tournament conditions.
$$("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      if (b.dataset.mode === config.mode) return;
      if (config.mode === "free")
        freeConfig = {
          distance: config.distance,
          wind: config.wind,
          target: config.target,
          moving: config.moving,
          sway: config.sway,
        };
      config.mode = b.dataset.mode;
      if (config.mode === "free") Object.assign(config, freeConfig);
      sync();
    }),
);
$$("[data-env]").forEach(
  (b) =>
    (b.onclick = () => {
      config.env = b.dataset.env;
      sync();
    }),
);
$$("[data-target]").forEach(
  (b) =>
    (b.onclick = () => {
      config.target = b.dataset.target;
      sync();
    }),
);
for (const id of ["distance", "wind", "moving", "sway"])
  $(id).oninput = (e) => {
    config[id] =
      e.target.type === "checkbox" ? e.target.checked : Number(e.target.value);
    refreshUI();
    if (id === "distance") rebuildTargets();
    persist();
  };
$("start").onclick = startRound;
$("pause").onclick = pause;
$("resume").onclick = resume;
$("leave").onclick = returnClub;
$("armory").onclick = showArmory;
$("weapon-card").onclick = showArmory;
$("browse-weapons").onclick = showArmory;
$("help").onclick = showGuide;
$("mobile-help").onclick = showGuide;
$("photos-button").onclick = showPhotos;
$("target-upload").onchange = async (event) => {
  await importPhotoFiles(event.target.files, event.target);
};
$("target-remove-photo").onclick = async (event) => {
  const photo = photos.at(-1);
  if (!photo) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await mutatePhoto("delete", photo.id);
    toast(t("photoRemoved"));
  } catch {
    toast(t("storageError"));
  } finally {
    button.disabled = false;
  }
};
$("target-use-photos").onchange = (event) => {
  config.usePhotos = event.target.checked;
  persist();
  rebuildTargets();
};
$("range-tab").onclick = () => {
  if (active) pause();
  else closeModal();
};
$("close-modal").onclick = closeModal;
$("modal").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeModal();
});
$("language").onchange = (e) => {
  lang = e.target.value;
  applyLanguage();
  persist();
};
document.documentElement.dataset.theme =
  prefs.theme === "light" ? "light" : "dark";
$("theme").onclick = () => {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
  persist();
};
$("sound").onclick = () => {
  soundEnabled = !soundEnabled;
  refreshUI();
  persist();
  sound("reload");
  toast(t(soundEnabled ? "soundOn" : "soundOff"));
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("viewport").requestFullscreen();
  } catch {
    toast(t("fullscreenError"));
  }
};
$("touch-fire").onclick = shoot;
$("touch-reload").onclick = reload;
$("touch-zoom").onclick = () => {
  zoom = !zoom;
};
window.addEventListener("keydown", (e) => {
  if (
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
    e.target.isContentEditable
  )
    return;
  if (e.code === "Escape") {
    if (modalKind) return;
    if (active) {
      paused ? resume() : pause();
      e.preventDefault();
    }
    return;
  }
  if (!active || paused || modalKind) return;
  if (["Space", "KeyR", "ShiftLeft", "ShiftRight"].includes(e.code))
    e.preventDefault();
  if (e.code === "KeyR" && !e.repeat) reload();
  if (e.code === "Space") zoom = true;
  if (e.key === "Shift") steady = true;
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") zoom = false;
  if (e.key === "Shift") steady = false;
});
window.addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!W || document.hidden) return;
  const run = !paused && !modalKind;
  const simDt = run ? dt : 0;
  if (run) {
    time += dt;
    cooldown = Math.max(0, cooldown - dt);
    recoil = Math.max(0, recoil - dt * 5);
    if (active) {
      if (steady && breath > 0 && !exhausted) {
        breath = Math.max(0, breath - dt * 0.23);
        if (breath <= 0) exhausted = true;
      } else {
        breath = Math.min(1, breath + dt * 0.16);
        if (!steady && breath > 0.2) exhausted = false;
      }
      if (reloadLeft > 0) {
        reloadLeft = Math.max(0, reloadLeft - dt);
        if (reloadLeft === 0) {
          round.ammo = weapon().mag;
          updateHUD();
        }
      }
    }
  }
  updateAim();
  const scopeVisible =
    active &&
    !paused &&
    !modalKind &&
    zoom &&
    config.weapon === "rifle" &&
    reloadLeft === 0;
  $("scope-view").hidden = !scopeVisible;
  const ironSights =
    active && zoom && config.weapon !== "bow" && reloadLeft === 0;
  $("reticle").style.opacity = ironSights ? "0" : "1";
  if (scopeVisible) {
    $("scope-view").style.left = (actualAim.x + 1) * 50 + "%";
    $("scope-view").style.top = (1 - actualAim.y) * 50 + "%";
    const rect = $("viewport").getBoundingClientRect();
    $("scope-view").style.setProperty(
      "--scope-size",
      Math.min(rect.width * 0.78, rect.height * 0.68, 520) + "px",
    );
    $("scope-distance").textContent = config.distance + " m";
  }
  $("reticle").style.left = (actualAim.x + 1) * 50 + "%";
  $("reticle").style.top = (1 - actualAim.y) * 50 + "%";
  $("wind-hud").textContent = effectiveWind().toFixed(1) + " m/s";
  $("wind-arrow").textContent = config.env === "indoor" ? "—" : "→";
  $("breath-bar").style.width = breath * 100 + "%";
  W.update(
    simDt,
    time,
    config,
    actualAim,
    recoil,
    reloadLeft > 0 ? Math.sin((reloadLeft / weapon().reload) * Math.PI) : 0,
    zoom,
    active,
    effectiveWind(),
    !round || round.ammo > 0,
  );
  if (active && run && !round.finished) stepProjectiles(simDt);
}
applyStage();
applyLanguage();
requestAnimationFrame(frame);
try {
  const T = await import(
    "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js"
  );
  W = createWorld(T, $("scene"));
  W.renderer.domElement.tabIndex = 0;
  W.renderer.domElement.setAttribute("aria-label", t("aimShoot"));
  W.renderer.domElement.addEventListener("pointermove", (e) => {
    if (paused) return;
    const rect = W.renderer.domElement.getBoundingClientRect();
    aim.x = Math.max(
      -0.94,
      Math.min(0.94, ((e.clientX - rect.left) / rect.width) * 2 - 1),
    );
    aim.y = Math.max(
      -0.92,
      Math.min(0.92, 1 - ((e.clientY - rect.top) / rect.height) * 2),
    );
  });
  W.renderer.domElement.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") {
      const rect = W.renderer.domElement.getBoundingClientRect();
      aim.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      aim.y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
      return;
    }
    if (e.button === 0) shoot();
    if (e.button === 2) zoom = true;
  });
  window.addEventListener("pointerup", (e) => {
    if (e.button === 2) zoom = false;
  });
  W.renderer.domElement.addEventListener("contextmenu", (e) =>
    e.preventDefault(),
  );
  W.renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    pause();
    toast(t("loadError"));
  });
  try {
    await loadPhotos();
  } catch {
    toast(t("storageError"));
  }
  rebuild();
  $("loading").hidden = true;
  $("start").disabled = false;
  // Read-only diagnostics also support deterministic browser regression checks.
  window.rangeClub = {
    get state() {
      return {
        active,
        paused,
        config: { ...config },
        save: { ...save, owned: [...save.owned] },
        round: round ? { ...round } : null,
        projectiles: projectiles.length,
        photos: photos.length,
        breath,
        reloadLeft,
        zoom,
        weapon: weapon().id,
      };
    },
    get targetScreens() {
      return W.targets().map((target) => {
        const v = new T.Vector3(0, target.type === "paper" ? 2 : 1.5, 0);
        target.group.localToWorld(v);
        v.project(W.camera);
        const r = W.renderer.domElement.getBoundingClientRect();
        return {
          x: r.left + ((v.x + 1) / 2) * r.width,
          y: r.top + ((1 - v.y) / 2) * r.height,
          index: target.index,
          down: target.down,
        };
      });
    },
    get rendererInfo() {
      return {
        calls: W.renderer.info.render.calls,
        triangles: W.renderer.info.render.triangles,
        geometries: W.renderer.info.memory.geometries,
        textures: W.renderer.info.memory.textures,
      };
    },
    get visualState() {
      return W.visualState;
    },
  };
} catch (error) {
  console.error(error);
  $("load-detail").textContent = t("loadError");
  $("retry").hidden = false;
}
