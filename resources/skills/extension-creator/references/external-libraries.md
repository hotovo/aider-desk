# External Libraries in UI Components

Extensions can load third-party npm packages and use them in their UI component JSX. This is useful when you need a rich component library (e.g., charts, kanban boards, calendars) that isn't available through the built-in `ui` prop.

## How It Works

1. **Declare** — Implement `getUIComponentsLibraries()` returning a map of arbitrary keys to npm package specs.
2. **Resolve** — AiderDesk resolves each package via [esm.sh](https://esm.sh) (React and React-DOM are externalized to avoid duplicate instances). Resolved sources are cached to `~/.aider-desk/cache/extension-libraries/` for offline reuse.
3. **Access** — Resolved libraries are passed to your JSX as `props.libraries.<key>`.

## Declaring Libraries

```typescript
getUIComponentsLibraries(): Record<string, string> {
  return {
    chart: 'recharts@^2.12.0',
    lodash: 'lodash@^4.17.0',
  };
}
```

- **Key** — camelCase identifier you'll use to access the library in JSX (e.g., `props.libraries.chart`).
- **Value** — npm package name with a semver range, exactly as you'd list it in `package.json` (e.g., `'recharts@^2.12.0'`).

## Accessing in JSX

Libraries arrive as `props.libraries.<key>`. Each value is the module's resolved exports — you can destructure named exports or use the default:

```jsx
(props) => {
  var chartLib = props.libraries.chart;
  if (!chartLib) return <span>Loading chart library…</span>;

  var LineChart = chartLib.LineChart;
  var Line = chartLib.Line;
  // ... use them
}
```

## Loading State

Libraries are loaded asynchronously. On first render `props.libraries.<key>` will be `undefined`. Always check for availability before using a library:

```jsx
(props) => {
  var chartLib = props.libraries.chart;

  if (!chartLib) {
    return <span className="text-text-secondary text-sm">Loading…</span>;
  }

  var LineChart = chartLib.LineChart;
  return <LineChart data={props.data} />;
}
```

If you want to show an error after a timeout, use `useEffect` with a flag:

```jsx
(props) => {
  var useState = React.useState;
  var useEffect = React.useEffect;
  var chartLib = props.libraries.chart;

  var _e = useState(false);
  var loadError = _e[0];
  var setLoadError = _e[1];

  useEffect(function () {
    if (!chartLib && !loadError) {
      var t = setTimeout(function () { setLoadError(true); }, 15000);
      return function () { clearTimeout(t); };
    }
    setLoadError(false);
  }, [chartLib, loadError]);

  if (loadError && !chartLib) {
    return <span className="text-red-400 text-sm">Failed to load library.</span>;
  }
  if (!chartLib) {
    return <span className="text-text-secondary text-sm">Loading…</span>;
  }

  var LineChart = chartLib.LineChart;
  return <LineChart data={props.data} />;
}
```

## Important Notes

- **React is externalized** — AiderDesk's React instance is used automatically. Never bundle or import React inside the library spec; it is already available globally. The esm.sh resolution uses `?external=react,react-dom,react/jsx-runtime,react/jsx-dev-runtime` to prevent duplicate React instances.
- **Internet required on first load** — Libraries are fetched from esm.sh on first use, then cached to disk. Subsequent loads work offline.
- **Single-file extensions** — `getUIComponentsLibraries()` works in both single-file and folder extensions.
- **Key naming** — Use camelCase keys. A key like `chart` becomes `props.libraries.chart`. Avoid dots or special characters in keys.
- **Multiple libraries** — You can declare as many libraries as needed. Each is loaded independently.

## Minimal Example

```typescript
// chart-demo.ts
import type { Extension, ExtensionContext, UIComponentDefinition } from '@aiderdesk/extensions';

const chartJsx = `
(props) => {
  var chartLib = props.libraries.chart;
  var Button = props.ui.Button;

  if (!chartLib) {
    return <span className="text-text-secondary text-xs">Loading chart…</span>;
  }

  var PieChart = chartLib.PieChart;
  var Pie = chartLib.Pie;

  var data = [
    { name: 'A', value: 40 },
    { name: 'B', value: 60 },
  ];

  return (
    <div className="p-2">
      <PieChart width={200} height={200}>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} />
      </PieChart>
    </div>
  );
}
`;

export default class ChartDemoExtension implements Extension {
  static metadata = {
    name: 'Chart Demo',
    version: '1.0.0',
    description: 'Demonstrates loading a third-party npm library (recharts) in an extension',
    author: 'my_git_name',
    capabilities: ['ui', 'example'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Chart Demo loaded', 'info');
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    return [
      {
        id: 'chart-demo',
        placement: 'task-status-bar-left',
        jsx: chartJsx,
      },
    ];
  }

  getUIComponentsLibraries(): Record<string, string> {
    return {
      chart: 'recharts@^2.12.0',
    };
  }
}
```
