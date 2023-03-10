import { effect, signal } from '@preact/signals-core';
import MagicBell from 'magicbell';
import * as vscode from 'vscode';

import { contextKeys, signalKeys } from './constants';
import { commands } from './lib/commands';
import { Messenger } from './lib/messenger';
import { NotificationHandler } from './notifications/notification-handler';
import { NotificationSync } from './notifications/notification-sync';

const config = vscode.workspace.getConfiguration('ping');
const magicbell = new MagicBell({
  apiKey: process.env.MB_API_KEY,
  userExternalId: config.get('username') ?? '',
  userHmac: config.get('userHmac'),
  appInfo: {
    name: 'ping-vscode',
    version: process.env.PING_VERSION,
  },
});

export const activeNotification = signal<string | null>(null);
export const notifications = signal<Array<any>>([]);

export function init() {
  const notificationHandler = new NotificationHandler(notifications);
  const sync = new NotificationSync(notificationHandler, notifications, magicbell);

  sync.pull();
}

export function bindSignals(messenger: Messenger) {
  messenger.bindSignal(signalKeys.ACTIVE_NOTIFICATION, activeNotification);
  messenger.bindSignal(signalKeys.NOTIFICATIONS, notifications);

  messenger.on('toast', async (data) => {
    return vscode.window.showInformationMessage(data.message, ...data.action);
  });

  messenger.on('archive', async (notificationId) => {
    notifications.value = notifications.value.filter((n) => n.id !== notificationId);
    await magicbell.notifications.archive(notificationId);
  });

  messenger.on('open-url', async (url) => {
    vscode.env.openExternal(vscode.Uri.parse(url));
  });
}

effect(() => {
  if (!activeNotification.value) {
    commands.clearContext(contextKeys.ACTIVE_NOTIFICATION);
    commands.clearContext('textInputFocus');
    return;
  }

  
  commands.setContext(contextKeys.ACTIVE_NOTIFICATION, activeNotification.value);
  commands.setContext('textInputFocus', true);
  // commands.showDetailPane(); Intentionally disabled.
  commands.showList();
});
