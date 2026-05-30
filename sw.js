// Lectio Service Worker — notifications quotidiennes
let scheduledHour = 8;
let enabled = false;
let checkInterval = null;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('message', e => {
  if (e.data.type === 'SCHEDULE') {
    scheduledHour = e.data.hour || 8;
    enabled = e.data.enabled || false;
    startScheduler();
  }
  if (e.data.type === 'TEST') {
    sendNotifFromClients();
  }
  if (e.data.type === 'GET_DAILY') {
    // handled by page
  }
});

function startScheduler() {
  if (checkInterval) clearInterval(checkInterval);
  if (!enabled) return;
  checkInterval = setInterval(() => {
    const now = new Date();
    if (now.getHours() === scheduledHour && now.getMinutes() === 0) {
      const today = now.toDateString();
      if (self.__lastSent !== today) {
        self.__lastSent = today;
        sendNotifFromClients();
      }
    }
  }, 60000);
}

async function sendNotifFromClients() {
  const allClients = await self.clients.matchAll({ type: 'window' });

  let pick = null;
  for (const client of allClients) {
    pick = await new Promise(resolve => {
      const ch = new MessageChannel();
      ch.port1.onmessage = e => resolve(e.data);
      client.postMessage({ type: 'GET_DAILY' }, [ch.port2]);
      setTimeout(() => resolve(null), 1500);
    });
    if (pick) break;
  }

  let title = '📖 Lectio';
  let body = 'Ouvre Lectio pour ton inspiration du jour !';

  if (pick) {
    if (pick.type === 'quote') {
      title = '💬 Citation du jour';
      body = pick.text;
    } else {
      title = '📚 Mot du jour';
      body = pick.word + ' — ' + pick.definition;
    }
  }

  await self.registration.showNotification(title, {
    body,
    icon: 'icon-512.png',
    badge: 'icon-192.png',
    tag: 'lectio-daily',
    renotify: true,
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) return clients[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
