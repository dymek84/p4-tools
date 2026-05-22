import Phaser from 'phaser';
import type { FXManager } from '../FXManager';
import type { FXPass, FXUniformDefinition } from '../FXPass';

export class ShockwavePass implements FXPass {
    name = 'Shockwave Click';
    kind = 'shockwave';
    enabled = true;

    private readonly scene: Phaser.Scene;
    private ring?: Phaser.GameObjects.Arc;
    private initialized = false;
    private active = false;
    private startTime = 0;
    private durationMs = 550;
    private center = { x: 640, y: 360 };

    private uniforms = {
        maxRadius: 300,
        thickness: 12,
        strength: 1,
        color: '#7dd3fc'
    };

    constructor(scene: Phaser.Scene, name = 'Shockwave Click') {
        this.scene = scene;
        this.name = name;
        this.center = {
            x: Number((scene.scale as any)?.width ?? 1280) * 0.5,
            y: Number((scene.scale as any)?.height ?? 720) * 0.5
        };
    }

    init(_manager: FXManager): void {
        if (this.initialized) {
            return;
        }

        const color = Phaser.Display.Color.HexStringToColor(this.uniforms.color).color;
        this.ring = this.scene.add.arc(this.center.x, this.center.y, 1, 0, 360, false, color, 0);
        this.ring.setStrokeStyle(this.uniforms.thickness, color, 1);
        this.ring.setDepth(4999);
        this.ring.setVisible(false);
        this.initialized = true;
    }

    trigger(x: number, y: number): void {
        this.center.x = x;
        this.center.y = y;
        this.startTime = performance.now();
        this.active = true;
        this.ring?.setVisible(this.enabled);
    }

    update(_time: number): void {
        if (!this.initialized || !this.ring) {
            return;
        }

        this.ring.setVisible(this.enabled && this.active);

        if (!this.enabled || !this.active) {
            return;
        }

        const elapsed = performance.now() - this.startTime;
        const t = Phaser.Math.Clamp(elapsed / this.durationMs, 0, 1);
        const ease = Phaser.Math.Easing.Cubic.Out(t);
        const radius = Math.max(1, this.uniforms.maxRadius * ease);
        const alpha = (1 - t) * Phaser.Math.Clamp(this.uniforms.strength, 0, 2);

        const color = Phaser.Display.Color.HexStringToColor(this.uniforms.color).color;
        this.ring.setPosition(this.center.x, this.center.y);
        this.ring.setRadius(radius);
        this.ring.setStrokeStyle(this.uniforms.thickness, color, alpha);

        if (t >= 1) {
            this.active = false;
            this.ring.setVisible(false);
        }
    }

    render(input: WebGLTexture): WebGLTexture {
        return input;
    }

    getUniforms(): FXUniformDefinition[] {
        return [
            { name: 'maxRadius', type: 'float', min: 40, max: 900, step: 1, default: 300 },
            { name: 'thickness', type: 'float', min: 1, max: 60, step: 1, default: 12 },
            { name: 'strength', type: 'float', min: 0, max: 2, step: 0.01, default: 1 },
            { name: 'color', type: 'color', default: '#7dd3fc' }
        ];
    }

    setUniform(name: string, value: any): void {
        switch (name) {
            case 'maxRadius':
                this.uniforms.maxRadius = Number(value);
                break;
            case 'thickness':
                this.uniforms.thickness = Number(value);
                break;
            case 'strength':
                this.uniforms.strength = Number(value);
                break;
            case 'color':
                this.uniforms.color = String(value);
                break;
        }
    }

    destroy(): void {
        this.ring?.destroy();
        this.ring = undefined;
        this.initialized = false;
        this.active = false;
    }
}
