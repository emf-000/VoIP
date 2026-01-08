import VideoCall from "@/components/VideoCall";

type Props = {
  params: {
    roomId?: string;
  };
};

export default function Room({ params }: Props) {
  const roomId =
    typeof params?.roomId === "string" ? params.roomId : "";

  if (!roomId) {
    console.error(" Invalid roomId:", params?.roomId);
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Invalid Room
      </div>
    );
  }

  console.log(" Room page loaded with roomId:", roomId);

  return (
    <div className="p-4 bg-black min-h-screen text-white">
      <VideoCall roomId={roomId} />
    </div>
  );
}
