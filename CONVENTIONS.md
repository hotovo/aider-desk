- when creating Props type for a component, always use `type Props`
- do not use React.FC for components as type, if needed use `{}: Props` as argument. Example:
- do not add `import React from 'react';`

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
