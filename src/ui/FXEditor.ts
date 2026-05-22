import type { FXManager } from '../fx/FXManager';
import type { FXPass, FXUniformDefinition } from '../fx/FXPass';

type PresetPass = {
    name: string;
    enabled: boolean;
    uniforms: Record<string, any>;
};

type Preset = {
    version: 1;
    passes: PresetPass[];
};

type ControlRecord = {
    input: HTMLInputElement;
    valueLabel?: HTMLSpanElement;
    definition: FXUniformDefinition;
};

export class FXEditor {
    private readonly manager: FXManager;
    private readonly root: HTMLDivElement;
    private readonly header: HTMLDivElement;
    private readonly body: HTMLDivElement;
    private readonly pipelineList: HTMLDivElement;
    private readonly uniformsList: HTMLDivElement;
    private readonly presetArea: HTMLTextAreaElement;
    private readonly statusLine: HTMLDivElement;
    private readonly state = new Map<string, PresetPass>();
    private readonly controls = new Map<string, Map<string, ControlRecord>>();
    private dragging = false;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private visible = true;

    constructor(manager: FXManager) {
        this.manager = manager;
        this.root = document.createElement('div');
        this.header = document.createElement('div');
        this.body = document.createElement('div');
        this.pipelineList = document.createElement('div');
        this.uniformsList = document.createElement('div');
        this.presetArea = document.createElement('textarea');
        this.statusLine = document.createElement('div');

        this.ensureHost();
        this.buildShell();
        this.init();
    }

    init(): void {
        this.syncStateFromManager();
        this.refresh();
    }

    toggle(): void {
        this.visible ? this.hide() : this.show();
    }

    show(): void {
        this.visible = true;
        this.root.style.display = 'block';
    }

    hide(): void {
        this.visible = false;
        this.root.style.display = 'none';
    }

    destroy(): void {
        this.root.remove();
    }

    refresh(): void {
        this.buildPipelineList();
        this.buildUniformControls();
    }

    savePreset(): string {
        const preset = this.collectPreset();
        const json = JSON.stringify(preset, null, 2);
        this.presetArea.value = json;
        this.setStatus('Preset saved.');
        return json;
    }

    loadPreset(jsonText: string): void {
        const preset = JSON.parse(jsonText) as Preset;

        if (!preset || preset.version !== 1 || !Array.isArray(preset.passes)) {
            throw new Error('Invalid preset format.');
        }

        const passOrder: string[] = [];

        for (const entry of preset.passes) {
            const pass = this.manager.getPassByName(entry.name);

            if (!pass) {
                continue;
            }

            pass.enabled = entry.enabled;
            passOrder.push(pass.name);

            if (pass.setUniform) {
                for (const [uniformName, uniformValue] of Object.entries(entry.uniforms)) {
                    pass.setUniform(uniformName, uniformValue);
                }
            }

            const state = this.state.get(pass.name);

            if (state) {
                state.enabled = entry.enabled;
                state.uniforms = { ...entry.uniforms };
            }
        }

        this.manager.setPassOrder(passOrder);
        this.refresh();
        this.setStatus('Preset loaded.');
    }

    resetToDefaults(): void {
        for (const pass of this.manager.getPasses()) {
            const state = this.state.get(pass.name);
            pass.enabled = true;

            if (state) {
                state.enabled = true;
                for (const definition of pass.getUniforms?.() ?? []) {
                    state.uniforms[definition.name] = definition.default;
                    pass.setUniform?.(definition.name, definition.default);
                }
            }
        }

        this.refresh();
        this.setStatus('Defaults restored.');
    }

    private ensureHost(): void {
        const host = document.body;
        const style = window.getComputedStyle(host);

        if (style.position === 'static') {
            host.style.position = 'relative';
        }

        if (!host.contains(this.root)) {
            host.appendChild(this.root);
        }
    }

    private buildShell(): void {
        Object.assign(this.root.style, {
            position: 'fixed',
            top: '16px',
            right: '16px',
            width: '360px',
            height: '560px',
            minWidth: '280px',
            minHeight: '340px',
            background: 'rgba(10, 14, 22, 0.92)',
            color: '#e5eef9',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.45)',
            zIndex: '1000',
            overflow: 'hidden',
            resize: 'both',
            display: 'block',
            fontFamily: 'Arial, sans-serif'
        });

        Object.assign(this.header.style, {
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            cursor: 'move',
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            userSelect: 'none'
        });
        this.header.textContent = 'FX Editor';

        const hotkey = document.createElement('span');
        hotkey.textContent = 'F2';
        hotkey.style.opacity = '0.75';
        hotkey.style.fontSize = '12px';
        this.header.appendChild(hotkey);

        Object.assign(this.body.style, {
            display: 'grid',
            gap: '12px',
            padding: '12px',
            height: 'calc(100% - 40px)',
            overflow: 'auto',
            boxSizing: 'border-box'
        });

        this.pipelineList.className = 'fx-editor-pipelines';
        this.uniformsList.className = 'fx-editor-uniforms';

        const presetBar = document.createElement('div');
        presetBar.style.display = 'grid';
        presetBar.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
        presetBar.style.gap = '8px';

        const saveButton = this.createButton('Save', () => this.savePreset());
        const loadButton = this.createButton('Load', () => {
            try {
                this.loadPreset(this.presetArea.value);
            } catch (error) {
                this.setStatus(error instanceof Error ? error.message : 'Failed to load preset.');
            }
        });
        const resetButton = this.createButton('Reset', () => this.resetToDefaults());

        presetBar.append(saveButton, loadButton, resetButton);

        this.presetArea.rows = 10;
        this.presetArea.placeholder = '{"version":1,"passes":[]}';
        Object.assign(this.presetArea.style, {
            width: '100%',
            minHeight: '140px',
            resize: 'vertical',
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            background: 'rgba(15, 23, 42, 0.92)',
            color: '#e5eef9',
            fontFamily: 'monospace',
            boxSizing: 'border-box'
        });

        Object.assign(this.statusLine.style, {
            minHeight: '18px',
            fontSize: '12px',
            opacity: '0.8'
        });

        this.body.append(this.makeSection('Pipelines', this.pipelineList), this.makeSection('Uniforms', this.uniformsList), this.makeSection('Presets', this.presetArea, presetBar), this.statusLine);
        this.root.append(this.header, this.body);

        this.installDrag();
    }

    private makeSection(title: string, content: HTMLElement, footer?: HTMLElement): HTMLDivElement {
        const wrapper = document.createElement('section');
        wrapper.style.display = 'grid';
        wrapper.style.gap = '8px';

        const heading = document.createElement('div');
        heading.textContent = title;
        heading.style.fontWeight = '700';
        heading.style.fontSize = '13px';
        heading.style.letterSpacing = '0.02em';
        heading.style.textTransform = 'uppercase';
        heading.style.opacity = '0.85';

        wrapper.append(heading, content);

        if (footer) {
            wrapper.append(footer);
        }

        return wrapper;
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

    private buildPipelineList(): void {
        this.pipelineList.replaceChildren();

        const passes = this.manager.getPasses();

        if (passes.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No passes registered.';
            empty.style.opacity = '0.75';
            this.pipelineList.appendChild(empty);
            return;
        }

        passes.forEach((pass, index) => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = 'auto 1fr auto';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.padding = '8px 10px';
            row.style.border = '1px solid rgba(148, 163, 184, 0.18)';
            row.style.borderRadius = '10px';
            row.style.background = 'rgba(15, 23, 42, 0.7)';

            const enabled = document.createElement('input');
            enabled.type = 'checkbox';
            enabled.checked = pass.enabled;
            enabled.addEventListener('change', () => {
                this.manager.setPassEnabled(pass, enabled.checked);
                const entry = this.state.get(pass.name);
                if (entry) {
                    entry.enabled = enabled.checked;
                }
            });

            const name = document.createElement('div');
            name.textContent = pass.name;
            name.style.fontSize = '13px';

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
            row.append(enabled, name, actions);
            this.pipelineList.appendChild(row);
        });
    }

    private buildUniformControls(): void {
        this.uniformsList.replaceChildren();
        this.controls.clear();

        const passes = this.manager.getPasses();

        if (passes.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Add a pass to edit uniforms.';
            empty.style.opacity = '0.75';
            this.uniformsList.appendChild(empty);
            return;
        }

        for (const pass of passes) {
            const definitions = pass.getUniforms?.() ?? [];
            const state = this.ensureState(pass, definitions);

            const group = document.createElement('div');
            group.style.display = 'grid';
            group.style.gap = '8px';
            group.style.padding = '10px';
            group.style.border = '1px solid rgba(148, 163, 184, 0.18)';
            group.style.borderRadius = '10px';
            group.style.background = 'rgba(15, 23, 42, 0.7)';

            const title = document.createElement('div');
            title.textContent = pass.name;
            title.style.fontWeight = '700';
            title.style.fontSize = '13px';
            group.appendChild(title);

            const controlMap = new Map<string, ControlRecord>();

            if (definitions.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'No uniforms exposed.';
                empty.style.opacity = '0.75';
                group.appendChild(empty);
            }

            for (const definition of definitions) {
                const control = this.createUniformControl(pass, definition, state.uniforms[definition.name]);
                controlMap.set(definition.name, control);
                group.appendChild(control.input.closest('[data-fx-uniform-row]') as HTMLElement);
            }

            this.controls.set(pass.name, controlMap);
            this.uniformsList.appendChild(group);
        }
    }

    private createUniformControl(pass: FXPass, definition: FXUniformDefinition, initialValue: any): ControlRecord {
        const row = document.createElement('div');
        row.dataset.fxUniformRow = 'true';
        row.style.display = 'grid';
        row.style.gap = '6px';

        const label = document.createElement('label');
        label.textContent = `${definition.name} (${definition.type})`;
        label.style.fontSize = '12px';
        label.style.opacity = '0.85';

        row.appendChild(label);

        let input: HTMLInputElement;
        let valueLabel: HTMLSpanElement | undefined;

        if (definition.type === 'bool') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = Boolean(initialValue ?? definition.default);
            input.addEventListener('change', () => {
                this.applyUniform(pass, definition, input.checked);
            });
            row.appendChild(input);
        } else if (definition.type === 'color' || definition.type === 'vec3' || definition.type === 'vec4') {
            input = document.createElement('input');
            input.type = 'color';
            input.value = this.toColorString(initialValue ?? definition.default);
            input.addEventListener('input', () => {
                const color = this.fromColorString(input.value, definition.type === 'vec4' ? this.getAlphaValue(initialValue ?? definition.default) : 1);
                this.applyUniform(pass, definition, color);
            });
            row.appendChild(input);

            if (definition.type === 'vec4') {
                const alpha = document.createElement('input');
                alpha.type = 'range';
                alpha.min = '0';
                alpha.max = '1';
                alpha.step = '0.01';
                alpha.value = String(this.getAlphaValue(initialValue ?? definition.default));
                alpha.addEventListener('input', () => {
                    const color = this.fromColorString(input.value, Number(alpha.value));
                    this.applyUniform(pass, definition, color);
                });
                row.appendChild(alpha);
            }
        } else if (definition.type === 'vec2') {
            const values = this.normalizeArray(initialValue ?? definition.default, 2);
            const x = this.createNumberInput(values[0], definition, () => {
                this.applyUniform(pass, definition, [Number(x.value), Number(y.value)]);
            });
            const y = this.createNumberInput(values[1], definition, () => {
                this.applyUniform(pass, definition, [Number(x.value), Number(y.value)]);
            });
            row.append(x, y);
            input = x;
        } else {
            input = document.createElement('input');
            input.type = definition.type === 'int' ? 'number' : 'range';
            input.min = String(definition.min ?? 0);
            input.max = String(definition.max ?? 1);
            input.step = String(definition.step ?? (definition.type === 'int' ? 1 : 0.01));
            input.value = String(initialValue ?? definition.default);
            input.addEventListener('input', () => {
                const nextValue = definition.type === 'int' ? Math.round(Number(input.value)) : Number(input.value);
                if (valueLabel) {
                    valueLabel.textContent = String(nextValue);
                }
                this.applyUniform(pass, definition, nextValue);
            });
            row.appendChild(input);

            valueLabel = document.createElement('span');
            valueLabel.textContent = String(initialValue ?? definition.default);
            valueLabel.style.fontSize = '12px';
            valueLabel.style.opacity = '0.8';
            row.appendChild(valueLabel);
        }

        const record = { input, valueLabel, definition };
        (row as HTMLElement).appendChild;
        return record;
    }

    private createNumberInput(value: number, definition: FXUniformDefinition, onInput: () => void): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = String(value);
        input.min = String(definition.min ?? -9999);
        input.max = String(definition.max ?? 9999);
        input.step = String(definition.step ?? 0.01);
        input.addEventListener('input', onInput);
        return input;
    }

    private applyUniform(pass: FXPass, definition: FXUniformDefinition, value: any): void {
        pass.setUniform?.(definition.name, value);
        const state = this.ensureState(pass, pass.getUniforms?.() ?? []);
        state.uniforms[definition.name] = value;
    }

    private ensureState(pass: FXPass, definitions: FXUniformDefinition[]): PresetPass {
        let entry = this.state.get(pass.name);

        if (!entry) {
            entry = {
                name: pass.name,
                enabled: pass.enabled,
                uniforms: {}
            };

            for (const definition of definitions) {
                entry.uniforms[definition.name] = definition.default;
                pass.setUniform?.(definition.name, definition.default);
            }

            this.state.set(pass.name, entry);
        }

        return entry;
    }

    private syncStateFromManager(): void {
        for (const pass of this.manager.getPasses()) {
            this.ensureState(pass, pass.getUniforms?.() ?? []);
        }
    }

    private collectPreset(): Preset {
        return {
            version: 1,
            passes: this.manager.getPasses().map((pass) => {
                const state = this.ensureState(pass, pass.getUniforms?.() ?? []);

                return {
                    name: pass.name,
                    enabled: pass.enabled,
                    uniforms: { ...state.uniforms }
                };
            })
        };
    }

    private setStatus(message: string): void {
        this.statusLine.textContent = message;
    }

    private installDrag(): void {
        this.header.addEventListener('mousedown', (event) => {
            this.dragging = true;
            this.dragOffsetX = event.clientX - this.root.offsetLeft;
            this.dragOffsetY = event.clientY - this.root.offsetTop;
            event.preventDefault();
        });

        window.addEventListener('mousemove', (event) => {
            if (!this.dragging) {
                return;
            }

            this.root.style.left = `${Math.max(0, event.clientX - this.dragOffsetX)}px`;
            this.root.style.top = `${Math.max(0, event.clientY - this.dragOffsetY)}px`;
            this.root.style.right = 'auto';
        });

        window.addEventListener('mouseup', () => {
            this.dragging = false;
        });
    }

    private normalizeArray(value: any, length: number): number[] {
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

        const array = this.normalizeArray(value, 3);
        const hex = array.map((component) => Math.max(0, Math.min(255, Math.round(component * 255))).toString(16).padStart(2, '0')).join('');
        return `#${hex}`;
    }

    private fromColorString(value: string, alpha = 1): [number, number, number] | [number, number, number, number] {
        const hex = value.replace('#', '');
        const red = parseInt(hex.slice(0, 2), 16) / 255;
        const green = parseInt(hex.slice(2, 4), 16) / 255;
        const blue = parseInt(hex.slice(4, 6), 16) / 255;
        return alpha < 1 ? [red, green, blue, alpha] : [red, green, blue];
    }

    private getAlphaValue(value: any): number {
        return Array.isArray(value) && value.length > 3 ? Number(value[3]) : 1;
    }
}