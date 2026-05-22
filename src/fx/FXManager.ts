import Phaser from 'phaser';
import type { FXPass } from './FXPass';

export class FXManager {
    readonly scene: Phaser.Scene;
    private readonly passes: FXPass[] = [];
    private inputTexture: WebGLTexture | null = null;
    private outputTexture: WebGLTexture | null = null;
    private initialized = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    init(): void {
        if (this.initialized) {
            return;
        }

        this.inputTexture = this.createFallbackTexture();
        this.outputTexture = this.inputTexture;
        this.initialized = true;

        for (const pass of this.passes) {
            pass.init(this);
        }
    }

    addPass(pass: FXPass): void {
        if (!this.passes.includes(pass)) {
            this.passes.push(pass);
        }

        if (this.initialized) {
            pass.init(this);
        }
    }

    getPasses(): readonly FXPass[] {
        return this.passes;
    }

    getPassByName(name: string): FXPass | undefined {
        return this.passes.find((pass) => pass.name === name);
    }

    setPassEnabled(pass: FXPass, enabled: boolean): void {
        pass.enabled = enabled;
    }

    movePass(pass: FXPass, nextIndex: number): void {
        const currentIndex = this.passes.indexOf(pass);

        if (currentIndex === -1 || nextIndex < 0 || nextIndex >= this.passes.length || currentIndex === nextIndex) {
            return;
        }

        this.passes.splice(currentIndex, 1);
        this.passes.splice(nextIndex, 0, pass);
    }

    movePassUp(pass: FXPass): void {
        const currentIndex = this.passes.indexOf(pass);

        if (currentIndex > 0) {
            this.movePass(pass, currentIndex - 1);
        }
    }

    movePassDown(pass: FXPass): void {
        const currentIndex = this.passes.indexOf(pass);

        if (currentIndex !== -1 && currentIndex < this.passes.length - 1) {
            this.movePass(pass, currentIndex + 1);
        }
    }

    setPassOrder(passNames: string[]): void {
        const byName = new Map(this.passes.map((pass) => [pass.name, pass] as const));
        const ordered: FXPass[] = [];

        for (const name of passNames) {
            const pass = byName.get(name);

            if (pass && !ordered.includes(pass)) {
                ordered.push(pass);
            }
        }

        for (const pass of this.passes) {
            if (!ordered.includes(pass)) {
                ordered.push(pass);
            }
        }

        this.passes.splice(0, this.passes.length, ...ordered);
    }

    removePass(pass: FXPass): void {
        const index = this.passes.indexOf(pass);

        if (index !== -1) {
            this.passes.splice(index, 1);
            pass.destroy?.();
        }
    }

    clearPasses(): void {
        for (const pass of this.passes) {
            pass.destroy?.();
        }
        this.passes.length = 0;
    }

    render(inputTexture: WebGLTexture): WebGLTexture {
        this.init();

        let currentTexture = inputTexture ?? this.inputTexture;

        if (!currentTexture) {
            currentTexture = this.createFallbackTexture();
            this.inputTexture = currentTexture;
        }

        for (const pass of this.passes) {
            if (!pass.enabled) {
                continue;
            }

            currentTexture = pass.render(currentTexture);
        }

        this.outputTexture = currentTexture;
        return currentTexture;
    }

    getOutputTexture(): WebGLTexture {
        this.init();
        return this.outputTexture ?? this.inputTexture ?? this.createFallbackTexture();
    }

    update(time: number, delta: number): void {
        for (const pass of this.passes) {
            if (pass.enabled && pass.update) {
                pass.update(time, delta);
            }
        }
    }

    getInputTexture(): WebGLTexture {
        this.init();
        return this.inputTexture ?? this.createFallbackTexture();
    }

    private createFallbackTexture(): WebGLTexture {
        const renderer = this.scene.game.renderer;

        if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
            throw new Error('FXManager requires the WebGL renderer.');
        }

        const gl = renderer.gl;
        const texture = gl.createTexture();

        if (!texture) {
            throw new Error('FXManager could not create a fallback texture.');
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            1,
            1,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array([255, 255, 255, 255])
        );
        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }
}