import { ImagePlus } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

import { Button } from "./ui/Button.tsx";
import { cn } from "../lib/cn.ts";

type ImageUploadProps = {
  file: File | null;
  previewUrl: string | null;
  onFile: (file: File | null) => void;
};

export function ImageUpload({ file, previewUrl, onFile }: ImageUploadProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      onFile(accepted[0] ?? null);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    maxSize: 10 * 1024 * 1024,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-card border border-dashed p-6 text-center transition-colors duration-200",
          isDragActive ? "border-primary bg-card" : "border-border bg-card",
        )}
      >
        <input {...getInputProps()} />
        <ImagePlus className="mx-auto size-5 text-primary" strokeWidth={1.75} />
        <p className="mt-2 text-sm font-medium text-charcoal">Drop a chest X-ray, or click to browse</p>
        <p className="mt-1 text-xs text-muted">JPEG or PNG, up to 10 MB</p>
      </div>
      {previewUrl ? (
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <img src={previewUrl} alt="Uploaded chest X-ray preview" className="max-h-72 w-full object-contain" />
          <div className="flex items-center justify-between px-3 py-2 text-xs text-muted">
            <span className="truncate">{file?.name ?? "Selected image"}</span>
            <Button variant="text" size="sm" className="no-print h-8 px-2" onClick={() => onFile(null)}>
              Remove
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
