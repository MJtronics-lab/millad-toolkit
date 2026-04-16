// Notification Scheduling for Millads Toolkit
// Runs on every page — checks every 30s if a reminder is due

const DEFAULT_REMINDERS = {
  fruehstueck: { enabled: true, hour: 8, minute: 0, title: 'Frühstück & Supplements', body: 'Vit D, Magnesium, Omega 3 nicht vergessen', day: null },
  wasser: { enabled: true, hour: 15, minute: 0, title: 'Wasser-Check', body: 'Schon 4 Gläser getrunken?', day: null },
  feierabend: { enabled: true, hour: 17, minute: 55, title: 'Feierabend in 5 Min', body: 'Arbeit sauber abschließen, gleich raus an die Luft', day: null },
  winddown: { enabled: true, hour: 20, minute: 45, title: 'Wind Down in 15 Min', body: 'Gleich Handy weg, letzte Mahlzeit', day: null },
  adhkar: { enabled: true, hour: 21, minute: 0, title: 'Adhkar-Zeit', body: 'Geräte weg, 10 Min Abend-Adhkar', day: null },
  wochencheck: { enabled: true, hour: 20, minute: 0, title: 'Wochen-Check', body: 'Fitness 4x diese Woche geschafft?', day: 5 }
};

function getReminders() {
  try {
    const saved = localStorage.getItem('reminder_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = {};
      for (const key of Object.keys(DEFAULT_REMINDERS)) {
        merged[key] = { ...DEFAULT_REMINDERS[key], ...parsed[key] };
      }
      return merged;
    }
  } catch (e) {}
  return { ...DEFAULT_REMINDERS };
}

function saveReminders(reminders) {
  localStorage.setItem('reminder_settings', JSON.stringify(reminders));
}

function getFiredKey(id, now) {
  const dateStr = now.toISOString().slice(0, 10);
  return `fired_${id}_${dateStr}`;
}

function wasFiredToday(id) {
  const now = new Date();
  return localStorage.getItem(getFiredKey(id, now)) === '1';
}

function markFired(id) {
  const now = new Date();
  localStorage.setItem(getFiredKey(id, now), '1');
}

function cleanOldFired() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith('fired_') && !key.includes(todayStr) && !key.includes(yesterdayStr)) {
      localStorage.removeItem(key);
    }
  }
}

async function showNotification(title, body) {
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      reg.showNotification(title, {
        body: body,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [100, 50, 100],
        tag: 'toolkit-' + Date.now(),
        renotify: true
      });
    } else {
      new Notification(title, { body: body, icon: 'icon-192.png' });
    }
  } catch (e) {
    try {
      new Notification(title, { body: body, icon: 'icon-192.png' });
    } catch (e2) {}
  }
}

function checkReminders() {
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDay = now.getDay();
  const reminders = getReminders();

  for (const [id, r] of Object.entries(reminders)) {
    if (!r.enabled) continue;
    if (r.day !== null && r.day !== currentDay) continue;
    if (currentHour !== r.hour || currentMinute !== r.minute) continue;
    if (wasFiredToday(id)) continue;

    markFired(id);
    showNotification(r.title, r.body);
  }
}

function initNotifications() {
  cleanOldFired();
  checkReminders();
  setInterval(checkReminders, 30000);
}

function notificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function iosCanNotify() {
  return isIOS() && isStandalone() && 'Notification' in window;
}

async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    initNotifications();
  }
  return result;
}

function showPermissionBanner() {
  if (!notificationsSupported()) return;
  if (Notification.permission === 'granted') {
    initNotifications();
    return;
  }
  if (Notification.permission === 'denied') return;

  if (isIOS() && !isStandalone()) return;

  const banner = document.createElement('div');
  banner.id = 'notif-banner';
  banner.innerHTML = `
    <div style="
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: #1a2230; border-top: 1px solid #2a3445;
      padding: 16px 20px; display: flex; align-items: center; gap: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: slideUp 0.3s ease-out;
    ">
      <div style="font-size: 28px; flex-shrink: 0;">🔔</div>
      <div style="flex: 1;">
        <div style="font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 3px;">Erinnerungen aktivieren?</div>
        <div style="font-size: 13px; color: #8a96a3;">6 tägliche Erinnerungen für Supplements, Wasser, Feierabend & Adhkar</div>
      </div>
      <div style="display: flex; gap: 8px; flex-shrink: 0;">
        <button id="notif-later" style="
          background: transparent; border: 1px solid #3a4a5e; color: #8a96a3;
          padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer;
        ">Später</button>
        <button id="notif-allow" style="
          background: #4a90e2; border: none; color: #fff;
          padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
        ">Aktivieren</button>
      </div>
    </div>
    <style>@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }</style>
  `;
  document.body.appendChild(banner);

  document.getElementById('notif-allow').addEventListener('click', async () => {
    const result = await requestPermission();
    banner.remove();
    if (result === 'denied') {
      showDeniedHint();
    }
  });

  document.getElementById('notif-later').addEventListener('click', () => {
    banner.remove();
    sessionStorage.setItem('notif_dismissed', '1');
  });
}

function showDeniedHint() {
  const hint = document.createElement('div');
  hint.innerHTML = `
    <div style="
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: #1a2230; border-top: 1px solid #2a3445;
      padding: 16px 20px; text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <div style="font-size: 14px; color: #f5a623; margin-bottom: 6px;">Benachrichtigungen blockiert</div>
      <div style="font-size: 13px; color: #8a96a3;">Du kannst sie in den Browser-Einstellungen nachträglich aktivieren.</div>
      <button onclick="this.parentElement.parentElement.remove()" style="
        margin-top: 10px; background: transparent; border: 1px solid #3a4a5e;
        color: #8a96a3; padding: 6px 16px; border-radius: 8px; font-size: 13px; cursor: pointer;
      ">Verstanden</button>
    </div>
  `;
  document.body.appendChild(hint);
}

// Auto-init on page load
document.addEventListener('DOMContentLoaded', () => {
  if (Notification.permission === 'granted') {
    initNotifications();
  } else if (!sessionStorage.getItem('notif_dismissed')) {
    setTimeout(showPermissionBanner, 1500);
  }
});
