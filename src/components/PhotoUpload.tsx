"use client";
import { useRef, useState } from "react";

/** File input that shrinks photos in the browser (max 1600px JPEG) before the form is sent. */
export function PhotoUpload({ name = "photo", label, multiple = false }: { name?: string; label: string; multiple?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  async function shrink(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) return file;
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.84));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  }

  return (
    <label className="upload">
      <input
        ref={input}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple={multiple}
        required
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []).slice(0, multiple ? 8 : 1);
          if (!files.length) return setStatus("");
          setStatus("Foto voorbereiden…");
          try {
            const small = await Promise.all(files.map(shrink));
            const dt = new DataTransfer();
            small.forEach((f) => dt.items.add(f));
            input.current!.files = dt.files;
            setStatus(small.length === 1 ? `${small[0].name} · ${Math.round(small[0].size / 1024)} kB` : `${small.length} foto's klaar`);
          } catch {
            setStatus(files.length === 1 ? files[0].name : `${files.length} foto's`);
          }
        }}
      />
      <span className="upload-box">
        <b>{label}</b>
        <span className="small muted">{status || "Tik om een foto te kiezen (jpg, png of webp)"}</span>
      </span>
    </label>
  );
}
