import Phaser from 'phaser';
import { BlackHolePass } from '../../fx/custom/BlackHolePass';
import { FXManager } from '../../fx/FXManager';
import { ShockwavePass } from '../../fx/passes/ShockwavePass';
import { PixiFilterPipeline } from '../../fx/pixi/PixiFilterPipeline';
import { ReglPipeline } from '../../fx/regl/ReglPipeline';
import { ThreePipeline } from '../../fx/three/ThreePipeline';
import { FXMenu } from '../../ui/FXMenu';

export class Main extends Phaser.Scene {
    private fx!: FXManager;
    private menu!: FXMenu;
    private shockwave!: ShockwavePass;

    constructor() {
        super('Main');
    }

    create() {
        this.fx = new FXManager(this);
        this.fx.init();

        const box = this.add.rectangle(640, 360, 240, 160, 0x1d4ed8).setStrokeStyle(4, 0xe2e8f0);

        this.add.text(640, 360, 'Phaser 4 Starter', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            color: '#e2e8f0'
        }).setOrigin(0.5);

        void box;

        this.fx.addPass(new PixiFilterPipeline(this));
        this.fx.addPass(new ReglPipeline(this));
        this.fx.addPass(new ThreePipeline(this));
        this.shockwave = new ShockwavePass(this);
        this.fx.addPass(this.shockwave);
        this.fx.addPass(new BlackHolePass(this));

        this.menu = new FXMenu(this, this.fx);

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.shockwave.trigger(pointer.x, pointer.y);
        });

        this.input.keyboard?.on('keydown-F1', () => {
            this.menu.toggle();
        });
    }

    update(time: number, delta: number) {
        this.fx.update(time, delta);

        const inputTexture = this.fx.getInputTexture();
        this.fx.render(inputTexture);
    }
}