import { A } from '@solidjs/router';
import { batch, Component, For, Match, Show, Switch } from 'solid-js';
import { PrimalNote, ZapOption } from '../../types/primal';
import ParsedNote from '../ParsedNote/ParsedNote';
import NoteFooter from './NoteFooter/NoteFooter';

import styles from './Note.module.scss';
import { TopZap, useThreadContext } from '../../contexts/ThreadContext';
import { useIntl } from '@cookbook/solid-intl';
import { hookForDev } from '../../lib/devTools';
import Avatar from '../Avatar/Avatar';
import NoteAuthorInfo from './NoteAuthorInfo';
import NoteRepostHeader from './NoteRepostHeader';
import NoteReplyToHeader from './NoteReplyToHeader';
import NoteHeader from './NoteHeader/NoteHeader';
import { createStore, unwrap } from 'solid-js/store';
import { CustomZapInfo, useAppContext } from '../../contexts/AppContext';
import NoteContextTrigger from './NoteContextTrigger';
import { date, longDate, veryLongDate } from '../../lib/dates';
import { hexToNpub } from '../../lib/keys';

export type NoteFooterState = {
  likes: number,
  liked: boolean,
  reposts: number,
  reposted: boolean,
  replies: number,
  replied: boolean,
  zapCount: number,
  satsZapped: number,
  zappedAmount: number,
  zapped: boolean,
  zappedNow: boolean,
  isZapping: boolean,
  showZapAnim: boolean,
  hideZapIcon: boolean,
  isRepostMenuVisible: boolean,
};

const Note: Component<{
  note: PrimalNote,
  id?: string,
  parent?: boolean,
  shorten?: boolean,
  noteType?: 'feed' | 'primary' | 'notification'
}> = (props) => {

  const threadContext = useThreadContext();
  const app = useAppContext();
  const intl = useIntl();

  const noteType = () => props.noteType || 'feed';

  const repost = () => props.note.repost;

  const navToThread = (note: PrimalNote) => {
    threadContext?.actions.setPrimaryNote(note);
  };

  const [footerState, updateFooterState] = createStore({
    likes: props.note.post.likes,
    liked: props.note.post.noteActions.liked,
    reposts: props.note.post.reposts,
    reposted: props.note.post.noteActions.reposted,
    replies: props.note.post.replies,
    replied: props.note.post.noteActions.replied,
    zapCount: props.note.post.zaps,
    satsZapped: props.note.post.satszapped,
    zapped: props.note.post.noteActions.zapped,
    zappedAmount: 0,
    zappedNow: false,
    isZapping: false,
    showZapAnim: false,
    hideZapIcon: false,
    isRepostMenuVisible: false,
  });

  let noteContextMenu: HTMLDivElement | undefined;

  const onConfirmZap = (zapOption: ZapOption) => {
    app?.actions.closeCustomZapModal();
    batch(() => {
      updateFooterState('zappedAmount', () => zapOption.amount || 0);
      updateFooterState('zappedNow', () => true);
      updateFooterState('zapped', () => true);
      updateFooterState('showZapAnim', () => true)
    });
  };

  const onSuccessZap = (zapOption: ZapOption) => {
    app?.actions.closeCustomZapModal();
    batch(() => {
      updateFooterState('isZapping', () => false);
      updateFooterState('zappedNow', () => false);
      updateFooterState('showZapAnim', () => false);
      updateFooterState('hideZapIcon', () => false);
      updateFooterState('zapped', () => true);
    });
  };

  const onFailZap = (zapOption: ZapOption) => {
    app?.actions.closeCustomZapModal();
    batch(() => {
      updateFooterState('zappedAmount', () => -(zapOption.amount || 0));
      updateFooterState('isZapping', () => false);
      updateFooterState('zappedNow', () => true);
      updateFooterState('showZapAnim', () => false);
      updateFooterState('hideZapIcon', () => false);
      updateFooterState('zapped', () => props.note.post.noteActions.zapped);
    });
  };

  const onCancelZap = (zapOption: ZapOption) => {
    app?.actions.closeCustomZapModal();
    batch(() => {
      updateFooterState('zappedAmount', () => -(zapOption.amount || 0));
      updateFooterState('isZapping', () => false);
      updateFooterState('zappedNow', () => true);
      updateFooterState('showZapAnim', () => false);
      updateFooterState('hideZapIcon', () => false);
      updateFooterState('zapped', () => props.note.post.noteActions.zapped);
    });
  };

  const customZapInfo: CustomZapInfo = {
    note: props.note,
    onConfirm: onConfirmZap,
    onSuccess: onSuccessZap,
    onFail: onFailZap,
    onCancel: onCancelZap,
  };

  const openReactionModal = (openOn = 'likes') =>  {
    app?.actions.openReactionModal(props.note.post.id, {
      likes: footerState.likes,
      zaps: footerState.zapCount,
      reposts: footerState.reposts,
      quotes: 0,
      openOn,
    });
  };

  const onContextMenuTrigger = () => {
    app?.actions.openContextMenu(
      props.note,
      noteContextMenu?.getBoundingClientRect(),
      () => {
        app?.actions.openCustomZapModal(customZapInfo);
      },
      openReactionModal,
    );
  }

  const reactionSum = () => {
    const { likes, zaps, reposts } = props.note.post;

    return (likes || 0) + (zaps || 0) + (reposts || 0);
  };

  const firstZap = () => (threadContext?.topZaps[props.note.post.id] || [])[0];

  const topZaps = () => {
    return (threadContext?.topZaps[props.note.post.id] || []).slice(1, 8);
  }

  const zapSender = (zap: TopZap) => {
    return threadContext?.users.find(u => u.pubkey === zap.sender);
  }

  return (
    <Switch>
      <Match when={noteType() === 'notification'}>
        <A
          id={props.id}
          class={styles.noteNotificationLink}
          href={`/e/${props.note?.post.noteId}`}
          onClick={() => navToThread(props.note)}
          data-event={props.note.post.id}
          data-event-bech32={props.note.post.noteId}
        >
          <div class={styles.noteNotifications}>
            <div class={styles.content}>
              <div class={styles.message}>
                <ParsedNote note={props.note} shorten={true} />
              </div>

              <div class={styles.footer}>
                <NoteFooter
                  note={props.note}
                  state={footerState}
                  updateState={updateFooterState}
                  customZapInfo={customZapInfo}
                />
              </div>
            </div>
          </div>
        </A>
      </Match>

      <Match when={noteType() === 'primary'}>
        <div
          id={props.id}
          class={styles.notePrimary}
          data-event={props.note.post.id}
          data-event-bech32={props.note.post.noteId}
        >
          <div class={styles.border}></div>

          <NoteHeader note={props.note} primary={true} />

          <div class={styles.upRightFloater}>
            <NoteContextTrigger
              ref={noteContextMenu}
              onClick={onContextMenuTrigger}
            />
          </div>

          <div class={styles.content}>

            <div class={styles.message}>
              <ParsedNote note={props.note} width={Math.min(574, window.innerWidth)} />
            </div>

            <div class={styles.zapHighlights}>
              <Show when={firstZap()}>
                <A class={styles.firstZap} href={`/p/${hexToNpub(firstZap().sender)}`}>
                  <Avatar user={zapSender(firstZap())} size="micro" />
                  <div class={styles.amount}>
                    {firstZap().amount_sats.toLocaleString()}
                  </div>
                  <div class={styles.description}>
                  </div>
                </A>
              </Show>
              <div class={styles.topZaps}>
                <div class={styles.zapList}>
                  <For each={topZaps()}>
                    {zap => (
                      <A class={styles.topZap} href={`/p/${hexToNpub(zap.sender)}`}>
                        <Avatar user={zapSender(zap)} size="micro" />
                        <div class={styles.amount}>
                          {zap.amount_sats.toLocaleString()}
                        </div>
                      </A>
                    )}
                  </For>
                </div>

                <Show when={topZaps().length > 0}>
                  <button
                    class={styles.moreZaps}
                    onClick={() => openReactionModal('zaps')}
                  >
                    <div class={styles.contextIcon}></div>
                  </button>
                </Show>
              </div>
            </div>


            <div
              class={styles.time}
              title={date(props.note.post?.created_at).date.toLocaleString()}
            >
              <span>
                {veryLongDate(props.note.post?.created_at).replace('at', '·')}
              </span>
              <button
                class={styles.reactSummary}
                onClick={() => openReactionModal()}
              >
                <span class={styles.number}>{reactionSum()}</span> Reactions
              </button>
            </div>

            <NoteFooter
              note={props.note}
              state={footerState}
              updateState={updateFooterState}
              customZapInfo={customZapInfo}
              wide={true}
              large={true}
            />
          </div>
        </div>
      </Match>

      <Match when={noteType() === 'feed'}>

        <A
          id={props.id}
          class={`${styles.note} ${props.parent ? styles.parent : ''}`}
          href={`/e/${props.note?.post.noteId}`}
          onClick={() => navToThread(props.note)}
          data-event={props.note.post.id}
          data-event-bech32={props.note.post.noteId}
          draggable={false}
        >
          <div class={styles.header}>
            <Show when={repost()}>
              <NoteRepostHeader note={props.note} />
            </Show>
          </div>
          <div class={styles.content}>
            <div class={styles.leftSide}>
              <A href={`/p/${props.note.user.npub}`}>
                <Avatar user={props.note.user} size="vs" />
              </A>
              <Show
                when={props.parent}
              >
                <div class={styles.ancestorLine}></div>
              </Show>
            </div>

            <div class={styles.rightSide}>
              <NoteAuthorInfo
                author={props.note.user}
                time={props.note.post.created_at}
              />

              <div class={styles.upRightFloater}>
                <NoteContextTrigger
                  ref={noteContextMenu}
                  onClick={onContextMenuTrigger}
                />
              </div>

              <NoteReplyToHeader note={props.note} />

              <div class={styles.message}>
                <ParsedNote
                  note={props.note}
                  shorten={props.shorten}
                  width={Math.min(528, window.innerWidth - 72)}
                />
              </div>

              <NoteFooter
                note={props.note}
                state={footerState}
                updateState={updateFooterState}
                customZapInfo={customZapInfo}
              />
            </div>
          </div>
        </A>
      </Match>
    </Switch>
  );
}

export default hookForDev(Note);
