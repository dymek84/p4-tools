import Phaser from 'phaser';
import type { FXManager } from '../fx/FXManager';
import type { FXPass, FXUniformDefinition } from '../fx/FXPass';
import { BlackHolePass } from '../fx/custom/BlackHolePass';
import { PixiFilterPipeline } from '../fx/pixi/PixiFilterPipeline';
import { ReglPipeline } from '../fx/regl/ReglPipeline';
import { ThreePipeline } from '../fx/three/ThreePipeline';

type EffectKind = 'shockwave' | 'bloom' | 'noise' | 'distortion' | 'lightning' | 'blackhole';

type EffectCatalogEntry = {
    kind: EffectKind;
    label: string;
    description: string;
    create: (scene: Phaser.Scene, name: string) => FXPass;
};

type PresetPass = {
    kind: string;
    name: string;
    enabled: boolean;
    uniforms: Record<string, any>;
};

type Preset = {
    version: 1;
    passes: PresetPass[];
};

type PassSnapshot = {
    kind: string;
    name: string;
    enabled: boolean;
    uniforms: Record<string, any>;
};

class MenuEffectPass implements FXPass {
    readonly kind: string;
    name: string;
    enabled = true;
    private readonly uniforms = new Map<string, any>();
    private readonly definitions: FXUniformDefinition[];

    constructor(kind: string, name: string, definitions: FXUniformDefinition[]) {
        this.kind = kind;
        this.name = name;
        this.definitions = definitions.map((definition) => ({ ...definition }));

        for (const definition of this.definitions) {
            this.uniforms.set(definition.name, this.cloneValue(definition.default));
        }
    }

    init(_manager: FXManager): void {
        return;
    }

    render(input: WebGLTexture): WebGLTexture {
        return input;
    }

    getUniforms(): FXUniformDefinition[] {
        return this.definitions.map((definition) => ({ ...definition }));
    }

    setUniform(name: string, value: any): void {
        this.uniforms.set(name, this.cloneValue(value));
    }

    private cloneValue(value: any): any {
        return Array.isArray(value) ? [...value] : value;
    }
}

export class FXMenu {
    private readonly scene: Phaser.Scene;
    private readonly manager: FXManager;
    private readonly root: HTMLDivElement;
    private readonly modal: HTMLDivElement;
    private readonly modalPanel: HTMLDivElement;
    private readonly effectList: HTMLDivElement;
    private readonly orderList: HTMLDivElement;
    private readonly editBody: HTMLDivElement;
    private readonly editTitle: HTMLDivElement;
    private readonly presetSelect: HTMLSelectElement;
    private readonly presetTextarea: HTMLTextAreaElement;
    private readonly presetStatus: HTMLDivElement;
    private readonly statusLine: HTMLDivElement;
    private readonly snapshots = new Map<FXPass, PassSnapshot>();
    private activePass: FXPass | null = null;
    private visible = true;
    private dragging = false;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private readonly effectCatalog: EffectCatalogEntry[];

    constructor(scene: Phaser.Scene, manager: FXManager) {
        this.scene = scene;
        this.manager = manager;
        this.root = document.createElement('div');
        this.modal = document.createElement('div');
        this.modalPanel = document.createElement('div');
        this.effectList = document.createElement('div');
        this.orderList = document.createElement('div');
        this.editBody = document.createElement('div');
        this.editTitle = document.createElement('div');
        this.presetSelect = document.createElement('select');
        this.presetTextarea = document.createElement('textarea');
        this.presetStatus = document.createElement('div');
        this.statusLine = document.createElement('div');
        this.effectCatalog = this.createEffectCatalog();

        this.ensureHost();
        this.buildShell();
        this.syncSnapshots();
        this.refresh();
    }

    show(): void {
        this.visible = true;
        this.root.style.display = 'block';
    }

    hide(): void {
        this.visible = false;
        this.root.style.display = 'none';
        this.closeModal();
    }

    toggle(): void {
        this.visible ? this.hide() : this.show();
    }

    destroy(): void {
        this.root.remove();
        this.modal.remove();
    }

    refresh(): void {
        this.syncSnapshots();
        this.renderEffectList();
        this.renderOrderPanel();
        this.renderEditMode();
    }

    openAddModal(): void {
        this.renderEffectModal();
        this.modal.style.display = 'grid';
    }

    closeModal(): void {
        this.modal.style.display = 'none';
    }

    savePresetToTextarea(): string {
        const preset = this.serializePreset();
        const json = JSON.stringify(preset, null, 2);
        this.presetTextarea.value = json;
        this.presetStatus.textContent = 'Preset saved to JSON.';
        return json;
    }

    loadPresetFromTextarea(): void {
        const parsed = JSON.parse(this.presetTextarea.value) as Preset;

        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.passes)) {
            throw new Error('Invalid preset format.');
        }

        this.applyPreset(parsed);
        this.refresh();
        this.presetStatus.textContent = 'Preset loaded.';
    }

    resetAllToDefaults(): void {
        for (const pass of this.manager.getPasses()) {
            pass.enabled = true;
            this.syncPassSnapshot(pass, true);

            for (const definition of pass.getUniforms?.() ?? []) {
                pass.setUniform?.(definition.name, this.cloneValue(definition.default));
                this.currentSnapshot(pass).uniforms[definition.name] = this.cloneValue(definition.default);
            }
        }

        this.refresh();
        this.presetStatus.textContent = 'All FX reset to defaults.';
    }

    private createEffectCatalog(): EffectCatalogEntry[] {
        return [
            {
                kind: 'shockwave',
                label: 'Shockwave',
                description: 'A radial ripple effect using the Pixi shockwave filter.',
                create: (scene, name) => new PixiFilterPipeline(scene, name)
            },
            {
                kind: 'bloom',
                label: 'Bloom',
                description: 'A Three.js post-process bloom stack.',
                create: (scene, name) => new ThreePipeline(scene, name)
            },
            {
                kind: 'blackhole',
                label: 'Black Hole',
                description: 'A visible animated singularity overlay with configurable core, spin, and pulse.',
                create: (scene, name) => new BlackHolePass(scene, name)
            },
            {
                kind: 'noise',
                label: 'Noise',
                description: 'Animated grain and color modulation controls.',
                create: (_scene, name) => new MenuEffectPass('noise', name, [
                    { name: 'strength', type: 'float', min: 0, max: 4, step: 0.01, default: 1 },
                    { name: 'seed', type: 'int', min: 0, max: 9999, step: 1, default: 42 },
                    { name: 'animated', type: 'bool', default: true },
                    { name: 'tint', type: 'color', default: '#ffffff' }
                ])
            },
            {
                kind: 'distortion',
                label: 'Distortion',
                description: 'A screen-warp control set for broad distortion tuning.',
                create: (_scene, name) => new MenuEffectPass('distortion', name, [
                    { name: 'amount', type: 'float', min: 0, max: 1, step: 0.01, default: 0.25 },
                    { name: 'frequency', type: 'float', min: 0, max: 20, step: 0.1, default: 6 },
                    { name: 'speed', type: 'float', min: 0, max: 8, step: 0.01, default: 1 },
                    { name: 'invert', type: 'bool', default: false },
                    { name: 'color', type: 'color', default: '#60a5fa' }
                ])
            },
            {
                kind: 'lightning',
                label: 'Lightning',
                description: 'A high-energy bolt style effect with adjustable intensity.',
                create: (_scene, name) => new MenuEffectPass('lightning', name, [
                    { name: 'intensity', type: 'float', min: 0, max: 6, step: 0.01, default: 1.5 },
                    { name: 'thickness', type: 'float', min: 0, max: 10, step: 0.01, default: 2 },
                    { name: 'segments', type: 'int', min: 2, max: 32, step: 1, default: 8 },
                    { name: 'glow', type: 'bool', default: true },
                    { name: 'color', type: 'color', default: '#f8fafc' }
                ])
            }
        ];
    }

    private ensureHost(): void {
        const host = document.body;

        if (window.getComputedStyle(host).position === 'static') {
            host.style.position = 'relative';
        }

        if (!host.contains(this.root)) {
            host.appendChild(this.root);
        }

        if (!host.contains(this.modal)) {
            host.appendChild(this.modal);
        }
    }

    private buildShell(): void {
        Object.assign(this.root.style, {
            position: 'fixed',
            inset: '0',
            pointerEvents: 'none',
            zIndex: '1000',
            fontFamily: 'Arial, sans-serif',
            color: '#e5eef9'
        });

        const panel = document.createElement('div');
        Object.assign(panel.style, {
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '420px',
            height: '620px',
            minWidth: '320px',
            minHeight: '360px',
            background: 'rgba(10, 14, 22, 0.92)',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            borderRadius: '14px',
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.48)',
            display: 'grid',
            gridTemplateRows: '40px 1fr',
            overflow: 'hidden',
            resize: 'both',
            pointerEvents: 'auto'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '0 12px',
            cursor: 'move',
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.96))',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            userSelect: 'none'
        });

        const title = document.createElement('div');
        title.textContent = 'FX Menu';
        title.style.fontWeight = '700';

        const hint = document.createElement('div');
        hint.textContent = 'F1';
        hint.style.fontSize = '12px';
        hint.style.opacity = '0.75';

        const closeButton = this.createButton('Close', () => this.hide());
        closeButton.style.marginLeft = 'auto';

        header.append(title, hint, closeButton);
        panel.appendChild(header);

        const body = document.createElement('div');
        Object.assign(body.style, {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '12px',
            padding: '12px',
            overflow: 'auto',
            boxSizing: 'border-box'
        });

        const controlsRow = document.createElement('div');
        Object.assign(controlsRow.style, {
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '8px'
        });

        const addButton = this.createButton('Add New Effect', () => this.openAddModal());
        addButton.style.gridColumn = '1 / -1';

        const presetSection = this.createSection('Presets');
        const presetTools = document.createElement('div');
        Object.assign(presetTools.style, {
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '8px'
        });

        this.presetSelect.append(
            this.createOption('save', 'Save current FX to JSON'),
            this.createOption('load', 'Load preset JSON'),
            this.createOption('reset', 'Reset all FX to defaults')
        );
        this.presetSelect.value = 'save';
        Object.assign(this.presetSelect.style, this.selectStyle());

        const presetRunButton = this.createButton('Run', () => {
            try {
                const action = this.presetSelect.value;

                if (action === 'save') {
                    this.savePresetToTextarea();
                } else if (action === 'load') {
                    this.loadPresetFromTextarea();
                } else {
                    this.resetAllToDefaults();
                }
            } catch (error) {
                this.presetStatus.textContent = error instanceof Error ? error.message : 'Preset action failed.';
            }
        });

        presetTools.append(this.presetSelect, presetRunButton);
        this.presetTextarea.rows = 8;
        this.presetTextarea.placeholder = '{"version":1,"passes":[]}';
        Object.assign(this.presetTextarea.style, {
            width: '100%',
            resize: 'vertical',
            minHeight: '120px',
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            background: 'rgba(15, 23, 42, 0.92)',
            color: '#e5eef9',
            fontFamily: 'monospace',
            padding: '10px',
            boxSizing: 'border-box'
        });
        Object.assign(this.presetStatus.style, {
            minHeight: '18px',
            fontSize: '12px',
            opacity: '0.8'
        });
        presetSection.append(presetTools, this.presetTextarea, this.presetStatus);

        const existingSection = this.createSection('Existing Effects');
        this.effectList.style.display = 'grid';
        this.effectList.style.gap = '8px';
        existingSection.appendChild(this.effectList);

        const orderSection = this.createSection('Pipeline Order');
        this.orderList.style.display = 'grid';
        this.orderList.style.gap = '8px';
        orderSection.appendChild(this.orderList);

        const editSection = this.createSection('Edit Mode');
        this.editTitle.style.fontWeight = '700';
        this.editTitle.style.marginBottom = '4px';
        this.editBody.style.display = 'grid';
        this.editBody.style.gap = '8px';
        editSection.append(this.editTitle, this.editBody);

        body.append(addButton, controlsRow, presetSection, existingSection, orderSection, editSection);
        panel.appendChild(body);
        this.root.appendChild(panel);
        this.installDrag(header, panel);

        this.modal.style.display = 'none';
        Object.assign(this.modal.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '1100',
            background: 'rgba(2, 6, 23, 0.72)',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto'
        });

        Object.assign(this.modalPanel.style, {
            width: 'min(640px, calc(100vw - 40px))',
            maxHeight: 'min(80vh, 720px)',
            overflow: 'auto',
            background: 'rgba(15, 23, 42, 0.98)',
            color: '#e5eef9',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            borderRadius: '16px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
            padding: '16px',
            display: 'grid',
            gap: '12px'
        });

        this.modal.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this.closeModal();
            }
        });

        this.modal.appendChild(this.modalPanel);
        this.statusLine.style.minHeight = '18px';
        this.statusLine.style.fontSize = '12px';
        this.statusLine.style.opacity = '0.8';
        body.appendChild(this.statusLine);
    }

    private createSection(title: string): HTMLDivElement {
        const section = document.createElement('section');
        Object.assign(section.style, {
            display: 'grid',
            gap: '8px',
            padding: '12px',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.72)'
        });

        const heading = document.createElement('div');
        heading.textContent = title;
        heading.style.fontSize = '12px';
        heading.style.fontWeight = '700';
        heading.style.textTransform = 'uppercase';
        heading.style.letterSpacing = '0.04em';
        heading.style.opacity = '0.82';
        section.appendChild(heading);
        return section;
    }

    private createButton(label: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        Object.assign(button.style, {
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: '10px',
            padding: '8px 10px',
            color: '#e5eef9',
            background: 'rgba(30, 41, 59, 0.92)',
            cursor: 'pointer'
        });
        button.addEventListener('click', onClick);
        return button;
    }

    private createOption(value: string, label: string): HTMLOptionElement {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        return option;
    }

    private selectStyle(): Partial<CSSStyleDeclaration> {
        return {
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            backgroundColor: 'rgba(30, 41, 59, 0.92)',
            color: '#e5eef9',
            padding: '8px 10px'
        };
    }

    private installDrag(handle: HTMLElement, panel: HTMLElement): void {
        handle.addEventListener('mousedown', (event) => {
            this.dragging = true;
            this.dragOffsetX = event.clientX - panel.getBoundingClientRect().left;
            this.dragOffsetY = event.clientY - panel.getBoundingClientRect().top;
            event.preventDefault();
        });

        window.addEventListener('mousemove', (event) => {
            if (!this.dragging) {
                return;
            }

            panel.style.left = `${Math.max(0, event.clientX - this.dragOffsetX)}px`;
            panel.style.top = `${Math.max(0, event.clientY - this.dragOffsetY)}px`;
            panel.style.right = 'auto';
        });

        window.addEventListener('mouseup', () => {
            this.dragging = false;
        });
    }

    private renderEffectList(): void {
        this.effectList.replaceChildren();

        const passes = this.manager.getPasses();

        if (passes.length === 0) {
            this.effectList.appendChild(this.emptyState('No effects registered yet.'));
            return;
        }

        for (const pass of passes) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '8px',
                alignItems: 'center',
                padding: '8px 10px',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.62)'
            });

            const toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.checked = pass.enabled;
            toggle.addEventListener('change', () => {
                pass.enabled = toggle.checked;
                this.currentSnapshot(pass).enabled = toggle.checked;
            });

            const labelBox = document.createElement('div');
            labelBox.style.display = 'grid';
            labelBox.style.gap = '2px';

            const title = document.createElement('div');
            title.textContent = pass.name;
            title.style.fontSize = '13px';
            title.style.fontWeight = '700';

            const subtitle = document.createElement('div');
            subtitle.textContent = this.passKindLabel(pass);
            subtitle.style.fontSize = '11px';
            subtitle.style.opacity = '0.72';

            labelBox.append(title, subtitle);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '6px';

            const editButton = this.createButton('Edit', () => {
                this.activePass = pass;
                this.renderEditMode();
            });
            const deleteButton = this.createButton('Delete', () => {
                this.manager.removePass(pass);
                this.snapshots.delete(pass);
                if (this.activePass === pass) {
                    this.activePass = null;
                }
                this.refresh();
            });

            actions.append(editButton, deleteButton);
            row.append(toggle, labelBox, actions);
            this.effectList.appendChild(row);
        }
    }

    private renderOrderPanel(): void {
        this.orderList.replaceChildren();

        const passes = this.manager.getPasses();

        if (passes.length === 0) {
            this.orderList.appendChild(this.emptyState('No pipeline order yet.'));
            return;
        }

        passes.forEach((pass, index) => {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '8px',
                alignItems: 'center',
                padding: '8px 10px',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.62)'
            });

            const label = document.createElement('div');
            label.textContent = `${index + 1}. ${pass.name}`;
            label.style.fontSize = '13px';

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '6px';

            const up = this.createButton('Up', () => {
                this.manager.movePassUp(pass);
                this.refresh();
            });
            const down = this.createButton('Down', () => {
                this.manager.movePassDown(pass);
                this.refresh();
            });
            up.disabled = index === 0;
            down.disabled = index === passes.length - 1;

            actions.append(up, down);
            row.append(label, actions);
            this.orderList.appendChild(row);
        });
    }

    private renderEditMode(): void {
        this.editBody.replaceChildren();

        if (!this.activePass) {
            this.editTitle.textContent = 'Select an effect to edit its uniforms.';
            this.editBody.appendChild(this.emptyState('No effect selected.'));
            return;
        }

        const pass = this.activePass;
        this.editTitle.textContent = `${pass.name} · ${this.passKindLabel(pass)}`;

        const definitions = pass.getUniforms?.() ?? [];
        const snapshot = this.currentSnapshot(pass);

        if (definitions.length === 0) {
            this.editBody.appendChild(this.emptyState('This effect exposes no uniforms.'));
        } else {
            for (const definition of definitions) {
                this.editBody.appendChild(this.createUniformField(pass, definition, snapshot.uniforms[definition.name]));
            }
        }

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '8px';
        footer.style.flexWrap = 'wrap';

        const saveButton = this.createButton('Save', () => {
            this.savePresetToTextarea();
            this.statusLine.textContent = 'Current FX configuration saved to JSON.';
        });
        const resetButton = this.createButton('Reset', () => {
            this.resetPassToDefaults(pass);
            this.renderEditMode();
            this.renderEffectList();
            this.renderOrderPanel();
        });
        const closeButton = this.createButton('Close', () => {
            this.activePass = null;
            this.renderEditMode();
        });

        footer.append(saveButton, resetButton, closeButton);
        this.editBody.appendChild(footer);
    }

    private createUniformField(pass: FXPass, definition: FXUniformDefinition, currentValue: any): HTMLDivElement {
        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'grid',
            gap: '6px',
            padding: '8px 10px',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.58)'
        });

        const label = document.createElement('div');
        label.textContent = `${definition.name} (${definition.type})`;
        label.style.fontSize = '12px';
        label.style.opacity = '0.86';
        row.appendChild(label);

        const applyValue = (value: any) => {
            pass.setUniform?.(definition.name, value);
            this.currentSnapshot(pass).uniforms[definition.name] = this.cloneValue(value);
        };

        const value = currentValue ?? this.cloneValue(definition.default);

        if (definition.type === 'bool') {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = Boolean(value);
            input.addEventListener('change', () => applyValue(input.checked));
            row.appendChild(input);
            return row;
        }

        if (definition.type === 'float' || definition.type === 'int') {
            const input = document.createElement('input');
            input.type = definition.type === 'int' ? 'number' : 'range';
            input.min = String(definition.min ?? 0);
            input.max = String(definition.max ?? 1);
            input.step = String(definition.step ?? (definition.type === 'int' ? 1 : 0.01));
            input.value = String(value);
            input.addEventListener('input', () => {
                const nextValue = definition.type === 'int' ? Math.round(Number(input.value)) : Number(input.value);
                applyValue(nextValue);
                valueLabel.textContent = String(nextValue);
            });

            const valueLabel = document.createElement('div');
            valueLabel.textContent = String(value);
            valueLabel.style.fontSize = '12px';
            valueLabel.style.opacity = '0.72';

            row.append(input, valueLabel);
            return row;
        }

        if (definition.type === 'vec2') {
            const values = this.normalizeVector(value, 2);
            row.appendChild(this.createVectorInputs(values, definition, applyValue, 2));
            return row;
        }

        if (definition.type === 'vec3' || definition.type === 'vec4' || definition.type === 'color') {
            const color = this.toColorString(value);
            const input = document.createElement('input');
            input.type = 'color';
            input.value = color;
            input.addEventListener('input', () => {
                if (definition.type === 'vec4') {
                    applyValue([...this.fromColorString(input.value), this.getAlpha(value)]);
                } else {
                    applyValue(this.fromColorString(input.value));
                }
            });

            row.appendChild(input);

            if (definition.type === 'vec4') {
                const alpha = document.createElement('input');
                alpha.type = 'range';
                alpha.min = '0';
                alpha.max = '1';
                alpha.step = '0.01';
                alpha.value = String(this.getAlpha(value));
                alpha.addEventListener('input', () => {
                    applyValue([...this.fromColorString(input.value), Number(alpha.value)]);
                });
                row.appendChild(alpha);
            }

            return row;
        }

        const fallback = document.createElement('input');
        fallback.type = 'text';
        fallback.value = String(value);
        fallback.addEventListener('change', () => applyValue(fallback.value));
        row.appendChild(fallback);
        return row;
    }

    private createVectorInputs(
        values: number[],
        definition: FXUniformDefinition,
        applyValue: (value: number[]) => void,
        length: number
    ): HTMLDivElement {
        const container = document.createElement('div');
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${length}, minmax(0, 1fr))`;
        container.style.gap = '8px';

        const inputs: HTMLInputElement[] = [];

        for (let index = 0; index < length; index += 1) {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = String(values[index] ?? 0);
            input.min = String(definition.min ?? -9999);
            input.max = String(definition.max ?? 9999);
            input.step = String(definition.step ?? 0.01);
            inputs.push(input);
            container.appendChild(input);
        }

        const sync = () => applyValue(inputs.map((input) => Number(input.value)));
        for (const input of inputs) {
            input.addEventListener('input', sync);
        }

        return container;
    }

    private renderEffectModal(): void {
        this.modalPanel.replaceChildren();

        const heading = document.createElement('div');
        heading.textContent = 'Add New Effect';
        heading.style.fontSize = '20px';
        heading.style.fontWeight = '700';

        const helper = document.createElement('div');
        helper.textContent = 'Choose an effect type to create a new FXPass and open it in Edit Mode.';
        helper.style.opacity = '0.78';
        helper.style.fontSize = '13px';

        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px'
        });

        for (const entry of this.effectCatalog) {
            const card = document.createElement('button');
            card.type = 'button';
            Object.assign(card.style, {
                textAlign: 'left',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#e5eef9',
                cursor: 'pointer',
                display: 'grid',
                gap: '6px'
            });

            const cardTitle = document.createElement('div');
            cardTitle.textContent = entry.label;
            cardTitle.style.fontWeight = '700';

            const cardKind = document.createElement('div');
            cardKind.textContent = entry.kind;
            cardKind.style.fontSize = '12px';
            cardKind.style.opacity = '0.72';

            const cardDesc = document.createElement('div');
            cardDesc.textContent = entry.description;
            cardDesc.style.fontSize = '12px';
            cardDesc.style.opacity = '0.84';

            card.append(cardTitle, cardKind, cardDesc);
            card.addEventListener('click', () => {
                const pass = this.createEffectPass(entry);
                this.manager.addPass(pass);
                this.activePass = pass;
                this.syncSnapshots();
                this.refresh();
                this.closeModal();
            });
            grid.appendChild(card);
        }

        const close = this.createButton('Close', () => this.closeModal());

        this.modalPanel.append(heading, helper, grid, close);
    }

    private createEffectPass(entry: EffectCatalogEntry): FXPass {
        const name = this.makeUniqueName(entry.label);
        return entry.create(this.scene, name);
    }

    private makeUniqueName(base: string): string {
        const existing = new Set(this.manager.getPasses().map((pass) => pass.name));

        if (!existing.has(base)) {
            return base;
        }

        let index = 2;
        while (existing.has(`${base} ${index}`)) {
            index += 1;
        }

        return `${base} ${index}`;
    }

    private syncSnapshots(): void {
        for (const pass of this.manager.getPasses()) {
            this.syncPassSnapshot(pass, false);
        }

        for (const pass of Array.from(this.snapshots.keys())) {
            if (!this.manager.getPasses().includes(pass)) {
                this.snapshots.delete(pass);
            }
        }

        if (this.activePass && !this.manager.getPasses().includes(this.activePass)) {
            this.activePass = null;
        }
    }

    private syncPassSnapshot(pass: FXPass, overwrite: boolean): void {
        const definitions = pass.getUniforms?.() ?? [];
        const existing = this.snapshots.get(pass);

        if (!existing || overwrite) {
            const uniforms: Record<string, any> = {};

            for (const definition of definitions) {
                uniforms[definition.name] = this.cloneValue(definition.default);
            }

            this.snapshots.set(pass, {
                kind: this.getPassKind(pass),
                name: pass.name,
                enabled: pass.enabled,
                uniforms
            });
            return;
        }

        existing.kind = this.getPassKind(pass);
        existing.name = pass.name;
        existing.enabled = pass.enabled;

        for (const definition of definitions) {
            if (!(definition.name in existing.uniforms)) {
                existing.uniforms[definition.name] = this.cloneValue(definition.default);
            }
        }
    }

    private currentSnapshot(pass: FXPass): PassSnapshot {
        const existing = this.snapshots.get(pass);

        if (existing) {
            return existing;
        }

        const snapshot: PassSnapshot = {
            kind: this.getPassKind(pass),
            name: pass.name,
            enabled: pass.enabled,
            uniforms: {}
        };

        for (const definition of pass.getUniforms?.() ?? []) {
            snapshot.uniforms[definition.name] = this.cloneValue(definition.default);
        }

        this.snapshots.set(pass, snapshot);
        return snapshot;
    }

    private serializePreset(): Preset {
        return {
            version: 1,
            passes: this.manager.getPasses().map((pass) => {
                const snapshot = this.currentSnapshot(pass);
                return {
                    kind: snapshot.kind,
                    name: snapshot.name,
                    enabled: pass.enabled,
                    uniforms: { ...snapshot.uniforms }
                };
            })
        };
    }

    private applyPreset(preset: Preset): void {
        const passes = this.manager.getPasses();

        for (let index = 0; index < preset.passes.length; index += 1) {
            const saved = preset.passes[index];
            const existing = passes[index];
            let target = existing;

            if (!target || this.getPassKind(target) !== saved.kind) {
                const created = this.createPassFromSaved(saved);

                if (target) {
                    this.manager.removePass(target);
                }

                this.manager.addPass(created);
                this.manager.movePass(created, Math.min(index, this.manager.getPasses().length - 1));
                target = created;
            }

            target.enabled = saved.enabled;
            const snapshot = this.currentSnapshot(target);
            snapshot.enabled = saved.enabled;

            for (const [uniformName, uniformValue] of Object.entries(saved.uniforms)) {
                target.setUniform?.(uniformName, uniformValue);
                snapshot.uniforms[uniformName] = this.cloneValue(uniformValue);
            }
        }

        this.activePass = this.manager.getPasses()[0] ?? null;
        this.syncSnapshots();
    }

    private createPassFromSaved(saved: PresetPass): FXPass {
        const catalogEntry = this.effectCatalog.find((entry) => entry.kind === saved.kind);

        if (catalogEntry) {
            const pass = catalogEntry.create(this.scene, saved.name || this.makeUniqueName(catalogEntry.label));
            pass.enabled = saved.enabled;
            return pass;
        }

        return new MenuEffectPass(saved.kind, saved.name || this.makeUniqueName(saved.kind), []);
    }

    private resetPassToDefaults(pass: FXPass): void {
        pass.enabled = true;
        const snapshot = this.currentSnapshot(pass);
        snapshot.enabled = true;

        for (const definition of pass.getUniforms?.() ?? []) {
            pass.setUniform?.(definition.name, this.cloneValue(definition.default));
            snapshot.uniforms[definition.name] = this.cloneValue(definition.default);
        }
    }

    private getPassKind(pass: FXPass): string {
        return (pass as FXPass & { kind?: string }).kind ?? pass.name.toLowerCase();
    }

    private passKindLabel(pass: FXPass): string {
        const kind = this.getPassKind(pass);
        return kind.charAt(0).toUpperCase() + kind.slice(1);
    }

    private emptyState(message: string): HTMLDivElement {
        const empty = document.createElement('div');
        empty.textContent = message;
        empty.style.opacity = '0.72';
        empty.style.fontSize = '13px';
        return empty;
    }

    private cloneValue(value: any): any {
        return Array.isArray(value) ? value.map((entry) => this.cloneValue(entry)) : value;
    }

    private normalizeVector(value: any, length: number): number[] {
        const array = Array.isArray(value) ? value : [];
        const result: number[] = [];

        for (let index = 0; index < length; index += 1) {
            result.push(Number(array[index] ?? (index === 0 ? 0 : 1)));
        }

        return result;
    }

    private toColorString(value: any): string {
        if (typeof value === 'string') {
            return value.startsWith('#') ? value : `#${value}`;
        }

        const vector = this.normalizeVector(value, 3);
        const components = vector.map((component) => Math.max(0, Math.min(255, Math.round(component * 255))).toString(16).padStart(2, '0'));
        return `#${components.join('')}`;
    }

    private fromColorString(value: string): [number, number, number] {
        const hex = value.replace('#', '');
        const red = parseInt(hex.slice(0, 2), 16) / 255;
        const green = parseInt(hex.slice(2, 4), 16) / 255;
        const blue = parseInt(hex.slice(4, 6), 16) / 255;
        return [red, green, blue];
    }

    private getAlpha(value: any): number {
        return Array.isArray(value) && value.length > 3 ? Number(value[3]) : 1;
    }
}
