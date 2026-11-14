import { sportsbookMarkUrl } from '@/features/games/detail/sportsbooks/marks';
import { sportsbookName } from '@/features/games/detail/sportsbooks/quotes';

/** Prop prices quote DraftKings, then FanDuel when DraftKings has no line. */
export function pickPropBook(books: Array<string | null | undefined>): 'draftkings' | 'fanduel' | null {
  const have = new Set(books.filter((book): book is string => Boolean(book)).map((book) => book.toLowerCase()));
  if (have.has('draftkings')) return 'draftkings';
  if (have.has('fanduel')) return 'fanduel';
  return null;
}

export function BookMark({ bookKey }: { bookKey: string }) {
  const src = sportsbookMarkUrl(bookKey);
  if (!src) return null;
  return <img className="book" src={src} alt={sportsbookName(bookKey)} />;
}
