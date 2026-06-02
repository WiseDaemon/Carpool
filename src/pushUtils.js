// Base64 to Uint8Array converter
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported.');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Get VAPID public key from backend
    const res = await fetch('http://localhost:3001/api/push/vapid-public-key', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch VAPID public key');
    const { publicKey } = await res.json();

    const convertedVapidKey = urlBase64ToUint8Array(publicKey);

    const pushSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    // Send subscription to backend
    const subRes = await fetch('http://localhost:3001/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(pushSubscription)
    });
    
    if (!subRes.ok) throw new Error('Failed to save subscription on server');
    
    return true;
  } catch (error) {
    console.error('Error subscribing to push notifications', error);
    return false;
  }
}

export async function unsubscribeFromPush(token) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      
      // Delete from backend
      await fetch('http://localhost:3001/api/push/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error unsubscribing from push notifications', error);
    return false;
  }
}
