import { Component } from 'solid-js';
import styles from './Settings.module.scss';

import ThemeChooser from '../../components/ThemeChooser/ThemeChooser';
import { useIntl } from '@cookbook/solid-intl';
import { settings as t } from '../../translations';
import PageCaption from '../../components/PageCaption/PageCaption';
import { Link } from '@solidjs/router';
import PageTitle from '../../components/PageTitle/PageTitle';

const Appearance: Component = () => {

  const intl = useIntl();

  return (
    <div>
      <PageTitle title={`${intl.formatMessage(t.appearance.title)} ${intl.formatMessage(t.title)}`} />

      <PageCaption>
        <Link href='/settings' >{intl.formatMessage(t.index.title)}</Link>:&nbsp;
        <div>{intl.formatMessage(t.appearance.title)}</div>
      </PageCaption>

      <div class={styles.settingsCaption}>
        {intl.formatMessage(t.appearance.caption)}
      </div>

      <ThemeChooser />
    </div>
  )
}

export default Appearance;
