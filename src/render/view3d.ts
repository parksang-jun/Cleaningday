// 3D 보기 — 같은 게임(같은 엔진·같은 2D 오염 그림)을 3D 공간에 띄운다.
//  · 2D 렌더러가 그린 캔버스를 청소 대상 면의 텍스처로 쓴다 → 오염·거품·반짝임이 그대로 3D 면 위에 보인다.
//  · 장면은 표면 방향(바닥형/벽형/기울어진 유리)과 장소(실내·욕실·주방·정원·자동차)에 맞춰 방·하늘·차체를 둘러 세운다.
//  · 포인터는 광선 투사로 면의 UV → 격자 좌표. 3D 도구 모형이 손끝을 따라다니고, 문지르면 살짝 눌리고 흔들린다.
//  · 카메라는 포인터 쪽으로 살짝 기울어 입체감을 준다(시차). three.js 는 3D 모드를 켤 때만 불러온다(지연 로드).
import * as THREE from 'three';
import type { ToolFamily } from '../game/catalog';
import type { AreaId, SceneId } from '../game/levels';

type Orientation = 'floor' | 'wall' | 'tilted';
type Place = 'room' | 'kitchen' | 'bath' | 'garden' | 'carOut' | 'carIn';

const FLOORISH: SceneId[] = ['floor', 'rug', 'livingMix', 'roomMix', 'kitchenTile', 'kitchenMix', 'floorMat', 'trunk', 'entrance', 'bigClean', 'bed', 'table', 'stove', 'sink', 'grill', 'patio', 'deck', 'gardenMix', 'deckMix', 'yardMix', 'basin', 'bathtub', 'tub', 'toilet', 'desk', 'shelf', 'sofa', 'seat'];
const TILTED: SceneId[] = ['windshield', 'dashboard'];

function orientationOf(scene: SceneId): Orientation {
  if (TILTED.includes(scene)) return 'tilted';
  return FLOORISH.includes(scene) ? 'floor' : 'wall';
}
function placeOf(area: AreaId): Place {
  switch (area) {
    case 'kitchen':
      return 'kitchen';
    case 'bathroom':
      return 'bath';
    case 'garden':
      return 'garden';
    case 'exterior':
      return 'carOut';
    case 'interior':
      return 'carIn';
    default:
      return 'room';
  }
}

const PLACE_LOOK: Record<Place, { floor: number; wall: number; sky?: number; fog: number }> = {
  room: { floor: 0xc9a77c, wall: 0xf3ede4, fog: 0xf3ede4 },
  kitchen: { floor: 0xd9d4cc, wall: 0xf6f1e8, fog: 0xf6f1e8 },
  bath: { floor: 0xdde8ec, wall: 0xeef5f7, fog: 0xeef5f7 },
  garden: { floor: 0x7fb069, wall: 0xb9925f, sky: 0xbfe3f7, fog: 0xd8eefa },
  carOut: { floor: 0x9aa3a8, wall: 0x2f6fb5, sky: 0xc5e4f6, fog: 0xdcecf5 },
  carIn: { floor: 0x3b3f45, wall: 0x50565e, fog: 0x8a9096 },
};

export interface View3DInit {
  /** 2D 렌더러의 캔버스 (텍스처 원본) */
  source: HTMLCanvasElement;
  /** 3D 를 그릴 캔버스 (입력도 여기서 받는다) */
  target: HTMLCanvasElement;
  scene: SceneId;
  area: AreaId;
  /** 격자 크기 */
  gridW: number;
  gridH: number;
}

export class View3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private surface: THREE.Mesh;
  private tex: THREE.CanvasTexture;
  private tool = new THREE.Group();
  private toolFamily: ToolFamily | 'spray' | null = null;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private camBase = new THREE.Vector3();
  private camDir = new THREE.Vector3(0, 0, 1);
  private lookAt = new THREE.Vector3();
  private tilt = new THREE.Vector2();
  private orient: Orientation;
  private planeW: number;
  private planeH: number;
  private t = 0;
  private hit: THREE.Vector3 | null = null;
  private pressing = false;
  private disposed = false;

  constructor(private init: View3DInit) {
    this.renderer = new THREE.WebGLRenderer({ canvas: init.target, antialias: true, alpha: false, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.orient = orientationOf(init.scene);
    const place = placeOf(init.area);
    const look = PLACE_LOOK[place];
    this.scene.background = new THREE.Color(look.sky ?? look.fog);
    this.scene.fog = new THREE.Fog(look.fog, 9, 22);

    // 청소 대상 면: 격자 비율의 판. 2D 캔버스가 그대로 텍스처
    const ratio = init.gridW / init.gridH;
    this.planeH = 3;
    this.planeW = this.planeH * ratio;
    this.tex = new THREE.CanvasTexture(init.source);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: place === 'carOut' || init.scene === 'window' || init.scene === 'mirror' ? 0.25 : 0.6, metalness: place === 'carOut' ? 0.15 : 0 });
    this.surface = new THREE.Mesh(new THREE.PlaneGeometry(this.planeW, this.planeH), mat);
    this.surface.receiveShadow = true;

    // 테두리(두께) — 판이 공중에 뜬 그림이 아니라 물건처럼 보이게
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(this.planeW + 0.16, this.planeH + 0.16, 0.12),
      new THREE.MeshStandardMaterial({ color: place === 'carOut' ? 0x2a5f9e : place === 'carIn' ? 0x2b2f34 : 0xe9e2d6, roughness: 0.7 }),
    );
    frame.position.z = -0.065;
    frame.castShadow = true;
    frame.receiveShadow = true;
    const holder = new THREE.Group();
    holder.add(frame, this.surface);
    this.surface.position.z = 0.001;

    // 방향: 바닥형은 눕히고, 벽형은 세우고, 앞유리·대시보드는 기울인다
    if (this.orient === 'floor') {
      holder.rotation.x = -Math.PI / 2;
      holder.position.set(0, 0.07, 0);
      this.camDir.set(0, 4.6, 2.6);
      this.lookAt.set(0, 0, 0.1);
    } else if (this.orient === 'tilted') {
      holder.rotation.x = -Math.PI / 3.2;
      holder.position.set(0, 1.25, 0);
      this.camDir.set(0, 2.2, 3.6);
      this.lookAt.set(0, 1.25, 0);
    } else {
      holder.position.set(0, 1.75, -0.6);
      this.camDir.set(0, 0.35, 4.6);
      this.lookAt.set(0, 1.75, -0.6);
    }
    this.scene.add(holder);
    this.buildSurroundings(place, look);

    // 빛: 부드러운 하늘빛 + 그림자 지는 주광 + 따뜻한 보조광
    this.scene.add(new THREE.HemisphereLight(0xffffff, place === 'garden' ? 0x6e8f4f : 0xb8a58c, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3.5, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
    const fill = new THREE.PointLight(0xffe2b8, 0.6, 12);
    fill.position.set(-3, 3, 3);
    this.scene.add(fill);

    this.tool.visible = false;
    this.scene.add(this.tool);
    this.resize();
  }

  private buildSurroundings(place: Place, look: (typeof PLACE_LOOK)[Place]) {
    const std = (color: number, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(look.floor));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    if (place === 'garden' || place === 'carOut') {
      // 바깥: 멀리 나무·울타리, 자동차면 차체 덩어리
      for (let i = 0; i < 9; i++) {
        const x = -9 + i * 2.3 + (i % 2) * 0.6;
        const z = -7 - (i % 3);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), std(0x7a5a3a));
        trunk.position.set(x, 0.7, z);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), std(i % 2 ? 0x5f9e4d : 0x4f8a42, 0.9));
        crown.position.set(x, 1.9, z);
        crown.castShadow = true;
        this.scene.add(trunk, crown);
      }
      if (place === 'carOut') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(this.planeW + 2.4, 1.1, 2.2), new THREE.MeshStandardMaterial({ color: look.wall, roughness: 0.35, metalness: 0.3 }));
        body.position.set(0, this.orient === 'floor' ? -0.5 : 0.75, -1.9);
        body.castShadow = true;
        this.scene.add(body);
        for (const sx of [-1, 1]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 20), std(0x222222, 0.6));
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(sx * (this.planeW / 2 + 0.6), 0.42, -0.85);
          wheel.castShadow = true;
          this.scene.add(wheel);
        }
      }
      return;
    }
    // 실내: 뒷벽·옆벽, 걸레받이, 장소별 소품(주방 상판·욕실 타일 띠·차 안 대시)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), std(look.wall, 0.95));
    back.position.set(0, 5, -2.2);
    back.receiveShadow = true;
    this.scene.add(back);
    const skirting = new THREE.Mesh(new THREE.BoxGeometry(40, 0.18, 0.05), std(0xffffff, 0.6));
    skirting.position.set(0, 0.09, -2.17);
    this.scene.add(skirting);
    if (place === 'kitchen') {
      const counter = new THREE.Mesh(new THREE.BoxGeometry(12, 0.9, 0.7), std(0xe7e2da, 0.5));
      counter.position.set(0, 0.45, -1.85);
      counter.castShadow = true;
      this.scene.add(counter);
    }
    if (place === 'bath') {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.2), std(0xcfe0e6, 0.4));
      band.position.set(0, 0.6, -2.19);
      this.scene.add(band);
    }
    if (place === 'room') {
      const plant = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 14), std(0xd28b5a, 0.7));
      pot.position.y = 0.2;
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), std(0x5f9e4d, 0.9));
      leaves.position.y = 0.75;
      leaves.castShadow = true;
      plant.add(pot, leaves);
      plant.position.set(this.planeW / 2 + 1.1, 0, -1.6);
      this.scene.add(plant);
    }
  }

  /** 도구 모형 — 계열마다 간단한 저폴리 형태 */
  setTool(family: ToolFamily | 'spray') {
    if (family === this.toolFamily) return;
    this.toolFamily = family;
    this.tool.clear();
    const m = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      this.tool.add(mesh);
      return mesh;
    };
    switch (family) {
      case 'sponge':
      case 'scrubpad':
      case 'eraser':
        add(new THREE.BoxGeometry(0.42, 0.14, 0.28), m(family === 'eraser' ? 0xf5f5f0 : 0xf7d046, 0.95), 0, 0.07, 0);
        if (family !== 'eraser') add(new THREE.BoxGeometry(0.42, 0.05, 0.28), m(0x2e8b57, 1), 0, 0.165, 0);
        break;
      case 'cloth':
      case 'mitt':
      case 'claybar':
        add(new THREE.BoxGeometry(0.46, 0.06, 0.36), m(family === 'mitt' ? 0x8fc9ff : 0x6fc3b2, 1), 0, 0.03, 0);
        add(new THREE.SphereGeometry(0.12, 12, 8), m(family === 'mitt' ? 0x8fc9ff : 0x6fc3b2, 1), 0.05, 0.1, 0);
        break;
      case 'tilebrush':
      case 'deckbrush':
      case 'wheelbrush': {
        const long = family === 'deckbrush';
        add(new THREE.BoxGeometry(0.5, 0.08, 0.2), m(0x3a7bd5, 0.5), 0, 0.12, 0);
        add(new THREE.BoxGeometry(0.46, 0.08, 0.17), m(0xf2f2f2, 1), 0, 0.04, 0);
        const handle = add(new THREE.CylinderGeometry(0.03, 0.03, long ? 1.6 : 0.5, 8), m(0x8b5a2b, 0.7), 0, long ? 0.85 : 0.35, long ? 0.4 : 0.1);
        handle.rotation.x = long ? -0.5 : -0.6;
        break;
      }
      case 'vacuum':
      case 'lintroller': {
        add(new THREE.BoxGeometry(0.55, 0.1, 0.22), m(0x444a52, 0.4, 0.3), 0, 0.05, 0);
        const stick = add(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 10), m(0xb0b8c0, 0.3, 0.7), 0, 0.8, 0.35);
        stick.rotation.x = -0.45;
        add(new THREE.CylinderGeometry(0.11, 0.11, 0.35, 14), m(0x7b4fd6, 0.4), 0, 1.45, 0.68);
        break;
      }
      case 'squeegee': {
        add(new THREE.BoxGeometry(0.6, 0.05, 0.05), m(0x222222, 0.6), 0, 0.03, 0);
        add(new THREE.BoxGeometry(0.62, 0.06, 0.08), m(0xc0c6cc, 0.3, 0.6), 0, 0.08, 0);
        const h = add(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), m(0x2e86de, 0.5), 0, 0.3, 0.05);
        h.rotation.x = -0.4;
        break;
      }
      case 'hose':
      case 'washer':
      case 'steam':
      case 'rinse': {
        const gun = add(new THREE.BoxGeometry(0.14, 0.14, 0.42), m(family === 'washer' ? 0xffcc00 : family === 'steam' ? 0xffffff : 0x2ecc71, 0.5), 0, 0.5, 0.25);
        gun.rotation.x = -0.6;
        const nozzle = add(new THREE.CylinderGeometry(0.025, 0.04, 0.5, 10), m(0x333333, 0.4, 0.5), 0, 0.28, 0.05);
        nozzle.rotation.x = -0.6;
        break;
      }
      case 'spray':
      default: {
        add(new THREE.CylinderGeometry(0.12, 0.13, 0.45, 16), m(0x48c6ef, 0.3), 0, 0.5, 0.2);
        add(new THREE.BoxGeometry(0.1, 0.12, 0.2), m(0xffffff, 0.5), 0, 0.8, 0.24);
        break;
      }
    }
  }

  /** 포인터 → 격자 좌표 (면 밖이면 null) */
  toGrid(clientX: number, clientY: number): { x: number; y: number } | null {
    const r = this.init.target.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.tilt.set(this.ndc.x, this.ndc.y);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObject(this.surface);
    if (!hits.length || !hits[0].uv) {
      this.hit = null;
      return null;
    }
    this.hit = hits[0].point.clone();
    const uv = hits[0].uv;
    return { x: uv.x * this.init.gridW, y: (1 - uv.y) * this.init.gridH };
  }

  setPressing(on: boolean) {
    this.pressing = on;
  }
  hideTool() {
    this.hit = null;
  }

  resize() {
    const c = this.init.target;
    const parent = c.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h, false);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.fov = 40;
    this.camera.updateProjectionMatrix();
    // 면이 화면을 거의 채우도록 카메라 거리를 맞춘다 (가로·세로 중 빡빡한 쪽 기준, 기울기만큼 여유)
    const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const slant = this.orient === 'floor' ? 1.25 : this.orient === 'tilted' ? 1.15 : 1;
    const dW = (this.planeW / 2) * 1.06 / (half * this.camera.aspect);
    const dH = (this.planeH / 2) * 1.06 * slant / half;
    const dist = Math.max(dW, dH);
    const dir = this.camDir.clone().normalize();
    this.camBase.copy(this.lookAt).addScaledVector(dir, dist);
  }

  /** 매 프레임: 텍스처 갱신 + 카메라 시차 + 도구 따라가기 */
  draw(dt: number) {
    if (this.disposed) return;
    this.t += dt;
    this.tex.needsUpdate = true;
    const cam = this.camera;
    const sway = 0.25;
    cam.position.set(this.camBase.x + this.tilt.x * sway, this.camBase.y + this.tilt.y * sway * 0.5 + Math.sin(this.t * 0.6) * 0.02, this.camBase.z);
    cam.lookAt(this.lookAt);
    if (this.hit) {
      this.tool.visible = true;
      // 면의 법선 방향으로 띄우고, 문지르면 눌리면서 살짝 흔들린다
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(this.surface.getWorldQuaternion(new THREE.Quaternion()));
      const lift = this.pressing ? 0.01 + Math.sin(this.t * 38) * 0.008 : 0.12 + Math.sin(this.t * 3) * 0.015;
      const target = this.hit.clone().addScaledVector(n, lift);
      this.tool.position.lerp(target, 0.45);
      this.tool.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      if (this.pressing) this.tool.rotateY(Math.sin(this.t * 19) * 0.12);
    } else this.tool.visible = false;
    this.renderer.render(this.scene, cam);
  }

  dispose() {
    this.disposed = true;
    this.tex.dispose();
    this.renderer.dispose();
  }
}
