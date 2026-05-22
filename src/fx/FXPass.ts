import type { FXManager } from './FXManager';

export interface FXUniformDefinition {
    name: string;
    type: 'float' | 'int' | 'bool' | 'vec2' | 'vec3' | 'vec4' | 'color';
    min?: number;
    max?: number;
    step?: number;
    default: any;
}

export interface FXPass {
    name: string;
    kind?: string;
    enabled: boolean;
    init(manager: FXManager): void;
    render(input: WebGLTexture): WebGLTexture;
    getUniforms?(): FXUniformDefinition[];
    setUniform?(name: string, value: any): void;
    update?(time: number, delta: number): void;
    destroy?(): void;
}