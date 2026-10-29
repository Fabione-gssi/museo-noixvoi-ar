export interface Passage { id: string; section: string; text: string; fonte?: string }
export function parseApprofondimento(src: string): { chiParla: string; passages: Passage[] };
