# INT-33: User Guide - Onboarding Experience

**Feature**: First-Time User Onboarding
**Audience**: End Users, Product Managers, Support Team
**Last Updated**: 2025-01-09

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Creating Your First Assistant](#creating-your-first-assistant)
4. [Assistant Types](#assistant-types)
5. [Quick Start Guide](#quick-start-guide)
6. [Post-Onboarding Workflows](#post-onboarding-workflows)
7. [Troubleshooting](#troubleshooting)
8. [FAQs](#faqs)

---

## Overview

### What is the Onboarding Experience?

The onboarding experience is a guided interface that helps new users create their first AI assistant in IntelliAA. It appears automatically when you first access the Assistants page with zero existing assistants.

### Key Features

- **Visual Introduction**: Eye-catching illustration with animated elements
- **Three Assistant Types**: Voice, WhatsApp, and Web (coming soon)
- **Template Selection**: Choose from pre-configured templates
- **Quick Start Guide**: 4-step tutorial for getting started
- **One-Click Creation**: Streamlined process to create your first assistant

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

1. ✅ A registered IntelliAA account
2. ✅ Access to an account (personal or team)
3. ✅ Verified email address
4. ✅ Internet connection

### Accessing the Onboarding

1. **Log in** to your IntelliAA account
2. **Navigate** to `[Your Account] > Assistants` from the sidebar
3. If you have **zero assistants**, the onboarding screen displays automatically

**Example URL**:
```
https://app.intelliaa.com/my-company/assistants
```

---

## Creating Your First Assistant

### Step-by-Step Guide

#### Step 1: Choose Your Assistant Type

You'll see three cards representing different assistant types:

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│   📞 Asistente de Voz   │  💬 Asistente WhatsApp  │   🌐 Asistente Web      │
│       [Popular]         │         [New]           │    [Próximamente]       │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Voice synthesis       │ • 24/7 auto-replies     │ • Embeddable widget     │
│ • Spanish support       │ • Multimedia handling   │ • Multi-language        │
│ • Emotion recognition   │ • Railway integration   │ • Real-time analytics   │
│ • Real-time transcript  │ • QR code linking       │ • REST APIs             │
│ • Call routing          │ • Cloud deployment      │ • Webhooks              │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

**Click** on the card for the assistant type you want to create.

> **Note**: Web assistants are coming soon and cannot be created yet.

---

#### Step 2: Select a Template

After clicking a card, a creation dialog appears with template options:

**Template Categories**:
- **Atención al Cliente**: Customer service focused
- **Ventas**: Sales and lead generation
- **Soporte Técnico**: Technical support
- **Personalizado**: Blank template for custom configuration

**To Select**:
1. Browse available templates (thumbnails displayed)
2. **Click** on a template thumbnail to select it
3. Selected template shows a **blue border**

---

#### Step 3: Name Your Assistant

**Field**: `Nombre de asistente`

**Guidelines**:
- Use a descriptive name (e.g., "Soporte Técnico 24/7")
- Maximum 100 characters
- Required field (cannot be empty)

**Examples**:
```
✅ Good Names:
- "Ventas - Producto A"
- "Soporte WhatsApp Principal"
- "Recepción Telefónica"

❌ Avoid:
- "Test" (too generic)
- "asdf" (not descriptive)
- "" (empty)
```

---

#### Step 4: Verify Type Selection

The dialog pre-selects the type based on the card you clicked:

- Voice card → **Voz** selected
- WhatsApp card → **WhatsApp** selected

You can change the type by clicking a different icon in the "Tipos de asistentes" section.

---

#### Step 5: Create

1. **Click** the `Crear asistente` button
2. You'll see a **loading spinner** while the assistant is created
3. The system will:
   - **Voice**: Call VAPI API to create voice assistant
   - **WhatsApp**: Insert directly into Supabase database
4. On success, you're **redirected** to the assistants list

**Typical Creation Time**:
- Voice: ~2-3 seconds
- WhatsApp: ~1-2 seconds

---

## Assistant Types

### 1. Voice Assistant (Asistente de Voz) 📞

**Use Cases**:
- Inbound customer service calls
- Outbound sales calls
- Appointment reminders
- IVR systems
- Phone surveys

**Features**:
- **Voice Synthesis**: Natural-sounding voices powered by ElevenLabs
- **Transcription**: Real-time speech-to-text with Deepgram
- **Emotion Recognition**: Detects customer sentiment
- **Spanish Support**: Optimized for Spanish language
- **Call Routing**: Transfer calls to human agents

**Technology**:
- Provider: VAPI (Voice AI Platform Interface)
- TTS: ElevenLabs eleven_flash_v2_5
- STT: Deepgram nova-2-general
- LLM: OpenAI GPT-4o-mini

**Configuration Options** (after creation):
- Prompt customization
- Temperature (creativity level)
- Max tokens (response length)
- Voice selection (multiple ElevenLabs voices)
- Background sound (office, off)
- End call phrases
- Voicemail detection

---

### 2. WhatsApp Assistant (Asistente de WhatsApp) 💬

**Use Cases**:
- Customer support on WhatsApp Business
- Order notifications and updates
- FAQ automation
- Lead qualification
- Appointment booking

**Features**:
- **24/7 Availability**: Automated responses round-the-clock
- **Multimedia Support**: Handle images, documents, audio
- **QR Code Linking**: Easy WhatsApp Business account connection
- **Cloud Deployment**: Managed on Railway infrastructure
- **Message Routing**: Escalate to human agents when needed

**Technology**:
- Backend: Railway GraphQL
- Messaging: WhatsApp Business API
- LLM: OpenAI GPT-4o-mini
- Infrastructure: Buildship workflows

**Configuration Options** (after creation):
- Welcome message
- Keyword-based transfer rules
- Transfer phone number
- Knowledge base documents
- Deployment status monitoring

---

### 3. Web Assistant (Asistente Web) 🌐

**Status**: 🚧 Coming Soon

**Planned Features**:
- Embeddable chat widget
- Customizable branding
- Multi-language support
- Real-time analytics
- REST API and webhooks

**Notify Me**: Stay tuned for updates on the Web assistant launch!

---

## Quick Start Guide

### Accessing the Guide

1. On the onboarding screen, click the **"Ver Guía Rápida"** button
2. A dialog (desktop) or bottom sheet (mobile) opens with 4 steps

### The 4 Steps

#### Step 1: Choose Your Assistant Type ✨

**What to do**:
- Decide between Voice for phone calls or WhatsApp for messaging
- Consider your primary customer communication channel

**Tips**:
- Voice: Best for complex conversations, urgent issues
- WhatsApp: Best for async support, order updates, FAQs

---

#### Step 2: Configure with Template 🔧

**What to do**:
- Select a pre-designed template
- Templates are optimized for specific use cases

**Available Templates**:
- **Atención al Cliente**: General customer service
- **Ventas**: Sales conversations and lead generation
- **Soporte Técnico**: Technical troubleshooting
- **Custom**: Start from scratch

**Tips**:
- Start with a template to save time
- You can customize the prompt later

---

#### Step 3: Upload Knowledge Base 📚

**What to do** (after creation):
- Navigate to the Documents section
- Upload PDFs, manuals, or documentation
- Link documents to your assistant

**Supported Formats**:
- PDF (.pdf)
- Text (.txt)
- Markdown (.md)

**Benefits**:
- Assistant responses based on your specific business info
- Accurate answers to domain-specific questions
- Reduced hallucinations

**Tips**:
- Keep documents well-organized
- Use clear, concise language
- Update documents regularly

---

#### Step 4: Test and Deploy 🚀

**What to do**:
1. **Test** conversations with your assistant
2. **Adjust** responses if needed
3. **Deploy** to production when ready

**Voice Testing**:
- Assign a phone number
- Make test calls
- Verify call routing and voicemail

**WhatsApp Testing**:
- Scan QR code to link WhatsApp Business
- Send test messages
- Verify auto-responses

**Tips**:
- Test edge cases (rude customers, complex questions)
- Gather feedback from team members
- Monitor first 24 hours closely

---

## Post-Onboarding Workflows

### After Creating Your First Assistant

Once you create your first assistant, the onboarding screen disappears and you'll see:

```
┌─────────────────────────────────────────────────────────────┐
│  Asistentes                                        1 asistente│
│  ┌───────────────────────────────────────────────────────┐  │
│  │  [➕ Crear Asistente]                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📞 Soporte Técnico 24/7                    [Voice]  │    │
│  │ Última actualización: hace 2 minutos                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Creating Additional Assistants

1. **Click** the `Crear Asistente` button in the header
2. The same creation dialog opens (template selection, name, type)
3. Create as many assistants as you need for different use cases

**Use Case Examples**:
- **Sales Assistant**: Handles product inquiries and quotes
- **Support Assistant**: Technical troubleshooting and FAQs
- **Appointment Assistant**: Booking and reminders
- **Survey Assistant**: Customer feedback collection

---

### Managing Assistants

**Master-Detail Layout**:
```
┌─────────────────┬────────────────────────────────────────┐
│ Master Panel    │ Detail Panel                           │
│                 │                                        │
│ 📋 Asistentes   │ 📞 Soporte Técnico 24/7                │
│ ┌─────────────┐ │                                        │
│ │➕ Crear     │ │ [Tabs]                                 │
│ └─────────────┘ │ • Configuración                        │
│                 │ • Documentos                           │
│ • Asistente 1   │ • Números                              │
│ • Asistente 2   │ • Reportes                             │
│ • Asistente 3   │                                        │
└─────────────────┴────────────────────────────────────────┘
```

**Actions**:
- **Click** an assistant in the master panel to view details
- **Edit** configuration in the detail panel tabs
- **Delete** assistants from the detail panel

---

## Troubleshooting

### Issue: Onboarding Doesn't Appear

**Symptoms**:
- You navigate to `/assistants` but see the assistants list instead of onboarding

**Cause**:
- You already have one or more assistants created

**Solution**:
1. This is expected behavior! Onboarding only shows when you have **zero** assistants
2. To create more assistants, use the `Crear Asistente` button in the header

---

### Issue: "HTTP 400 Error" When Creating Voice Assistant

**Symptoms**:
```
Error: HTTP error! status: 400
VAPI API error (400): Couldn't Find 11labs Voice
```

**Cause**:
- Invalid ElevenLabs voice ID configuration

**Solution**:
1. This should be fixed in the latest version (commit `46198e9`)
2. If you still see this error, contact support
3. Admins: Check `NEXT_PRIVATE_VAPI_KEY` environment variable

---

### Issue: Templates Don't Load

**Symptoms**:
- Creation dialog opens but shows empty template section

**Cause**:
- Database connection issue or no templates in `assistants_template` table

**Solution**:
1. **Refresh** the page (Cmd+R / Ctrl+R)
2. **Check** your internet connection
3. **Contact** support if issue persists

**For Admins**:
```sql
-- Verify templates exist
SELECT COUNT(*) FROM assistants_template;
-- Should return > 0
```

---

### Issue: WhatsApp QR Code Not Generating

**Symptoms**:
- WhatsApp assistant created but no QR code appears

**Cause**:
- Railway backend deployment in progress

**Solution**:
1. **Wait** 1-2 minutes for deployment to complete
2. **Refresh** the assistant detail page
3. Check `is_deploying_ws` status (should be `false` when ready)

---

### Issue: Can't Click on Web Assistant Card

**Symptoms**:
- Web card appears grayed out and doesn't respond to clicks

**Cause**:
- Web assistants are not yet available (coming soon)

**Solution**:
- This is expected! Web assistants will be enabled in a future release
- Use Voice or WhatsApp assistants in the meantime

---

## FAQs

### General Questions

**Q: Can I skip the onboarding?**

A: The onboarding appears automatically when you have zero assistants. Once you create your first assistant, it won't show again. There's no "skip" button because the onboarding IS the creation interface.

---

**Q: Can I see the onboarding again?**

A: The onboarding only displays when you have zero assistants. To see it again:
1. Delete all your assistants (use with caution!)
2. Refresh the `/assistants` page

---

**Q: How many assistants can I create?**

A: There's no hard limit, but your plan may have usage limits:
- **Free**: 1 assistant
- **Starter**: 5 assistants
- **Pro**: 20 assistants
- **Enterprise**: Unlimited

Check your account settings for current limits.

---

### Voice Assistant Questions

**Q: Which languages does the Voice assistant support?**

A: Currently, Voice assistants are optimized for **Spanish** (language: "es"). English support is planned for a future release.

---

**Q: Can I use my own ElevenLabs voices?**

A: Currently, the system uses a pre-configured ElevenLabs voice (`voiceId: 26MYCwqeqFSxt1nT7VgZ`). Custom voice selection will be added in a future update.

---

**Q: How do I assign a phone number to a Voice assistant?**

A: After creating the assistant:
1. Navigate to `Números` (Numbers) in the sidebar
2. Purchase or import a Twilio phone number
3. Assign the number to your assistant

---

### WhatsApp Assistant Questions

**Q: Do I need a WhatsApp Business account?**

A: Yes! You need a WhatsApp Business account to deploy a WhatsApp assistant. The QR code links your IntelliAA assistant to your WhatsApp Business number.

---

**Q: How long does WhatsApp deployment take?**

A: Typically 1-2 minutes. The process:
1. Assistant created in database
2. Railway backend deploys service
3. QR code generated for linking

---

**Q: Can multiple assistants share the same WhatsApp number?**

A: No. Each WhatsApp assistant requires a unique WhatsApp Business number.

---

### Template Questions

**Q: Can I edit a template after selecting it?**

A: Yes! Templates are starting points. After creation, you can:
1. Navigate to the assistant detail page
2. Edit the prompt, temperature, and other settings
3. Save changes

---

**Q: Can I create my own custom templates?**

A: Currently, templates are managed by admins only. Custom template creation for users is planned for a future release.

---

**Q: What's the difference between templates?**

A:
- **Atención al Cliente**: General customer service prompts, empathetic tone
- **Ventas**: Sales-focused, persuasive language, objection handling
- **Soporte Técnico**: Technical troubleshooting, step-by-step guidance
- **Custom**: Blank slate for advanced users

---

### Document/Knowledge Base Questions

**Q: When should I upload documents?**

A: Upload documents **after** creating your assistant:
1. Create assistant via onboarding
2. Navigate to `Documentos` (Documents)
3. Upload and link documents

---

**Q: What file formats are supported?**

A: Currently supported:
- PDF (.pdf)
- Text (.txt)
- Markdown (.md)

Coming soon: Word (.docx), Excel (.xlsx)

---

**Q: How large can my documents be?**

A: Maximum file size: **10 MB per file**. For larger documents, split them into smaller files.

---

**Q: How many documents can I upload?**

A: Depends on your plan:
- **Free**: 5 documents
- **Starter**: 25 documents
- **Pro**: 100 documents
- **Enterprise**: Unlimited

---

### Technical Questions

**Q: What AI model powers the assistants?**

A: All assistants use **OpenAI GPT-4o-mini** for language understanding and generation.

---

**Q: Can I self-host IntelliAA?**

A: IntelliAA is currently a hosted SaaS platform. Self-hosting is not available.

---

**Q: Is my data secure?**

A: Yes! We use:
- **Supabase Row Level Security (RLS)** for database isolation
- **Encryption at rest** for stored data
- **HTTPS** for all API communications
- **SOC 2 Type II** compliant infrastructure

---

**Q: Can I export my assistant configuration?**

A: Export/import functionality is planned for a future release.

---

## Support

### Getting Help

**In-App Support**:
- Click the `?` icon in the top-right corner
- Access help articles and FAQs

**Contact Support**:
- Email: support@intelliaa.com
- Live Chat: Available Mon-Fri, 9 AM - 6 PM (your timezone)

**Community**:
- Discord: [discord.gg/intelliaa](https://discord.gg/intelliaa)
- Forum: [community.intelliaa.com](https://community.intelliaa.com)

---

## Feedback

We'd love to hear your thoughts on the onboarding experience!

**Ways to Provide Feedback**:
1. **In-App Survey**: Complete the post-onboarding survey
2. **Email**: feedback@intelliaa.com
3. **Feature Requests**: [roadmap.intelliaa.com](https://roadmap.intelliaa.com)

**What to Include**:
- What you liked
- What was confusing
- Suggestions for improvement
- Screenshots (if applicable)

---

## Changelog

### Version 1.0 (2025-01-09)
- ✅ Initial release
- ✅ Three assistant type cards
- ✅ Template selection
- ✅ Quick start guide
- ✅ Create assistant button post-onboarding
- ✅ Fixed VAPI voiceId error

### Upcoming Features
- 🚧 Web assistant support
- 🚧 Custom template creation
- 🚧 Video tutorial in quick start
- 🚧 Progress tracking bar
- 🚧 Guided tour with tooltips

---

## Glossary

**Assistant**: An AI-powered conversational agent (Voice, WhatsApp, or Web)

**Template**: Pre-configured prompt and settings for specific use cases

**Onboarding**: First-time user experience for creating your first assistant

**Master-Detail**: Layout with list of assistants (master) and selected assistant details (detail)

**VAPI**: Voice AI Platform Interface - provider for voice assistants

**ElevenLabs**: Text-to-speech (TTS) provider for natural voice synthesis

**Deepgram**: Speech-to-text (STT) provider for transcription

**Railway**: Cloud infrastructure provider for WhatsApp backend

**RLS**: Row Level Security - database access control in Supabase

**Namespace**: Unique identifier for an assistant, used for data isolation

---

## Related Documentation

- [Implementation Plan](./implementation-plan.md)
- [Component Architecture](./component-architecture.md)
- [API Documentation](../VAPI/api-reference.md)
- [Database Schema](../supabase-schema.md)

---

**Last Updated**: 2025-01-09
**Version**: 1.0
**Status**: Published
