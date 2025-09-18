import type { StyleOption } from './types';
import { PictureBookStyle } from './types';

export const STYLES: StyleOption[] = [
  { id: PictureBookStyle.Watercolor, name: '水彩画風' },
  { id: PictureBookStyle.Crayon, name: 'クレヨン画風' },
  { id: PictureBookStyle.PopArt, name: 'ポップアート風' },
  { id: PictureBookStyle.Manga, name: '漫画風' },
  { id: PictureBookStyle.PixelArt, name: 'ピクセルアート風' },
  { id: PictureBookStyle.Fantasy, name: 'ファンタジー風' },
];

export const LOADING_MESSAGES: string[] = [
    'AIがお話のアイデアを考えています...',
    '主人公の冒険が始まりました...',
    '魔法の絵の具で色を塗っています...',
    'キャラクターに命を吹き込んでいます...',
    '素敵な絵本がもうすぐ完成します！',
];

export const STORY_CHAR_LIMIT = 200; // Adjusted for theme input