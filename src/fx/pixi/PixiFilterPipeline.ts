import Phaser from 'phaser';
import { ShockwaveFilter } from '@pixi/filter-shockwave';
import type { FXManager } from '../FXManager';
import type { FXPass, FXUniformDefinition } from '../FXPass';

type ShockwaveUniforms = {
    center: [number, number];
    amplitude: number;
    wavelength: number;
    brightness: number;
    speed: number;
    radius: number;
    time: number;
};

export class PixiFilterPipeline implements FXPass {
    readonly name = 'Shockwave';
    readonly kind = 'shockwave';
    enabled = true;
    private readonly scene: Phaser.Scene;
    private manager: FXManager | null = null;
    private readonly filter = new ShockwaveFilter([0.5, 0.5], undefined, 0);
    private readonly uniforms: ShockwaveUniforms = {
        center: [0.5, 0.5],
        amplitude: 30,
        wavelength: 160,
        brightness: 1,
        speed: 500,
        radius: -1,
        time: 0
    };

    constructor(scene: Phaser.Scene, name = 'Shockwave') {
        this.scene = scene;
        this.name = name;
    }

    init(manager: FXManager) {
        this.manager = manager;
        return this;
    }

    render(input: WebGLTexture) {
        void input;
        return input;
    }

    update(time: number, delta: number) {
        void delta;
        const seconds = time * 0.001;
        this.uniforms.time = seconds;
        this.filter.time = seconds;
    }

    getUniforms(): FXUniformDefinition[] {
        return [
            { name: 'center', type: 'vec2', min: 0, max: 1, step: 0.001, default: [0.5, 0.5] },
            { name: 'amplitude', type: 'float', min: 0, max: 100, step: 0.1, default: 30 },
            { name: 'wavelength', type: 'float', min: 1, max: 400, step: 1, default: 160 },
            { name: 'brightness', type: 'float', min: 0, max: 4, step: 0.01, default: 1 },
            { name: 'speed', type: 'float', min: 0, max: 1200, step: 1, default: 500 },
            { name: 'radius', type: 'float', min: -1, max: 1, step: 0.01, default: -1 }
        ];
    }

    setUniform(name: string, value: any) {
        switch (name) {
            case 'center':
                this.uniforms.center = [Number(value[0]), Number(value[1])];
                this.filter.center = this.uniforms.center;
                break;
            case 'amplitude':
                this.uniforms.amplitude = Number(value);
                this.filter.amplitude = this.uniforms.amplitude;
                break;
            case 'wavelength':
                this.uniforms.wavelength = Number(value);
                this.filter.wavelength = this.uniforms.wavelength;
                break;
            case 'brightness':
                this.uniforms.brightness = Number(value);
                this.filter.brightness = this.uniforms.brightness;
                break;
            case 'speed':
                this.uniforms.speed = Number(value);
                this.filter.speed = this.uniforms.speed;
                break;
            case 'radius':
                this.uniforms.radius = Number(value);
                this.filter.radius = this.uniforms.radius;
                break;
        }
    }
}