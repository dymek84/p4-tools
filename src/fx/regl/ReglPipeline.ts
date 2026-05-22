import Phaser from 'phaser';
import createREGL, { type REGL } from 'regl';
import fragmentShader from '../../shaders/basic/passthrough.frag?raw';
import vertexShader from '../../shaders/basic/passthrough.vert?raw';
import type { FXManager } from '../FXManager';
import type { FXPass, FXUniformDefinition } from '../FXPass';

type TextureLike = REGL.Texture2D | WebGLTexture | null;

type PassProps = {
    time: number;
    resolution: [number, number];
    texture: TextureLike;
    strength: number;
    tint: [number, number, number];
    framebuffer?: REGL.Framebuffer2D | null;
};

export class ReglPipeline implements FXPass {
    readonly name = 'Noise';
    readonly kind = 'noise';
    enabled = true;
    private readonly scene: Phaser.Scene;
    private manager: FXManager | null = null;
    private regl: REGL.Regl | null = null;
    private drawPass: REGL.DrawCommand | null = null;
    private outputTexture: REGL.Texture2D | null = null;
    private outputFramebuffer: REGL.Framebuffer2D | null = null;
    private sourceTexture: REGL.Texture2D | null = null;
    private width = 1;
    private height = 1;
    private readonly uniforms = {
        time: 0,
        strength: 1,
        tint: [1, 1, 1] as [number, number, number]
    };

    constructor(scene: Phaser.Scene, name = 'Noise') {
        this.scene = scene;
        this.name = name;
    }

    init(manager: FXManager) {
        this.manager = manager;
        if (this.regl) {
            return this;
        }

        const renderer = this.scene.game.renderer;

        if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
            return this;
        }

        this.width = renderer.width;
        this.height = renderer.height;

        this.regl = createREGL({
            gl: renderer.gl,
            extensions: []
        });

        this.outputTexture = this.regl.texture({
            width: this.width,
            height: this.height,
            wrap: 'clamp',
            min: 'linear',
            mag: 'linear'
        });

        this.sourceTexture = this.regl.texture({
            data: new Uint8Array([255, 255, 255, 255]),
            width: 1,
            height: 1,
            wrap: 'clamp',
            min: 'linear',
            mag: 'linear'
        });

        this.outputFramebuffer = this.regl.framebuffer({
            color: this.outputTexture
        });

        const positions = [-1, -1, 3, -1, -1, 3];
        const uvs = [0, 0, 2, 0, 0, 2];

        this.drawPass = this.regl({
            vert: vertexShader,
            frag: fragmentShader,
            attributes: {
                position: positions,
                uv: uvs
            },
            count: 3,
            uniforms: {
                time: (_context, props: PassProps) => props.time,
                resolution: (_context, props: PassProps) => props.resolution,
                texture: (_context, props: PassProps) => props.texture,
                strength: (_context, props: PassProps) => props.strength,
                tint: (_context, props: PassProps) => props.tint
            },
            framebuffer: (_context, props: PassProps) => props.framebuffer ?? this.outputFramebuffer,
            depth: { enable: false },
            blend: { enable: false }
        });

        return this;
    }

    render(inputTexture: WebGLTexture) {
        void inputTexture;
        return inputTexture;
    }

    renderToTexture(texture?: TextureLike, time = this.scene.time.now) {
        void texture;
        void time;
        return null;
    }

    applyPass(texture?: TextureLike, time = this.scene.time.now) {
        return this.renderToTexture(texture, time);
    }

    resize(width: number, height: number) {
        this.width = width;
        this.height = height;

        if (this.outputTexture) {
            this.outputTexture.resize(width, height);
        }

        return this;
    }

    dispose() {
        this.drawPass = null;

        if (this.outputFramebuffer) {
            this.outputFramebuffer.destroy();
            this.outputFramebuffer = null;
        }

        if (this.outputTexture) {
            this.outputTexture.destroy();
            this.outputTexture = null;
        }

        if (this.sourceTexture) {
            this.sourceTexture.destroy();
            this.sourceTexture = null;
        }

        if (this.regl) {
            this.regl.destroy();
            this.regl = null;
        }

        return this;
    }

    getUniforms(): FXUniformDefinition[] {
        return [
            { name: 'strength', type: 'float', min: 0, max: 4, step: 0.01, default: 1 },
            { name: 'tint', type: 'color', default: '#ffffff' }
        ];
    }

    setUniform(name: string, value: any) {
        switch (name) {
            case 'strength':
                this.uniforms.strength = Number(value);
                break;
            case 'tint':
                this.uniforms.tint = Array.isArray(value) ? [Number(value[0]), Number(value[1]), Number(value[2])] : this.uniforms.tint;
                break;
        }
    }
}

export type ReglPass = FXPass & ReglPipeline;