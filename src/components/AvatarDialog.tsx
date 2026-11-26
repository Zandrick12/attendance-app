import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAction, type Profile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const VIEW = 280; // preview size in px
const OUT = 256; // saved image size in px
const MAX_SRC = 1024; // large photos are shrunk to this before editing

type Step = "choose" | "camera" | "edit";

export function Avatar({ profile, className = "size-10" }: { profile: Profile; className?: string }) {
  if (profile.avatar_url) {
    return <img src={profile.avatar_url} alt="" className={`${className} rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${className} flex items-center justify-center rounded-full bg-slate-900 font-semibold text-white`}
    >
      {profile.name.charAt(0).toUpperCase()}
    </span>
  );
}

function makeSource(el: HTMLImageElement | HTMLVideoElement, w: number, h: number, mirror = false) {
  const k = Math.min(1, MAX_SRC / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext("2d")!;
  if (mirror) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(el, 0, 0, c.width, c.height);
  return c;
}

function drawCrop(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  size: number,
  zoom: number,
  off: { x: number; y: number },
) {
  const k = size / VIEW;
  const s = (VIEW / Math.min(src.width, src.height)) * zoom * k;
  const dw = src.width * s;
  const dh = src.height * s;
  ctx.fillStyle = "#fff"; // transparent logos get a white background
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(src, size / 2 - dw / 2 + off.x * k, size / 2 - dh / 2 + off.y * k, dw, dh);
}

function clampOff(src: HTMLCanvasElement, zoom: number, off: { x: number; y: number }) {
  const s = (VIEW / Math.min(src.width, src.height)) * zoom;
  const mx = Math.max(0, (src.width * s - VIEW) / 2);
  const my = Math.max(0, (src.height * s - VIEW) / 2);
  return { x: Math.min(mx, Math.max(-mx, off.x)), y: Math.min(my, Math.max(-my, off.y)) };
}

export function AvatarDialog({
  open,
  onOpenChange,
  profile,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: Profile;
  onSaved: (url: string | null) => void;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [src, setSrc] = useState<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camFileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Start fresh every time the dialog opens
  useEffect(() => {
    if (open) {
      setStep("choose");
      setSrc(null);
      setZoom(1);
      setOff({ x: 0, y: 0 });
      setError("");
    }
  }, [open]);

  // Turn the camera off whenever we leave the camera step or close the dialog
  useEffect(() => {
    if (!open || step !== "camera") stopCamera();
  }, [open, step, stopCamera]);
  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (step === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [step]);

  // Redraw the preview
  useEffect(() => {
    if (step !== "edit" || !src || !canvasRef.current) return;
    drawCrop(canvasRef.current.getContext("2d")!, src, VIEW, zoom, off);
  }, [step, src, zoom, off]);

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      // e.g. a phone on plain http: the file picker with capture opens the camera app instead
      camFileRef.current?.click();
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setStep("camera");
    } catch {
      setError("Could not open the camera. Check the browser permission, or use Upload photo.");
    }
  }

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setSrc(makeSource(v, v.videoWidth, v.videoHeight, true));
    setZoom(1);
    setOff({ x: 0, y: 0 });
    setStep("edit");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("That image is too large (max 15 MB).");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      setSrc(makeSource(img, img.naturalWidth, img.naturalHeight));
      setZoom(1);
      setOff({ x: 0, y: 0 });
      setStep("edit");
    } catch {
      setError("That image couldn't be read. Try a JPG or PNG.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function changeZoom(z: number) {
    setZoom(z);
    if (src) setOff((o) => clampOff(src, z, o));
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !src) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setOff((o) => clampOff(src, zoom, { x: o.x + dx, y: o.y + dy }));
  }
  function onUp() {
    drag.current = null;
  }

  async function persist(url: string | null) {
    setSaving(true);
    setError("");
    const { error } = await supabase.rpc("set_my_avatar", { p_avatar: url });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await logAction(
      "UPDATE_PROFILE_PHOTO",
      `${profile.username} ${url ? "changed" : "removed"} their profile photo`,
    );
    onSaved(url);
    onOpenChange(false);
  }

  async function save() {
    if (!src) return;
    const out = document.createElement("canvas");
    out.width = OUT;
    out.height = OUT;
    drawCrop(out.getContext("2d")!, src, OUT, zoom, off);
    await persist(out.toDataURL("image/jpeg", 0.85));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile photo</DialogTitle>
        </DialogHeader>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <input
          ref={camFileRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={onFile}
        />

        {step === "choose" ? (
          <div className="space-y-4">
            <div className="flex justify-center py-2">
              <Avatar profile={profile} className="size-28 text-4xl" />
            </div>
            <div className="grid gap-2">
              <Button variant="outline" className="h-11 justify-start" onClick={startCamera}>
                <Camera className="size-4" /> Take photo
              </Button>
              <Button variant="outline" className="h-11 justify-start" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Upload photo or logo
              </Button>
              {profile.avatar_url ? (
                <Button
                  variant="outline"
                  className="h-11 justify-start text-destructive"
                  disabled={saving}
                  onClick={() => persist(null)}
                >
                  <Trash2 className="size-4" /> Remove photo
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              You can move and zoom the picture before saving. It is stored as a small 256×256 image.
            </p>
          </div>
        ) : null}

        {step === "camera" ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-square w-[280px] -scale-x-100 rounded-full bg-black object-cover"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("choose")}>
                Back
              </Button>
              <Button onClick={snap}>Capture</Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "edit" ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={VIEW}
                height={VIEW}
                style={{ width: VIEW, height: VIEW }}
                className="cursor-grab touch-none rounded-full border active:cursor-grabbing"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Zoom (drag the picture to move it)</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => changeZoom(Number(e.target.value))}
                className="w-full"
              />
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("choose")}>
                Back
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}