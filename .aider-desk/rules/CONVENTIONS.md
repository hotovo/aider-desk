## Coding Best Practices
- Do not add comments to the code you write, unless the user asks you to, or the code is complex and requires additional context.
- When making changes to files, first understand the file's code conventions. Mimic code style, use existing libraries and utilities, and follow existing patterns.
- NEVER assume that a given library is available, even if it is well known. Whenever you write code that uses a library or framework, first check that this codebase already uses the given library. For example, you might look at neighboring files, or check the package.json (or cargo.toml, and so on depending on the language).
- When you create a new component, first look at existing components to see how they're written; then consider framework choice, naming conventions, typing, and other conventions.
- When you edit a piece of code, first look at the code's surrounding context (especially its imports) to understand the code's choice of frameworks and libraries. Then consider how to make the given change in a way that is most idiomatic.
- when creating Props type for a component, always use `type Props`
- do not add `import React from 'react';`
- do not use React.FC for components as type, if needed use `{}: Props` as argument. Example:
```tsx
// bad
const MyComponent: React.FC<Props> = () => {
  return <div>Hello</div>;
};

// good
const MyComponent = ({value}: Props) => {
  return <div>Hello</div>;
};
```

- when using setting function prop for a component always extract it to a separate function. Example:

```tsx
// bad
const MyComponent = ({value}: Props) => {
  return <div onClick={(e) => console.log(e)}>Hello</div>;
};

// good
const MyComponent = ({value}: Props) => {
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    console.log(e);
  };

  return <div onClick={handleClick}>Hello</div>;
};
```

- when using Event types from React, always import them and use them directly. Example:

```tsx
// bad
const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
  ...
};

// good
import { MouseEvent } from 'react';
...
const handleClick = (e: MouseEvent<HTMLDivElement>) => {
  ...
};
```

- when using icons use 'react-icons' library
- always use arrow functions, when possible
- prefer TypeScript enums over string literal unions when defining a set of related constants. This improves type safety and code clarity. Example:

```typescript
// bad
type Status = 'pending' | 'processing' | 'completed' | 'failed';

// also bad - using the union directly
interface Task {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// good
enum Status {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}
```

- when adding some strings to the UI component, always use i18n library and update the translation files: src/common/locales/en.json and src/common/locales/zh.json
- only add comments that are beneficial and describe some functionality
- use `clsx` library for conditional classes - `import { clsx } from 'clsx';`
