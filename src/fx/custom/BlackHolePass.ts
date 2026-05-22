import Phaser from 'phaser';
import type { FXManager } from '../FXManager';
import type { FXPass, FXUniformDefinition } from '../FXPass';

export class BlackHolePass implements FXPass {
    readonly kind = 'blackhole';
    name: string;
    enabled = true;

    private readonly scene: Phaser.Scene;
    private initialized = false;
    private manager: FXManager | null = null;
    private core?: Phaser.GameObjects.Arc;
    private halo?: Phaser.GameObjects.Arc;
    private ringA?: Phaser.GameObjects.Arc;
    private ringB?: Phaser.GameObjects.Arc;

    private uniforms = {
        x: 640,
        y: 360,
        radius: 44,
        spin: 1,
        pulse: 0.2,
        color: '#60a5fa'
    };

    constructor(scene: Phaser.Scene, name = 'Black Hole') {
        this.scene = scene;
        this.name = name;

        const width = Number((scene.scale as any)?.width ?? 1280);
        const height = Number((scene.scale as any)?.height ?? 720);
        this.uniforms.x = width * 0.5;
        this.uniforms.y = height * 0.5;
    }

    init(manager: FXManager): void {
        this.manager = manager;

        if (this.initialized) {
            return;
        }

        const color = Phaser.Display.Color.HexStringToColor(this.uniforms.color).color;
        const r = this.uniforms.radius;

        this.halo = this.scene.add.circle(this.uniforms.x, this.uniforms.y, r * 2.2, 0x0f172a, 0.14);
        this.ringA = this.scene.add.arc(this.uniforms.x, this.uniforms.y, r * 1.75, 20, 330, false, color, 0.26);
        this.ringB = this.scene.add.arc(this.uniforms.x, this.uniforms.y, r * 2.05, 210, 155, false, 0xf8fafc, 0.18);
        this.core = this.scene.add.circle(this.uniforms.x, this.uniforms.y, r, 0x020617, 0.98);

        this.halo.setDepth(5000);
        this.ringA.setDepth(5001);
        this.ringB.setDepth(5002);
        this.core.setDepth(5003);

        this.initialized = true;
    }

    render(input: WebGLTexture): WebGLTexture {
        return input;
    }

    update(time: number): void {
        if (!this.initialized || !this.core || !this.halo || !this.ringA || !this.ringB) {
            return;
        }

        const visible = this.enabled;
        this.core.setVisible(visible);
        this.halo.setVisible(visible);
        this.ringA.setVisible(visible);
        this.ringB.setVisible(visible);

        if (!visible) {
            return;
        }

        const t = time * 0.001;
        const pulse = 1 + Math.sin(t * 2.1) * this.uniforms.pulse;
        const base = Math.max(10, this.uniforms.radius);

        this.core.setPosition(this.uniforms.x, this.uniforms.y);
        this.halo.setPosition(this.uniforms.x, this.uniforms.y);
        this.ringA.setPosition(this.uniforms.x, this.uniforms.y);
        this.ringB.setPosition(this.uniforms.x, this.uniforms.y);

        this.core.setRadius(base * pulse);
        this.halo.setRadius(base * 2.2 * pulse);
        this.ringA.setRadius(base * 1.75 * (1 + Math.sin(t * 1.4) * 0.03));
        this.ringB.setRadius(base * 2.05 * (1 + Math.cos(t * 1.1) * 0.04));
        this.ringA.rotation = t * this.uniforms.spin;
        this.ringB.rotation = -t * this.uniforms.spin * 1.35;
    }

    getUniforms(): FXUniformDefinition[] {
        return [
            { name: 'x', type: 'float', min: 0, max: 1600, step: 1, default: this.uniforms.x },
            { name: 'y', type: 'float', min: 0, max: 900, step: 1, default: this.uniforms.y },
            { name: 'radius', type: 'float', min: 10, max: 220, step: 1, default: 44 },
            { name: 'spin', type: 'float', min: 0, max: 8, step: 0.01, default: 1 },
            { name: 'pulse', type: 'float', min: 0, max: 0.5, step: 0.01, default: 0.2 },
            { name: 'color', type: 'color', default: '#60a5fa' }
        ];
    }

    setUniform(name: string, value: any): void {
        switch (name) {
            case 'x':
                this.uniforms.x = Number(value);
                break;
            case 'y':
                this.uniforms.y = Number(value);
                break;
            case 'radius':
                this.uniforms.radius = Number(value);
                break;
            case 'spin':
                this.uniforms.spin = Number(value);
                break;
            case 'pulse':
                this.uniforms.pulse = Number(value);
                break;
            case 'color': {
                this.uniforms.color = String(value);
                const color = Phaser.Display.Color.HexStringToColor(this.uniforms.color).color;
                this.ringA?.setFillStyle(color, 0.26);
                break;
            }
        }
    }

    destroy(): void {
        this.core?.destroy();
        this.halo?.destroy();
        this.ringA?.destroy();
        this.ringB?.destroy();
        this.core = undefined;
        this.halo = undefined;
        this.ringA = undefined;
        this.ringB = undefined;
        this.initialized = false;
    }
}
