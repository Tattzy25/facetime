import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  RotateCcw, Maximize2, Minimize2, Grid, 
  Settings, Share, MoreHorizontal, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---
interface FaceTimeProps {
  onEndCall: () => void;
}

// --- Components ---

const IPhoneFrame = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative mx-auto h-[844px] w-[390px] overflow-hidden rounded-[60px] border-[8px] border-black bg-black shadow-2xl ring-1 ring-gray-800 scale-[0.75] sm:scale-[0.85] md:scale-100 origin-center">
      {/* Dynamic Island */}
      <div className="absolute top-2 left-1/2 z-50 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />
      
      {/* Screen Content */}
      <div className="h-full w-full bg-zinc-900 overflow-hidden relative">
        {children}
      </div>

      {/* Home Indicator */}
      <div className="absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-white/30" />
    </div>
  );
};

const StatusBar = () => {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-8 pt-4 text-white font-semibold text-sm">
      <span>{time}</span>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-4 border border-white/50 rounded-sm relative">
          <div className="absolute inset-[1px] bg-white rounded-[1px] w-[80%]" />
        </div>
        <div className="flex gap-0.5">
          <div className="h-2 w-0.5 bg-white" />
          <div className="h-2.5 w-0.5 bg-white" />
          <div className="h-3 w-0.5 bg-white" />
          <div className="h-3.5 w-0.5 bg-white/50" />
        </div>
      </div>
    </div>
  );
};

const ControlButton = ({ 
  icon: Icon, 
  label, 
  active = false, 
  danger = false, 
  onClick 
}: { 
  icon: any, 
  label?: string, 
  active?: boolean, 
  danger?: boolean,
  onClick?: () => void
}) => (
  <div className="flex flex-col items-center gap-2">
    <button 
      onClick={onClick}
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 active:scale-90",
        danger ? "bg-red-500 text-white" : active ? "bg-white text-black" : "bg-white/10 text-white backdrop-blur-xl"
      )}
    >
      <Icon size={24} fill={active ? "currentColor" : "none"} />
    </button>
    {label && <span className="text-[10px] font-medium text-white/70 uppercase tracking-widest">{label}</span>}
  </div>
);

export default function App() {
  const [isCalling, setIsCalling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Realtime API State
  const [status, setStatus] = useState('Idle');
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const startCall = async () => {
    setShowDisclaimer(false);
    setIsCalling(true);
    setStatus('Connecting...');

    try {
      // 1. Get ephemeral token
      const tokenResponse = await fetch('/api/session', { method: 'POST' });
      const data = await tokenResponse.json();
      const EPHEMERAL_KEY = data.client_secret.value;

      // 2. Setup Peer Connection
      const pc = new RTCPeerConnection();
      peerConnection.current = pc;

      // Handle remote audio/video
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      // Add local media
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: isFrontCamera ? 'user' : 'environment' }
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      // Setup Data Channel for tools and vision
      const dc = pc.createDataChannel('oai-events');
      dataChannel.current = dc;

      dc.onmessage = (e) => {
        const event = JSON.parse(e.data);
        console.log('Received event:', event);
        
        // Handle tool calls (e.g., generate tattoo)
        if (event.type === 'response.function_call_arguments.done') {
          handleToolCall(event);
        }
      };

      // WebRTC Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      const answer = { type: "answer" as const, sdp: await sdpResponse.text() };
      await pc.setRemoteDescription(answer);
      
      setStatus('Connected');

      // Start vision loop (screenshots every 1s)
      startVisionLoop();

    } catch (error) {
      console.error('Call failed:', error);
      setIsCalling(false);
      setStatus('Failed');
    }
  };

  const handleToolCall = async (event: any) => {
    const args = JSON.parse(event.arguments);
    if (event.name === 'generate_tattoo_design') {
      const response = await fetch('/api/tools/generate-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: args.prompt })
      });
      const data = await response.json();
      setGeneratedImage(data.imageUrl);
      
      // Send result back to model
      dataChannel.current?.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify({ success: true, imageUrl: data.imageUrl })
        }
      }));
      dataChannel.current?.send(JSON.stringify({ type: 'response.create' }));
    }
  };

  const startVisionLoop = () => {
    const interval = setInterval(() => {
      if (!isCalling || !localVideoRef.current || !canvasRef.current || !dataChannel.current) return;

      const canvas = canvasRef.current;
      const video = localVideoRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Capture at a reasonable resolution for vision
      canvas.width = 512;
      canvas.height = 512;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      
      // Send vision frame to model
      try {
        dataChannel.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_image',
                image: base64Image
              }
            ]
          }
        }));
        // We don't trigger a response every frame to avoid interrupting the AI
      } catch (e) {
        console.error('Failed to send vision frame:', e);
      }
    }, 500); // 500ms as requested

    return () => clearInterval(interval);
  };

  const endCall = () => {
    peerConnection.current?.close();
    setIsCalling(false);
    setGeneratedImage(null);
    setStatus('Idle');
  };

  return (
    <div className="h-screen w-full bg-white flex items-center justify-center overflow-hidden p-4 font-sans">
      <IPhoneFrame>
        <StatusBar />
        
        <AnimatePresence mode="wait">
          {!isCalling ? (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-zinc-950"
            >
              {!showDisclaimer ? (
                <>
                  <div className="mb-12">
                    <div className="h-24 w-24 rounded-3xl bg-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                      <Camera size={48} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">InkSight</h1>
                    <p className="text-zinc-400 text-sm">Professional Tattoo Consultation</p>
                  </div>

                  <div className="w-full space-y-4">
                    <button 
                      onClick={() => setShowDisclaimer(true)}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      <Video size={20} fill="currentColor" />
                      Start Consultation
                    </button>
                    <p className="text-[10px] text-zinc-500 px-4">
                      iOS 26 • Secure & Encrypted
                    </p>
                  </div>
                </>
              ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-8"
                  >
                    <div className="text-left space-y-4">
                      <h2 className="text-xl font-bold text-white">Consultation Disclaimer</h2>
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        This AI-powered consultation uses real-time visual analysis to suggest tattoo placements and designs. 
                        <br /><br />
                        • Designs are AI-generated concepts.<br />
                        • Camera data is processed in real-time.<br />
                        • Consult with a professional artist before tattooing.
                      </p>
                    </div>
                    <div className="w-full space-y-3">
                      <button 
                        onClick={startCall}
                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-semibold active:scale-95"
                      >
                        I Understand & Accept
                      </button>
                      <button 
                        onClick={() => setShowDisclaimer(false)}
                        className="w-full py-4 bg-white/10 text-white rounded-2xl font-semibold active:scale-95"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
            </motion.div>
          ) : (
            <motion.div 
              key="call"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="h-full w-full relative"
            >
              {/* Main Feed (Remote or Generated Design) */}
              <div className="absolute inset-0 bg-zinc-800">
                {generatedImage ? (
                  <motion.img 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    src={generatedImage} 
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="h-full w-full object-cover"
                  />
                )}
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
              </div>

              {/* PiP (Local Feed) */}
              <motion.div 
                drag
                dragConstraints={{ left: 12, right: 240, top: 60, bottom: 600 }}
                className="absolute top-16 right-4 h-48 w-32 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-30 bg-black"
              >
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={cn("h-full w-full object-cover", isFrontCamera && "-scale-x-100")}
                />
              </motion.div>

              {/* Call Info */}
              <div className="absolute top-16 left-6 z-20">
                <h2 className="text-white font-semibold text-lg drop-shadow-md">AI Consultant</h2>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-white/70 text-xs font-medium uppercase tracking-wider">{status}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="absolute bottom-12 left-0 right-0 px-6 flex flex-col gap-8 items-center z-40">
                <div className="grid grid-cols-4 gap-6 w-full max-w-xs">
                  <ControlButton 
                    icon={isMuted ? MicOff : Mic} 
                    label="Mute" 
                    active={isMuted}
                    onClick={() => setIsMuted(!isMuted)}
                  />
                  <ControlButton 
                    icon={isVideoOff ? VideoOff : Video} 
                    label="Video" 
                    active={isVideoOff}
                    onClick={() => setIsVideoOff(!isVideoOff)}
                  />
                  <ControlButton 
                    icon={RotateCcw} 
                    label="Flip" 
                    onClick={() => setIsFrontCamera(!isFrontCamera)}
                  />
                  <ControlButton 
                    icon={Grid} 
                    label="Layout" 
                  />
                </div>

                <div className="flex items-center gap-12">
                  <ControlButton 
                    icon={PhoneOff} 
                    danger 
                    onClick={endCall}
                  />
                </div>
              </div>

              {/* Hidden Canvas for Vision */}
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          )}
        </AnimatePresence>
      </IPhoneFrame>
    </div>
  );
}
