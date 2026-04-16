// Push Notification Client for Millads Toolkit
// Registers with push.mjtronics.de backend for server-side cron notifications

const PUSH_API = 'https://push.mjtronics.de';

function notificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function getVapidKey() {
  try {
    const res = await fetch(PUSH_API + '/vapid-key');
    const data = await res.json();
    return data.publicKey;
  } catch (e) {
    console.error('Failed to get VAPID key:', e);
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const vapidKey = await getVapidKey();
    if (!vapidKey) return null;

    let sub = await reg.pushManager.getSubscription();
    if (sub) return sub;

    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await fetch(PUSH_API + '/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });

    console.log('[Push] Subscribed successfully');
    return sub;
  } catch (e) {
    console.error('[Push] Subscribe failed:', e);
    return null;
  }
}

async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    await fetch(PUSH_API + '/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });

    await sub.unsubscribe();
    console.log('[Push] Unsubscribed');
  } catch (e) {
    console.error('[Push] Unsubscribe failed:', e);
  }
}

async function requestPermissionAndSubscribe() {
  if (!notificationsSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    await subscribeToPush();
  }
  return result;
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

function showPermissionBanner() {
  if (!notificationsSupported()) return;
  if (Notification.permission === 'granted') {
    subscribeToPush();
    return;
  }
  if (Notification.permission === 'denied') return;
  if (isIOS() && !isStandalone()) return;
  if (sessionStorage.getItem('notif_dismissed')) return;

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
        <div style="font-size: 13px; color: #8a96a3;">6 tägliche Erinnerungen — auch wenn die App geschlossen ist</div>
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
    const result = await requestPermissionAndSubscribe();
    banner.remove();
    if (result === 'denied') showDeniedHint();
  });

  document.getElementById('notif-later').addEventListener('click', () => {
    banner.remove();
    sessionStorage.setItem('notif_dismissed', '1');
  });
}

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
  if (!notificationsSupported()) return;
  if (Notification.permission === 'granted') {
    subscribeToPush();
  } else if (Notification.permission !== 'denied') {
    setTimeout(showPermissionBanner, 1500);
  }
});
