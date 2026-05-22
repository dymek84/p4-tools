import Phaser from 'phaser';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { FXManager } from '../FXManager';
import type { FXPass, FXUniformDefinition } from '../FXPass';

export class ThreePipeline implements FXPass {
    readonly name = 'Bloom';
    readonly kind = 'bloom';
    enabled = true;
    private readonly scene: Phaser.Scene;
    private manager: FXManager | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private threeScene: THREE.Scene | null = null;
    private camera: THREE.OrthographicCamera | null = null;
    private composer: EffectComposer | null = null;
    private renderTarget: THREE.WebGLRenderTarget | null = null;
    private mesh: THREE.Mesh | null = null;
    private readonly uniforms = {
        rotation: 0,
        bloomStrength: 1.2,
        bloomRadius: 0.4,
        bloomThreshold: 0.85,
        scale: 1,
        color: '#60a5fa'
    };

    constructor(scene: Phaser.Scene, name = 'Bloom') {
        this.scene = scene;
        this.name = name;
    }

    init(manager: FXManager) {
        this.manager = manager;

        if (this.renderer) {
            return this;
        }

        const renderer = this.scene.game.renderer;

        if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
            return this;
        }

        if (typeof WebGL2RenderingContext === 'undefined' || !(renderer.gl instanceof WebGL2RenderingContext)) {
            return this;
        }

        const width = renderer.width;
        const height = renderer.height;
        const canvas = renderer.canvas as HTMLCanvasElement;

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            context: renderer.gl,
            alpha: true,
            antialias: false,
            preserveDrawingBuffer: false
        });
        this.renderer.autoClear = false;
        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(1);

        this.threeScene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        this.camera.position.z = 1;

        this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
            depthBuffer: false,
            stencilBuffer: false
        });

        const geometry = new THREE.PlaneGeometry(1.5, 0.9);
        const material = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
        this.mesh = new THREE.Mesh(geometry, material);
        this.threeScene.add(this.mesh);

        const renderPass = new RenderPass(this.threeScene, this.camera);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            this.uniforms.bloomStrength,
            this.uniforms.bloomRadius,
            this.uniforms.bloomThreshold
        );
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);

        return this;
    }

    render(inputTexture: WebGLTexture) {
        void inputTexture;
        this.draw(this.manager?.scene.time.now ?? this.scene.time.now);
        return (this.getTexture() ?? inputTexture) as WebGLTexture;
    }

    update(time: number, delta: number) {
        void delta;
        this.draw(time);
    }

    getUniforms(): FXUniformDefinition[] {
        return [
            { name: 'rotation', type: 'float', min: -6.283, max: 6.283, step: 0.01, default: 0 },
            { name: 'scale', type: 'float', min: 0.25, max: 2, step: 0.01, default: 1 },
            { name: 'bloomStrength', type: 'float', min: 0, max: 4, step: 0.01, default: 1.2 },
            { name: 'bloomRadius', type: 'float', min: 0, max: 1, step: 0.01, default: 0.4 },
            { name: 'bloomThreshold', type: 'float', min: 0, max: 1, step: 0.01, default: 0.85 },
            { name: 'color', type: 'color', default: '#60a5fa' }
        ];
    }

    setUniform(name: string, value: any) {
        switch (name) {
            case 'rotation':
                this.uniforms.rotation = Number(value);
                break;
            case 'scale':
                this.uniforms.scale = Number(value);
                break;
            case 'bloomStrength':
                this.uniforms.bloomStrength = Number(value);
                if (this.composer) {
                    const pass = this.composer.passes[1] as UnrealBloomPass | undefined;
                    if (pass) {
                        pass.strength = this.uniforms.bloomStrength;
                    }
                }
                break;
            case 'bloomRadius':
                this.uniforms.bloomRadius = Number(value);
                if (this.composer) {
                    const pass = this.composer.passes[1] as UnrealBloomPass | undefined;
                    if (pass) {
                        pass.radius = this.uniforms.bloomRadius;
                    }
                }
                break;
            case 'bloomThreshold':
                this.uniforms.bloomThreshold = Number(value);
                if (this.composer) {
                    const pass = this.composer.passes[1] as UnrealBloomPass | undefined;
                    if (pass) {
                        pass.threshold = this.uniforms.bloomThreshold;
                    }
                }
                break;
            case 'color':
                this.uniforms.color = String(value);
                if (this.mesh) {
                    this.mesh.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.uniforms.color) });
                }
                break;
        }
    }

    private draw(time = this.scene.time.now) {
        if (!this.renderer || !this.threeScene || !this.camera || !this.renderTarget || !this.mesh || !this.composer) {
            return this;
        }

        const seconds = time * 0.001;
        this.mesh.rotation.z = this.uniforms.rotation + seconds * 0.5;
        this.mesh.scale.setScalar(this.uniforms.scale + Math.sin(seconds * 1.25) * 0.06);

        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.clear();
        this.renderer.render(this.threeScene, this.camera);
        this.renderer.setRenderTarget(null);
        this.composer.render();

        return this;
    }

    getTexture() {
        return this.renderTarget?.texture ?? null;
    }

    resize(width: number, height: number) {
        this.renderer?.setSize(width, height, false);
        this.renderTarget?.setSize(width, height);
        return this;
    }
}

export type ThreePass = FXPass & ThreePipeline;