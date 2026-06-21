// Decode a data: URL (e.g. from a canvas capture) into a blob + mime type.
export function parsePhoto(
	dataUrl: string,
): { blob: Uint8Array; mime: string } | null {
	if (!dataUrl || !dataUrl.startsWith("data:")) return null;
	const [header, b64] = dataUrl.split(",");
	if (!b64) return null;
	const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
	const blob = new Uint8Array(Buffer.from(b64, "base64"));
	return { blob, mime };
}
