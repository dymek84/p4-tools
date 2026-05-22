import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Main } from './scenes/Main';

export const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    width: 1280,
    height: 720,
    backgroundColor: '#0f172a',
    scene: [Boot, Main],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};