# INT-41: Update ElevenLabs Voice Catalog with Enhanced Previews

**Epic**: INT-39 - Voice Assistant VAPI Integration Modernization
**Priority**: P1 - Should Have
**Estimate**: 3-5 points (Medium)
**Labels**: frontend, voice, elevenlabs, ui

## User Story

As an IntelliAA user configuring a voice assistant, I want to browse the latest ElevenLabs voice catalog with audio previews and detailed metadata, so that I can choose the perfect voice for my assistant's personality.

## Acceptance Criteria

### AC1: Voice Catalog Display
**Given** I am configuring voice settings
**When** I open the voice selector
**Then** I see a grid of 50+ ElevenLabs voices with avatar, name, language, accent, and gender tags

### AC2: Audio Preview with Custom Text
**Given** I want to preview a voice
**When** I click "Preview" on a voice card
**Then** I hear the voice speaking customizable sample text (default: "Hello, I'm your AI assistant")

### AC3: Voice Metadata Display
**Given** I view a voice card
**When** examining the details
**Then** I see: name, age/gender tags, accent, language(s), voice description, and use case recommendations

### AC4: Voice Comparison Feature
**Given** I shortlist 3 voices
**When** I click "Compare"
**Then** I see a side-by-side comparison with all metadata and ability to play all previews simultaneously

### AC5: Voice Search and Filter
**Given** I'm looking for a specific voice type
**When** I use filters (gender, accent, age, language)
**Then** the catalog updates in real-time to show only matching voices

### AC6: Favorite Voices
**Given** I frequently use certain voices
**When** I click the star icon on a voice
**Then** it's saved to my favorites and appears at the top of the catalog

### AC7: Voice Settings Preview
**Given** I adjust speed, stability, or clarity settings
**When** I change a slider
**Then** I can instantly preview how the voice sounds with the new settings

## Technical Notes

### ElevenLabs API Integration
```typescript
// src/services/elevenlabsService.ts
import { ElevenLabsClient } from 'elevenlabs';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function getVoiceCatalog() {
  const voices = await client.voices.getAll();
  
  return voices.voices.map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    category: voice.category,
    description: voice.description,
    labels: voice.labels, // { accent, description, age, gender, use_case }
    previewUrl: voice.preview_url,
    settings: voice.settings, // stability, similarity_boost, style, use_speaker_boost
  }));
}

export async function generateVoicePreview(
  voiceId: string,
  text: string,
  settings?: VoiceSettings
) {
  const audio = await client.textToSpeech.convert(voiceId, {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: settings || {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    },
  });

  return audio; // ArrayBuffer
}
```

### Voice Catalog Component
```typescript
// src/components/intelliaa/assistants/voice/VoiceCatalog.tsx
export function VoiceCatalog({ onSelect, selectedVoiceId }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [filters, setFilters] = useState({
    gender: 'all',
    accent: 'all',
    language: 'all',
  });
  const [previewText, setPreviewText] = useState('Hello, I\'m your AI assistant');
  const [favorites, setFavorites] = useState<string[]>([]);

  const filteredVoices = useMemo(() => {
    return voices.filter((voice) => {
      if (filters.gender !== 'all' && voice.labels.gender !== filters.gender) return false;
      if (filters.accent !== 'all' && voice.labels.accent !== filters.accent) return false;
      if (filters.language !== 'all' && !voice.labels.language?.includes(filters.language)) return false;
      return true;
    });
  }, [voices, filters]);

  // Sort favorites first
  const sortedVoices = [
    ...filteredVoices.filter((v) => favorites.includes(v.id)),
    ...filteredVoices.filter((v) => !favorites.includes(v.id)),
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Input
          placeholder="Preview text..."
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          className="max-w-md"
        />
        <Select value={filters.gender} onValueChange={(v) => setFilters({ ...filters, gender: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
        {/* More filters... */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedVoices.map((voice) => (
          <VoiceCard
            key={voice.id}
            voice={voice}
            previewText={previewText}
            isSelected={selectedVoiceId === voice.id}
            isFavorite={favorites.includes(voice.id)}
            onSelect={onSelect}
            onToggleFavorite={(id) => toggleFavorite(id)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Voice Card Component
```typescript
interface VoiceCardProps {
  voice: Voice;
  previewText: string;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (voiceId: string) => void;
  onToggleFavorite: (voiceId: string) => void;
}

function VoiceCard({ voice, previewText, isSelected, isFavorite, onSelect, onToggleFavorite }: VoiceCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePreview = async () => {
    setIsPlaying(true);
    const audioBuffer = await generateVoicePreview(voice.id, previewText);
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(blob);
    
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      await audioRef.current.play();
    }
    setIsPlaying(false);
  };

  return (
    <Card className={cn(isSelected && 'border-primary border-2')}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <Avatar className="w-12 h-12">
            <AvatarImage src={voice.avatarUrl} />
            <AvatarFallback>{voice.name[0]}</AvatarFallback>
          </Avatar>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleFavorite(voice.id)}
          >
            <Star className={cn('w-4 h-4', isFavorite && 'fill-yellow-400 text-yellow-400')} />
          </Button>
        </div>
        <CardTitle>{voice.name}</CardTitle>
        <CardDescription className="line-clamp-2">{voice.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1 mb-4">
          {voice.labels.gender && <Badge variant="outline">{voice.labels.gender}</Badge>}
          {voice.labels.accent && <Badge variant="outline">{voice.labels.accent}</Badge>}
          {voice.labels.age && <Badge variant="outline">{voice.labels.age}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={isPlaying}
          >
            {isPlaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Preview
          </Button>
          <Button size="sm" onClick={() => onSelect(voice.id)}>
            Select
          </Button>
        </div>
        <audio ref={audioRef} className="hidden" />
      </CardContent>
    </Card>
  );
}
```

### Voice Comparison Modal
```typescript
export function VoiceComparisonModal({ voiceIds, onClose }) {
  const voices = useVoices(voiceIds);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Compare Voices</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4">
          {voices.map((voice) => (
            <div key={voice.id} className="space-y-4">
              <h3 className="font-semibold">{voice.name}</h3>
              <VoiceMetadataTable voice={voice} />
              <Button onClick={() => playPreview(voice.id)}>
                <Play className="w-4 h-4 mr-2" />
                Preview
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## Definition of Done

- [ ] ElevenLabs API integration created
- [ ] Voice catalog displays 50+ voices
- [ ] Audio preview working with custom text
- [ ] Voice metadata displayed (gender, accent, age, description)
- [ ] Comparison feature functional for 2-3 voices
- [ ] Search and filtering working
- [ ] Favorites system implemented with persistence
- [ ] Voice settings preview (speed, stability, clarity)
- [ ] Responsive design verified
- [ ] Accessibility verified (keyboard controls, ARIA labels)
- [ ] Performance optimized (lazy loading, audio caching)
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-40 (VAPI v2 API with ElevenLabs integration)
- ElevenLabs API key and sufficient quota
- Audio playback in browser

## Related Stories

- **Depends on**: INT-40 (VAPI v2 migration)
- **Enhances**: INT-38 (Configuration step voice selection)
- **Related**: Voice assistant configuration UI
