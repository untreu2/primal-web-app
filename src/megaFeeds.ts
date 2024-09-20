import { Kind } from "./constants";
import { getMegaFeed } from "./lib/feed";
import { setLinkPreviews } from "./lib/notes";
import { subsTo } from "./sockets";
import { isRepostInCollection } from "./stores/note";
import {
  MegaFeedPage,
  NostrEventContent,
  NostrMentionContent,
  NostrNoteActionsContent,
  NostrNoteContent,
  NostrStatsContent,
  NostrUserContent,
  NoteActions,
  PrimalArticle,
  PrimalNote,
  TopZap,
} from "./types/primal";
import { parseBolt11 } from "./utils";
import { convertToNotesMega, convertToReadsMega } from "./stores/megaFeed";
import { FeedRange } from "./pages/FeedQueryTest";

export type MegaFeedResults = { notes: PrimalNote[], reads: PrimalArticle[] };

export const fetchMegaFeed = (
  pubkey: string | undefined,
  specification: any,
  subId: string,
  paging?: {
    limit?: number,
    until?: number,
    since?: number,
    offset?: number,
  },
  excludeIds?: string[]
  ) => {
    return new Promise<MegaFeedResults>((resolve) => {
      let page: MegaFeedPage = {
        users: {},
        notes: [],
        reads: [],
        noteStats: {},
        mentions: {},
        noteActions: {},
        relayHints: {},
        topZaps: {},
        wordCount: {},
        since: 0,
        until: 0,
        sortBy: 'created_at',
      };

      const unsub = subsTo(subId, {
        onEose: () => {
          unsub();

          const notes = convertToNotesMega(page);
          const reads = convertToReadsMega(page);

          resolve({ notes, reads });
        },
        onEvent: (_, content) => {
          updatePage(content, excludeIds || []);
        }
      });

      const until = paging?.until || 0;
      const limit = paging?.limit || 0;

      getMegaFeed(pubkey, specification, subId, until, limit);

      const updatePage = (content: NostrEventContent, excludeIds: string[]) => {
        if (content.kind === Kind.FeedRange) {
          const feedRange: FeedRange = JSON.parse(content.content || '{}');

          page.since = feedRange.since;
          page.until = feedRange.until;
          page.sortBy = feedRange.order_by;
          return;
        }

        if (content.kind === Kind.Metadata) {
          const user = content as NostrUserContent;

          page.users[user.pubkey] = { ...user };
          return;
        }

        if ([Kind.Text, Kind.Repost].includes(content.kind)) {
          const message = content as NostrNoteContent;

          const isRepost = message.kind === Kind.Repost;

          const isAlreadyIn = message.kind === Kind.Text &&
            excludeIds.find(id => id === message.id);


          let isAlreadyReposted = isRepostInCollection(page.notes, message);

          if (isAlreadyIn || isAlreadyReposted) return;

          page.notes.push({ ...message });
          return;
        }

        if (content.kind === Kind.NoteStats) {
          const statistic = content as NostrStatsContent;
          const stat = JSON.parse(statistic.content);

          page.noteStats[stat.event_id] = { ...stat };
          return;
        }

        if (content.kind === Kind.Mentions) {
          const mentionContent = content as NostrMentionContent;
          const mention = JSON.parse(mentionContent.content);

          page.mentions[mention.id] = { ...mention};
          return;
        }

        if (content.kind === Kind.NoteActions) {
          const noteActionContent = content as NostrNoteActionsContent;
          const noteActions = JSON.parse(noteActionContent.content) as NoteActions;

          page.noteActions[noteActions.event_id] = { ...noteActions };
          return;
        }

        if (content.kind === Kind.LinkMetadata) {
          const metadata = JSON.parse(content.content);

          const data = metadata.resources[0];
          if (!data) {
            return;
          }

          const preview = {
            url: data.url,
            title: data.md_title,
            description: data.md_description,
            mediaType: data.mimetype,
            contentType: data.mimetype,
            images: [data.md_image],
            favicons: [data.icon_url],
          };

          setLinkPreviews(() => ({ [data.url]: preview }));
          return;
        }

        if (content?.kind === Kind.Zap) {
          const zapTag = content.tags.find(t => t[0] === 'description');

          if (!zapTag) return;

          const zapInfo = JSON.parse(zapTag[1] || '{}');

          let amount = '0';

          let bolt11Tag = content?.tags?.find(t => t[0] === 'bolt11');

          if (bolt11Tag) {
            try {
              amount = `${parseBolt11(bolt11Tag[1]) || 0}`;
            } catch (e) {
              const amountTag = zapInfo.tags.find((t: string[]) => t[0] === 'amount');

              amount = amountTag ? amountTag[1] : '0';
            }
          }

          const eventId = (zapInfo.tags.find((t: string[]) => t[0] === 'e') || [])[1];

          const zap: TopZap = {
            id: zapInfo.id,
            amount: parseInt(amount || '0'),
            pubkey: zapInfo.pubkey,
            message: zapInfo.content,
            eventId,
          };

          const oldZaps = page.topZaps[eventId];

          if (oldZaps === undefined) {
            page.topZaps[eventId] = [{ ...zap }];
            return;
          }

          if (oldZaps.find(i => i.id === zap.id)) {
            return;
          }

          const newZaps = [ ...oldZaps, { ...zap }].sort((a, b) => b.amount - a.amount);

          page.topZaps[eventId] = [ ...newZaps ];
          return;
        }
      };
    });
};
