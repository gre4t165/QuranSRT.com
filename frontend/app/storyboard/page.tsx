import StoryboardTimeline from "../components/StoryboardTimeline";

export const metadata = {
  title: "AI Storyboard Creator — QuranSRT",
  description:
    "Ubah premis atau transkrip menjadi storyboard bernarasi lengkap dengan gambar, voiceover, dan video MP4.",
};

export default function StoryboardPage() {
  return (
    <main className="min-h-screen">
      <StoryboardTimeline />
    </main>
  );
}
