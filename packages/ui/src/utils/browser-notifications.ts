export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    // eslint-disable-next-line no-console
    console.warn('This browser does not support desktop notification');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const showNotification = async (title: string, body: string): Promise<void> => {
  const hasPermission = await requestNotificationPermission();

  if (!hasPermission) {
    return;
  }

  new Notification(title, {
    body,
  });
};
