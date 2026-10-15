import { Button, Box, Stack, Title, Text, Group } from '@mantine/core';
interface AboutViewProps {
  navigate: (view: string) => void;
}

export function AboutView({ navigate }: AboutViewProps) {
  return (
    <Box maw={600} mx="auto">
      <Button variant="default" size="xs" onClick={() => navigate('browse')} mb="md">&#8592; Back</Button>
      <Title order={1} size={36} c="var(--cv-brand)" ta="center">&#9833; ChordVault</Title>
      <Text ta="center" c="dimmed" mb="xl">Your chord sheet library</Text>

      <Stack gap="xs" mb="lg">
        <Title order={2} size="h4">Browse &amp; Search</Title>
        <Text c="dimmed" size="sm">Browse the full chord library without an account. Search by title or artist to find what you need.</Text>
      </Stack>

      <Stack gap="xs" mb="lg">
        <Title order={2} size="h4">Transpose &amp; Key Picker</Title>
        <Text c="dimmed" size="sm">Tap the key to open a picker with all 12 keys. Chords update instantly — no more counting semitones.</Text>
      </Stack>

      <Stack gap="xs" mb="lg">
        <Title order={2} size="h4">Number Notation</Title>
        <Text c="dimmed" size="sm">Toggle number notation (Nashville numbers) to see chords as 1, 4, 5 instead of C, F, G. Useful for playing in any key.</Text>
      </Stack>

      <Stack gap="xs" mb="lg">
        <Title order={2} size="h4">Setlists</Title>
        <Text c="dimmed" size="sm">Build setlists for worship sessions or gigs. Swipe or tap through songs, with per-song key and global settings for font size, multi-column layout, and more.</Text>
      </Stack>

      <Stack gap="xs" mb="lg">
        <Title order={2} size="h4">Multi-Column &amp; Font Size</Title>
        <Text c="dimmed" size="sm">Toggle multi-column layout to fit more on screen. Use the Fit button to automatically adjust columns and font size for your device. Great for tablets on a music stand.</Text>
      </Stack>

      <Stack gap="xs" mb="lg">
        <Title order={2} size="h4">With an Account</Title>
        <Text c="dimmed" size="sm">Sign in to add your own songs, build server-saved setlists, submit corrections to existing songs, and use photo-to-chords OCR.</Text>
      </Stack>

      <Group justify="center" mt="xl">
        <Button onClick={() => navigate('auth')}>Sign in</Button>
      </Group>
    </Box>
  );
}
