import type { VideoBlock } from "@/lib/courseSchema";

function toEmbed(block: VideoBlock): string {
  const url = block.url;
  if (block.provider === "youtube") {
    // accept full URL or video id
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    const id = match?.[1] || url;
    return `https://www.youtube.com/embed/${id}`;
  }
  if (block.provider === "vimeo") {
    const id = url.match(/vimeo\.com\/(\d+)/)?.[1] || url;
    return `https://player.vimeo.com/video/${id}`;
  }
  return url;
}

export function VideoRunner({ block }: { block?: VideoBlock }) {
  if (!block?.url) return <p className="text-muted-foreground italic">Sin video.</p>;
  return (
    <div className="space-y-2">
      {block.title && <h4 className="font-semibold text-foreground">{block.title}</h4>}
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={toEmbed(block)}
          title={block.title || "Video"}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
