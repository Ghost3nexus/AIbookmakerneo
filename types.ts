

export enum PictureBookStyle {
  Watercolor = '水彩画風',
  Crayon = 'クレヨン画風',
  PopArt = 'ポップアート風',
  Manga = '漫画風',
  PixelArt = 'ピクセルアート風',
  Fantasy = 'ファンタジー風',
}

export interface StyleOption {
  id: PictureBookStyle;
  name: string;
}

export interface OriginalImage {
  base64: string;
  mimeType: string;
}

export interface BookPage {
  id: number;
  text: string;
  imageUrl: string;
  originalImages: OriginalImage[];
}

export enum AppStep {
  Input,
  Loading,
  Preview,
}