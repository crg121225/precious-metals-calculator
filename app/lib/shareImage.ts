// Helpers for getting a finished image off the phone or computer. Nothing is uploaded:
// the image is made in the browser and the owner chooses where it goes.

export const canvasToBlob = (canvas: HTMLCanvasElement, type = 'image/png', quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** True when the phone's own share menu can take image files (needs an https site). */
export const canShareImageFiles = (): boolean => {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File([''], 'test.png', { type: 'image/png' })] })
    );
  } catch {
    return false;
  }
};

/** Opens the share menu. Returns an error message, or '' if it worked or the user closed the menu. */
export const shareImageFile = async (blob: Blob, fileName: string, text: string): Promise<string> => {
  try {
    await navigator.share({ files: [new File([blob], fileName, { type: blob.type })], text });
    return '';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return '';
    return "Couldn't open the share menu. Use Save image instead.";
  }
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Copies text to the clipboard. Returns true on success (needs an https site on phones). */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/** Wraps text into lines that fit a width. Returns at most maxLines lines, adding … if cut. */
export const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
};
