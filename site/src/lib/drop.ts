// Drop state + catalog loaders — the owner's control surface, resolved at build time.
import dropJson from '../content/drop.json';
import piecesJson from '../content/pieces.json';
import vaultJson from '../content/vault.json';

export type DropState = 'live' | 'between';

export interface Piece {
  id: string;
  name: string;
  kind: string;
  kindShort: string;
  price: number;
  art: string;
  artW: string;
  tileArtMax: string;
  sized: boolean;
  category: 'wear' | 'paper';
  hero?: boolean;
  original?: boolean;
  desc: string;
  meta: string;
  note: string;
  underline: string;
}

export interface VaultPiece { id: string; img: string; name: string; sub: string; }

export const drop = {
  state: (dropJson.dropState === 'between' ? 'between' : 'live') as DropState,
  editionSize: dropJson.editionSize,
  left: Math.min(dropJson.dropLeft, dropJson.editionSize),
  nextDropDate: dropJson.nextDropDate,
};

export const isLive = drop.state === 'live';
export const isBetween = !isLive;
export const dropLow = drop.left <= Math.max(3, drop.editionSize * 0.2);
export const dropLeftShort = `${drop.left} left`;
export const dropLeftLabel = `${drop.left} of ${drop.editionSize} left`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function nextDropLabel(): string {
  const t = Date.parse(drop.nextDropDate);
  if (Number.isNaN(t)) return 'soon';
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export const pieces = piecesJson.pieces as Piece[];
export const pieceById = (id: string) => pieces.find((p) => p.id === id);

export const vault = vaultJson.pieces as VaultPiece[];
export const vaultStrip = vaultJson.strip
  .map((id) => vault.find((v) => v.id === id))
  .filter(Boolean) as VaultPiece[];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
export const money = (n: number) => `$${n}`;
