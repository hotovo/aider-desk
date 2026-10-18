import { describe, expect, it } from 'vitest';
import { mount, renderAsync, load } from 'pele/lazy';

const options = {
  images: false,
  links: false,
  autoDirection: false,
  measurer: { width: (text: string, size: number) => text.length * size * 0.6 },
};

describe('Pele renderer integration', () => {
  it.each([
    ['flowchart', 'flowchart LR\nA[Start] --> B[Done]'],
    ['sequence', 'sequenceDiagram\nAlice->>Bob: Hello'],
    ['class', 'classDiagram\nAnimal <|-- Dog'],
    ['state', 'stateDiagram-v2\n[*] --> Active'],
    ['er', 'erDiagram\nCUSTOMER ||--o{ ORDER : places'],
    ['pie', 'pie title Usage\n"Input" : 40\n"Output" : 60'],
    ['gantt', 'gantt\ndateFormat YYYY-MM-DD\nsection Work\nTask :a1, 2026-01-01, 2d'],
    ['mindmap', 'mindmap\n  root((Root))\n    Child'],
  ])('lazily renders %s diagrams with themeable SVG', async (type, source) => {
    const result = await renderAsync(source, options);
    expect(result.type).toBe(type);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    const container = document.createElement('div');
    container.innerHTML = result.svg;
    expect(container.querySelector('svg.pele')).not.toBeNull();
    expect(result.svg).toContain('var(--pele-');
    expect(container.querySelector('script, foreignObject')).toBeNull();
  });

  it('does not emit clickable links or injected HTML from model output', async () => {
    const { svg } = await renderAsync('flowchart LR\nA["<script>alert(1)</script>"] --> B[Safe]\nclick B "https://example.com"', options);
    const container = document.createElement('div');
    container.innerHTML = svg;
    expect(container.querySelector('script, a, foreignObject')).toBeNull();
    expect(container.querySelector('[onclick], [onerror]')).toBeNull();
  });

  it('enforces the source size limit', async () => {
    await expect(renderAsync(`flowchart LR\nA[${'x'.repeat(50000)}]`, options)).rejects.toMatchObject({ code: 'limit' });
  });

  it('retains the previous SVG during invalid updates and recovers', async () => {
    await load('flowchart');
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    document.body.append(container);
    const diagram = mount(container, 'flowchart LR\nA --> B', { ...options, zoom: false });
    try {
      const previous = diagram.result;
      expect(previous?.type).toBe('flowchart');
      diagram.update('flowchart LR\nA[Incomplete');
      expect(diagram.error).toBeDefined();
      expect(diagram.result).toBe(previous);
      expect(container.querySelector('svg')).not.toBeNull();
      expect(container.querySelector('.pele-error')).not.toBeNull();
      diagram.update('flowchart LR\nA --> C');
      expect(diagram.error).toBeUndefined();
      expect(container.querySelector('.pele-error')).toBeNull();
    } finally {
      diagram.destroy();
      container.remove();
    }
  });
});
