"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type HeroSlide = {
  src: string;
  alt: string;
};

type Slot = {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  opacity: number;
};

type HeroCanvasProps = {
  slides: readonly HeroSlide[];
  activeIndex: number;
  onReady: () => void;
  onFail: () => void;
};

function slotFor(delta: number, compact: boolean): Slot {
  if (compact) {
    if (delta === 0) return { x: 0.1, y: 0.02, z: 1.2, rotY: -0.03, scale: 1.62, opacity: 1 };
    if (delta === 1) return { x: 1.35, y: 0.62, z: -0.1, rotY: -0.26, scale: 0.4, opacity: 0.88 };
    if (delta === -1) return { x: -1.2, y: -0.42, z: -0.15, rotY: 0.2, scale: 0.44, opacity: 0.88 };
    return { x: 0.55, y: 0.9, z: -1.05, rotY: 0.04, scale: 0.28, opacity: 0.72 };
  }
  if (delta === 0) return { x: 0.15, y: 0, z: 0.7, rotY: -0.06, scale: 1, opacity: 1 };
  if (delta === 1) return { x: 1.65, y: 0.18, z: -0.65, rotY: -0.34, scale: 0.58, opacity: 0.9 };
  if (delta === -1) return { x: -1.15, y: -0.08, z: -0.28, rotY: 0.24, scale: 0.64, opacity: 0.92 };
  return { x: 0.4, y: 0.42, z: -1.45, rotY: 0.06, scale: 0.44, opacity: 0.78 };
}

function ringDelta(index: number, active: number, count: number) {
  let delta = index - active;
  if (delta > count / 2) delta -= count;
  if (delta < -count / 2) delta += count;
  return delta;
}

export function HeroCanvas({ slides, activeIndex, onReady, onFail }: HeroCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeIndex);
  const onReadyRef = useRef(onReady);
  const onFailRef = useRef(onFail);

  activeRef.current = activeIndex;
  onReadyRef.current = onReady;
  onFailRef.current = onFail;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      if (!renderer.getContext()) {
        renderer.dispose();
        onFailRef.current();
        return;
      }
    } catch {
      onFailRef.current();
      return;
    }

    const view = { compact: false };
    const pointer = { x: 0, y: 0 };
    const pointerTarget = { x: 0, y: 0 };
    let running = false;
    let disposed = false;
    let inView = true;
    let raf = 0;
    let readySent = false;
    let lastFrame = performance.now();
    let elapsed = 0;

    const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.pointerEvents = "none";
    canvas.setAttribute("aria-hidden", "true");
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    const group = new THREE.Group();
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(2.5, 4, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdbe4ff, 0.55);
    rim.position.set(-3, 1.5, 2);
    scene.add(rim);

    const planeGeo = new THREE.PlaneGeometry(1, 1);
    const loader = new THREE.TextureLoader();
    const textures: THREE.Texture[] = [];
    const materials: THREE.MeshStandardMaterial[] = [];

    const planes = slides.map((slide, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.88,
        metalness: 0.02,
        transparent: true,
        side: THREE.DoubleSide,
      });
      materials.push(material);
      const mesh = new THREE.Mesh(planeGeo, material);
      const slot = slotFor(ringDelta(index, 0, slides.length), false);
      mesh.position.set(slot.x, slot.y, slot.z);
      mesh.rotation.y = slot.rotY;
      mesh.userData.aspect = 0.72;
      const height = 3.25 * slot.scale;
      mesh.scale.set(height * 0.72, height, 1);
      group.add(mesh);

      loader.load(
        slide.src,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAniso;
          textures.push(texture);
          material.map = texture;
          material.needsUpdate = true;
          const image = texture.image as { width?: number; height?: number };
          const width = image.width ?? 3;
          const heightPx = image.height ?? 4;
          mesh.userData.aspect = width / Math.max(heightPx, 1);
          if (!readySent) {
            readySent = true;
            onReadyRef.current();
          }
        },
        undefined,
        () => {
          if (!readySent) {
            readySent = true;
            onReadyRef.current();
          }
        }
      );

      return mesh;
    });

    const icoMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.62,
      roughness: 0.2,
      flatShading: true,
      emissive: 0x1e293b,
      emissiveIntensity: 0.35,
    });
    const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), icoMaterial);
    group.add(ico);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      view.compact = width < 768;
      const ratio = Math.min(window.devicePixelRatio || 1, view.compact ? 1 : 1.5);
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(0, 0.08, view.compact ? 7.2 : 7.9);
      camera.lookAt(view.compact ? 0.05 : 1.15, 0, 0);
      camera.updateProjectionMatrix();
      group.position.x = view.compact ? 0.08 : 1.7;
      ico.scale.setScalar(view.compact ? 0.72 : 1);
    };

    const onPointer = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside) {
        pointerTarget.x = 0;
        pointerTarget.y = 0;
        return;
      }
      pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerTarget.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      elapsed += dt;
      const blend = 1 - Math.exp(-7 * dt);
      const time = elapsed;

      pointer.x += (pointerTarget.x - pointer.x) * blend;
      pointer.y += (pointerTarget.y - pointer.y) * blend;
      group.rotation.y += (pointer.x * 0.16 - group.rotation.y) * blend;
      group.rotation.x += (-pointer.y * 0.07 - group.rotation.x) * blend;

      const count = planes.length;
      const active = activeRef.current;
      for (let index = 0; index < count; index += 1) {
        const mesh = planes[index];
        const slot = slotFor(ringDelta(index, active, count), view.compact);
        const float = Math.sin(time * 0.75 + index * 0.8) * 0.055;
        mesh.position.x += (slot.x - mesh.position.x) * blend;
        mesh.position.y += (slot.y + float - mesh.position.y) * blend;
        mesh.position.z += (slot.z - mesh.position.z) * blend;
        mesh.rotation.y += (slot.rotY - mesh.rotation.y) * blend;
        const aspect = (mesh.userData.aspect as number) || 0.72;
        const height = 3.25 * slot.scale;
        mesh.scale.x += (height * aspect - mesh.scale.x) * blend;
        mesh.scale.y += (height - mesh.scale.y) * blend;
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.opacity += (slot.opacity - material.opacity) * blend;
      }

      ico.position.x = (view.compact ? 1.45 : 1.85) + Math.sin(time * 0.45) * 0.08;
      ico.position.y = (view.compact ? 1.25 : 1.55) + Math.cos(time * 0.6) * 0.14;
      ico.position.z = 1.2;
      ico.rotation.x = time * 0.22;
      ico.rotation.y = time * 0.38;

      renderer.render(scene, camera);
    };

    const start = () => {
      if (running || disposed || !inView || document.hidden) return;
      running = true;
      lastFrame = performance.now();
      loop();
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const onContextLost = (event: Event) => {
      if (disposed) return;
      event.preventDefault();
      stop();
      onFailRef.current();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      },
      { threshold: 0.05 }
    );

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(mount);
    observer.observe(mount);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);
    resize();
    start();

    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      planeGeo.dispose();
      ico.geometry.dispose();
      icoMaterial.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [slides]);

  return <div ref={mountRef} className="absolute inset-0 z-[1]" />;
}
