/** The web recorder hands back a blob: URL; let the browser free it. */
export function discardTempRecording(uri: string) {
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}
