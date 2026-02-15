import { common, createLowlight } from 'lowlight';
import { refractor } from 'refractor/all';
import { ReactNode, Fragment } from 'react';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Nodes, Root, Element, Text, Comment, Doctype } from 'hast';
import { map } from 'unist-util-map';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

/**
 * Maps standard highlighting classes to Prism-compatible token classes.
 * These mappings ensure that Highlight.js (lowlight) classes are translated
 * to the classes expected by the Prism-based theme.css.
 */
const mapToPrismClass = (className: string): string => {
  const c = className.replace(/^hljs-/, '');
  switch (c) {
    case 'attr':
      return 'attr-name';
    case 'params':
      return 'parameter';
    case 'class':
      return 'class-name';
    case 'title':
      return 'function';
    case 'meta':
      return 'atrule';
    case 'template-tag':
      return 'tag';
    case 'template-variable':
      return 'variable';
    case 'addition':
      return 'inserted';
    case 'deletion':
      return 'deleted';
    case 'regexp':
      return 'regex';
    case 'literal':
      return 'boolean';
    case 'name':
      return 'tag';
    case 'bullet':
      return 'punctuation';
    case 'code':
      return 'code-snippet';
    case 'quote':
      return 'blockquote';
    case 'section':
      return 'title';
    default:
      return c;
  }
};

/**
 * Converts HAST nodes to React elements using hast-util-to-jsx-runtime
 * This is more performant and robust than manual conversion.
 */
export const renderHast = (nodes: Nodes | Nodes[], usePrismClasses = false): ReactNode => {
  let root: Root = Array.isArray(nodes)
    ? { type: 'root', children: nodes as (Element | Text | Comment | Doctype)[] }
    : nodes.type === 'root'
      ? (nodes as Root)
      : { type: 'root', children: [nodes as Element | Text | Comment | Doctype] };

  if (usePrismClasses) {
    root = map(root, (node) => {
      if (node.type === 'element') {
        const element = node as Element;
        const classes = (element.properties?.className as string[]) || [];
        if (classes.length > 0) {
          const mappedClasses = classes.flatMap((c) => {
            const prismClass = mapToPrismClass(c);
            // If the class is already 'token', don't duplicate it
            if (prismClass === 'token') {
              return ['token'];
            }
            return ['token', prismClass];
          });

          return {
            ...element,
            properties: {
              ...element.properties,
              className: Array.from(new Set(mappedClasses)),
            },
          };
        }
      }
      return node;
    }) as Root;
  }

  return toJsxRuntime(root, {
    Fragment,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jsx: jsx as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jsxs: jsxs as any,
    development: false,
  });
};

/**
 * Highlights code using lowlight (best for auto-detection)
 */
export const highlightWithLowlight = (code: string, language?: string): ReactNode => {
  try {
    if (language && lowlight.registered(language)) {
      return renderHast(lowlight.highlight(language, code), true);
    }
    // Fallback to auto-detection
    const result = lowlight.highlightAuto(code);
    return renderHast(result, true);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Lowlight highlighting failed:', error);
    return code;
  }
};

/**
 * Highlights code using refractor (best for diffs/Prism compatibility)
 */
export const highlightWithRefractor = (code: string, language: string): ReactNode => {
  try {
    // refractor.highlight returns a Root node
    const root = refractor.highlight(code, language);
    return renderHast(root, true);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Refractor highlighting failed:', error);
    return code;
  }
};

export { lowlight, refractor };
