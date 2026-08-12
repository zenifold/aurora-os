import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Mic,
  Square,
  Pause,
  Play,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useCreateMeeting, useUpdateMeeting } from "@/hooks/use-meetings";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { analyzeMeetingTranscript } from "@/server/meeting-analysis.functions";
import { haptic } from "@/lib/haptics";

// Minimal types for the Web Speech API (not in lib.dom by default everywhere).
type SRAlt = { transcript: string };
type SRResult = { 0: SRAlt; isFinal: boolean; length: number };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SRErrorEvent = { error: string };
interface SRInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SRConstructor = new () => SRInstance;

function getSpeechRecognition(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultProjectId?: string | null;
}

export function MeetingRecorder({ open, onOpenChange, defaultProjectId }: Props) {
  const navigate = useNavigate();
  const ws = useWorkspaceStore((s) => s.current);
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const analyze = useServerFn(analyzeMeetingTranscript);

  const [title, setTitle] = useState("");
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [saving, setSaving] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const [permError, setPermError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SRInstance | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedTotalRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    setSttSupported(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    if (!open) cleanup();
    if (open && !title) {
      const d = new Date();
      setTitle(`Recording — ${d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cleanup = () => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    try {
      recognitionRef.current?.abort();
    } catch { /* noop */ }
    recognitionRef.current = null;
    try {
      mediaRef.current?.state !== "inactive" && mediaRef.current?.stop();
    } catch { /* noop */ }
    mediaRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setPaused(false);
    setElapsed(0);
    setFinalText("");
    setInterim("");
    setPermError(null);
    pausedTotalRef.current = 0;
    pausedAtRef.current = 0;
  };

  const startTick = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      if (paused) return;
      const ms = Date.now() - startedAtRef.current - pausedTotalRef.current;
      setElapsed(Math.max(0, Math.floor(ms / 1000)));
    }, 250);
  };

  const startRecognition = () => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onresult = (e) => {
      let interimChunk = "";
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0].transcript;
        if (res.isFinal) finalChunk += t + " ";
        else interimChunk += t;
      }
      if (finalChunk) setFinalText((p) => (p + finalChunk).replace(/\s+/g, " "));
      setInterim(interimChunk);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermError("Microphone access denied.");
      }
      // network errors auto-restart by onend
    };
    r.onend = () => {
      // Auto-restart if still recording (mobile browsers stop after silence)
      if (recordingRef.current && !pausedRef.current) {
        try { r.start(); } catch { /* noop */ }
      }
    };
    try {
      r.start();
      recognitionRef.current = r;
    } catch (err) {
      console.warn("Speech recognition start failed", err);
    }
  };

  // Refs for callbacks
  const recordingRef = useRef(false);
  const pausedRef = useRef(false);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const start = async () => {
    setPermError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Pick a broadly supported mime
      const mimeOptions = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const mime = mimeOptions.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.start(1000);
      mediaRef.current = mr;
      startedAtRef.current = Date.now();
      pausedTotalRef.current = 0;
      setRecording(true);
      setPaused(false);
      startTick();
      startRecognition();
      haptic("success");
    } catch (err) {
      setPermError(err instanceof Error ? err.message : "Cannot access microphone");
      toast.error("Microphone access denied");
    }
  };

  const togglePause = () => {
    const mr = mediaRef.current;
    if (!mr) return;
    if (paused) {
      try { mr.resume(); } catch { /* noop */ }
      pausedTotalRef.current += Date.now() - pausedAtRef.current;
      setPaused(false);
      startRecognition();
      haptic("tap");
    } else {
      try { mr.pause(); } catch { /* noop */ }
      pausedAtRef.current = Date.now();
      setPaused(true);
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      haptic("tap");
    }
  };

  const stopAndProcess = async () => {
    const mr = mediaRef.current;
    if (!mr) return;
    setSaving(true);
    haptic("long");

    // Stop recording, wait for last chunk
    const stopped = new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      try { mr.stop(); } catch { resolve(); }
    });
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    await stopped;
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const transcript = (finalText + " " + interim).trim();
    const blob = chunksRef.current.length
      ? new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" })
      : null;

    try {
      if (!ws) throw new Error("No workspace");
      // 1. Create meeting row
      const meeting = await createMeeting.mutateAsync({
        title: title.trim() || "Untitled recording",
        project_id: defaultProjectId ?? null,
        transcript_raw_text: transcript || null,
      });

      // 2. Upload audio (best-effort)
      if (blob) {
        const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
        const path = `${ws.id}/${meeting.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("meeting-recordings")
          .upload(path, blob, { contentType: blob.type, upsert: true });
        if (!upErr) {
          await updateMeeting.mutateAsync({
            id: meeting.id,
            patch: {
              audio_path: path,
              duration_seconds: elapsed,
              actual_start: new Date(startedAtRef.current).toISOString(),
              actual_end: new Date().toISOString(),
              platform: "mobile_recording",
            } as never,
          });
        } else {
          console.warn("Audio upload failed", upErr);
        }
      }

      toast.success("Recording saved");

      // 3. Auto-analyze if we have transcript
      if (transcript.length >= 20) {
        analyze({ data: { meeting_id: meeting.id } })
          .then((res) => {
            if (!res.ok) toast.error(res.error ?? "Analysis failed");
          })
          .catch(() => { /* noop, surfaced on detail page */ });
        toast.message("Analyzing transcript…", { icon: <Sparkles className="h-4 w-4" /> });
      }

      onOpenChange(false);
      cleanup();
      navigate({ to: "/app/meetings/$meetingId", params: { meetingId: meeting.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save recording");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[92vh] flex-col gap-0 p-0 sm:h-[86vh]">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-left text-base">Record meeting</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={recording}
                placeholder="Sprint planning"
              />
            </div>

            {/* Recording state */}
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-muted/30 py-6">
              <div className="relative flex h-24 w-24 items-center justify-center">
                {recording && !paused && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
                )}
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-full ${
                    recording
                      ? paused
                        ? "bg-amber-500"
                        : "bg-red-500"
                      : "bg-aura-gradient"
                  } text-white shadow-lg`}
                >
                  {recording ? (
                    paused ? <Pause className="h-8 w-8" /> : <Mic className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </div>
              </div>
              <div className="font-mono text-2xl tabular-nums">{fmt(elapsed)}</div>
              {recording && (
                <Badge variant={paused ? "outline" : "destructive"} className="gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {paused ? "Paused" : "Recording"}
                </Badge>
              )}

              {!recording ? (
                <Button
                  onClick={start}
                  disabled={saving}
                  size="lg"
                  className="bg-aura-gradient text-primary-foreground"
                >
                  <Mic className="mr-2 h-4 w-4" /> Start recording
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="lg" onClick={togglePause} disabled={saving}>
                    {paused ? <><Play className="mr-2 h-4 w-4" /> Resume</> : <><Pause className="mr-2 h-4 w-4" /> Pause</>}
                  </Button>
                  <Button
                    size="lg"
                    onClick={stopAndProcess}
                    disabled={saving}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4 fill-current" />}
                    Stop & analyze
                  </Button>
                </div>
              )}
            </div>

            {permError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">{permError}</div>
                  <div className="opacity-80">Allow microphone access in your browser settings, then try again.</div>
                </div>
              </div>
            )}

            {!sttSupported && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                Live transcription isn't supported on this browser. Audio will still be saved — you can paste a transcript or run analysis after upload.
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Live transcript</Label>
              <Textarea
                value={(finalText + (interim ? " " + interim : "")).trim()}
                onChange={(e) => { setFinalText(e.target.value); setInterim(""); }}
                rows={8}
                placeholder={sttSupported ? "Words will appear here as you speak…" : "You can type or paste a transcript here."}
                className="font-mono text-xs leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">
                Edits before you stop will be saved as your transcript.
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
