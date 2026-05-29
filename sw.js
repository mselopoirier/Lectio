// Lectio Service Worker — notifications quotidiennes (sans backend)
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
  if (e.data.type === 'TEST') sendNotif();
});

function startScheduler() {
  if (checkInterval) clearInterval(checkInterval);
  if (!enabled) return;
  // Check every minute if it's time
  checkInterval = setInterval(() => {
    const now = new Date();
    if (now.getHours() === scheduledHour && now.getMinutes() === 0) {
      const today = now.toDateString();
      const lastSent = self.__lastSent;
      if (lastSent !== today) {
        self.__lastSent = today;
        sendNotif();
      }
    }
  }, 60000);
}

async function sendNotif() {
  // Read data from all clients via localStorage — fallback to generic message
  const allClients = await self.clients.matchAll({ type: 'window' });
  let text = null;
  let title = '📖 Lectio';

  for (const client of allClients) {
    // Ask the client for a daily pick
    const pick = await new Promise(resolve => {
      const ch = new MessageChannel();
      ch.port1.onmessage = e => resolve(e.data);
      client.postMessage({ type: 'GET_DAILY' }, [ch.port2]);
      setTimeout(() => resolve(null), 1000);
    });
    if (pick) {
      if (pick.type === 'quote') { title = '💬 Citation du jour'; text = pick.text; }
      else { title = '📚 Mot du jour'; text = `${pick.word} — ${pick.definition}`; }
      break;
    }
  }

  if (!text) text = 'Ouvre Lectio pour découvrir ton inspiration du jour !';

  self.registration.showNotification(title, {
    body: text,
    icon: '/icon-512.png',
    badge: '/icon-192.png',
    tag: 'lectio-daily',
    renotify: true,
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    if (clients.length) return clients[0].focus();
    return self.clients.openWindow('/');
  }));
});
