
# WebPreview

The `WebPreview` component provides a flexible way to showcase the result of a generated UI component, along with its source code. It is designed for documentation and demo purposes, allowing users to interact with live examples and view the underlying implementation.

<Preview path="web-preview" />

## Installation

```sh
npx ai-elements@latest add web-preview
```

## Usage

```tsx
import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
} from '@/components/ai-elements/web-preview';
```

```tsx
<WebPreview defaultUrl="https://ai-sdk.dev" style={{ height: '400px' }}>
  <WebPreviewNavigation>
    <WebPreviewUrl src="https://ai-sdk.dev" />
  </WebPreviewNavigation>
  <WebPreviewBody src="https://ai-sdk.dev" />
</WebPreview>
```

## Usage with AI SDK

Build a simple v0 clone using the [v0 Platform API](https://v0.dev/docs/api/platform).

Install the `v0-sdk` package:

<div className="my-4">
  <Tabs items={['pnpm', 'npm', 'yarn']}>
    <Tab>
      <Snippet text="pnpm add v0-sdk" dark />
    </Tab>
    <Tab>
      <Snippet text="npm install v0-sdk" dark />
    </Tab>
    <Tab>
      <Snippet text="yarn add v0-sdk" dark />
    </Tab>
  </Tabs>
</div>

Add the following component to your frontend:

```tsx filename="app/page.tsx"
'use client';

import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewUrl,
} from '@/components/ai-elements/web-preview';
import { useState } from 'react';
import {
  Input,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import { Loader } from '../ai-elements/loader';

const WebPreviewDemo = () => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setPrompt('');

    setIsGenerating(true);
    try {
      const response = await fetch('/api/v0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      setPreviewUrl(data.demo || '/');
      console.log('Generation finished:', data);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full rounded-lg border h-[600px]">
      <div className="flex flex-col h-full">
        <div className="flex-1 mb-4">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader />
              <p className="mt-4 text-muted-foreground">
                Generating app, this may take a few seconds...
              </p>
            </div>
          ) : previewUrl ? (
            <WebPreview defaultUrl={previewUrl}>
              <WebPreviewNavigation>
                <WebPreviewUrl />
              </WebPreviewNavigation>
              <WebPreviewBody src={previewUrl} />
            </WebPreview>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Your generated app will appear here
            </div>
          )}
        </div>

        <Input
          onSubmit={handleSubmit}
          className="w-full max-w-2xl mx-auto relative"
        >
          <PromptInputTextarea
            value={prompt}
            placeholder="Describe the app you want to build..."
            onChange={(e) => setPrompt(e.currentTarget.value)}
            className="pr-12 min-h-[60px]"
          />
          <PromptInputSubmit
            status={isGenerating ? 'streaming' : 'ready'}
            disabled={!prompt.trim()}
            className="absolute bottom-1 right-1"
          />
        </Input>
      </div>
    </div>
  );
};

export default WebPreviewDemo;
```

Add the following route to your backend:

```ts filename="app/api/v0/route.ts"
import { v0 } from 'v0-sdk';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const result = await v0.chats.create({
    system: 'You are an expert coder',
    message: prompt,
    modelConfiguration: {
      modelId: 'v0-1.5-sm',
      imageGenerations: false,
      thinking: false,
    },
  });

  return Response.json({
    demo: result.demo,
    webUrl: result.webUrl,
  });
}
```

## Features

- Live preview of UI components
- Composable architecture with dedicated sub-components
- Responsive design modes (Desktop, Tablet, Mobile)
- Navigation controls with back/forward functionality
- URL input and example selector
- Full screen mode support
- Console logging with timestamps
- Context-based state management
- Consistent styling with the design system
- Easy integration into documentation pages

## Props

### `<WebPreview />`

<PropertiesTable
  content={[
    {
      name: 'defaultUrl',
      type: 'string',
      description:
        'The initial URL to load in the preview (default: empty string).',
      isOptional: true,
    },
    {
      name: 'onUrlChange',
      type: '(url: string) => void',
      description: 'Callback fired when the URL changes.',
      isOptional: true,
    },
    {
      name: '[...props]',
      type: 'React.HTMLAttributes<HTMLDivElement>',
      description: 'Any other props are spread to the root div.',
      isOptional: true,
    },
  ]}
/>

### `<WebPreviewNavigation />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.HTMLAttributes<HTMLDivElement>',
      description: 'Any other props are spread to the navigation container.',
      isOptional: true,
    },
  ]}
/>

### `<WebPreviewNavigationButton />`

<PropertiesTable
  content={[
    {
      name: 'tooltip',
      type: 'string',
      description: 'Tooltip text to display on hover.',
      isOptional: true,
    },
    {
      name: '[...props]',
      type: 'React.ComponentProps<typeof Button>',
      description:
        'Any other props are spread to the underlying shadcn/ui Button component.',
      isOptional: true,
    },
  ]}
/>

### `<WebPreviewUrl />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<typeof Input>',
      description:
        'Any other props are spread to the underlying shadcn/ui Input component.',
      isOptional: true,
    },
  ]}
/>

### `<WebPreviewBody />`

<PropertiesTable
  content={[
    {
      name: 'loading',
      type: 'React.ReactNode',
      description: 'Optional loading indicator to display over the preview.',
      isOptional: true,
    },
    {
      name: '[...props]',
      type: 'React.IframeHTMLAttributes<HTMLIFrameElement>',
      description: 'Any other props are spread to the underlying iframe.',
      isOptional: true,
    },
  ]}
/>

### `<WebPreviewConsole />`

<PropertiesTable
  content={[
    {
      name: 'logs',
      type: 'Array<{ level: "log" | "warn" | "error"; message: string; timestamp: Date }>',
      description: 'Console log entries to display in the console panel.',
      isOptional: true,
    },
    {
      name: '[...props]',
      type: 'React.HTMLAttributes<HTMLDivElement>',
      description: 'Any other props are spread to the root div.',
      isOptional: true,
    },
  ]}
/>
