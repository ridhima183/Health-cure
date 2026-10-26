import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

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
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
          isDragActive ? "border-primary bg-teal-tint/60" : "border-border bg-ivory"
        }`}
      >
        <input {...getInputProps()} />
        <p className="font-medium text-charcoal">Drop a chest X-ray here, or click to browse</p>
        <p className="mt-1 text-sm text-muted">JPEG or PNG, up to 10 MB</p>
      </div>
      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <img src={previewUrl} alt="Uploaded chest X-ray preview" className="max-h-72 w-full object-contain" />
          <div className="flex items-center justify-between px-4 py-2 text-sm text-muted">
            <span>{file?.name ?? "Selected image"}</span>
            <button type="button" className="text-accent no-print" onClick={() => onFile(null)}>
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
