
# Inline Citation

The `InlineCitation` component provides a way to display citations inline with text content, similar to academic papers or research documents. It consists of a citation pill that shows detailed source information on hover, making it perfect for AI-generated content that needs to reference sources.

<Preview path="inline-citation" />

## Installation

```sh
npx ai-elements@latest add inline-citation
```

## Usage

```tsx
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationSource,
  InlineCitationText,
} from '@/components/ai-elements/inline-citation';
```

```tsx
<InlineCitation>
  <InlineCitationText>{citation.text}</InlineCitationText>
  <InlineCitationCard>
    <InlineCitationCardTrigger
      sources={citation.sources.map((source) => source.url)}
    />
    <InlineCitationCardBody>
      <InlineCitationCarousel>
        <InlineCitationCarouselHeader>
          <InlineCitationCarouselIndex />
        </InlineCitationCarouselHeader>
        <InlineCitationCarouselContent>
          <InlineCitationCarouselItem>
            <InlineCitationSource
              title="AI SDK"
              url="https://ai-sdk.dev"
              description="The AI Toolkit for TypeScript"
            />
          </InlineCitationCarouselItem>
        </InlineCitationCarouselContent>
      </InlineCitationCarousel>
    </InlineCitationCardBody>
  </InlineCitationCard>
</InlineCitation>
```

## Usage with AI SDK

Build citations for AI-generated content using [`experimental_generateObject`](/docs/reference/ai-sdk-ui/use-object).

Add the following component to your frontend:

```tsx filename="app/page.tsx"
'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
  InlineCitationSource,
  InlineCitationQuote,
} from '@/components/ai-elements/inline-citation';
import { Button } from '@/components/ui/button';
import { citationSchema } from '@/app/api/citation/route';

const CitationDemo = () => {
  const { object, submit, isLoading } = useObject({
    api: '/api/citation',
    schema: citationSchema,
  });

  const handleSubmit = (topic: string) => {
    submit({ prompt: topic });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex gap-2 mb-6">
        <Button
          onClick={() => handleSubmit('artificial intelligence')}
          disabled={isLoading}
          variant="outline"
        >
          Generate AI Content
        </Button>
        <Button
          onClick={() => handleSubmit('climate change')}
          disabled={isLoading}
          variant="outline"
        >
          Generate Climate Content
        </Button>
      </div>

      {isLoading && !object && (
        <div className="text-muted-foreground">
          Generating content with citations...
        </div>
      )}

      {object?.content && (
        <div className="prose prose-sm max-w-none">
          <p className="leading-relaxed">
            {object.content.split(/(\[\d+\])/).map((part, index) => {
              const citationMatch = part.match(/\[(\d+)\]/);
              if (citationMatch) {
                const citationNumber = citationMatch[1];
                const citation = object.citations?.find(
                  (c: any) => c.number === citationNumber,
                );

                if (citation) {
                  return (
                    <InlineCitation key={index}>
                      <InlineCitationCard>
                        <InlineCitationCardTrigger sources={[citation.url]} />
                        <InlineCitationCardBody>
                          <InlineCitationCarousel>
                            <InlineCitationCarouselHeader>
                              <InlineCitationCarouselPrev />
                              <InlineCitationCarouselNext />
                              <InlineCitationCarouselIndex />
                            </InlineCitationCarouselHeader>
                            <InlineCitationCarouselContent>
                              <InlineCitationCarouselItem>
                                <InlineCitationSource
                                  title={citation.title}
                                  url={citation.url}
                                  description={citation.description}
                                />
                                {citation.quote && (
                                  <InlineCitationQuote>
                                    {citation.quote}
                                  </InlineCitationQuote>
                                )}
                              </InlineCitationCarouselItem>
                            </InlineCitationCarouselContent>
                          </InlineCitationCarousel>
                        </InlineCitationCardBody>
                      </InlineCitationCard>
                    </InlineCitation>
                  );
                }
              }
              return part;
            })}
          </p>
        </div>
      )}
    </div>
  );
};

export default CitationDemo;
```

Add the following route to your backend:

```ts filename="app/api/citation/route.ts"
import { streamObject } from 'ai';
import { z } from 'zod';

export const citationSchema = z.object({
  content: z.string(),
  citations: z.array(
    z.object({
      number: z.string(),
      title: z.string(),
      url: z.string(),
      description: z.string().optional(),
      quote: z.string().optional(),
    }),
  ),
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = streamObject({
    model: 'openai/gpt-4o',
    schema: citationSchema,
    prompt: `Generate a well-researched paragraph about ${prompt} with proper citations. 
    
    Include:
    - A comprehensive paragraph with inline citations marked as [1], [2], etc.
    - 2-3 citations with realistic source information
    - Each citation should have a title, URL, and optional description/quote
    - Make the content informative and the sources credible
    
    Format citations as numbered references within the text.`,
  });

  return result.toTextStreamResponse();
}
```

## Features

- Hover interaction to reveal detailed citation information
- **Carousel navigation** for multiple citations with prev/next controls
- **Live index tracking** showing current slide position (e.g., "1/5")
- Support for source titles, URLs, and descriptions
- Optional quote blocks for relevant excerpts
- Composable architecture for flexible citation formats
- Accessible design with proper keyboard navigation
- Seamless integration with AI-generated content
- Clean visual design that doesn't disrupt reading flow
- Smart badge display showing source hostname and count

## Props

### `<InlineCitation />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<"span">',
      description: 'Any other props are spread to the root span element.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationText />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<"span">',
      description: 'Any other props are spread to the underlying span element.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCard />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<"span">',
      description: 'Any other props are spread to the HoverCard component.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCardTrigger />`

<PropertiesTable
  content={[
    {
      name: 'sources',
      type: 'string[]',
      description:
        'Array of source URLs. The length determines the number displayed in the badge.',
      isOptional: false,
    },
    {
      name: '[...props]',
      type: 'React.ComponentProps<"button">',
      description:
        'Any other props are spread to the underlying button element.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCardBody />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<"div">',
      description: 'Any other props are spread to the underlying div.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCarousel />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<typeof Carousel>',
      description:
        'Any other props are spread to the underlying Carousel component.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCarouselContent />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<"div">',
      description:
        'Any other props are spread to the underlying CarouselContent component.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCarouselItem />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<"div">',
      description: 'Any other props are spread to the underlying div.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCarouselHeader />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<"div">',
      description: 'Any other props are spread to the underlying div.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCarouselIndex />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<"div">',
      description:
        'Any other props are spread to the underlying div. Children will override the default index display.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCarouselPrev />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<typeof CarouselPrevious>',
      description:
        'Any other props are spread to the underlying CarouselPrevious component.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationCarouselNext />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<typeof CarouselNext>',
      description:
        'Any other props are spread to the underlying CarouselNext component.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationSource />`

<PropertiesTable
  content={[
    {
      name: 'title',
      type: 'string',
      description: 'The title of the source.',
      isOptional: true,
    },
    {
      name: 'url',
      type: 'string',
      description: 'The URL of the source.',
      isOptional: true,
    },
    {
      name: 'description',
      type: 'string',
      description: 'A brief description of the source.',
      isOptional: true,
    },
    {
      name: '[...props]',
      type: 'React.ComponentProps<"div">',
      description: 'Any other props are spread to the underlying div.',
      isOptional: true,
    },
  ]}
/>

### `<InlineCitationQuote />`

<PropertiesTable
  content={[
    {
      name: '[...props]',
      type: 'React.ComponentProps<"blockquote">',
      description:
        'Any other props are spread to the underlying blockquote element.',
      isOptional: true,
    },
  ]}
/>
