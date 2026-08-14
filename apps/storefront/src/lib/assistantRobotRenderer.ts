import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

type RobotOptions = {
  environmentUrl: string;
  eyesUrl: string;
  glassUrl: string;
  headUrl: string;
  modelSize: number;
  onError: () => void;
  onReady: () => void;
  signal: AbortSignal;
  textureUrl?: string | null;
};

export function mountAssistantRobot(
  canvas: HTMLCanvasElement,
  options: RobotOptions,
): () => void {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "low-power",
    premultipliedAlpha: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, -0.2, 8);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(4, 6, 4);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const root = new THREE.Group();
  scene.add(root);
  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const hdrLoader = new HDRLoader();
  const gaze = new THREE.Vector2();
  const gazeTarget = new THREE.Vector2();
  const eyeTarget = new THREE.Vector2();
  const pointer = new THREE.Vector2();
  let head: THREE.Group | null = null;
  let eyes: THREE.Group | null = null;
  let frame = 0;
  let elapsed = 0;
  let visible = true;
  let disposed = false;
  let animating = false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  THREE.Cache.enabled = true;

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const handlePointer = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    pointer.set(
      THREE.MathUtils.clamp((event.clientX - centerX) / Math.max(bounds.width / 2, 1), -1.5, 1.5),
      THREE.MathUtils.clamp(-(event.clientY - centerY) / Math.max(bounds.height / 2, 1), -1.5, 1.5),
    );
  };
  window.addEventListener("pointermove", handlePointer, { passive: true });

  const loadOptionalTexture = async () => {
    if (!options.textureUrl) return null;
    const texture = await textureLoader.loadAsync(options.textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  };

  const environmentPromise = hdrLoader.loadAsync(options.environmentUrl).then((environment) => {
    if (disposed || options.signal.aborted) {
      environment.dispose();
      return;
    }
    environment.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = environment;
  }).catch((error: unknown) => {
    console.warn("AI Assistant HDR environment could not be loaded.", error);
  });

  void Promise.all([
    loader.loadAsync(options.headUrl),
    loader.loadAsync(options.eyesUrl),
    loader.loadAsync(options.glassUrl),
    loadOptionalTexture().catch((error: unknown) => {
      console.warn("AI Assistant custom texture could not be loaded.", error);
      return null;
    }),
  ]).then(([headAsset, eyesAsset, glassAsset, texture]) => {
    if (disposed || options.signal.aborted) {
      disposeObject(headAsset.scene);
      disposeObject(eyesAsset.scene);
      disposeObject(glassAsset.scene);
      texture?.dispose();
      return;
    }

    head = headAsset.scene;
    eyes = eyesAsset.scene;
    const glass = glassAsset.scene;
    fitModel(head, options.modelSize);
    head.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      disposeMaterials(object.material);
      object.castShadow = true;
      object.material = new THREE.MeshPhysicalMaterial({
        color: 0x444444,
        envMapIntensity: 0.8,
        map: texture,
        metalness: 0.9,
        roughness: 0.4,
      });
    });
    eyes.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      disposeMaterials(object.material);
      object.material = new THREE.MeshStandardMaterial({
        color: 0x88faff,
        emissive: 0x00eaff,
        emissiveIntensity: 1.1,
        metalness: 0.1,
        roughness: 0.1,
      });
    });
    glass.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      disposeMaterials(object.material);
      object.material = new THREE.MeshPhysicalMaterial({
        color: 0x99dfff,
        envMapIntensity: 0.35,
        ior: 1.35,
        roughness: 0.18,
        thickness: 0.22,
        transmission: 1,
        transparent: true,
      });
      object.renderOrder = 10;
    });
    eyes.position.z = 0.0009;
    head.add(eyes, glass);
    root.add(head);
    options.onReady();
  }).catch((error: unknown) => {
    console.warn("AI Assistant 3D model could not be loaded.", error);
    if (!disposed && !options.signal.aborted) options.onError();
  });

  const animate = () => {
    if (disposed || !visible || document.hidden) {
      animating = false;
      return;
    }
    animating = true;
    frame = window.requestAnimationFrame(animate);
    if (head && eyes && !reducedMotion.matches) {
      gaze.lerp(pointer, 0.08);
      gazeTarget.set(gaze.x * 0.35, gaze.y * 0.25);
      eyeTarget.lerp(gazeTarget, 0.15);
      const limitY = 0.65 * Math.sqrt(Math.max(0, 1 - eyeTarget.y * eyeTarget.y));
      const limitX = 0.45 * Math.sqrt(Math.max(0, 1 - eyeTarget.x * eyeTarget.x));
      eyes.rotation.y = THREE.MathUtils.clamp(eyeTarget.x, -limitY, limitY);
      eyes.rotation.x = THREE.MathUtils.clamp(-eyeTarget.y, -limitX, limitX);
      head.rotation.y += (gaze.x * 0.15 - head.rotation.y) * 0.03;
      head.rotation.x += (-gaze.y * 0.08 - head.rotation.x) * 0.03;
      elapsed += 0.04;
      eyes.rotation.x += Math.sin(elapsed * 2.4) * 0.001;
      eyes.rotation.y += Math.cos(elapsed * 1.7) * 0.001;
    }
    renderer.render(scene, camera);
  };
  const resume = () => {
    if (!animating && !disposed && visible && !document.hidden) animate();
  };
  const handleVisibilityChange = () => resume();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) resume();
  }, { threshold: 0.05 });
  visibilityObserver.observe(canvas);
  resume();

  return () => {
    disposed = true;
    window.cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", handlePointer);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    disposeObject(scene);
    scene.environment?.dispose();
    void environmentPromise;
    renderer.dispose();
  };
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    disposeMaterials(object.material);
  });
}

function disposeMaterials(material: THREE.Material | THREE.Material[]) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((entry) => {
    Object.values(entry).forEach((value) => {
      if (value instanceof THREE.Texture) value.dispose();
    });
    entry.dispose();
  });
}

function fitModel(model: THREE.Group, targetSize = 2.4) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = targetSize / (Math.max(size.x, size.y, size.z) || 1);
  model.scale.setScalar(scale);
  model.position.sub(center.multiplyScalar(scale));
}
