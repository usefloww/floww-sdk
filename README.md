# Floww SDK

SDK for building trigger-based workflows with dynamic TypeScript code execution.

## Features

- **Dynamic Code Execution**: Execute TypeScript code at runtime with full module support
- **Virtual File System**: Multi-file projects with import/export resolution
- **TypeScript Support**: Full TypeScript transpilation with type checking
- **Error Handling**: Meaningful stack traces with original file references
- **Async/Await**: Full Promise support for asynchronous operations
- **JSON Imports**: Native support for importing JSON configuration files

## Installation

### From GitHub Package Registry

```bash
# Configure npm to use GitHub Package Registry for @floww scope
echo "@floww:registry=https://npm.pkg.github.com" >> .npmrc

# Install the package
npm install @floww/sdk
```

### Authentication

For private repositories, you'll need a GitHub Personal Access Token:

```bash
# Create .npmrc in your project root
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc
```

## Usage

### Basic Example

```typescript
import { executeUserProject } from '@floww/sdk';

const files = {
  "main.ts": `
    import { add } from "./utils";
    export const handler = () => {
      return add(1, 2);
    }
  `,
  "utils.ts": "export const add = (a: number, b: number) => a + b;"
};

const result = await executeUserProject({
  files,
  entryPoint: "main.handler"
});

console.log(result); // 3
```

### Multi-file Project

```typescript
const files = {
  "src/index.ts": `
    import { Calculator } from "./math/calculator";
    import config from "./config.json";

    export const handler = async () => {
      const calc = new Calculator();
      return calc.multiply(config.baseValue, 5);
    }
  `,
  "src/math/calculator.ts": `
    export class Calculator {
      multiply(a: number, b: number): number {
        return a * b;
      }
    }
  `,
  "src/config.json": `{
    "baseValue": 10
  }`
};

const result = await executeUserProject({
  files,
  entryPoint: "src/index.handler"
});
```

### Async Operations

```typescript
const files = {
  "async-main.ts": `
    export const handler = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return "async complete";
    }
  `
};

const result = await executeUserProject({
  files,
  entryPoint: "async-main.handler"
});
```

## Publishing Strategy

This package uses different versioning strategies based on the branch:

- **`main` branch**: Patch versions (1.0.1, 1.0.2, etc.)
- **`develop` branch**: Alpha prereleases (1.0.1-alpha.1, etc.)
- **`feature/*` branches**: Beta prereleases (1.0.1-beta.1, etc.) with branch-specific package names
- **Other branches**: RC prereleases (1.0.1-rc.1, etc.)

### Installing Different Versions

```bash
# Latest stable release
npm install @floww/sdk

# Alpha version from develop branch
npm install @floww/sdk@alpha

# Beta version from feature branch
npm install @floww/sdk@beta

# Specific feature branch
npm install @floww/sdk-feature-new-feature@beta
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm run test:ci

# Build package
pnpm run build

# Run in development mode
pnpm run dev
```

## API Reference

### `executeUserProject(options)`

Executes a TypeScript project in a virtual environment.

#### Parameters

- `options.files`: Record<string, string> - Object mapping file paths to their content
- `options.entryPoint`: string - Entry point in format "filename.exportName" or just "filename"

#### Returns

Promise<any> - The result of executing the entry point function

#### Example Entry Points

```typescript
// For: export const handler = () => {...}
entryPoint: "main.handler"

// For: export default function() {...}
entryPoint: "main"

// For: module.exports = function() {...}
entryPoint: "index"
```

## License

ISC

