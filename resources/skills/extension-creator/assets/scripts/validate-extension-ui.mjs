#!/usr/bin/env node
/**
 * validate-extension-ui.mjs — validates AiderDesk extension UI components (.jsx files)
 *
 * Performs two checks per file:
 *   1. SYNTAX — runs the exact Sucrase transform the app uses at runtime
 *      (packages/common/src/jsx-transpiler.ts), so anything that would fail
 *      to render is caught here.
 *   2. TYPES — compiles the template with the TypeScript compiler API against
 *      the real runtime props contract (props, ui, icons, executeExtensionAction,
 *      config/updateConfig, ...), catching typos and bad prop usage statically.
 *
 * Usage:
 *   node validate-extension-ui.mjs <file-or-dir> [...] [options]
 *
 * Options:
 *   --type=ui|config|auto   Component kind (default: auto — files named
 *                           Config*.jsx/tsx are treated as config components)
 *   --no-types              Skip the TypeScript check (syntax only)
 *   --no-sucrase            Skip the runtime-transform syntax check
 *   -h, --help              Show this help
 *
 * Exit codes: 0 = all files valid, 1 = at least one failure, 2 = usage/environment error
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const SCRIPT_NAME = 'validate-extension-ui.mjs';
const JSX_EXTENSIONS = ['.jsx', '.tsx'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', '__tests__']);

const printHelp = () => {
  console.log(`Usage: node ${SCRIPT_NAME} <file-or-dir> [...] [options]

Options:
  --type=ui|config|auto   Component kind (default: auto — files named
                          Config*.jsx/tsx are treated as config components)
  --no-types              Skip the TypeScript check (syntax only)
  --no-sucrase            Skip the runtime-transform syntax check
  -h, --help              Show this help`);
};

const parseArgs = (argv) => {
  const targets = [];
  let type = 'auto';
  let runTypes = true;
  let runSucrase = true;

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith('--type=')) {
      const value = arg.slice('--type='.length);
      if (!['ui', 'config', 'auto'].includes(value)) {
        console.error(`Error: invalid --type value '${value}' (expected ui, config or auto)`);
        process.exit(2);
      }
      type = value;
    } else if (arg === '--no-types') {
      runTypes = false;
    } else if (arg === '--no-sucrase') {
      runSucrase = false;
    } else if (arg.startsWith('-')) {
      console.error(`Error: unknown option '${arg}'`);
      printHelp();
      process.exit(2);
    } else {
      targets.push(arg);
    }
  }

  return { targets, type, runTypes, runSucrase };
};

const loadOptional = (loader) => {
  try {
    return loader();
  } catch {
    return undefined;
  }
};

const findRepoRoot = (startDir) => {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'packages', 'common', 'src', 'types', 'common.ts'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
};

const resolveEnvironment = () => {
  const sucrase = loadOptional(() => require('sucrase'));
  const typescript = loadOptional(() => require('typescript'));
  const reactTypesPkg = loadOptional(() => require.resolve('@types/react/package.json'));
  const reactTypesDir = reactTypesPkg ? path.dirname(reactTypesPkg) : undefined;
  const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
  const commonTypesAvailable = repoRoot !== undefined && reactTypesDir !== undefined;
  return { sucrase, typescript, reactTypesDir, repoRoot, commonTypesAvailable };
};

const collectFiles = (targets) => {
  const files = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile() && JSX_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  };

  for (const target of targets) {
    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      console.error(`Error: '${target}' does not exist`);
      process.exit(2);
    }
    if (stat.isDirectory()) {
      walk(target);
    } else {
      files.push(path.resolve(target));
    }
  }

  return [...new Set(files)].sort();
};

const detectKind = (filePath, typeOverride) => {
  if (typeOverride === 'ui' || typeOverride === 'config') {
    return typeOverride;
  }
  return /^config.*\.(jsx|tsx)$/i.test(path.basename(filePath)) ? 'config' : 'ui';
};

// Mirrors packages/common/src/jsx-transpiler.ts exactly
const transpileLikeRuntime = (template, transform) => {
  const REACT_IMPORT = 'import React from "react";';
  const prepended = `${REACT_IMPORT}\nexport default ${template}`;
  const result = transform(prepended, { transforms: ['jsx', 'typescript'], production: true });
  if (result.diagnostics && result.diagnostics.length > 0) {
    const diag = result.diagnostics[0];
    const err = new Error(diag.message || 'Syntax error');
    err.loc = diag.loc;
    throw err;
  }
  return result.code;
};

const mapSucraseLocation = (loc) => {
  if (!loc || typeof loc.line !== 'number') {
    return undefined;
  }
  const templateLine = loc.line - 1;
  if (templateLine < 1) {
    return undefined;
  }
  let column = loc.column;
  if (loc.line === 2) {
    column = typeof column === 'number' ? Math.max(0, column - 'export default '.length) : column;
  }
  return { line: templateLine, column };
};

const buildPropsType = (kind, commonTypesAvailable) => {
  const typeImports = commonTypesAvailable
    ? `import type { AgentProfile, Message, Model, ProviderProfile, TaskData } from '@common/types';
import type { ApplicationAPI } from '@common/api';`
    : `type AgentProfile = any;
type Message = any;
type Model = any;
type ProviderProfile = any;
type TaskData = any;
type ApplicationAPI = any;`;

  const shared = `${typeImports}

type __AnyHandler = (...args: any[]) => any;
type __AnyComponentProps = {
  children?: any;
  onChange?: __AnyHandler;
  onClick?: __AnyHandler;
  onMouseEnter?: __AnyHandler;
  onMouseLeave?: __AnyHandler;
  onFocus?: __AnyHandler;
  onBlur?: __AnyHandler;
  onSubmit?: __AnyHandler;
  onKeyDown?: __AnyHandler;
  onKeyUp?: __AnyHandler;
  onLoad?: __AnyHandler;
  onError?: __AnyHandler;
  renderItem?: __AnyHandler;
  render?: __AnyHandler;
  [key: string]: any;
};
type __AnyComponent = React.ComponentType<__AnyComponentProps>;
type __ExecuteExtensionAction = (action: string, ...args: unknown[]) => Promise<any>;

type __UIComponents = {
  Button: __AnyComponent;
  Checkbox: __AnyComponent;
  Input: __AnyComponent;
  Select: __AnyComponent;
  TextArea: __AnyComponent;
  IconButton: __AnyComponent;
  RadioButton: __AnyComponent;
  MultiSelect: __AnyComponent;
  Slider: __AnyComponent;
  DatePicker: __AnyComponent;
  Chip: __AnyComponent;
  ModelSelector: __AnyComponent;
  Tooltip: __AnyComponent;
  LoadingOverlay: __AnyComponent;
  ConfirmDialog: __AnyComponent;
  ModalOverlayLayout: __AnyComponent;
  CodeBlock: __AnyComponent;
  ExpandableMessageBlock: __AnyComponent;
};`;

  const uiProps = `type __ComponentProps = {
  projectDir?: string;
  task?: TaskData;
  agentProfile?: AgentProfile;
  models: Model[];
  providers: ProviderProfile[];
  ui: __UIComponents;
  icons: Record<string, Record<string, any>>;
  libraries: Record<string, any>;
  activateTask?: (taskId: string) => void;
  executeExtensionAction: __ExecuteExtensionAction;
  data: any;
  api?: ApplicationAPI;
  taskId?: string;
  // index signature: extensions narrow with manual message.type checks, which TS cannot follow
  message?: Message & Record<string, any>;
  mode?: string;
  onRunPrompt?: () => void;
  onResumeTask?: () => void;
  onDeleteTask?: () => void;
  renderDefaultTaskActions?: () => React.ReactNode;
};`;

  const configProps = `type __ComponentProps = {
  extensionId: string;
  config: Record<string, any> | null;
  updateConfig: (newConfig: any) => void;
  executeExtensionAction: __ExecuteExtensionAction;
  ui: __UIComponents;
  icons: Record<string, Record<string, any>>;
  models: Model[];
  providers: ProviderProfile[];
  projectDir?: string;
  task?: TaskData;
  agentProfile?: AgentProfile;
  api?: ApplicationAPI;
};`;

  return `${shared}\n${kind === 'config' ? configProps : uiProps}\n`;
};

const typeCheckTemplate = (template, kind, env, sourceLines) => {
  const header = `import * as React from 'react';\n${buildPropsType(kind, env.commonTypesAvailable)}`;
  const footer = '\nconst __cmp: (props: __ComponentProps) => React.ReactNode = ';
  const fileContent = `${header}${footer}${template};\n`;

  const headerLineCount = header.split('\n').length + footer.split('\n').length - 1;

  const tmpDir = env.repoRoot
    ? path.join(env.repoRoot, 'node_modules', '.cache', 'aiderdesk-ext-ui-check')
    : path.join(os.tmpdir(), 'aiderdesk-ext-ui-check');
  fs.mkdirSync(tmpDir, { recursive: true });

  const hash = [...template].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const tmpFile = path.join(tmpDir, `check-${kind}-${hash.toString(36)}.tsx`);
  fs.writeFileSync(tmpFile, fileContent);

  try {
    const compilerOptions = {
      // deliberately loose: extension JSX is JavaScript at runtime, so patterns like
      // useState(null)/useState([]) must not be flagged; typos and unknown names still are
      noEmit: true,
      target: env.typescript.ScriptTarget.ES2022,
      module: env.typescript.ModuleKind.ESNext,
      moduleResolution: env.typescript.ModuleResolutionKind.Bundler,
      jsx: env.typescript.JsxEmit.ReactJSX,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      skipLibCheck: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
    };

    if (env.repoRoot) {
      compilerOptions.baseUrl = env.repoRoot;
      compilerOptions.paths = {
        '@common/*': [path.join(env.repoRoot, 'packages', 'common', 'src', '*')],
      };
    } else if (env.reactTypesDir) {
      compilerOptions.baseUrl = os.tmpdir();
      compilerOptions.paths = {
        react: [path.join(env.reactTypesDir, 'index.d.ts')],
        'react/jsx-runtime': [path.join(env.reactTypesDir, 'jsx-runtime.d.ts')],
      };
    }

    const program = env.typescript.createProgram([tmpFile], compilerOptions);
    const sourceFile = program.getSourceFile(tmpFile);
    if (!sourceFile) {
      return [{ line: 0, column: 0, message: 'Internal error: could not create TypeScript source file' }];
    }

    const diagnostics = [
      ...env.typescript.getPreEmitDiagnostics(program).filter((d) => d.file === sourceFile),
    ].filter((d) => {
      const message = env.typescript.flattenDiagnosticMessageText(d.messageText, ' ');
      // skip "Property 'x' does not exist on type '{ ... }'" — anonymous object literals come from
      // spreads of dynamic data and local JS-style objects; extension JSX is untyped at runtime
      if (d.code === 2339 && /on type '\{.*\}'\.?\s*$/.test(message)) {
        return false;
      }
      // skip "Expected 1 arguments, but got 0. Did you forget 'void' ... 'Promise'?" — calling
      // resolve() with no arguments is idiomatic JavaScript and fine at runtime
      if (d.code === 2794 && /Did you forget to include 'void' in your type argument to 'Promise'/.test(message)) {
        return false;
      }
      return true;
    });

    return diagnostics.map((diag) => {
      const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
      const line = pos.line + 2 - headerLineCount;
      const column = pos.character + 1;
      const message = env.typescript.flattenDiagnosticMessageText(diag.messageText, ' ');
      const excerpt = line >= 1 && line <= sourceLines.length ? sourceLines[line - 1].trim() : undefined;
      return { line, column, message, excerpt };
    });
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // best-effort cleanup
    }
  }
};

const formatIssue = (label, issue) => {
  const location = issue.line >= 1 ? `${issue.line}:${issue.column}` : 'line ?';
  const lines = [`  [${label}] ${location}  ${issue.message}`];
  if (issue.excerpt) {
    lines.push(`           ${issue.excerpt}`);
  }
  return lines.join('\n');
};

const displayPath = (filePath) => {
  const relative = path.relative(process.cwd(), filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : filePath;
};

const cleanSucraseMessage = (message) => {
  return message.split('\n')[0].replace(/\s*\(\d+:\d+\)\s*$/, '');
};

const validateFile = (filePath, kind, opts, env) => {
  const relative = displayPath(filePath);
  const template = fs.readFileSync(filePath, 'utf8');
  const sourceLines = template.split('\n');
  const issues = [];
  const checksRun = [];

  if (opts.runSucrase && env.sucrase) {
    checksRun.push('syntax');
    try {
      transpileLikeRuntime(template, env.sucrase.transform);
    } catch (error) {
      const mapped = mapSucraseLocation(error.loc);
      const line = mapped?.line ?? 0;
      issues.push({
        label: 'SYNTAX',
        line,
        column: mapped?.column ?? 0,
        message: cleanSucraseMessage(error.message) || 'Syntax error',
        excerpt: line >= 1 && line <= sourceLines.length ? sourceLines[line - 1].trim() : undefined,
      });
    }
  }

  if (opts.runTypes && env.typescript && env.reactTypesDir) {
    checksRun.push('types');
    for (const issue of typeCheckTemplate(template, kind, env, sourceLines)) {
      issues.push({ label: 'TYPE', ...issue });
    }
  }

  if (issues.length === 0) {
    console.log(`PASS ${relative} (${kind}) — ${checksRun.length > 0 ? checksRun.join(', ') : 'no checks'}`);
    return true;
  }

  console.log(`FAIL ${relative} (${kind})`);
  for (const issue of issues) {
    console.log(formatIssue(issue.label, issue));
  }
  return false;
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.targets.length === 0) {
    console.error('Error: no files or directories given');
    printHelp();
    process.exit(2);
  }

  const env = resolveEnvironment();
  const warnings = [];
  if (opts.runSucrase && !env.sucrase) {
    warnings.push('sucrase not resolvable — runtime syntax check skipped (run from the aider-desk repo or install sucrase)');
  }
  if (opts.runTypes && (!env.typescript || !env.reactTypesDir)) {
    warnings.push('typescript or @types/react not resolvable — type check skipped (run from the aider-desk repo or install them)');
  }
  if (opts.runTypes && env.typescript && env.reactTypesDir && !env.commonTypesAvailable) {
    warnings.push('AiderDesk common types not found — checking with permissive (any) prop types');
  }
  for (const warning of warnings) {
    console.log(`Warning: ${warning}`);
  }
  if (!opts.runTypes && !opts.runSucrase) {
    console.error('Error: both checks disabled — nothing to validate');
    process.exit(2);
  }
  if (warnings.length > 0 && !env.sucrase && (!env.typescript || !env.reactTypesDir)) {
    console.error('Error: no validator dependencies available at all — cannot validate');
    process.exit(2);
  }

  const files = collectFiles(opts.targets);
  if (files.length === 0) {
    console.error('Error: no .jsx/.tsx files found in the given targets');
    process.exit(2);
  }

  console.log(`Validating ${files.length} file(s)...\n`);
  let passed = 0;
  let failed = 0;
  for (const file of files) {
    const kind = detectKind(file, opts.type);
    if (validateFile(file, kind, opts, env)) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
};

main();
