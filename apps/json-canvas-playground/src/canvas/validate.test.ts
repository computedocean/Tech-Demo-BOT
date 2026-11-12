import { describe, expect, test } from 'bun:test'
import { inferSides, moveNode } from './document.ts'
import { examples } from './examples.ts'
import { parseCanvas, stringifyCanvas, validateCanvas } from './validate.ts'

describe('starter documents', () => {
  for (const [name, doc] of Object.entries(examples)) {
    test(`${name} matches its .canvas file and survives a strict round trip`, async () => {
      const text = await Bun.file(new URL(`../../examples/${name}.canvas`, import.meta.url)).text()
      expect(text).toBe(stringifyCanvas(doc))
      const parsed = parseCanvas(text)
      expect(parsed.ok).toBe(true)
      if (parsed.ok) expect(stringifyCanvas(parsed.value)).toBe(text)
    })
  }
})

describe('validateCanvas', () => {
  test('accepts an empty document', () => {
    const result = validateCanvas({})
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({})
  })

  test('accepts a node id that is reused by an edge', () => {
    const result = validateCanvas({
      nodes: [{ id: 'a', type: 'text', text: 'A', x: 0, y: 0, width: 10, height: 10 }],
      edges: [{ id: 'a', fromNode: 'a', toNode: 'a' }],
    })
    expect(result.ok).toBe(true)
  })

  test('rejects non-objects, unknown fields, and metadata', () => {
    expect(validateCanvas([]).ok).toBe(false)
    expect(validateCanvas(null).ok).toBe(false)
    const result = validateCanvas({
      metadata: {},
      nodes: [
        {
          id: 'a',
          type: 'text',
          text: 'Hi',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          zIndex: 2,
          parentId: 'nope',
        },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.errors.map((error) => error.path)
      expect(paths).toContain('metadata')
      expect(paths).toContain('nodes[0].zIndex')
      expect(paths).toContain('nodes[0].parentId')
    }
  })

  test('requires integer geometry and string colors', () => {
    const result = parseCanvas(`{
      "nodes": [
        { "id": "a", "type": "text", "text": "Hi", "x": 1.5, "y": "0", "width": 10, "height": 10, "color": "#fff" }
      ]
    }`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.errors.map((error) => error.path)
      expect(paths).toContain('nodes[0].x')
      expect(paths).toContain('nodes[0].y')
      expect(paths).toContain('nodes[0].color')
    }
  })

  test('accepts negative coordinates, preset colors, and #RRGGBB', () => {
    const result = validateCanvas({
      nodes: [
        { id: 'a', type: 'text', text: '', x: -20, y: 0, width: 0, height: -4, color: '1' },
        { id: 'b', type: 'link', url: 'https://jsoncanvas.org/', x: 0, y: 0, width: 8, height: 8, color: '#A1B2C3' },
      ],
    })
    expect(result.ok).toBe(true)
  })

  test('checks type-specific fields', () => {
    const file = validateCanvas({
      nodes: [{ id: 'a', type: 'file', file: 'a.md', subpath: 'heading', x: 0, y: 0, width: 1, height: 1 }],
    })
    expect(file.ok).toBe(false)
    const text = validateCanvas({
      nodes: [{ id: 'a', type: 'text', text: 'Hi', file: 'nope.md', x: 0, y: 0, width: 1, height: 1 }],
    })
    expect(text.ok).toBe(false)
    const group = validateCanvas({
      nodes: [{ id: 'a', type: 'group', backgroundStyle: 'stretch', x: 0, y: 0, width: 1, height: 1 }],
    })
    expect(group.ok).toBe(false)
    const ok = validateCanvas({
      nodes: [{
        id: 'a',
        type: 'group',
        label: 'Lane',
        background: 'textures/linen.png',
        backgroundStyle: 'repeat',
        x: 0,
        y: 0,
        width: 20,
        height: 20,
      }],
    })
    expect(ok.ok).toBe(true)
  })

  test('checks edge endpoints, sides, ends, and duplicate ids', () => {
    const result = validateCanvas({
      nodes: [{ id: 'a', type: 'text', text: 'A', x: 0, y: 0, width: 1, height: 1 }],
      edges: [
        { id: 'e', fromNode: 'missing', toNode: 'a', fromSide: 'middle', toEnd: 'dot' },
        { id: 'e', fromNode: 'a', toNode: 'a' },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const messages = result.errors.map((error) => `${error.path}: ${error.message}`).join('\n')
      expect(messages).toContain('unknown node')
      expect(messages).toContain('fromSide')
      expect(messages).toContain('toEnd')
      expect(messages).toContain('Duplicate id')
    }
  })

  test('keeps explicit defaults and omits nothing the file included', () => {
    const result = validateCanvas({
      nodes: [{ id: 'a', type: 'text', text: 'A', x: 1, y: 2, width: 3, height: 4 }],
      edges: [{ id: 'e', fromNode: 'a', toNode: 'a', fromEnd: 'none', toEnd: 'arrow', label: '' }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.edges?.[0]).toEqual({
        id: 'e',
        fromNode: 'a',
        fromEnd: 'none',
        toNode: 'a',
        toEnd: 'arrow',
        label: '',
      })
    }
  })

  test('reports invalid JSON', () => {
    const result = parseCanvas('{')
    expect(result.ok).toBe(false)
  })
})

describe('document helpers', () => {
  test('moveNode reorders the nodes array', () => {
    const start = examples.flowchart
    const forward = moveNode(start, 'start', 'forward')
    expect(forward.nodes?.map((node) => node.id)[0]).toBe('draft')
    expect(forward.nodes?.map((node) => node.id)[1]).toBe('start')
    const front = moveNode(start, 'start', 'front')
    expect(front.nodes?.at(-1)?.id).toBe('start')
    const back = moveNode(front, 'start', 'back')
    expect(back.nodes?.[0]?.id).toBe('start')
  })

  test('inferSides picks the dominant axis', () => {
    const from = { id: 'a', type: 'text' as const, text: '', x: 0, y: 0, width: 100, height: 40 }
    const to = { id: 'b', type: 'text' as const, text: '', x: 300, y: 10, width: 100, height: 40 }
    expect(inferSides(from, to)).toEqual({ fromSide: 'right', toSide: 'left' })
  })
})
