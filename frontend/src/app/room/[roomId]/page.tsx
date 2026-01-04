import VideoCall from "@/components/VideoCall";

type Props = {
  params: {
    roomId: string;
  };
};

export default function Room({ params }: Props) {
  const { roomId } = params;

  return (
    <div className="p-4 bg-black min-h-screen text-white">
      <VideoCall roomId={roomId} />
    </div>
  );
}
