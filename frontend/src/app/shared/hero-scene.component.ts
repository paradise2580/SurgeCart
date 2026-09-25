import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  varying float vHeight;
  varying float vDepth;
  void main() {
    vec3 p = position;
    float wave = sin(p.x * 0.28 + uTime * 0.9) * 0.9
               + cos(p.y * 0.35 + uTime * 0.6) * 0.7
               + sin((p.x + p.y) * 0.12 + uTime * 0.4) * 1.1;
    float ripple = exp(-distance(p.xy, uMouse * vec2(18.0, 10.0)) * 0.18) * 1.6;
    p.z = wave + ripple;
    vHeight = p.z;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_PointSize = max(1.0, (1.5 + p.z * 0.45) * (24.0 / vDepth));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vHeight;
  varying float vDepth;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    vec3 pink = vec3(1.0, 0.24, 0.54);
    vec3 violet = vec3(0.61, 0.36, 1.0);
    vec3 gold = vec3(0.96, 0.76, 0.42);
    vec3 col = mix(violet, pink, smoothstep(-1.5, 1.5, vHeight));
    col = mix(col, gold, smoothstep(2.2, 3.4, vHeight));
    float fog = smoothstep(46.0, 12.0, vDepth);
    gl_FragColor = vec4(col, (1.0 - d * 2.0) * fog * 0.55);
  }
`;

/**
 * Animated particle-wave background for the hero. three.js is imported
 * dynamically so it ships in this route's lazy chunk, never the initial
 * bundle. The render loop runs outside Angular's zone, pauses when the hero
 * scrolls out of view or the tab is hidden, and renders a single still frame
 * for users who prefer reduced motion.
 */
@Component({
  selector: 'app-hero-scene',
  standalone: true,
  template: `<canvas #canvas class="absolute inset-0 h-full w-full" aria-hidden="true"></canvas>`,
  host: { class: 'absolute inset-0 block' },
})
export class HeroSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private cleanup: (() => void) | null = null;
  private destroyed = false;

  constructor(private zone: NgZone, private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.start());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cleanup?.();
  }

  private async start(): Promise<void> {
    const THREE = await import('three');
    if (this.destroyed) return;

    const canvas = this.canvasRef.nativeElement;
    let renderer: import('three').WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return; // No WebGL — the CSS gradient behind the canvas still carries the hero.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, -14, 9);
    camera.lookAt(0, 4, 0);

    const geometry = new THREE.PlaneGeometry(60, 34, 170, 96);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0, 0) } },
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const target = new THREE.Vector2(0, 0);
    const onPointer = (e: PointerEvent) => {
      target.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = this.host.nativeElement;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(this.host.nativeElement);
    resize();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    let visible = true;
    let frame = 0;

    const render = () => {
      const mouse = material.uniforms['uMouse'].value as import('three').Vector2;
      mouse.lerp(target, 0.05);
      material.uniforms['uTime'].value = clock.getElapsedTime();
      camera.position.x = mouse.x * 1.4;
      camera.lookAt(0, 4, 0);
      renderer.render(scene, camera);
    };
    const loop = () => {
      frame = 0;
      if (!visible || document.hidden) return;
      render();
      frame = requestAnimationFrame(loop);
    };
    const resume = () => { if (!frame && !reduceMotion) frame = requestAnimationFrame(loop); };

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); });
    io.observe(this.host.nativeElement);
    document.addEventListener('visibilitychange', resume);

    if (reduceMotion) render(); else resume();

    this.cleanup = () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pointermove', onPointer);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }
}
