import { useRef } from "react";
import { Button } from "@/components/ui/button.tsx";

interface ImportBarProps {
  importName: string | null;
  error: string | null;
  onFile: (file: File) => void;
  onSample: () => void;
  onClear: () => void;
}

export function ImportBar({ importName, error, onFile, onSample, onClear }: ImportBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json,application/zip,.zip"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
        Import JSON
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onSample}>
        Load sample
      </Button>
      {importName ? (
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Use bundled graph
        </Button>
      ) : null}
      {importName ? <span className="text-[11px] text-muted-foreground">{importName}</span> : null}
      {error ? (
        <p role="alert" data-testid="import-error" className="basis-full text-right text-[11px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
