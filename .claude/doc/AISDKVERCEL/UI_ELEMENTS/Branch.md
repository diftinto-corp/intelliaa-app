
# Branch

The `Branch` component manages multiple versions of AI messages, allowing users to navigate between different response branches. It provides a clean, modern interface with customizable themes and keyboard-accessible navigation buttons.

<Preview path="branch" />

## Installation

```sh
npx ai-elements@latest add branch
```

## Usage

```tsx
import {
  Branch,
  BranchMessages,
  BranchNext,
  BranchPage,
  BranchPrevious,
  BranchSelector,
} from '@/components/ai-elements/branch';
```

```tsx
<Branch defaultBranch={0}>
  <BranchMessages>
    <Message from="user">
      <MessageContent>Hello</MessageContent>
    </Message>
    <Message from="user">
      <MessageContent>Hi!</MessageContent>
    </Message>
  </BranchMessages>
  <BranchSelector from="user">
    <BranchPrevious />
    <BranchPage />
    <BranchNext />
  </BranchSelector>
</Branch>
```

## Usage with AI SDK

<Note>
  Branching is an advanced use case that you can implement yourself to suit your
  application's needs. While the AI SDK does not provide built-in support for
  branching, you have full flexibility to design and manage multiple response
  paths as required.
</Note>

## Features

- Context-based state management for multiple message branches
- Navigation controls for moving between branches (previous/next)
- Uses CSS to prevent re-rendering of branches when switching
- Branch counter showing current position (e.g., "1 of 3")
- Automatic branch tracking and synchronization
- Callbacks for branch change and navigation using `onBranchChange`
- Support for custom branch change callbacks
- Responsive design with mobile-friendly controls
- Clean, modern styling with customizable themes
- Keyboard-accessible navigation buttons

## Props

### `<Branch />`

<PropertiesTable
  content={[
    {
      name: 'defaultBranch',
      type: 'number',
      description: 'The index of the branch to show by default (default: 0).',
      isOptional: true,
    },
    {
      name: 'onBranchChange',
      type: '(branchIndex: number) => void',
      description: 'Callback fired when the branch changes.',
      isOptional: true,
    },
    {
      name: '[...props]',
      type: 'React.HTMLAttributes<HTMLDivElement>',
      description: 'Any other props are spread to the root div.',
    },
  ]}
/>

### `<BranchMessages />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.HTMLAttributes<HTMLDivElement>',
      description: 'Any other props are spread to the root div.',
    },
  ]}
/>

### `<BranchSelector />`

<PropertiesTable
  content={[
    {
      name: 'from',
      type: 'UIMessage["role"]',
      description:
        'Aligns the selector for user, assistant or system messages.',
    },
    {
      name: '[...props]',
      type: 'React.HTMLAttributes<HTMLDivElement>',
      description: 'Any other props are spread to the selector container.',
    },
  ]}
/>

### `<BranchPrevious />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<typeof Button>',
      description:
        'Any other props are spread to the underlying shadcn/ui Button component.',
    },
  ]}
/>

### `<BranchNext />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<typeof Button>',
      description:
        'Any other props are spread to the underlying shadcn/ui Button component.',
    },
  ]}
/>

### `<BranchPage />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.HTMLAttributes<HTMLSpanElement>',
      description: 'Any other props are spread to the underlying span element.',
    },
  ]}
/>
